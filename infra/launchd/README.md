# Launchd Daemon Decommission Notice

The ChrisShop background `launchd` daemon (`com.chrishop.backlog-refinement`) has been **decommissioned** and replaced with a unified, high-speed, on-demand TypeScript CLI auditor.

### On-Demand Replacement:

Run the roadmap and backlog audit on-demand whenever needed:

```bash
pnpm run audit:roadmap
```

Or invoke it directly via the Project Management skill:
```bash
/project-management roadmap audit
```

### Decommissioned Artifacts:
- `com.chrishop.backlog-refinement.plist`
- `install.sh`
- `refinement-runner.sh`
- `refinement_audit.py` (logic consolidated into `scripts/audit-roadmap.ts`)
