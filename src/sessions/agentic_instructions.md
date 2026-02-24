# src/sessions/ -- SQLite Session Store for Agent Lifecycle

## Purpose

Provides SQLite-backed storage for agent session state (booting, working, completed, stalled, zombie) and run management (grouping sessions into coordinator-level runs). Includes a backward-compatible migration bridge from the legacy `sessions.json` flat file to SQLite.

## Technology

- TypeScript with strict mode
- `bun:sqlite` for synchronous database access (WAL mode)
- Schema migration: escalation columns, run_id column, activity tracking
- Legacy `sessions.json` -> `sessions.db` migration on first access
- `SessionStore` for agent sessions, `RunStore` for run groupings (both from same DB)

## Contents

| File | Description |
|------|-------------|
| `store.ts` | SQLite session store + run store -- upsert, query, state transitions, run lifecycle |
| `compat.ts` | Migration bridge -- auto-import from `sessions.json` to `sessions.db` on first access |
| `store.test.ts` | Tests for session and run store operations |
| `compat.test.ts` | Tests for JSON-to-SQLite migration |

## Key Functions

### `store.ts`
- `createSessionStore(dbPath: string): SessionStore` -- Factory: create DB, enable WAL, create schema with migration
  - `.upsert(session)` -- Insert or replace agent session (keyed by agent_name)
  - `.getByName(agentName)` -- Single session lookup
  - `.getActive()` -- All sessions with state IN ('booting', 'working', 'stalled')
  - `.getAll()` -- All sessions regardless of state
  - `.getByRun(runId)` -- Sessions belonging to a specific run
  - `.updateState(agentName, state)` -- Transition state
  - `.updateLastActivity(agentName)` -- Touch timestamp
  - `.updateEscalation(agentName, level, stalledSince)` -- Update watchdog escalation
  - `.remove(agentName)` -- Delete session
  - `.purge(opts)` -- Delete by state, agent, or all
  - `.close()` -- Close DB

- `createRunStore(dbPath: string): RunStore` -- Factory for run management
  - `.createRun(run: InsertRun): Run` -- Create a new run with auto-generated ID
  - `.getRun(runId): Run | null` -- Lookup run by ID
  - `.getActiveRun(): Run | null` -- Get the currently active run
  - `.listRuns(limit?): Run[]` -- Recent runs ordered by start time
  - `.incrementAgentCount(runId)` -- Bump agent count for a run
  - `.completeRun(runId)` -- Mark run as completed with timestamp

### `compat.ts`
- `openSessionStore(overstoryDir): { store, migrated }` -- Open or create SessionStore with automatic JSON migration
  - If `sessions.db` exists with data: open directly
  - If `sessions.db` is empty but `sessions.json` exists: import all entries
  - If neither exists: create empty `sessions.db`

## Data Types

```typescript
// From src/types.ts
interface AgentSession {
	id: string;
	agentName: string;
	capability: string;
	worktreePath: string;
	branchName: string;
	beadId: string;
	tmuxSession: string;
	state: AgentState;
	pid: number | null;
	parentAgent: string | null;
	depth: number;
	runId: string | null;
	startedAt: string;
	lastActivity: string;
	escalationLevel: number;
	stalledSince: string | null;
}

type AgentState = "booting" | "working" | "completed" | "stalled" | "zombie";

interface Run {
	id: string;
	startedAt: string;
	completedAt: string | null;
	status: RunStatus;
	agentCount: number;
	description: string | null;
}

type RunStatus = "active" | "completed";
```

## Logging

Not applicable. State queries are synchronous and return structured data.

## CRUD Entry Points

- **Create:** `upsert()` (sessions), `createRun()` (runs), `openSessionStore()` with migration
- **Read:** `getByName()`, `getActive()`, `getAll()`, `getByRun()`, `getRun()`, `getActiveRun()`, `listRuns()`
- **Update:** `updateState()`, `updateLastActivity()`, `updateEscalation()`, `incrementAgentCount()`, `completeRun()`
- **Delete:** `remove()`, `purge()`

## Style Guide

```typescript
import { Database } from "bun:sqlite";
import type { AgentSession, AgentState } from "../types.ts";

export function createSessionStore(dbPath: string): SessionStore {
	const db = new Database(dbPath);
	db.exec("PRAGMA journal_mode = WAL");
	db.exec("PRAGMA synchronous = NORMAL");
	db.exec("PRAGMA busy_timeout = 5000");
	db.exec(CREATE_TABLE);
	db.exec(CREATE_INDEXES);

	migrateEscalationColumns(db);
	migrateRunIdColumn(db);

	const upsertStmt = db.prepare<void, { ... }>(`
		INSERT OR REPLACE INTO sessions (...) VALUES (...)
	`);

	return {
		upsert(session: AgentSession): void {
			upsertStmt.run({ ... });
		},
		// ...
	};
}
```
