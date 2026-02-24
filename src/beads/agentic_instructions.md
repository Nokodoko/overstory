# src/beads/ -- Beads (bd) CLI Wrapper

## Purpose

Provides a typed TypeScript wrapper around the external `bd` (beads) command-line tool for issue tracking. Includes both the core issue client and molecule (multi-step workflow template) management helpers. All commands run via `Bun.spawn` with JSON output parsing.

## Technology

- TypeScript with strict mode
- Bun runtime -- `Bun.spawn` for subprocess execution
- Zero runtime dependencies -- wraps the external `bd` CLI binary
- JSON output parsing from `bd --json` flag

## Contents

| File | Description |
|------|-------------|
| `client.ts` | Core beads client -- ready, show, create, claim, close, list operations |
| `molecules.ts` | Molecule management -- create prototypes, pour (instantiate), list, convoy status |
| `client.test.ts` | Tests for the beads client |
| `molecules.test.ts` | Tests for molecule operations |

## Key Functions

### `client.ts`
- `createBeadsClient(cwd: string): BeadsClient` -- Factory that returns a client bound to a working directory
  - `.ready(options?)` -- List open, unblocked issues (optionally filtered by molecule)
  - `.show(id)` -- Get details for a specific issue (returns first element of `--json` array)
  - `.create(title, options?)` -- Create a new issue, returns the new ID
  - `.claim(id)` -- Mark issue as `in_progress` via `bd update`
  - `.close(id, reason?)` -- Close an issue with optional reason
  - `.list(options?)` -- List issues with status/limit filters

### `molecules.ts`
- `createMoleculePrototype(cwd, options): Promise<string>` -- Create a prototype via `bd mol create`, add steps in order via `bd mol step add`, return prototype ID
- `pourMolecule(cwd, options): Promise<string[]>` -- Instantiate a prototype into actual issues with pre-wired dependencies, return created IDs
- `listPrototypes(cwd): Promise<MoleculePrototype[]>` -- List all molecule prototypes
- `getConvoyStatus(cwd, prototypeId): Promise<ConvoyStatus>` -- Get completion counts for a poured prototype (total/completed/inProgress/blocked)

## Data Types

### `client.ts`
```typescript
interface BeadIssue {
	id: string;
	title: string;
	status: string;
	priority: number;
	type: string;
	assignee?: string;
	description?: string;
	blocks?: string[];
	blockedBy?: string[];
}
```

### `molecules.ts`
```typescript
interface MoleculeStep { title: string; type?: string; }
interface MoleculePrototype { id: string; name: string; stepCount: number; }
interface ConvoyStatus { total: number; completed: number; inProgress: number; blocked: number; }
```

## Logging

Not applicable. Throws `AgentError` on subprocess failures with exit code and stderr context.

## CRUD Entry Points

- **Create:** `createBeadsClient().create()`, `createMoleculePrototype()`, `pourMolecule()`
- **Read:** `createBeadsClient().ready()`, `.show()`, `.list()`, `listPrototypes()`, `getConvoyStatus()`
- **Update:** `createBeadsClient().claim()`
- **Delete:** `createBeadsClient().close()`

## Style Guide

```typescript
export function createBeadsClient(cwd: string): BeadsClient {
	async function runBd(
		args: string[],
		context: string,
	): Promise<{ stdout: string; stderr: string }> {
		const { stdout, stderr, exitCode } = await runCommand(["bd", ...args], cwd);
		if (exitCode !== 0) {
			throw new AgentError(`bd ${context} failed (exit ${exitCode}): ${stderr.trim()}`);
		}
		return { stdout, stderr };
	}

	return {
		async ready(options) {
			const args = ["ready", "--json"];
			if (options?.mol) {
				args.push("--mol", options.mol);
			}
			const { stdout } = await runBd(args, "ready");
			const raw = parseJsonOutput<RawBeadIssue[]>(stdout, "ready");
			return raw.map(normalizeIssue);
		},
		// ...
	};
}
```
