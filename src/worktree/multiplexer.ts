/**
 * Multiplexer abstraction for overstory agent sessions.
 *
 * Detects whether we're running in zellij or tmux and routes operations
 * to the appropriate implementation. Defaults to zellij if $ZELLIJ is set,
 * otherwise falls back to tmux.
 *
 * This allows overstory to work with either multiplexer seamlessly.
 */

import * as tmux from "./tmux.ts";
import * as zellij from "./zellij.ts";

export type Multiplexer = "zellij" | "tmux";

/**
 * Detect which multiplexer is currently in use.
 *
 * Priority:
 * 1. If $ZELLIJ is set → zellij
 * 2. If $TMUX is set → tmux
 * 3. Check for overstory zellij session → zellij
 * 4. Default → zellij (as per user preference)
 */
export async function detectMultiplexer(): Promise<Multiplexer> {
	// Check environment variables first
	if (process.env.ZELLIJ) {
		return "zellij";
	}
	if (process.env.TMUX) {
		return "tmux";
	}

	// Check if zellij overstory session exists
	const proc = Bun.spawn(["zellij", "list-sessions", "--no-formatting"], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const exitCode = await proc.exited;
	if (exitCode === 0) {
		const stdout = await new Response(proc.stdout).text();
		if (stdout.includes("overstory")) {
			return "zellij";
		}
	}

	// Default to zellij as per user preference
	return "zellij";
}

/**
 * Get the multiplexer module (zellij or tmux).
 */
export async function getMultiplexer(): Promise<typeof zellij | typeof tmux> {
	const mux = await detectMultiplexer();
	return mux === "zellij" ? zellij : tmux;
}

// Re-export common types
export type SessionInfo = { name: string; pid: number };

/**
 * Unified API that routes to the detected multiplexer.
 */
export const mux = {
	async createSession(
		name: string,
		cwd: string,
		command: string,
		env?: Record<string, string>,
	): Promise<number> {
		const m = await getMultiplexer();
		return m.createSession(name, cwd, command, env);
	},

	async listSessions(): Promise<SessionInfo[]> {
		const m = await getMultiplexer();
		return m.listSessions();
	},

	async killSession(name: string): Promise<void> {
		const m = await getMultiplexer();
		return m.killSession(name);
	},

	async isSessionAlive(name: string): Promise<boolean> {
		const m = await getMultiplexer();
		return m.isSessionAlive(name);
	},

	async sendKeys(name: string, keys: string): Promise<void> {
		const m = await getMultiplexer();
		return m.sendKeys(name, keys);
	},

	async capturePaneContent(name: string, lines?: number): Promise<string | null> {
		const m = await getMultiplexer();
		return m.capturePaneContent(name, lines);
	},

	async waitForTuiReady(
		name: string,
		timeoutMs?: number,
		pollIntervalMs?: number,
	): Promise<boolean> {
		const m = await getMultiplexer();
		return m.waitForTuiReady(name, timeoutMs, pollIntervalMs);
	},

	async getCurrentSessionName(): Promise<string | null> {
		const m = await getMultiplexer();
		return m.getCurrentSessionName();
	},

	async getPanePid(name: string): Promise<number | null> {
		const m = await getMultiplexer();
		return m.getPanePid(name);
	},

	async getDescendantPids(pid: number): Promise<number[]> {
		const m = await getMultiplexer();
		return m.getDescendantPids(pid);
	},

	async killProcessTree(pid: number, gracePeriodMs?: number): Promise<void> {
		const m = await getMultiplexer();
		return m.killProcessTree(pid, gracePeriodMs);
	},

	isProcessAlive(pid: number): boolean {
		// Same implementation in both
		return zellij.isProcessAlive(pid);
	},
};

// Re-export individual functions for DI compatibility
export const createSession = mux.createSession;
export const listSessions = mux.listSessions;
export const killSession = mux.killSession;
export const isSessionAlive = mux.isSessionAlive;
export const sendKeys = mux.sendKeys;
export const capturePaneContent = mux.capturePaneContent;
export const waitForTuiReady = mux.waitForTuiReady;
export const getCurrentSessionName = mux.getCurrentSessionName;
export const getPanePid = mux.getPanePid;
export const getDescendantPids = mux.getDescendantPids;
export const killProcessTree = mux.killProcessTree;
export const isProcessAlive = mux.isProcessAlive;
