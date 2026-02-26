/**
 * Zellij pane management for overstory agent workers.
 *
 * Drop-in replacement for tmux.ts — provides the same API but uses zellij
 * commands. All operations use Bun.spawn to call the zellij CLI directly.
 *
 * Architecture:
 *   - Agents run as panes within the "overstory" zellij session
 *   - Pane naming convention: `agent_{agentId}` (matches zellij-pane-manager.sh)
 *   - Session name stored in ZELLIJ_SESSION_NAME or defaults to "overstory"
 *
 * Key differences from tmux:
 *   - Zellij doesn't have named sessions in the same way; we target by pane name
 *   - write-chars replaces send-keys
 *   - dump-screen replaces capture-pane
 *   - Pane lifecycle is tied to the overstory session, not standalone sessions
 */

import { dirname, resolve } from "node:path";
import { AgentError } from "../errors.ts";

/** Default zellij session name for overstory agents */
const OVERSTORY_SESSION = process.env.ZELLIJ_SESSION_NAME ?? "overstory";

/**
 * Detect the directory containing the overstory binary.
 */
async function detectOverstoryBinDir(): Promise<string | null> {
	try {
		const proc = Bun.spawn(["which", "overstory"], {
			stdout: "pipe",
			stderr: "pipe",
		});
		const exitCode = await proc.exited;
		if (exitCode === 0) {
			const binPath = (await new Response(proc.stdout).text()).trim();
			if (binPath.length > 0) {
				return dirname(resolve(binPath));
			}
		}
	} catch {
		// which not available or overstory not on PATH
	}

	const scriptPath = process.argv[1];
	if (scriptPath?.includes("overstory")) {
		const bunPath = process.argv[0];
		if (bunPath) {
			return dirname(resolve(bunPath));
		}
	}

	return null;
}

/**
 * Run a shell command and capture its output.
 */
async function runCommand(
	cmd: string[],
	cwd?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	const proc = Bun.spawn(cmd, {
		cwd,
		stdout: "pipe",
		stderr: "pipe",
		// Strip ZELLIJ env vars so commands target the overstory session, not current
		env: {
			...process.env,
			ZELLIJ: undefined,
			ZELLIJ_SESSION_NAME: undefined,
		},
	});
	const stdout = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();
	const exitCode = await proc.exited;
	return { stdout, stderr, exitCode };
}

/**
 * Run a zellij command targeting the overstory session.
 */
async function zellijCommand(
	args: string[],
	cwd?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	return runCommand(["zellij", "--session", OVERSTORY_SESSION, ...args], cwd);
}

/**
 * Create a new zellij pane running the given command.
 *
 * Uses `zellij run` with --close-on-exit so the pane auto-closes when
 * the agent process exits.
 *
 * @param name - Pane name (e.g., "agent_abc123")
 * @param cwd - Working directory for the pane
 * @param command - Command to execute inside the pane
 * @param env - Optional environment variables to export
 * @returns The PID of the process running in the pane (best-effort)
 * @throws AgentError if pane creation fails
 */
export async function createSession(
	name: string,
	cwd: string,
	command: string,
	env?: Record<string, string>,
): Promise<number> {
	// Build environment exports
	const exports: string[] = [];

	const overstoryBinDir = await detectOverstoryBinDir();
	if (overstoryBinDir) {
		exports.push(`export PATH="${overstoryBinDir}:$PATH"`);
	}

	if (env) {
		for (const [key, value] of Object.entries(env)) {
			exports.push(`export ${key}="${value}"`);
		}
	}

	const wrappedCommand = exports.length > 0 ? `${exports.join(" && ")} && ${command}` : command;

	// Use zellij run to create a new pane with the command
	// --close-on-exit ensures pane closes when agent exits
	const { exitCode, stderr } = await zellijCommand([
		"run",
		"--close-on-exit",
		"--name",
		name,
		"--direction",
		"down",
		"--",
		"sh",
		"-c",
		wrappedCommand,
	]);

	if (exitCode !== 0) {
		throw new AgentError(`Failed to create zellij pane "${name}": ${stderr.trim()}`, {
			agentName: name,
		});
	}

	// Try to get the PID from ps (best effort)
	// Zellij doesn't expose pane PIDs directly like tmux does
	const pid = await getPanePid(name);
	return pid ?? 0;
}

/**
 * List all active agent panes in the overstory session.
 *
 * Parses zellij action query-tab-names or falls back to checking
 * the pane-map.json state file from zellij-panes plugin.
 *
 * @returns Array of pane name/pid pairs
 */
