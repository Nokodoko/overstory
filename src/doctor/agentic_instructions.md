# src/doctor/ -- Modular Health Check System

## Purpose

Implements 9 categories of health checks for the `overstory doctor` command. Each category is a separate module exporting an array of `DoctorCheck` objects. Categories cover dependencies, configuration, directory structure, databases, consistency, agents, merge queue, logs, and version.

## Technology

- TypeScript with strict mode
- Bun runtime (`Bun.spawn` for CLI checks, `Bun.file` for file existence, `bun:sqlite` for DB validation)
- Each check module exports `DoctorCheck[]` conforming to the shared type contract
- Tests colocated per category

## Contents

| File | Description |
|------|-------------|
| `types.ts` | Shared types: `DoctorCategory`, `DoctorCheck`, `DoctorCheckFn` |
| `dependencies.ts` | Check external tool availability (`git`, `tmux`, `bd`, `mulch`, `claude`) |
| `config-check.ts` | Validate `config.yaml` structure and required fields |
| `structure.ts` | Verify `.overstory/` directory structure and required files |
| `databases.ts` | Open and validate SQLite databases (`mail.db`, `sessions.db`, `events.db`, `metrics.db`) |
| `consistency.ts` | Cross-reference sessions, worktrees, and tmux sessions for orphans |
| `agents.ts` | Validate agent manifest and identity files |
| `merge-queue.ts` | Check merge queue state (`merge-queue.db`) |
| `logs.ts` | Verify log directory structure and file integrity |
| `version.ts` | Check overstory version and update availability |
| `*.test.ts` | One test file per check category |

## Key Functions

### `types.ts`
- `DoctorCategory` -- String union: `"dependencies" | "config" | "structure" | "databases" | "consistency" | "agents" | "merge" | "logs" | "version"`
- `DoctorCheck` -- `{ name: string, category: DoctorCategory, check: DoctorCheckFn }`
- `DoctorCheckFn` -- `(config: OverstoryConfig) => Promise<{ pass: boolean, message: string }>`

### Each category module
- Exports a `const checks: DoctorCheck[]` array
- Each check function receives the loaded `OverstoryConfig` and returns `{ pass, message }`

## Data Types

```typescript
type DoctorCategory =
	| "dependencies"
	| "config"
	| "structure"
	| "databases"
	| "consistency"
	| "agents"
	| "merge"
	| "logs"
	| "version";

interface DoctorCheck {
	name: string;
	category: DoctorCategory;
	check: DoctorCheckFn;
}

type DoctorCheckFn = (
	config: OverstoryConfig,
) => Promise<{ pass: boolean; message: string }>;
```

## Logging

Not applicable. Check results are returned as structured objects and formatted by `src/commands/doctor.ts`.

## CRUD Entry Points

- **Create:** Not applicable
- **Read:** Each check reads from disk (config files, databases, directories, CLI tools)
- **Update:** Not applicable
- **Delete:** Not applicable

## Style Guide

```typescript
import type { DoctorCheck } from "./types.ts";

export const checks: DoctorCheck[] = [
	{
		name: "git-available",
		category: "dependencies",
		check: async () => {
			const proc = Bun.spawn(["git", "--version"], {
				stdout: "pipe",
				stderr: "pipe",
			});
			const exitCode = await proc.exited;
			return exitCode === 0
				? { pass: true, message: "git is available" }
				: { pass: false, message: "git is not installed or not in PATH" };
		},
	},
];
```
