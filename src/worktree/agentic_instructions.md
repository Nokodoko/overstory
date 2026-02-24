# src/worktree/ -- Git Worktree and Tmux Session Management

## Purpose

Manages git worktrees for agent isolation (each agent gets its own checkout and branch) and tmux sessions for running Claude Code instances. Handles worktree creation with branch naming conventions, worktree listing and cleanup, tmux session lifecycle (create, list, kill), process tree management, and tmux pane operations (send keys, capture content).

## Technology

- TypeScript with strict mode
- `Bun.spawn` for all git and tmux CLI operations
- Session naming convention: `overstory-{projectName}-{agentName}` for project-scoped isolation
- Branch naming convention: `overstory/{agentName}/{beadId}`
- Process tree cleanup via `/proc` traversal and signal cascading
- Environment variable injection into tmux sessions (`OVERSTORY_AGENT_NAME`, `OVERSTORY_WORKTREE_PATH`)

## Contents

| File | Description |
|------|-------------|
| `manager.ts` | Git worktree operations -- create, list, check merge status, remove |
| `tmux.ts` | Tmux session management -- create, list, kill, process tree cleanup, pane operations |
| `manager.test.ts` | Tests for worktree operations (uses real temp git repos) |
| `tmux.test.ts` | Tests for tmux operations (uses fake session names to avoid real tmux) |

## Key Functions

### `manager.ts`
- `createWorktree(options): Promise<{ worktreePath, branchName }>` -- Create worktree at `{baseDir}/{agentName}` with branch `overstory/{agentName}/{beadId}` based on `baseBranch`
- `listWorktrees(repoRoot): Promise<Array<{ path, branch, head }>>` -- Parse `git worktree list --porcelain`
- `isBranchMerged(repoRoot, branchName, targetBranch): Promise<boolean>` -- Check via `git branch --merged`
- `removeWorktree(repoRoot, path, force?): Promise<void>` -- `git worktree remove` with optional `--force`

### `tmux.ts`
- `createSession(options): Promise<number | null>` -- Create a named tmux session running Claude Code with environment variables, returns PID
- `listSessions(prefix?): Promise<string[]>` -- List active tmux sessions, optionally filtered by name prefix
- `killSession(sessionName): Promise<void>` -- Kill a tmux session by name
- `killProcessTree(pid): Promise<void>` -- Recursively kill all descendants of a PID
- `getDescendantPids(pid): Promise<number[]>` -- Traverse `/proc/{pid}/task/*/children` to find all descendants
- `isProcessAlive(pid): boolean` -- Check via `process.kill(pid, 0)`
- `sendKeys(sessionName, text): Promise<void>` -- Send keystrokes to a tmux pane
- `capturePaneContent(sessionName, lines?): Promise<string>` -- Capture visible pane content
- `waitForTuiReady(sessionName, timeout?): Promise<boolean>` -- Poll for Claude Code TUI ready indicator
- `isSessionAlive(sessionName): Promise<boolean>` -- Check if tmux session exists
- `getCurrentSessionName(): Promise<string | null>` -- Get current tmux session name (if inside tmux)
- `getPanePid(sessionName): Promise<number | null>` -- Get PID of the process running in the tmux pane

## Data Types

No types defined locally. Uses `AgentSession` from `src/types.ts` and `WorktreeError` from `src/errors.ts`.

```typescript
// createWorktree options
interface CreateWorktreeOptions {
	repoRoot: string;
	baseDir: string;
	agentName: string;
	baseBranch: string;
	beadId: string;
}

// createSession options (in tmux.ts)
interface CreateSessionOptions {
	sessionName: string;
	workingDir: string;
	command: string;
	env?: Record<string, string>;
	model?: string;
}
```

## Logging

Not applicable. Throws `WorktreeError` and `AgentError` on failures with context fields.

## CRUD Entry Points

- **Create:** `createWorktree()` (git worktree + branch), `createSession()` (tmux session)
- **Read:** `listWorktrees()`, `listSessions()`, `isSessionAlive()`, `capturePaneContent()`, `getPanePid()`
- **Update:** `sendKeys()` (send input to running session)
- **Delete:** `removeWorktree()`, `killSession()`, `killProcessTree()`

## Style Guide

```typescript
import { WorktreeError } from "../errors.ts";

async function runGit(
	repoRoot: string,
	args: string[],
	context?: { worktreePath?: string; branchName?: string },
): Promise<string> {
	const proc = Bun.spawn(["git", ...args], {
		cwd: repoRoot,
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	if (exitCode !== 0) {
		throw new WorktreeError(
			`git ${args.join(" ")} failed (exit ${exitCode}): ${stderr.trim()}`,
			{ worktreePath: context?.worktreePath, branchName: context?.branchName },
		);
	}
	return stdout;
}
```
