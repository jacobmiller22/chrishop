#!/usr/bin/env python3
"""
ChrisShop Autonomous Adversarial Backlog Grooming & Refinement Auditor
Inspects repository state, GitHub issues, and architectural alignment.
Optionally queries Claude Opus or Gemini to generate adversarial critique.
Zero external pip dependencies (pure Python standard library).
"""

import argparse
import datetime
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path


def run_command(cmd, cwd=None, check=True):
    """Run shell command safely and return stdout."""
    res = subprocess.run(
        cmd,
        cwd=cwd,
        shell=isinstance(cmd, str),
        capture_output=True,
        text=True,
    )
    if check and res.returncode != 0:
        raise RuntimeError(f"Command failed ({res.returncode}): {cmd}\n{res.stderr}")
    return res.stdout.strip(), res.stderr.strip(), res.returncode


def get_repo_root():
    """Find git repository root."""
    try:
        stdout, _, _ = run_command(["git", "rev-parse", "--show-toplevel"])
        return Path(stdout)
    except Exception:
        return Path.cwd()


def fetch_github_issues():
    """Fetch issues via gh CLI."""
    cmd = [
        "gh",
        "issue",
        "list",
        "--state",
        "all",
        "--limit",
        "200",
        "--json",
        "number,title,state,labels,body,updatedAt",
    ]
    stdout, stderr, code = run_command(cmd, check=False)
    if code != 0:
        print(f"⚠️ Warning: 'gh issue list' failed: {stderr}", file=sys.stderr)
        return []
    try:
        return json.loads(stdout)
    except json.JSONDecodeError:
        print("⚠️ Warning: Failed to parse GitHub issues JSON", file=sys.stderr)
        return []


def audit_completed_deliverables(issues, repo_root):
    """Adversarially audit closed issues against files on disk."""
    findings = []
    closed_issues = [i for i in issues if i.get("state") == "CLOSED"]

    path_pattern = re.compile(r"[`'\"]([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9]+)[`'\"]")

    for issue in closed_issues:
        body = issue.get("body") or ""
        mentioned_files = set(path_pattern.findall(body))
        
        # Filter to paths that resemble project paths
        candidate_paths = [
            f for f in mentioned_files
            if any(f.startswith(prefix) for prefix in ("apps/", "packages/", "infra/", "docs/", ".github/", ".agents/"))
            and not f.endswith((".png", ".jpg", ".svg", ".ico"))
        ]

        missing_files = []
        for file_path in candidate_paths:
            full_path = repo_root / file_path
            if not full_path.exists():
                missing_files.append(file_path)

        if missing_files:
            findings.append({
                "issue_number": issue.get("number"),
                "title": issue.get("title"),
                "type": "missing_deliverables",
                "missing_files": missing_files,
            })

    return findings


def analyze_unblocked_and_gaps(issues):
    """Analyze open issues for prerequisites, shovel-readiness, and missing criteria."""
    closed_numbers = {i["number"] for i in issues if i.get("state") == "CLOSED"}
    open_issues = [i for i in issues if i.get("state") == "OPEN"]
    
    shovel_ready = []
    blocked_issues = []
    needs_refinement = []

    dep_pattern = re.compile(r"(?:Prerequisites|Depends on|prerequisite):\s*([#\d\s,]+)", re.IGNORECASE)

    for issue in open_issues:
        num = issue["number"]
        title = issue["title"]
        body = issue.get("body") or ""
        labels = [l["name"] for l in issue.get("labels", [])]

        # Check for needs-refinement or creator-review
        if "needs-refinement" in labels or len(body.strip()) < 80:
            needs_refinement.append({
                "number": num,
                "title": title,
                "reason": "Explicit needs-refinement label or very short description",
            })
            continue

        if "creator-review" in labels:
            blocked_issues.append({
                "number": num,
                "title": title,
                "reason": "Requires Creator (Chris) vision sign-off",
            })
            continue

        # Check dependencies
        dep_match = dep_pattern.search(body)
        unmet_deps = []
        if dep_match:
            raw_deps = dep_match.group(1)
            deps = [int(n) for n in re.findall(r"\d+", raw_deps)]
            for d in deps:
                if d not in closed_numbers:
                    unmet_deps.append(d)

        if unmet_deps:
            blocked_issues.append({
                "number": num,
                "title": title,
                "reason": f"Prerequisites open: {', '.join(f'#{d}' for d in unmet_deps)}",
            })
        else:
            shovel_ready.append({
                "number": num,
                "title": title,
                "labels": labels,
            })

    return shovel_ready, blocked_issues, needs_refinement


