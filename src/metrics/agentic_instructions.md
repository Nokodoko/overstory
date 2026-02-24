# src/metrics/ -- SQLite Metrics Storage and Cost Analysis

## Purpose

Provides SQLite-backed storage for agent session metrics (duration, exit codes, merge results, token usage) and real-time token snapshots. Includes a summary reporter for human-readable output and a Claude Code transcript parser for extracting token counts from JSONL session files. Powers the `overstory metrics`, `overstory costs`, and live cost monitoring features.

## Technology

- TypeScript with strict mode
- `bun:sqlite` for synchronous database access (WAL mode)
- Schema migration for adding token columns and run_id to existing tables
- Hardcoded model pricing tables (Opus, Sonnet, Haiku) for cost estimation
- JSONL line-by-line parsing for Claude Code transcripts

## Contents

| File | Description |
|------|-------------|
| `store.ts` | SQLite metrics store -- session recording, snapshot tracking, aggregation queries, migration |
| `summary.ts` | Metrics reporting -- aggregate summary generation and human-friendly formatting |
| `transcript.ts` | Claude Code transcript parser -- JSONL token extraction and cost estimation |
| `store.test.ts` | Tests for metrics store operations |
| `summary.test.ts` | Tests for summary generation and formatting |
| `transcript.test.ts` | Tests for transcript parsing |

## Key Functions

### `store.ts`
- `createMetricsStore(dbPath: string): MetricsStore` -- Factory: create DB, enable WAL, create schema, migrate columns
- `MetricsStore.recordSession(metrics: SessionMetrics): void` -- Insert or replace session metrics (keyed by agent_name + bead_id)
- `MetricsStore.getRecentSessions(limit?): SessionMetrics[]` -- Recent sessions ordered by start time
- `MetricsStore.getSessionsByAgent(agentName): SessionMetrics[]` -- All sessions for one agent
- `MetricsStore.getSessionsByRun(runId): SessionMetrics[]` -- All sessions in a run
- `MetricsStore.getAverageDuration(capability?): number` -- Average duration across completed sessions
- `MetricsStore.purge(options): number` -- Delete by agent or all
- `MetricsStore.recordSnapshot(snapshot: TokenSnapshot): void` -- Insert a real-time token usage snapshot
- `MetricsStore.getLatestSnapshots(): TokenSnapshot[]` -- Most recent snapshot per agent (for live dashboards)
- `MetricsStore.getLatestSnapshotTime(agentName): string | null` -- Timestamp of most recent snapshot
- `MetricsStore.purgeSnapshots(options): number` -- Delete snapshots by agent, age, or all

### `summary.ts`
- `generateSummary(store, limit?): MetricsSummary` -- Aggregate stats: total/completed sessions, avg duration, by-capability breakdown, token totals
- `formatSummary(summary): string` -- Human-readable multi-line output with duration and token formatting

### `transcript.ts`
- `parseTranscriptUsage(transcriptPath): Promise<TranscriptUsage>` -- Parse a JSONL file, aggregate token counts from all `assistant` entries
- `estimateCost(usage: TranscriptUsage): number | null` -- Calculate USD cost from token counts using hardcoded model pricing

## Data Types

```typescript
// From src/types.ts
interface SessionMetrics {
	agentName: string;
	beadId: string;
	capability: string;
	startedAt: string;
	completedAt: string | null;
	durationMs: number;
	exitCode: number | null;
	mergeResult: string | null;
	parentAgent: string | null;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheCreationTokens: number;
	estimatedCostUsd: number | null;
	modelUsed: string | null;
	runId: string | null;
}

interface TokenSnapshot {
	agentName: string;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheCreationTokens: number;
	estimatedCostUsd: number | null;
	modelUsed: string | null;
	createdAt: string;
}

// From summary.ts
interface MetricsSummary {
	totalSessions: number;
	completedSessions: number;
	averageDurationMs: number;
	byCapability: Record<string, { count: number; avgDurationMs: number }>;
	recentSessions: SessionMetrics[];
	tokenTotals: TokenTotals;
}

// From transcript.ts
interface TranscriptUsage {
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheCreationTokens: number;
	modelUsed: string | null;
}
```

## Logging

Not applicable. Metrics data is consumed by command handlers for output.

## CRUD Entry Points

- **Create:** `recordSession()`, `recordSnapshot()`
- **Read:** `getRecentSessions()`, `getSessionsByAgent()`, `getSessionsByRun()`, `getAverageDuration()`, `getLatestSnapshots()`, `generateSummary()`, `parseTranscriptUsage()`
- **Update:** `recordSession()` uses INSERT OR REPLACE
- **Delete:** `purge()`, `purgeSnapshots()`

## Style Guide

```typescript
export function createMetricsStore(dbPath: string): MetricsStore {
	const db = new Database(dbPath);
	db.exec("PRAGMA journal_mode = WAL");
	db.exec("PRAGMA busy_timeout = 5000");
	db.exec(CREATE_TABLE);
	db.exec(CREATE_SNAPSHOTS_TABLE);
	db.exec(CREATE_SNAPSHOTS_INDEX);

	migrateTokenColumns(db);
	migrateRunIdColumn(db);

	const insertStmt = db.prepare<void, { ... }>(`
		INSERT OR REPLACE INTO sessions (...) VALUES (...)
	`);

	return {
		recordSession(metrics: SessionMetrics): void {
			insertStmt.run({ ... });
		},
		// ...
	};
}
```
