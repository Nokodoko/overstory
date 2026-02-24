# src/agents/ -- Agent Lifecycle Management

## Purpose

Manages the complete agent lifecycle: loading agent definitions from the manifest, generating per-task CLAUDE.md overlays, deploying capability-specific hook guards, maintaining persistent agent identities, and handling session checkpoint/resume for crash recovery.

## Technology

- TypeScript with strict mode (`noUncheckedIndexedAccess`, `noExplicitAny`)
- Bun runtime (runs `.ts` directly, no build step)
- Custom YAML serializer/deserializer for identity files (zero dependencies)
- `{{PLACEHOLDER}}` template rendering for overlay generation
- `Bun.file()` / `Bun.write()` for all file I/O

## Contents

| File | Description |
|------|-------------|
| `manifest.ts` | Agent registry loader -- parse, validate, index agent definitions from JSON |
| `overlay.ts` | Dynamic CLAUDE.md overlay generator -- template rendering with per-task variables |
| `identity.ts` | Persistent agent identity (CVs) -- YAML serialize/deserialize, task history tracking |
| `hooks-deployer.ts` | Deploy hooks config to worktrees -- capability guards, path boundary enforcement |
| `lifecycle.ts` | Session handoff -- checkpoint/resume across compaction or crash events |
| `checkpoint.ts` | Session checkpoint save/load/clear -- JSON persistence for recovery |
| `manifest.test.ts` | Tests for manifest loading and validation |
| `overlay.test.ts` | Tests for overlay generation |
| `identity.test.ts` | Tests for identity CRUD operations |
| `hooks-deployer.test.ts` | Tests for hooks deployment and guard generation |
| `lifecycle.test.ts` | Tests for session handoff lifecycle |
| `checkpoint.test.ts` | Tests for checkpoint operations |

## Key Functions

### `manifest.ts`
- `createManifestLoader(manifestPath, agentBaseDir): ManifestLoader` -- Factory that returns a loader with `load()`, `getAgent()`, `findByCapability()`, `validate()` methods
- `resolveModel(config, manifest, role, fallback): ResolvedModel` -- Resolve model for an agent role via config override > manifest default > fallback chain
- `resolveProviderEnv(providerName, modelId, providers): Record<string, string> | null` -- Resolve gateway provider env vars for tmux session injection

### `overlay.ts`
- `generateOverlay(config: OverlayConfig): Promise<string>` -- Render the overlay template with all `{{VARIABLE}}` placeholders replaced
- `writeOverlay(worktreePath, config, canonicalRoot): Promise<void>` -- Generate and write overlay to `{worktree}/.claude/CLAUDE.md` with canonical-root guard
- `isCanonicalRoot(dir, canonicalRoot): boolean` -- Deterministic path comparison to prevent writing overlays to the orchestrator root

### `identity.ts`
- `createIdentity(baseDir, identity): Promise<void>` -- Write a new identity YAML file
- `loadIdentity(baseDir, name): Promise<AgentIdentity | null>` -- Load identity from YAML, null if not found
- `updateIdentity(baseDir, name, update): Promise<AgentIdentity>` -- Merge updates (increment sessions, add domains, append tasks capped at 20)

### `hooks-deployer.ts`
- `deployHooks(worktreePath, agentName, capability): Promise<void>` -- Read template, replace `{{AGENT_NAME}}`, merge capability guards, write `settings.local.json`
- `getCapabilityGuards(capability): HookEntry[]` -- Generate PreToolUse guards: write-tool blocks for read-only agents, path boundary for builders
- `getDangerGuards(agentName): HookEntry[]` -- Block git push, git reset --hard, enforce branch naming
- `getPathBoundaryGuards(): HookEntry[]` -- Enforce worktree path boundaries for Write/Edit/NotebookEdit
- `buildBashFileGuardScript(capability, extraSafePrefixes): string` -- Whitelist-first Bash guard for non-implementation agents
- `buildBashPathBoundaryScript(): string` -- Validate absolute paths in file-modifying Bash commands stay in worktree
- `buildPathBoundaryGuardScript(filePathField): string` -- Validate tool file_path field stays within worktree

### `lifecycle.ts`
- `initiateHandoff(options): Promise<SessionHandoff>` -- Save checkpoint + create handoff record
- `resumeFromHandoff(options): Promise<{checkpoint, handoff} | null>` -- Find pending handoff, load checkpoint
- `completeHandoff(options): Promise<void>` -- Mark handoff as completed, clear checkpoint

### `checkpoint.ts`
- `saveCheckpoint(agentsDir, checkpoint): Promise<void>` -- Write checkpoint JSON to `{agentsDir}/{name}/checkpoint.json`
- `loadCheckpoint(agentsDir, agentName): Promise<SessionCheckpoint | null>` -- Read checkpoint, null if absent
- `clearCheckpoint(agentsDir, agentName): Promise<void>` -- Delete checkpoint file (ENOENT safe)

## Data Types

Key types from `src/types.ts`:
- `AgentManifest` -- `{ version, agents: Record<string, AgentDefinition>, capabilityIndex }`
- `AgentDefinition` -- `{ file, model, tools, capabilities, canSpawn, constraints }`
- `OverlayConfig` -- All variables needed to render a per-task overlay (18 fields)
- `AgentIdentity` -- Persistent agent CV with `name`, `capability`, `sessionsCompleted`, `expertiseDomains`, `recentTasks[]`
- `SessionCheckpoint` -- Recovery state: `agentName`, `beadId`, `sessionId`, `progressSummary`, `filesModified`, `currentBranch`, `pendingWork`
- `SessionHandoff` -- Links sessions across compaction: `fromSessionId`, `toSessionId`, `checkpoint`, `reason`
- `ResolvedModel` -- `{ model: string, env?: Record<string, string> }` for gateway routing

## Logging

Not applicable. These modules throw typed errors (`AgentError`, `LifecycleError`) that propagate to command handlers.

## CRUD Entry Points

- **Create:** `createIdentity()`, `saveCheckpoint()`, `writeOverlay()`, `deployHooks()`
- **Read:** `loadIdentity()`, `loadCheckpoint()`, `createManifestLoader().load()`
- **Update:** `updateIdentity()`, `completeHandoff()`
- **Delete:** `clearCheckpoint()`

## Style Guide

```typescript
export async function deployHooks(
	worktreePath: string,
	agentName: string,
	capability = "builder",
): Promise<void> {
	const templatePath = getTemplatePath();
	const file = Bun.file(templatePath);
	const exists = await file.exists();

	if (!exists) {
		throw new AgentError(`Hooks template not found: ${templatePath}`, {
			agentName,
		});
	}

	let template: string;
	try {
		template = await file.text();
	} catch (err) {
		throw new AgentError(`Failed to read hooks template: ${templatePath}`, {
			agentName,
			cause: err instanceof Error ? err : undefined,
		});
	}
	// ...
}
```
