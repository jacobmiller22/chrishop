#!/usr/bin/env python3
"""
Find top shovel-ready user stories for parallel autonomous execution.
Evaluates open issues against dependencies, labels, phase order, and priority.
"""

import argparse
import json
import re
import subprocess
import sys

PHASE_ORDER = {
    'epic:phase-1': 1,
    'epic:phase-2': 2,
    'epic:phase-3': 3,
    'epic:phase-4': 4,
    'epic:phase-5': 5,
    'epic:phase-6': 6,
}

PRIORITY_ORDER = {
    'priority:critical': 0,
    'priority:high': 1,
    'priority:medium': 2,
    'priority:low': 3,
}

def get_issues(repo):
    open_res = subprocess.check_output(
        ['gh', 'issue', 'list', '--repo', repo, '--state', 'open', '--limit', '200',
         '--json', 'number,title,labels,milestone,body,assignees']
    )
    open_issues = json.loads(open_res.decode('utf-8'))

    closed_res = subprocess.check_output(
        ['gh', 'issue', 'list', '--repo', repo, '--state', 'closed', '--limit', '200',
         '--json', 'number']
    )
    closed_numbers = set(i['number'] for i in json.loads(closed_res.decode('utf-8')))
    return open_issues, closed_numbers

def is_shovel_ready(issue, closed_numbers):
    labels = [l['name'] for l in issue.get('labels', [])]
    
    # Skip blocked, in-progress, completed (PR awaiting merge), or touchpoint review stories
    if 'blocked' in labels:
        return False, "Has 'blocked' label"
    if 'status:in-progress' in labels:
        return False, "Already 'in-progress'"
    if 'status:completed' in labels:
        return False, "Already completed (PR awaiting merge)"
    if 'creator-review' in labels:
        return False, "Human Creator Review touchpoint"
    if 'needs-refinement' in labels:
        return False, "Needs refinement"
    if issue.get('assignees'):
        return False, f"Already assigned to {issue['assignees']}"

    # Check dependency declarations in body
    body = issue.get('body', '') or ''
    # Matches patterns like: Blocked by Issue #12, Blocked by #12, Depends on #12
    dep_matches = re.findall(r'(?:blocked by|depends on)(?: issue)?\s*#(\d+)', body, re.IGNORECASE)
    unresolved_blockers = [int(n) for n in dep_matches if int(n) not in closed_numbers]
    if unresolved_blockers:
        return False, f"Blocked by open issues: {unresolved_blockers}"

    return True, "Shovel-ready"

def extract_model_recommendation(body):
    if not body:
        return "Medium", "Gemini 3.8 Flash (Medium Thinking)"
    match = re.search(r'\*\*Thinking Level\*\*:\s*([A-Za-z]+)', body, re.IGNORECASE)
    level = match.group(1).capitalize() if match else "Medium"
    model_match = re.search(r'\*\*Recommended Model\*\*:\s*([^\n]+)', body, re.IGNORECASE)
    model_desc = model_match.group(1).strip() if model_match else f"Gemini 3.8 Flash ({level} Thinking)"
    return level, model_desc

def rank_key(issue):
    labels = [l['name'] for l in issue.get('labels', [])]
    
    # Priority rank (0 to 3, default 99) - PRIMARY SORT
    prio_rank = 99
    for l in labels:
        if l in PRIORITY_ORDER:
            prio_rank = min(prio_rank, PRIORITY_ORDER[l])

    # Phase rank (1 to 6, default 99) - SECONDARY SORT
    phase_rank = 99
    for l in labels:
        if l in PHASE_ORDER:
            phase_rank = min(phase_rank, PHASE_ORDER[l])
            
    return (prio_rank, phase_rank, issue['number'])

def main():
    parser = argparse.ArgumentParser(description="Find shovel-ready ChrisShop stories")
    parser.add_argument("--repo", default="jacobmiller22/chrishop", help="Target repository")
    parser.add_argument("--limit", type=int, default=4, help="Maximum candidates to return (default: 4)")
    parser.add_argument("--min-priority", choices=['critical', 'high', 'medium', 'low'], default=None,
                        help="Filter candidates to minimum priority level")
    parser.add_argument("--json", action="store_true", help="Output raw JSON array")
    args = parser.parse_args()

    open_issues, closed_numbers = get_issues(args.repo)

    candidates = []
    skipped = []

    for issue in open_issues:
        ready, reason = is_shovel_ready(issue, closed_numbers)
        if ready:
            if args.min_priority:
                max_rank = PRIORITY_ORDER[f'priority:{args.min_priority}']
                labels = [l['name'] for l in issue.get('labels', [])]
                issue_prio = min([PRIORITY_ORDER[l] for l in labels if l in PRIORITY_ORDER] or [99])
                if issue_prio > max_rank:
                    continue
            candidates.append(issue)
        else:
            skipped.append((issue['number'], issue['title'], reason))

    candidates.sort(key=rank_key)
    selected = candidates[:args.limit]

    if args.json:
        output = [
            {
                "number": i["number"],
                "title": i["title"],
                "labels": [l["name"] for l in i.get("labels", [])],
                "milestone": (i.get("milestone") or {}).get("title"),
                "thinking_level": extract_model_recommendation(i.get("body", ""))[0],
                "recommended_model": extract_model_recommendation(i.get("body", ""))[1],
                "body": i.get("body", "")
            }
            for i in selected
        ]
        print(json.dumps(output, indent=2))
        return

    print(f"============================================================")
    print(f" ChrisShop Orchestrator: Top {len(selected)} Shovel-Ready Stories")
    print(f"============================================================\n")

    for rank, issue in enumerate(selected, 1):
        labels = [l['name'] for l in issue.get('labels', [])]
        phase = next((l for l in labels if l.startswith('epic:')), 'No Phase')
        prio = next((l for l in labels if l.startswith('priority:')), 'No Priority')
        size = next((l for l in labels if l.startswith('size:')), 'No Size')
        thinking_level, rec_model = extract_model_recommendation(issue.get('body', ''))
        print(f"[{rank}] Issue #{issue['number']}: {issue['title']}")
        print(f"    Phase: {phase} | Priority: {prio} | Size: {size} | Thinking: {thinking_level}")
        print(f"    Model: {rec_model}")
        print(f"    URL: https://github.com/{args.repo}/issues/{issue['number']}")
        print()

    if not selected:
        print("No shovel-ready stories found! All open issues may be blocked, in-progress, or under review.")

if __name__ == "__main__":
    main()
