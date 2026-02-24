# src/commands/ -- CLI Command Handlers

## Purpose

Contains one file per CLI subcommand (30 commands total). Each module exports a function named `{command}Command(args: string[])` that is called by the command router in `src/index.ts`. Commands handle argument parsing, config loading, store initialization, and formatted output.

## Technology

- TypeScript with strict mode
- Bun runtime (`Bun.spawn`, `Bun.file`, `bun:sqlite`)
- Local arg parsing helpers (`getFlag()`, `hasFlag()`, `getAllFlags()`) -- no external arg parsing library
- `--json` flag support for machine-readable output on most commands
- Colocated tests (`{command}.test.ts`) using `bun test`

## Contents

| File | Description |
|------|-------------|
| `init.ts` | `overstory init` -- create `.overstory/` directory structure |
| `sling.ts` | `overstory sling` -- spawn a worker agent in a worktree |
| `stop.ts` | `overstory stop` -- terminate a running agent |
| `prime.ts` | `overstory prime` -- load context for orchestrator/agent |
| `status.ts` | `overstory status` -- show all active agents and state |
| `dashboard.ts` | `overstory dashboard` -- live TUI with polling |
| `inspect.ts` | `overstory inspect` -- deep single-agent view |
| `coordinator.ts` | `overstory coordinator` -- start/stop/status for persistent coordinator |
| `supervisor.ts` | `overstory supervisor` -- start/stop/status for project supervisor |
| `hooks.ts` | `overstory hooks` -- install/uninstall/status orchestrator hooks |
| `mail.ts` | `overstory mail` -- send/check/list/read/reply/purge messages |
| `nudge.ts` | `overstory nudge` -- tmux text nudge to an agent |
| `merge.ts` | `overstory merge` -- merge agent branches into canonical |
| `spec.ts` | `overstory spec` -- write task specs to `.overstory/specs/` |
| `group.ts` | `overstory group` -- batch task group management |
| `clean.ts` | `overstory clean` -- nuclear cleanup of runtime state |
| `doctor.ts` | `overstory doctor` -- modular health checks |
| `worktree.ts` | `overstory worktree` -- list/clean git worktrees |
| `log.ts` | `overstory log` -- hook event target (tool-start, tool-end, session-end) |
| `logs.ts` | `overstory logs` -- NDJSON log query and tail |
| `feed.ts` | `overstory feed` -- unified real-time event stream |
| `watch.ts` | `overstory watch` -- start watchdog daemon |
| `monitor.ts` | `overstory monitor` -- Tier 2 monitor agent management |
| `trace.ts` | `overstory trace` -- chronological event timeline |
| `errors.ts` | `overstory errors` -- aggregated error view |
| `replay.ts` | `overstory replay` -- multi-agent interleaved replay |
| `run.ts` | `overstory run` -- manage run lifecycle |
| `costs.ts` | `overstory costs` -- token/cost analysis |
| `metrics.ts` | `overstory metrics` -- session metrics display |
| `completions.ts` | `overstory --completions` -- shell completion generation |
| `agents.ts` | `overstory agents` -- discover available agent types |

Each command also has a corresponding `.test.ts` file.

## Key Functions

Each command exports a single entry point:
- `initCommand(args): Promise<void>`
- `slingCommand(args): Promise<void>`
- `stopCommand(args): Promise<void>`
- `primeCommand(args): Promise<void>`
- `statusCommand(args): Promise<void>`
- `dashboardCommand(args): Promise<void>`
- `inspectCommand(args): Promise<void>`
- `coordinatorCommand(args): Promise<void>`
- `supervisorCommand(args): Promise<void>`
- `hooksCommand(args): Promise<void>`
- `mailCommand(args): Promise<void>`
- `nudgeCommand(args) / nudgeAgent(options): Promise<...>`
- `mergeCommand(args): Promise<void>`
- `specCommand(args): Promise<void>`
- `groupCommand(args): Promise<void>`
- `cleanCommand(args): Promise<void>`
- `doctorCommand(args): Promise<void>`
- `worktreeCommand(args): Promise<void>`
- `logCommand(args): Promise<void>`
- `logsCommand(args): Promise<void>`
- `feedCommand(args): Promise<void>`
- `watchCommand(args): Promise<void>`
- `monitorCommand(args): Promise<void>`
- `traceCommand(args): Promise<void>`
- `errorsCommand(args): Promise<void>`
- `replayCommand(args): Promise<void>`
- `runCommand(args): Promise<void>`
- `costsCommand(args): Promise<void>`
- `metricsCommand(args): Promise<void>`
- `completionsCommand(args): void`
- `agentsCommand(args): Promise<void>`

## Data Types

Commands consume types from `src/types.ts`. No types are defined in this directory. Common patterns:
- `loadConfig(projectRoot)` returns `OverstoryConfig`
- `openSessionStore(overstoryDir)` returns `SessionStore`
- `createEventStore(dbPath)` returns `EventStore`
- `createMailStore(dbPath)` returns `MailStore`

## Logging

Commands use `console.log()` for human output, `JSON.stringify()` for `--json` mode, and `console.error()` for errors. The `log.ts` command writes events to the EventStore database.

## CRUD Entry Points

- **Create:** `initCommand` creates `.overstory/` structure; `slingCommand` creates worktrees and agent sessions; `specCommand` writes spec files
- **Read:** Most commands read from SessionStore, EventStore, MetricsStore, or MailStore
- **Update:** `mailCommand` marks messages read; `stopCommand` updates session state; `mergeCommand` updates merge queue status
- **Delete:** `cleanCommand` purges all runtime state; `worktreeCommand clean` removes completed worktrees

## Style Guide

Commands follow a canonical pattern (see `trace.ts` as the reference implementation):

```typescript
import { loadConfig } from "../config.ts";
import { createEventStore } from "../events/store.ts";

function getFlag(args: string[], flag: string): string | undefined {
	const idx = args.indexOf(flag);
	if (idx === -1 || idx + 1 >= args.length) return undefined;
	return args[idx + 1];
}

function hasFlag(args: string[], flag: string): boolean {
	return args.includes(flag);
}

export async function traceCommand(args: string[]): Promise<void> {
	const target = args[0];
	const json = hasFlag(args, "--json");
	const since = getFlag(args, "--since");
	const config = await loadConfig(process.cwd());
	// ...
}
```
