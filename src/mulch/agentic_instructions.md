# src/mulch/ -- Mulch CLI Wrapper

## Purpose

Provides a typed TypeScript wrapper around the external `mulch` command-line tool for structured expertise management. Supports all mulch operations: priming context, recording expertise entries, querying domains, searching records, diffing changes, learning from git history, pruning stale records, running health checks, viewing recent records, and compacting domain storage.

## Technology

- TypeScript with strict mode
- Bun runtime -- `Bun.spawn` for subprocess execution
- Zero runtime dependencies -- wraps the external `mulch` CLI binary
- JSON output parsing from `mulch --json` flag

## Contents

| File | Description |
|------|-------------|
| `client.ts` | Mulch CLI client -- all mulch subcommands wrapped with typed interfaces |
| `client.test.ts` | Tests for the mulch client |

## Key Functions

### `client.ts`
- `createMulchClient(cwd: string): MulchClient` -- Factory that returns a client bound to a working directory
  - `.prime(domains?, format?, options?)` -- Generate a priming prompt, optionally scoped to domains or files
  - `.status()` -- Show domain statistics as `MulchStatus`
  - `.record(domain, options)` -- Record an expertise entry with type, name, description, tags, classification, evidence, outcome fields
  - `.query(domain?)` -- Query expertise records, optionally scoped to a domain
  - `.search(query, options?)` -- Search records across all domains, optionally filtered by file or sorted by score
  - `.diff(options?)` -- Show expertise record changes since a git ref
  - `.learn(options?)` -- Show changed files and suggest domains for recording learnings
  - `.prune(options?)` -- Remove unused or stale records (supports dry-run)
  - `.doctor(options?)` -- Run health checks on mulch repository (supports auto-fix)
  - `.ready(options?)` -- Show recently added or updated expertise records
  - `.compact(domain?, options?)` -- Compact and optimize domain storage (analyze, apply, auto, dry-run modes)

## Data Types

```typescript
// From src/types.ts
interface MulchStatus {
	domains: Array<{
		name: string;
		recordCount: number;
		lastUpdated: string;
	}>;
}

interface MulchDiffResult { /* changes since a ref */ }
interface MulchLearnResult { /* suggested domains for changed files */ }
interface MulchPruneResult { /* pruning statistics */ }
interface MulchDoctorResult { /* health check results */ }
interface MulchReadyResult { /* recently updated records */ }
interface MulchCompactResult { /* compaction statistics */ }
```

## Logging

Not applicable. Throws `AgentError` on subprocess failures with exit code and stderr context.

## CRUD Entry Points

- **Create:** `record()` -- add new expertise entries
- **Read:** `prime()`, `status()`, `query()`, `search()`, `diff()`, `learn()`, `ready()`
- **Update:** `compact()` -- optimize existing records
- **Delete:** `prune()` -- remove stale records

## Style Guide

```typescript
export function createMulchClient(cwd: string): MulchClient {
	async function runMulch(
		args: string[],
		context: string,
	): Promise<{ stdout: string; stderr: string }> {
		const { stdout, stderr, exitCode } = await runCommand(["mulch", ...args], cwd);
		if (exitCode !== 0) {
			throw new AgentError(`mulch ${context} failed (exit ${exitCode}): ${stderr.trim()}`);
		}
		return { stdout, stderr };
	}

	return {
		async prime(domains, format, options) {
			const args = ["prime"];
			if (domains && domains.length > 0) {
				args.push(...domains);
			}
			if (format) {
				args.push("--format", format);
			}
			const { stdout } = await runMulch(args, "prime");
			return stdout;
		},
		// ...
	};
}
```
