# agents/ -- Base Agent Definitions

## Purpose

Contains markdown-based agent role definitions (Layer 1: the HOW) for all agent types in the overstory swarm system. Each file defines a complete agent persona with role description, capabilities, workflow, constraints, and failure modes.

## Technology

- Markdown with structured sections
- Consumed by `src/agents/overlay.ts` which merges base definitions with per-task overlays

## Contents

| File | Description |
|------|-------------|
| `builder.md` | Implementation agent -- writes code, runs tests, commits to worktree branch |
| `coordinator.md` | Top-level orchestrator (depth 0) -- spawns leads, manages runs |
| `lead.md` | Team lead (depth 1) -- spawns sub-workers (scouts, builders, reviewers) |
| `merger.md` | Branch merge specialist -- merges agent branches with tiered conflict resolution |
| `monitor.md` | Tier 2 continuous fleet patrol agent -- monitors agent health |
| `reviewer.md` | Read-only validation agent -- reviews code without modifications |
| `scout.md` | Read-only exploration agent -- investigates codebase, writes specs |
| `supervisor.md` | Per-project supervisor (depth 1) -- manages workers for a specific project |

## Key Functions

Not applicable -- these are markdown definition files, not code modules.

## Data Types

Agent capability hierarchy:
- **coordinator** (depth 0): Can spawn leads and supervisors
- **supervisor** (depth 1): Can spawn scouts, builders, reviewers, mergers
- **lead** (depth 1): Can spawn scouts, builders, reviewers
- **builder** (depth 2): Leaf node, writes code
- **scout** (depth 2): Leaf node, read-only exploration
- **reviewer** (depth 2): Leaf node, read-only validation
- **merger** (depth 2): Leaf node, merges branches
- **monitor** (depth 0): Persistent, no worktree

## Logging

Not applicable.

## CRUD Entry Points

- **Create:** Add a new `.md` file following the structure of existing definitions
- **Read:** Loaded by `src/agents/overlay.ts:generateOverlay()` via `Bun.file()`
- **Update:** Edit the markdown file directly; changes apply to all future spawns
- **Delete:** Remove the `.md` file and update `agent-manifest.json`

## Style Guide

Agent definitions follow a standardized section structure:

1. Title and intro paragraph
2. `## Role` -- what the agent does
3. `## Capabilities` -- tools, communication, expertise subsections
4. `## Workflow` -- numbered step-by-step instructions
5. `## Constraints` -- hard rules
6. `## Communication Protocol` -- mail patterns
7. `## Propulsion Principle` -- anti-procrastination directive
8. `## Failure Modes` -- named anti-patterns
9. `## Cost Awareness` -- token efficiency
10. `## Completion Protocol` -- shutdown checklist
