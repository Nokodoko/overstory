# src/events/ -- SQLite Event Store for Agent Observability

## Purpose

Provides a SQLite-backed event store that tracks tool invocations, session lifecycle events, mail events, and errors across all agent processes. Includes a smart tool argument filter that reduces payloads from ~20KB to ~200 bytes for efficient storage. The store powers the `trace`, `errors`, `replay`, `feed`, and `inspect` commands.

## Technology

- TypeScript with strict mode
- `bun:sqlite` for synchronous database access
- WAL mode + 5-second busy timeout for concurrent multi-agent reads/writes
- Prepared statements for all frequent queries
- Indexed columns: `agent_name+created_at`, `run_id+created_at`, `event_type+created_at`, `tool_name+agent_name`, `level WHERE error`

## Contents

| File | Description |
|------|-------------|
| `store.ts` | SQLite event store -- insert, correlate tool durations, query by agent/run/errors/timeline, tool stats aggregation, purge |
| `tool-filter.ts` | Smart argument filter -- per-tool-type payload reduction preserving identifying fields |
| `store.test.ts` | Tests for event store operations |
| `tool-filter.test.ts` | Tests for tool argument filtering |

## Key Functions

### `store.ts`
- `createEventStore(dbPath: string): EventStore` -- Factory: create DB, enable WAL, create schema, return EventStore interface
- `EventStore.insert(event: InsertEvent): number` -- Insert an event, return the auto-generated ID
- `EventStore.correlateToolEnd(agentName, toolName): { startId, durationMs } | null` -- Find the most recent uncorrelated `tool_start` for an agent+tool, compute duration, update the row
- `EventStore.getByAgent(agentName, opts?): StoredEvent[]` -- Query events for an agent with optional time/level/limit filters
- `EventStore.getByRun(runId, opts?): StoredEvent[]` -- Query events for a run
- `EventStore.getErrors(opts?): StoredEvent[]` -- Query error-level events across all agents
- `EventStore.getTimeline(opts): StoredEvent[]` -- Chronological event stream with required `since`
- `EventStore.getToolStats(opts?): ToolStats[]` -- Aggregated tool usage: count, avg duration, max duration per tool
- `EventStore.purge(opts): number` -- Delete events by age, agent, or all; returns count deleted
- `EventStore.close(): void` -- Checkpoint WAL and close DB

### `tool-filter.ts`
- `filterToolArgs(toolName, toolInput): FilteredToolArgs` -- Dispatch to per-tool handler, return compact `{ args, summary }`
- Handlers for: `Bash` (command+description), `Read` (file_path+offset+limit), `Write` (file_path), `Edit` (file_path), `Glob` (pattern+path), `Grep` (pattern+path+glob+output_mode), `WebFetch` (url), `WebSearch` (query), `Task` (description+subagent_type)

## Data Types

```typescript
// From src/types.ts
interface StoredEvent {
	id: number;
	runId: string | null;
	agentName: string;
	sessionId: string | null;
	eventType: "tool_start" | "tool_end" | "session_start" | "session_end" | "mail_sent" | "mail_received" | "error" | "custom";
	toolName: string | null;
	toolArgs: string | null;
	toolDurationMs: number | null;
	level: EventLevel;
	data: string | null;
	createdAt: string;
}

interface InsertEvent {
	runId: string | null;
	agentName: string;
	sessionId: string | null;
	eventType: string;
	toolName: string | null;
	toolArgs: string | null;
	toolDurationMs: number | null;
	level: EventLevel;
	data: string | null;
}

interface ToolStats {
	toolName: string;
	count: number;
	avgDurationMs: number;
	maxDurationMs: number;
}

// From tool-filter.ts
interface FilteredToolArgs {
	args: Record<string, unknown>;
	summary: string;
}
```

## Logging

Not applicable. The event store IS the logging backend for observability data.

## CRUD Entry Points

- **Create:** `EventStore.insert()` -- insert tool events, session events, errors
- **Read:** `getByAgent()`, `getByRun()`, `getErrors()`, `getTimeline()`, `getToolStats()`
- **Update:** `correlateToolEnd()` -- backfill `tool_duration_ms` on tool_start rows
- **Delete:** `purge()` -- delete by age, agent, or all

## Style Guide

```typescript
import { Database } from "bun:sqlite";
import type { EventStore, InsertEvent, StoredEvent } from "../types.ts";

export function createEventStore(dbPath: string): EventStore {
	const db = new Database(dbPath);
	db.exec("PRAGMA journal_mode = WAL");
	db.exec("PRAGMA synchronous = NORMAL");
	db.exec("PRAGMA busy_timeout = 5000");
	db.exec(CREATE_TABLE);
	db.exec(CREATE_INDEXES);

	const insertStmt = db.prepare<{ id: number }, { ... }>(`
		INSERT INTO events (...) VALUES (...) RETURNING id
	`);

	return {
		insert(event: InsertEvent): number {
			const row = insertStmt.get({ ... });
			return row?.id ?? 0;
		},
		// ...
	};
}
```