def call_agy_adversary(summary_prompt):
    """
    Invoke Antigravity CLI ('agy') non-interactively using the user's active plan/subscription.
    Zero-config: No ANTHROPIC_API_KEY or GEMINI_API_KEY required.
    """
    candidates = [
        shutil.which("agy"),
        str(Path.home() / ".local" / "bin" / "agy"),
        "/opt/homebrew/bin/agy",
        "/usr/local/bin/agy",
    ]
    agy_bin = next((p for p in candidates if p and Path(p).is_file() and os.access(p, os.X_OK)), None)

    if not agy_bin:
        return None

    print(f"🤖 Invoking Antigravity CLI ('agy') via active plan for adversarial backlog review...")
    system_instruction = (
        "You are an adversarial Technical Project Auditor and Principal Architect on ChrisShop. "
        "Challenge existing plans, identify failure modes (race conditions, drop spikes, webhook idempotency, "
        "data migrations, missing glue code), propose concrete new stories, and escalate low-confidence decisions."
    )
    full_prompt = f"{system_instruction}\n\n{summary_prompt}"

    try:
        res = subprocess.run(
            [agy_bin, "--dangerously-skip-permissions", "-p", full_prompt],
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            timeout=180,
        )
        if res.returncode == 0 and res.stdout.strip():
            return res.stdout.strip()
        elif res.stderr.strip():
            print(f"⚠️ Warning: agy CLI reported: {res.stderr.strip()}", file=sys.stderr)
    except subprocess.TimeoutExpired:
        print("⚠️ Warning: agy CLI execution timed out after 180s", file=sys.stderr)
    except Exception as e:
        print(f"⚠️ Warning: Failed to execute agy CLI: {e}", file=sys.stderr)

    return None


def call_llm_adversary(summary_prompt, model="claude-3-opus-20240229"):
    """
    Adversarial reasoning query prioritizing Antigravity CLI ('agy') for zero-config execution,
    falling back to Anthropic API or Gemini API if explicit keys are provided.
    """
    # 1. Prioritize Antigravity CLI ('agy') using user's active plan
    agy_critique = call_agy_adversary(summary_prompt)
    if agy_critique:
        return agy_critique

    # 2. Fall back to Anthropic API if key is present
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    gemini_key = os.environ.get("GEMINI_API_KEY")

    if anthropic_key:
        print(f"🤖 Invoking Anthropic Claude ({model}) for adversarial backlog review...")
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": anthropic_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {
            "model": model,
            "max_tokens": 3000,
            "system": (
                "You are an adversarial Technical Project Auditor and Principal Architect on ChrisShop. "
                "Challenge existing plans, identify failure modes (race conditions, drop spikes, webhook idempotency, "
                "data migrations, missing glue code), propose concrete new stories, and escalate low-confidence decisions."
            ),
            "messages": [
                {"role": "user", "content": summary_prompt}
            ],
        }
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=90) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                blocks = res_data.get("content", [])
                text_parts = [b["text"] for b in blocks if b.get("type") == "text"]
                return "\n".join(text_parts)
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8")
            return f"Anthropic API error ({e.code}): {err_msg}"
        except Exception as e:
            return f"Anthropic API connection failure: {e}"

    elif gemini_key:
        print("🤖 Invoking Google Gemini for adversarial backlog review...")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key={gemini_key}"
        headers = {"content-type": "application/json"}
        payload = {
            "contents": [{
                "parts": [{"text": summary_prompt}]
            }]
        }
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=90) as response:
                res_data = json.loads(response.read().decode("utf-8"))
                candidates = res_data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    return "\n".join(p.get("text", "") for p in parts)
                return "Gemini returned empty response"
        except Exception as e:
            return f"Gemini API failure: {e}"

    return None