export async function listSessions(): Promise<Array<{ name: string; pid: number }>> {
	// Try to read from zellij-panes plugin state (most reliable)
	const stateFile = `${process.env.HOME}/.claude/plugins/zellij-panes/.state/pane-map.json`;
	try {
		const file = Bun.file(stateFile);
		if (await file.exists()) {
			const text = await file.text();
			const state = JSON.parse(text) as {
				agents: Array<{
					agent_id: string;
					pane_name: string;
					status: string;
				}>;
			};

			const sessions: Array<{ name: string; pid: number }> = [];
			for (const agent of state.agents ?? []) {
				if (agent.status === "active") {
					sessions.push({
						name: agent.pane_name,
						pid: 0, // PID not tracked in pane-map
					});
				}
			}
			return sessions;
		}
	} catch {
		// Fall through to zellij query
	}

	// Fallback: check if overstory session exists
	const { exitCode, stdout } = await runCommand([
		"zellij",
		"list-sessions",
		"--no-formatting",
	]);

	if (exitCode !== 0) {
		return [];
	}

	// Check if overstory session is in the list
	const lines = stdout.trim().split("\n");
	const hasOverstory = lines.some((line) => line.startsWith(OVERSTORY_SESSION));

	if (!hasOverstory) {
		return [];
	}

	// Session exists but we can't enumerate panes easily without the state file
	return [];
}

/**
 * Get the PID for a process running in a zellij pane (best-effort).
 *
 * Zellij doesn't expose pane PIDs directly. We use pgrep to find
 * processes whose command line matches the pane name pattern.
 *
 * @param name - Pane name
 * @returns PID if found, null otherwise
 */
export async function getPanePid(name: string): Promise<number | null> {
	// Try pgrep for a process matching the agent pattern
	// This is best-effort since zellij doesn't expose PIDs like tmux
	const { exitCode, stdout } = await runCommand([
		"pgrep",
		"-f",
		`claude.*${name}|${name}`,
	]);

	if (exitCode !== 0 || stdout.trim().length === 0) {
		return null;
	}

	const pidStr = stdout.trim().split("\n")[0];
	const pid = Number.parseInt(pidStr ?? "", 10);
	return Number.isNaN(pid) ? null : pid;
}

/**
 * Recursively collect all descendant PIDs of a given process.
 * (Same as tmux.ts implementation)
 */
export async function getDescendantPids(pid: number): Promise<number[]> {
	const { exitCode, stdout } = await runCommand(["pgrep", "-P", String(pid)]);

	if (exitCode !== 0 || stdout.trim().length === 0) {
		return [];
	}

	const childPids: number[] = [];
	for (const line of stdout.trim().split("\n")) {
		const childPid = Number.parseInt(line.trim(), 10);
		if (!Number.isNaN(childPid)) {
			childPids.push(childPid);
		}
	}

	const allDescendants: number[] = [];
	for (const childPid of childPids) {
		const grandchildren = await getDescendantPids(childPid);
		allDescendants.push(...grandchildren);
	}

	allDescendants.push(...childPids);
	return allDescendants;
}

/**
 * Check if a process is still alive.
 */
export function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

const KILL_GRACE_PERIOD_MS = 2000;

/**
 * Kill a process tree: SIGTERM deepest-first, wait, SIGKILL survivors.
 * (Same as tmux.ts implementation)
 */
export async function killProcessTree(
	rootPid: number,
	gracePeriodMs: number = KILL_GRACE_PERIOD_MS,
): Promise<void> {
	const descendants = await getDescendantPids(rootPid);

	if (descendants.length === 0) {
		sendSignal(rootPid, "SIGTERM");
		return;
	}

	for (const pid of descendants) {
		sendSignal(pid, "SIGTERM");
	}
	sendSignal(rootPid, "SIGTERM");

	await Bun.sleep(gracePeriodMs);

	for (const pid of descendants) {
		if (isProcessAlive(pid)) {
			sendSignal(pid, "SIGKILL");
		}
	}
	if (isProcessAlive(rootPid)) {
		sendSignal(rootPid, "SIGKILL");
	}
}

function sendSignal(pid: number, signal: "SIGTERM" | "SIGKILL"): void {
	try {
		process.kill(pid, signal);
	} catch {
		// Process already dead or inaccessible
	}
}

/**
 * Kill a zellij pane by name.
 *
 * First kills the process tree, then closes the pane via zellij action.
 *
 * @param name - Pane name to kill
 */
export async function killSession(name: string): Promise<void> {
	// Get PID and kill process tree first
	const panePid = await getPanePid(name);
	if (panePid !== null) {
		await killProcessTree(panePid);
	}

	// Close the pane via zellij
	// Note: zellij action close-pane only works on the focused pane
	// For named panes, we need to use the zellij-panes plugin state
	// to mark as completed, which triggers --close-on-exit behavior

	// Update pane-map state to mark as completed
	const stateFile = `${process.env.HOME}/.claude/plugins/zellij-panes/.state/pane-map.json`;
	try {
		const file = Bun.file(stateFile);
		if (await file.exists()) {
			const text = await file.text();
			const state = JSON.parse(text) as {
				agents: Array<{
					agent_id: string;
					pane_name: string;
					status: string;
					updated: number;
				}>;
			};

			const updated = state.agents.map((agent) => {
				if (agent.pane_name === name) {
					return { ...agent, status: "completed", updated: Date.now() };
				}
				return agent;
			});

			state.agents = updated;
			await Bun.write(stateFile, JSON.stringify(state, null, 2));
		}
	} catch {
		// Best effort — pane may already be closed
	}
}

