# src/logging/ -- Multi-Format Logger and Output Control

## Purpose

Provides a multi-format logger that writes simultaneously to 4 output files (session.log, events.ndjson, tools.ndjson, errors.log), a console reporter with ANSI colors, a secret sanitizer for credential redaction, and centralized color/quiet mode control. All writes are fire-and-forget to ensure logging never crashes the host application.

## Technology

- TypeScript with strict mode
- `node:fs/promises` (`appendFile`, `mkdir`) for async file writes
- ANSI escape codes for terminal colors (no external dependencies)
- Respects `NO_COLOR`, `TERM=dumb`, `FORCE_COLOR` environment conventions
- Fire-and-forget write pattern -- errors silently swallowed

## Contents

| File | Description |
|------|-------------|
| `logger.ts` | Multi-format logger -- writes to session.log, events.ndjson, tools.ndjson, errors.log simultaneously |
| `sanitizer.ts` | Secret redaction -- pattern-based replacement of API keys, tokens, bearer credentials |
| `reporter.ts` | Console reporter -- ANSI-colored `[HH:MM:SS] LVL agent | event key=value` format |
| `color.ts` | Central ANSI color control -- `NO_COLOR`/`FORCE_COLOR` detection, quiet mode toggle |
| `logger.test.ts` | Tests for multi-format logger |
| `sanitizer.test.ts` | Tests for secret redaction |
| `reporter.test.ts` | Tests for console reporter formatting |
| `color.test.ts` | Tests for color detection and quiet mode |

## Key Functions

### `logger.ts`
- `createLogger(options: LoggerOptions): Logger` -- Factory that returns a logger writing to 4 files
  - `.info(event, data?)` -- Write info-level event to session.log + events.ndjson + console
  - `.warn(event, data?)` -- Write warn-level event
  - `.error(event, error, data?)` -- Write to all files including errors.log with stack trace
  - `.debug(event, data?)` -- Write debug-level (suppressed unless verbose)
  - `.toolStart(toolName, args)` -- Write to events.ndjson + tools.ndjson
  - `.toolEnd(toolName, durationMs, result?)` -- Write tool completion with timing
  - `.close()` -- Stop accepting writes

### `sanitizer.ts`
- `sanitize(input: string): string` -- Replace known secret patterns with `[REDACTED]`
- `sanitizeObject(obj): Record<string, unknown>` -- Deep-clone and sanitize all string values
- Patterns: `sk-ant-*`, `github_pat_*`, `Bearer *`, `ghp_*`, `ANTHROPIC_API_KEY=*`

### `reporter.ts`
- `formatLogLine(event: LogEvent): string` -- Format as `[HH:MM:SS] LVL agent | event key=value` with ANSI colors
- `printToConsole(event, verbose): void` -- Print to stdout/stderr respecting verbose and quiet modes

### `color.ts`
- `color` -- Object with ANSI codes: `reset`, `bold`, `dim`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, `gray`
- `colorsEnabled` -- Boolean reflecting color detection result
- `setQuiet(enabled: boolean): void` -- Toggle quiet mode
- `isQuiet(): boolean` -- Check quiet mode state

## Data Types

```typescript
// From src/types.ts
interface LogEvent {
	timestamp: string;
	level: "debug" | "info" | "warn" | "error";
	event: string;
	agentName?: string;
	data: Record<string, unknown>;
}

// From logger.ts
interface Logger {
	info(event: string, data?: Record<string, unknown>): void;
	warn(event: string, data?: Record<string, unknown>): void;
	error(event: string, error: Error, data?: Record<string, unknown>): void;
	debug(event: string, data?: Record<string, unknown>): void;
	toolStart(toolName: string, args: Record<string, unknown>): void;
	toolEnd(toolName: string, durationMs: number, result?: string): void;
	close(): void;
}
```

## Logging

This IS the logging subsystem. Output files created in `.overstory/logs/{agent-name}/{session-timestamp}/`:
- `session.log` -- Human-readable `[TIMESTAMP] LEVEL event key=value`
- `events.ndjson` -- Machine-parseable NDJSON stream of all events
- `tools.ndjson` -- Tool-only event stream (toolStart/toolEnd)
- `errors.log` -- Stack traces with context (error events only)

## CRUD Entry Points

- **Create:** `createLogger()` initializes log directory and files
- **Read:** Log files are consumed by `overstory logs`, `overstory feed`, `overstory inspect`
- **Update:** `safeAppend()` appends to existing log files
- **Delete:** Log cleanup handled by `overstory clean --logs`

## Style Guide

```typescript
function safeAppend(filePath: string, content: string): void {
	if (closed) return;
	ensureDir()
		.then(() => appendFile(filePath, content, "utf-8"))
		.catch(() => {
			// Silently ignore write errors -- logging should never crash the host
		});
}
```