def generate_refinement_report(repo_root, issues, missing_deliverables, shovel_ready, blocked, needs_refinement, llm_critique=None):
    """Build markdown report."""
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S %Z")
    
    total_issues = len(issues)
    open_count = len([i for i in issues if i.get("state") == "OPEN"])
    closed_count = len([i for i in issues if i.get("state") == "CLOSED"])

    lines = [
        f"# 🛡️ ChrisShop Adversarial Backlog Refinement Report",
        f"**Generated**: {timestamp}",
        f"**Monorepo**: `{repo_root}`",
        f"",
        f"## 1. Backlog Health Overview",
        f"- **Total Issues**: {total_issues}",
        f"- **Closed Issues (Completed)**: {closed_count}",
        f"- **Open Issues (Outstanding)**: {open_count}",
        f"- **Shovel-Ready Candidates**: {len(shovel_ready)}",
        f"- **Blocked Issues**: {len(blocked)}",
        f"- **Issues Needing Refinement**: {len(needs_refinement)}",
        f"",
    ]

    # Section 2: Missing Deliverables Audit
    lines.append("## 2. Adversarial Codebase Audit (Closed Stories vs Files on Disk)")
    if not missing_deliverables:
        lines.append("✅ **Zero discrepancies detected**: All referenced files in closed issues exist on disk.")
    else:
        lines.append("⚠️ **Potential Missing Deliverables Found in Closed Issues**:")
        for item in missing_deliverables:
            lines.append(f"- **Issue #{item['issue_number']} ({item['title']})**:")
            for f in item["missing_files"]:
                lines.append(f"  - ❌ Missing: `{f}`")
    lines.append("")

    # Section 3: Shovel-ready stories
    lines.append("## 3. Shovel-Ready Unblocked Stories")
    if shovel_ready:
        for s in shovel_ready[:8]:
            labels_str = ", ".join(s["labels"]) if s["labels"] else "no labels"
            lines.append(f"- **#{s['number']}**: {s['title']} `[{labels_str}]`")
    else:
        lines.append("⚠️ No unblocked stories found. Check blocked items below.")
    lines.append("")

    # Section 4: Blocked & Needing Refinement
    lines.append("## 4. Blocked & Incomplete Stories")
    if needs_refinement:
        lines.append("### Needs Refinement / Decomposition:")
        for r in needs_refinement:
            lines.append(f"- **#{r['number']}**: {r['title']} ({r['reason']})")
    if blocked:
        lines.append("### Blocked by Prerequisites:")
        for b in blocked[:10]:
            lines.append(f"- **#{b['number']}**: {b['title']} — _{b['reason']}_")
    lines.append("")

    # Section 5: LLM Adversarial Review
    if llm_critique:
        lines.append("## 5. Adversarial Architectural Critique & Course Corrections (AI Review)")
        lines.append(llm_critique)
        lines.append("")
    else:
        lines.append("## 5. AI Reasoning Notice")
        lines.append(
            "> [!NOTE]\n"
            "> Automated AI critique via Antigravity CLI (`agy`) or API keys was skipped or not detected.\n"
            "> Ensure `agy` is installed in `~/.local/bin/agy` (zero config) or set `ANTHROPIC_API_KEY` in `~/.chrishop/refinement.env`."
        )
        lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="ChrisShop Adversarial Backlog Grooming Auditor")
    parser.add_argument("--output", "-o", help="Path to save report markdown", default=None)
    parser.add_argument("--model", help="Claude model name", default="claude-3-opus-20240229")
    parser.add_argument("--no-llm", action="store_true", help="Skip remote LLM critique")
    args = parser.parse_args()

    repo_root = get_repo_root()
    print(f"🔍 Analyzing ChrisShop backlog in {repo_root}...")

    issues = fetch_github_issues()
    if not issues:
        print("❌ Could not fetch GitHub issues. Verify 'gh auth status'.", file=sys.stderr)
        sys.exit(1)

    missing_deliverables = audit_completed_deliverables(issues, repo_root)
    shovel_ready, blocked, needs_refinement = analyze_unblocked_and_gaps(issues)

    llm_critique = None
    if not args.no_llm:
        hld_path = repo_root / "docs" / "HIGH_LEVEL_DESIGN.md"
        hld_text = hld_path.read_text()[:4000] if hld_path.exists() else ""
        
        prompt = (
            f"Here is a summary of the ChrisShop e-commerce backlog:\n"
            f"- Total issues: {len(issues)}\n"
            f"- Shovel-ready: {[s['number'] for s in shovel_ready]}\n"
            f"- Blocked: {[b['number'] for b in blocked]}\n"
            f"- Needing refinement: {[n['number'] for n in needs_refinement]}\n\n"
            f"High Level Design excerpt:\n{hld_text}\n\n"
            f"Please conduct an adversarial review:\n"
            f"1. Identify hidden architecture risks or missing glue code.\n"
            f"2. Suggest specific new stories to create.\n"
            f"3. Note low-confidence questions needing creator input.\n"
            f"Keep recommendations punchy, concrete, and actionable."
        )
        llm_critique = call_llm_adversary(prompt, model=args.model)

    report = generate_refinement_report(
        repo_root=repo_root,
        issues=issues,
        missing_deliverables=missing_deliverables,
        shovel_ready=shovel_ready,
        blocked=blocked,
        needs_refinement=needs_refinement,
        llm_critique=llm_critique,
    )

    if args.output:
        out_path = Path(args.output).expanduser()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(report)
        print(f"📄 Report written to {out_path}")

    print("\n" + report)


if __name__ == "__main__":
    main()
