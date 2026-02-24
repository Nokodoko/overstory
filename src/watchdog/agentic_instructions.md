# src/watchdog/ -- Process Monitoring Daemon and AI Triage

## Purpose

Implements a 3-tier agent monitoring system. Tier 0 is a mechanical daemon that polls agent health on a configurable interval with progressive nudging (warn -> nudge -> escalate -> terminate). Tier 1 is AI-assisted triage that classifies stalled agents via Claude subprocess analysis. The health module provides the ZFC (Zero Failure Crash) state machine where observable state (tmux/pid) trumps recorded state (sessions.db).

## Technology

- TypeScript with strict mode
- `Bun.spawn` for tmux liveness checks, process monitoring, Claude triage subprocess
- `setInterval` for daemon polling loop
- EventStore integration for failure recording
- Mulch integration for failure pattern recording (fire-and-forget)
- ZFC principle: signal priority is tmux > pid > recorded state

## Contents

| File | Description |
|------|-------------|
| `daemon.ts` | Tier 0 mechanical daemon -- poll loop, progressive nudging (4 levels), run completion detection |
| `health.ts` | ZFC health state machine -- evaluate health from observable signals, forward-only state transitions |
| `triage.ts` | Tier 1 AI triage -- read recent logs, classify via Claude as retry/terminate/extend |
| `daemon.test.ts` | Tests for watchdog daemon |
| `health.test.ts` | Tests for health evaluation and state transitions |
| `triage.test.ts` | Tests for AI triage classification |

## Key Functions

### `daemon.ts`
- Main daemon loop (internal): polls all active sessions, evaluates health, applies progressive escalation:
  - Level 0 (warn): Log warning via callback, no direct action
  - Level 1 (nudge): Send tmux nudge via `nudgeAgent()`
  - Level 2 (escalate): Invoke Tier 1 AI triage (if enabled), else skip
  - Level 3 (terminate): Kill tmux session
- `recordFailure(root, session, reason, tier, triageSuggestion?)` -- Fire-and-forget recording to mulch
- `recordEvent(eventStore, session, eventType, data)` -- Fire-and-forget event recording
- Persistent capabilities (`coordinator`, `monitor`) are excluded from run-level completion checks

### `health.ts`
- `evaluateHealth(session, isAlive): HealthCheck` -- Evaluate agent health based on tmux liveness + time since last activity
  - Returns `{ status: "healthy" | "stale" | "zombie", reason, suggestedAction }`
- `transitionState(currentState, targetState): AgentState` -- Forward-only state machine (booting -> working -> completed -> stalled -> zombie)
- `isProcessAlive(pid): boolean` -- Check if a PID exists via `process.kill(pid, 0)`

ZFC signal priority:
1. tmux session liveness (highest priority)
2. Process liveness (pid)
3. Recorded state in sessions.db (lowest priority)

### `triage.ts`
- `triageAgent(options): Promise<"retry" | "terminate" | "extend">` -- Read last 50 lines of session.log, spawn Claude to classify:
  - `"retry"` -- recoverable error, nudge the agent
  - `"terminate"` -- fatal, kill the session
  - `"extend"` -- likely long-running operation, increase timeout
- Falls back to `"extend"` if Claude is unavailable or logs are missing

## Data Types

```typescript
// From src/types.ts
interface HealthCheck {
	agentName: string;
	status: "healthy" | "stale" | "zombie";
	reason: string;
	suggestedAction: "none" | "nudge" | "escalate" | "terminate";
	checkedAt: string;
}

type AgentState = "booting" | "working" | "completed" | "stalled" | "zombie";
```

## Logging

The daemon uses `console.log()` for status output and records events to the EventStore and failure patterns to mulch. Both recording paths use fire-and-forget (try/catch swallowing errors) to ensure monitoring never crashes the daemon.

## CRUD Entry Points

- **Create:** `recordFailure()` records to mulch; `recordEvent()` records to EventStore
- **Read:** Reads active sessions from SessionStore, tmux liveness, pid liveness, log files
- **Update:** `SessionStore.updateState()`, `SessionStore.updateEscalation()`
- **Delete:** `killSession()` terminates tmux sessions at escalation level 3

## Style Guide

```typescript
const PERSISTENT_CAPABILITIES = new Set(["coordinator", "monitor"]);

function recordFailure(
	root: string,
	session: AgentSession,
	reason: string,
	tier: number,
	triageSuggestion?: string,
): void {
	// Fire-and-forget per convention mx-09e10f
	try {
		const mulchClient = createMulchClient(root);
		mulchClient
			.record("agents", {
				type: "failure",
				description: `Agent ${session.agentName} failed: ${reason}`,
				tags: ["watchdog", `tier-${tier}`],
			})
			.catch(() => {});
	} catch {
		// Swallow — recording should never block monitoring
	}
}
```
