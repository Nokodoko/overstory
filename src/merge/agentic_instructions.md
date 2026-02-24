# src/merge/ -- FIFO Merge Queue and Tiered Conflict Resolver

## Purpose

Manages the merge pipeline for integrating agent branches back into the canonical branch. Includes a SQLite-backed FIFO queue for ordering merges and a 4-tier escalation resolver for conflict resolution. Integrates with mulch for historical conflict pattern learning.

## Technology

- TypeScript with strict mode
- `bun:sqlite` for synchronous merge queue storage (WAL mode)
- `Bun.spawn` for git operations and Claude subprocess calls (AI-resolve tier)
- Tiered conflict resolution: clean merge -> auto-resolve -> AI-resolve -> reimagine
- Mulch integration for conflict pattern recording and historical skip-tier logic

## Contents

| File | Description |
|------|-------------|
| `queue.ts` | SQLite FIFO merge queue -- enqueue, dequeue, peek, list, updateStatus |
| `resolver.ts` | 4-tier conflict resolver -- clean merge, auto-resolve (keep incoming), AI-resolve (Claude), reimagine (full rewrite) |
| `queue.test.ts` | Tests for merge queue operations |
| `resolver.test.ts` | Tests for conflict resolution tiers |

## Key Functions

### `queue.ts`
- `createMergeQueue(dbPath: string): MergeQueue` -- Factory: create DB, enable WAL, create schema
- `MergeQueue.enqueue(entry): MergeEntry` -- Add entry with auto-generated timestamp and pending status
- `MergeQueue.dequeue(): MergeEntry | null` -- Remove and return first pending entry (FIFO via autoincrement ID)
- `MergeQueue.peek(): MergeEntry | null` -- View first pending without removing
- `MergeQueue.list(status?): MergeEntry[]` -- List all or filtered by status
- `MergeQueue.updateStatus(branchName, status, tier?): void` -- Update merge outcome
- `MergeQueue.close(): void` -- WAL checkpoint + close

### `resolver.ts`
- `createMergeResolver(options): MergeResolver` -- Factory with configurable tier enablement and optional mulch client
- `MergeResolver.resolve(entry, canonicalBranch, repoRoot): Promise<MergeResult>` -- Attempt merge with tier escalation
- `parseConflictPatterns(searchOutput): ParsedConflictPattern[]` -- Extract structured conflict data from mulch search results
- `buildConflictHistory(patterns, entryFiles): ConflictHistory` -- Compute skip-tiers, past resolutions, predicted conflict files
- `looksLikeProse(text): boolean` -- Validate AI output is code, not conversational text

#### Resolution Tiers (internal):
1. `tryCleanMerge(entry, repoRoot)` -- `git merge --no-edit`
2. `tryAutoResolve(conflictFiles, repoRoot)` -- Parse conflict markers, keep incoming (agent) changes
3. `tryAiResolve(conflictFiles, repoRoot, pastResolutions?)` -- Spawn `claude --print` per conflicted file with prose validation
4. `tryReimagine(entry, canonicalBranch, repoRoot)` -- Abort merge, get both versions via `git show`, reimplement with Claude

## Data Types

```typescript
// From src/types.ts
interface MergeEntry {
	branchName: string;
	beadId: string;
	agentName: string;
	filesModified: string[];
	enqueuedAt: string;
	status: "pending" | "merging" | "merged" | "conflict" | "failed";
	resolvedTier: ResolutionTier | null;
}

type ResolutionTier = "clean-merge" | "auto-resolve" | "ai-resolve" | "reimagine";

interface MergeResult {
	entry: MergeEntry;
	success: boolean;
	tier: ResolutionTier;
	conflictFiles: string[];
	errorMessage: string | null;
}

interface ConflictHistory {
	skipTiers: ResolutionTier[];
	pastResolutions: string[];
	predictedConflictFiles: string[];
}

interface ParsedConflictPattern {
	tier: ResolutionTier;
	success: boolean;
	files: string[];
	agent: string;
	branch: string;
}
```

## Logging

Not applicable. Throws `MergeError` on failures. Records conflict patterns to mulch via fire-and-forget.

## CRUD Entry Points

- **Create:** `MergeQueue.enqueue()` -- add branches to merge queue
- **Read:** `MergeQueue.peek()`, `MergeQueue.list()`, `queryConflictHistory()`
- **Update:** `MergeQueue.updateStatus()` -- record merge outcome
- **Delete:** `MergeQueue.dequeue()` -- consume and remove from queue

## Style Guide

```typescript
async function tryCleanMerge(
	entry: MergeEntry,
	repoRoot: string,
): Promise<{ success: boolean; conflictFiles: string[] }> {
	const { exitCode } = await runGit(repoRoot, ["merge", "--no-edit", entry.branchName]);
	if (exitCode === 0) {
		return { success: true, conflictFiles: [] };
	}
	const conflictFiles = await getConflictedFiles(repoRoot);
	return { success: false, conflictFiles };
}
```
