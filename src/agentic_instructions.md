# src/ -- Main Source Directory

## Purpose

Root source directory for the overstory CLI tool. Contains the CLI entry point, shared types, configuration loader, error hierarchy, test helpers, and all subsystem directories. Every TypeScript module in the project lives under this directory.

## Technology

- TypeScript with strict mode (`noUncheckedIndexedAccess`, `noExplicitAny`)
- Bun runtime (runs `.ts` directly, no build step)
- Biome for linting and formatting (tab indentation, 100-char line width)
- Zero runtime npm dependencies -- only Bun built-in APIs

## Contents

| File | Description |
|------|-------------|
| `index.ts` | CLI entry point -- command router with 30 subcommands, global flag parsing, edit-distance suggestion |
| `types.ts` | ALL shared types and interfaces for the entire project |
| `config.ts` | YAML config loader with custom parser, deep merge, validation, worktree-aware root resolution |
| `errors.ts` | Error class hierarchy -- 8 typed error classes extending `OverstoryError` |
| `test-helpers.ts` | Shared test utilities -- temp git repo creation, file commit helpers |
| `test-helpers.test.ts` | Tests for test helpers |
| `config.test.ts` | Tests for configuration loading and validation |

### Subdirectories

| Directory | Description |
|-----------|-------------|
| `agents/` | Agent lifecycle management (manifest, overlay, identity, hooks, checkpoint) |
| `beads/` | Beads (bd) CLI wrapper for issue tracking |
| `commands/` | One file per CLI subcommand (30 command handlers) |
| `doctor/` | Modular health check system (9 check categories) |
| `e2e/` | End-to-end integration tests |
| `events/` | SQLite event store for agent activity observability |
| `insights/` | Session insight analyzer for auto-expertise extraction |
| `logging/` | Multi-format logger, ANSI reporter, secret sanitizer |
| `mail/` | SQLite mail system for inter-agent messaging |
| `merge/` | FIFO merge queue and tiered conflict resolver |
| `metrics/` | SQLite metrics storage, summary reporting, transcript parsing |
| `mulch/` | Mulch CLI wrapper for structured expertise |
| `sessions/` | SQLite session store for agent lifecycle tracking |
| `watchdog/` | Process monitoring daemon, health checks, AI triage |
| `worktree/` | Git worktree management and tmux session control |

## Key Functions

### `index.ts`
- `main(): Promise<void>` -- Parse args, route to command handler via switch statement
- `suggestCommand(input: string): string | undefined` -- Edit-distance typo correction
- `editDistance(a: string, b: string): number` -- Levenshtein distance for command suggestions

### `config.ts`
- `loadConfig(projectRoot: string): Promise<OverstoryConfig>` -- Load, merge, validate config
- `resolveProjectRoot(startDir: string): Promise<string>` -- Handle git worktree resolution
- `parseYaml(text: string): Record<string, unknown>` -- Custom zero-dependency YAML parser

### `test-helpers.ts`
- `createTempGitRepo(): Promise<string>` -- Cached template clone for fast test repo creation
- `commitFile(repoDir, filePath, content, message?): Promise<void>` -- Git add + commit helper
- `cleanupTempDir(dir: string): Promise<void>` -- Safe recursive delete

## Data Types

See `types.ts` for the complete type catalog. Key types:
- `OverstoryConfig` -- Full project configuration (12 nested sections)
- `AgentSession` -- Runtime agent state (16 fields)
- `MailMessage` -- Inter-agent message (11 fields)
- `MergeEntry` / `MergeResult` -- Merge queue entries and results
- `StoredEvent` / `InsertEvent` -- Observability events
- `SessionMetrics` / `TokenSnapshot` -- Cost and performance tracking

## Logging

Not applicable at root level. See `src/logging/` for the logging subsystem.

## CRUD Entry Points

- **Create:** New commands go in `src/commands/`, new subsystems get their own directory
- **Read:** `loadConfig()` in `config.ts` is the primary config entry point
- **Update:** Types are centralized in `types.ts`, errors in `errors.ts`
- **Delete:** Not applicable

## Style Guide

- Tab indentation (Biome enforced)
- 100-character line width
- `const` by default (`useConst` error)
- No explicit `any` (`noExplicitAny` error)
- Guard `undefined` from indexed access (`noUncheckedIndexedAccess`)
- Imports organized by Biome automatically

```typescript
import { dirname, join, resolve } from "node:path";
import { ConfigError, ValidationError } from "./errors.ts";
import type { OverstoryConfig } from "./types.ts";

export async function loadConfig(projectRoot: string): Promise<OverstoryConfig> {
	const resolvedRoot = await resolveProjectRoot(projectRoot);
	const configPath = join(resolvedRoot, OVERSTORY_DIR, CONFIG_FILENAME);
	const defaults = structuredClone(DEFAULT_CONFIG);
	defaults.project.root = resolvedRoot;

	const file = Bun.file(configPath);
	const exists = await file.exists();
	if (!exists) {
		let config = defaults;
		config = await mergeLocalConfig(resolvedRoot, config);
		validateConfig(config);
		return config;
	}
	// ...
}
```
