# src/insights/ -- Session Insight Analyzer

## Purpose

Analyzes EventStore data from completed agent sessions to extract structured patterns about tool usage, file edit frequency, and errors. Produces `SessionInsight` objects suitable for automated recording to mulch. Used by the session completion flow to auto-capture learnings.

## Technology

- TypeScript with strict mode
- Pure logic module -- no I/O, no database access, no subprocess calls
- Consumes `StoredEvent[]` and `ToolStats[]` from EventStore, produces `InsightAnalysis`

## Contents

| File | Description |
|------|-------------|
| `analyzer.ts` | Session insight extraction -- tool profiles, hot files, error patterns, domain inference |
| `analyzer.test.ts` | Tests for insight analysis |

## Key Functions

### `analyzer.ts`
- `analyzeSessionInsights(params): InsightAnalysis` -- Main entry point. Processes events and tool stats to produce:
  - **Tool workflow pattern** (if 10+ tool calls): classifies as read-heavy, write-heavy, bash-heavy, or balanced
  - **Hot file patterns**: files edited 3+ times, capped at top 3, indicating complexity
  - **Error patterns**: error count with involved tool names
- `inferDomain(filePath: string): string | null` -- Map file paths to mulch domains based on directory structure:
  - `src/mail/` -> `"messaging"`
  - `src/commands/` -> `"cli"`
  - `src/agents/` or `agents/` -> `"agents"`
  - `src/events/`, `src/logging/`, `src/metrics/` -> `"cli"`
  - `src/merge/`, `src/worktree/` -> `"architecture"`
  - `*.test.ts` -> `"typescript"`
  - Generic `src/` -> `"typescript"`

## Data Types

```typescript
// From src/types.ts
interface InsightAnalysis {
	insights: SessionInsight[];
	toolProfile: ToolProfile;
	fileProfile: FileProfile;
}

interface SessionInsight {
	type: "pattern" | "failure";
	domain: string;
	description: string;
	tags: string[];
}

interface ToolProfile {
	topTools: Array<{ name: string; count: number; avgMs: number }>;
	totalToolCalls: number;
	errorCount: number;
}

interface FileProfile {
	hotFiles: Array<{ path: string; editCount: number }>;
	totalEdits: number;
}
```

## Logging

Not applicable. Pure analysis module with no side effects.

## CRUD Entry Points

- **Create:** Not applicable (produces data structures, does not persist them)
- **Read:** Consumes `StoredEvent[]` and `ToolStats[]` from callers
- **Update:** Not applicable
- **Delete:** Not applicable

## Style Guide

```typescript
export function analyzeSessionInsights(params: {
	events: StoredEvent[];
	toolStats: ToolStats[];
	agentName: string;
	capability: string;
	domains: string[];
}): InsightAnalysis {
	const insights: SessionInsight[] = [];
	const fallbackDomain = params.domains[0] ?? "agents";

	const topTools = params.toolStats
		.sort((a, b) => b.count - a.count)
		.slice(0, 5)
		.map((stat) => ({
			name: stat.toolName,
			count: stat.count,
			avgMs: Math.round(stat.avgDurationMs),
		}));
	// ...
}
```
