# src/e2e/ -- End-to-End Integration Tests

## Purpose

Contains end-to-end tests that exercise full command sequences across multiple subsystems. These tests create real temporary git repos, run `overstory init`, spawn agents via `overstory sling`, and verify the complete lifecycle including worktree creation, session tracking, and cleanup.

## Technology

- TypeScript with `bun test` (Jest-compatible API)
- Real git repos in temp directories (no mocking)
- Real SQLite databases (`:memory:` or temp files)
- Only tmux operations are mocked (to avoid interfering with developer sessions)

## Contents

| File | Description |
|------|-------------|
| `init-sling-lifecycle.test.ts` | Full init -> sling -> lifecycle test covering worktree creation, session store, and cleanup |

## Key Functions

Not applicable -- this directory contains test files only. Tests use helpers from `src/test-helpers.ts`:
- `createTempGitRepo()` -- Initialize a real git repo in a temp dir
- `commitFile()` -- Add and commit a file
- `cleanupTempDir()` -- Remove temp directories

## Data Types

Not applicable -- tests use types from `src/types.ts`.

## Logging

Not applicable.

## CRUD Entry Points

Not applicable -- test-only directory.

## Style Guide

```typescript
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { cleanupTempDir, createTempGitRepo } from "../test-helpers.ts";

describe("init -> sling lifecycle", () => {
	let repoDir: string;

	beforeAll(async () => {
		repoDir = await createTempGitRepo();
	});

	afterAll(async () => {
		await cleanupTempDir(repoDir);
	});

	it("creates .overstory directory structure", async () => {
		// ...
	});
});
```
