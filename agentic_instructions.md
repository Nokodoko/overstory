# overstory/ -- Project Root

## Purpose

Project-agnostic swarm system for Claude Code agent orchestration. Overstory turns a single Claude Code session into a multi-agent team by spawning worker agents in git worktrees via tmux, coordinating them through a custom SQLite mail system, and merging their work back with tiered conflict resolution. The CLI provides 30 subcommands for the full lifecycle: init, spawn, communicate, monitor, merge, and clean.

## Technology

- **Runtime:** Bun (runs TypeScript directly, no build step)
- **Language:** TypeScript with strict mode (`noUncheckedIndexedAccess`, `noExplicitAny`)
- **Linting:** Biome (tab indentation, 100-char line width)
- **Runtime dependencies:** Zero. Only Bun built-in APIs (`bun:sqlite`, `Bun.spawn`, `Bun.file`)
- **Dev dependencies:** `@types/bun`, `typescript`, `@biomejs/biome`
- **External CLIs:** `bd` (beads issue tracking), `mulch` (structured expertise), `git`, `tmux`
- **Testing:** `bun test` with colocated test files

## Contents

| File/Directory | Description |
|----------------|-------------|
| `src/` | All TypeScript source code -- CLI entry point, types, config, commands, subsystems |
| `agents/` | Base agent definition markdown files (the HOW -- 8 agent roles) |
| `templates/` | Code generation templates for overlays and hooks (`{{PLACEHOLDER}}` syntax) |
| `scripts/` | Build and release scripts (version bumping) |
| `package.json` | Project metadata, scripts, zero runtime dependencies |
| `tsconfig.json` | TypeScript config: ES2022, strict, bundler module resolution |
| `biome.json` | Biome config: tab indentation, 100-char width, enforced rules |

## Key Abstractions

> Use this section to route to the correct subdirectory documentation.

| Concept | Where to look |
|---------|---------------|
| CLI entry point, command routing | `src/agentic_instructions.md` -> `src/index.ts` |
| All shared types and interfaces | `src/agentic_instructions.md` -> `src/types.ts` |
| Configuration loading and validation | `src/agentic_instructions.md` -> `src/config.ts` |
| Error class hierarchy | `src/agentic_instructions.md` -> `src/errors.ts` |
| Command handlers (30 subcommands) | `src/commands/agentic_instructions.md` |
| Agent manifest, overlay, identity, hooks | `src/agents/agentic_instructions.md` |
| Base agent role definitions (builder, scout, lead, etc.) | `agents/agentic_instructions.md` |
| Template files for overlays and hooks | `templates/agentic_instructions.md` |
| Git worktree and tmux session management | `src/worktree/agentic_instructions.md` |
| SQLite mail system (inter-agent messaging) | `src/mail/agentic_instructions.md` |
| FIFO merge queue and tiered conflict resolution | `src/merge/agentic_instructions.md` |
| SQLite event store (tool tracking, observability) | `src/events/agentic_instructions.md` |
| SQLite session store (agent lifecycle) | `src/sessions/agentic_instructions.md` |
| SQLite metrics store (cost, token tracking) | `src/metrics/agentic_instructions.md` |
| Multi-format logging and secret sanitization | `src/logging/agentic_instructions.md` |
| Session insight analyzer (auto-expertise) | `src/insights/agentic_instructions.md` |
| Watchdog daemon and AI triage | `src/watchdog/agentic_instructions.md` |
| Modular health checks (9 categories) | `src/doctor/agentic_instructions.md` |
| Beads issue tracking wrapper | `src/beads/agentic_instructions.md` |
| Mulch expertise wrapper | `src/mulch/agentic_instructions.md` |
| End-to-end integration tests | `src/e2e/agentic_instructions.md` |
| Version bump scripts | `scripts/agentic_instructions.md` |

## Architecture Overview

### Orchestrator Model
Your Claude Code session IS the orchestrator. There is no separate daemon. `CLAUDE.md` + hooks + the `overstory` CLI provide everything.

### Agent Hierarchy
```
Orchestrator (your Claude Code session, depth 0)
  --> Team Lead / Supervisor (depth 1, can spawn sub-workers)
        --> Builder / Scout / Reviewer / Merger (depth 2, leaf nodes)
```

### Agent Instruction Layers
1. **Base Definition** (`agents/*.md`): Reusable role definitions -- the HOW
2. **Dynamic Overlay** (`templates/overlay.md.tmpl`): Per-task context -- the WHAT (task ID, file scope, spec path, branch)

### Data Stores (all SQLite with WAL mode)
- `mail.db` -- Inter-agent messaging (~1-5ms per query)
- `sessions.db` -- Agent lifecycle state tracking
- `events.db` -- Tool invocations, session events, errors
- `metrics.db` -- Session metrics, token usage snapshots
- `merge-queue.db` -- FIFO merge queue with status tracking

### Merge Pipeline
4-tier escalation: clean merge -> auto-resolve (keep incoming) -> AI-resolve (Claude) -> reimagine (full rewrite). Historical conflict patterns learned via mulch integration.

## Logging

See `src/logging/agentic_instructions.md` for the logging subsystem. Log files live in `.overstory/logs/{agent-name}/{session-timestamp}/`.

## CRUD Entry Points

- **Create:** `overstory init` creates `.overstory/` structure; `overstory sling` spawns agents
- **Read:** `overstory status`, `overstory inspect`, `overstory dashboard`, `overstory trace`, `overstory costs`
- **Update:** `overstory merge` integrates branches; `overstory mail send` communicates
- **Delete:** `overstory clean` wipes runtime state; `overstory worktree clean` removes worktrees

## Style Guide

- Tab indentation (Biome enforced)
- 100-character line width
- `const` by default (`useConst` error)
- No explicit `any` (`noExplicitAny` error)
- Guard `undefined` from indexed access (`noUncheckedIndexedAccess`)
- Zero runtime dependencies -- only Bun built-in APIs
- External CLIs invoked via `Bun.spawn` with captured stdout/stderr
- All SQLite databases use WAL mode + busy timeout
- Tests colocated with source files (`*.test.ts`)

```typescript
// Canonical subprocess pattern
const proc = Bun.spawn(["git", "worktree", "add", path, "-b", branch], {
	cwd: repoRoot,
	stdout: "pipe",
	stderr: "pipe",
});
const exitCode = await proc.exited;
if (exitCode !== 0) {
	const stderr = await new Response(proc.stderr).text();
	throw new WorktreeError(`Failed to create worktree: ${stderr}`);
}
```