/**
 * Detect the current zellij session name.
 *
 * @returns Session name if running inside zellij, null otherwise
 */
export async function getCurrentSessionName(): Promise<string | null> {
	if (!process.env.ZELLIJ) {
		return null;
	}
	return process.env.ZELLIJ_SESSION_NAME ?? OVERSTORY_SESSION;
}

/**
 * Check whether a zellij pane is still alive.
 *
 * Checks the pane-map.json state file from zellij-panes plugin.
 *
 * @param name - Pane name to check
 * @returns true if the pane exists and is active
 */
export async function isSessionAlive(name: string): Promise<boolean> {
	const stateFile = `${process.env.HOME}/.claude/plugins/zellij-panes/.state/pane-map.json`;
	try {
		const file = Bun.file(stateFile);
		if (!(await file.exists())) {
			return false;
		}
		const text = await file.text();
		const state = JSON.parse(text) as {
			agents: Array<{
				pane_name: string;
				status: string;
			}>;
		};

		return state.agents.some(
			(agent) => agent.pane_name === name && agent.status === "active",
		);
	} catch {
		return false;
	}
}

/**
 * Capture the visible content of a zellij pane.
 *
 * Uses zellij action dump-screen to capture pane content.
 * Note: This captures the focused pane; targeting by name requires
 * first focusing the pane.
 *
 * @param name - Pane name (currently unused — captures focused pane)
 * @param lines - Number of lines to capture (default 50)
 * @returns The trimmed pane content, or null if capture fails
 */
export async function capturePaneContent(name: string, lines = 50): Promise<string | null> {
	// Create a temp file for dump output
	const tmpFile = `/tmp/zellij-capture-${Date.now()}.txt`;

	const { exitCode } = await zellijCommand([
		"action",
		"dump-screen",
		tmpFile,
	]);

	if (exitCode !== 0) {
		return null;
	}

	try {
		const file = Bun.file(tmpFile);
		if (await file.exists()) {
			const content = await file.text();
			await Bun.spawn(["rm", "-f", tmpFile]).exited;
			const trimmed = content.trim();
			// Take last N lines
			const allLines = trimmed.split("\n");
			const lastLines = allLines.slice(-lines).join("\n");
			return lastLines.length > 0 ? lastLines : null;
		}
	} catch {
		// Capture failed
	}

	return null;
}

/**
 * Wait for a zellij pane to become ready for input.
 *
 * @param name - Pane name to poll
 * @param timeoutMs - Maximum wait time (default 15s)
 * @param pollIntervalMs - Poll interval (default 500ms)
 * @returns true once content is detected, false on timeout
 */
export async function waitForTuiReady(
	name: string,
	timeoutMs = 15_000,
	pollIntervalMs = 500,
): Promise<boolean> {
	const maxAttempts = Math.ceil(timeoutMs / pollIntervalMs);
	for (let i = 0; i < maxAttempts; i++) {
		const alive = await isSessionAlive(name);
		if (alive) {
			return true;
		}
		await Bun.sleep(pollIntervalMs);
	}
	return false;
}

/**
 * Send text to a zellij pane.
 *
 * Uses zellij action write-chars to send text, then write to send Enter.
 *
 * @param name - Pane name to send to
 * @param keys - Text to send
 * @throws AgentError if the pane does not exist or send fails
 */
export async function sendKeys(name: string, keys: string): Promise<void> {
	// Verify pane is alive first
	const alive = await isSessionAlive(name);
	if (!alive) {
		throw new AgentError(
			`Zellij pane "${name}" does not exist. The agent may have crashed or been killed before receiving input.`,
			{ agentName: name },
		);
	}

	// Flatten newlines to spaces (same as tmux.ts)
	const flatKeys = keys.replace(/\n/g, " ");

	// Focus the pane first (required for write-chars)
	// This is tricky — zellij doesn't have focus-by-name
	// We need to use the zellij-pane-manager approach

	// For now, write to the session's stdin via a different approach:
	// Use zellij action write to send bytes directly
	if (flatKeys.length > 0) {
		const { exitCode, stderr } = await zellijCommand([
			"action",
			"write-chars",
			flatKeys,
		]);

		if (exitCode !== 0) {
			throw new AgentError(
				`Failed to write to zellij pane "${name}": ${stderr.trim()}`,
				{ agentName: name },
			);
		}
	}

	// Send Enter key
	const { exitCode: enterExitCode, stderr: enterStderr } = await zellijCommand([
		"action",
		"write",
		"13", // ASCII code for Enter
	]);

	if (enterExitCode !== 0) {
		throw new AgentError(
			`Failed to send Enter to zellij pane "${name}": ${enterStderr.trim()}`,
			{ agentName: name },
		);
	}
}
