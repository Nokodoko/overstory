# src/mail/ -- SQLite Mail System for Inter-Agent Messaging

## Purpose

Purpose-built messaging system for inter-agent communication. Three layers: a SQLite store (L1) for low-level CRUD, a mail client (L2) for higher-level operations like send/check/reply, and a broadcast module for group address resolution. WAL mode enables concurrent access from multiple agent processes. Query latency is ~1-5ms.

## Technology

- TypeScript with strict mode
- `bun:sqlite` for synchronous database access
- WAL mode + NORMAL synchronous + 5-second busy timeout
- Prepared statements for all frequent queries
- Schema migration support (CHECK constraints, payload column, protocol type expansion)
- `crypto.getRandomValues()` for message ID generation

## Contents

| File | Description |
|------|-------------|
| `store.ts` | SQLite mail storage (L1) -- insert, getUnread, getAll, getById, getByThread, markRead, purge |
| `client.ts` | Mail client (L2) -- send, sendProtocol, check, checkInject, list, markRead, reply |
| `broadcast.ts` | Group address resolution -- `@all`, `@builders`, `@scouts`, etc. |
| `store.test.ts` | Tests for mail store operations |
| `client.test.ts` | Tests for mail client operations |
| `broadcast.test.ts` | Tests for group address resolution |

## Key Functions

### `store.ts`
- `createMailStore(dbPath: string): MailStore` -- Factory: create DB, enable WAL, migrate schema, create indexes
- `MailStore.insert(message): MailMessage` -- Insert with auto-generated ID and timestamp
- `MailStore.getUnread(agentName): MailMessage[]` -- Fetch unread messages ordered by time
- `MailStore.getAll(filters?): MailMessage[]` -- Dynamic filter query (from, to, unread, limit)
- `MailStore.getById(id): MailMessage | null` -- Single message lookup
- `MailStore.getByThread(threadId): MailMessage[]` -- Thread conversation view
- `MailStore.markRead(id): void` -- Set read flag
- `MailStore.purge(options): number` -- Delete by age, agent, or all; returns count
- `MailStore.close(): void` -- WAL checkpoint + close

### `client.ts`
- `createMailClient(store: MailStore): MailClient` -- Wrap store with higher-level API
- `MailClient.send(msg): string` -- Send message, returns auto-generated ID
- `MailClient.sendProtocol<T>(msg): string` -- Send typed protocol message with JSON payload
- `MailClient.check(agentName): MailMessage[]` -- Get unread + mark all as read
- `MailClient.checkInject(agentName): string` -- Get unread formatted for hook injection
- `MailClient.reply(messageId, body, from): string` -- Reply in thread (auto-detects recipient)
- `parsePayload<T>(message, expectedType): T | null` -- Parse typed JSON payload from message

### `broadcast.ts`
- `isGroupAddress(recipient: string): boolean` -- Check if starts with `@`
- `resolveGroupAddress(groupAddress, activeSessions, senderName): string[]` -- Resolve `@all` to all active agents, `@builders`/`@scouts`/etc. to capability-filtered lists (sender excluded)

## Data Types

```typescript
// From src/types.ts
interface MailMessage {
	id: string;
	from: string;
	to: string;
	subject: string;
	body: string;
	type: "status" | "question" | "result" | "error" | "worker_done" | "merge_ready" | "merged" | "merge_failed" | "escalation" | "health_check" | "dispatch" | "assign";
	priority: "low" | "normal" | "high" | "urgent";
	threadId: string | null;
	payload: string | null;
	read: boolean;
	createdAt: string;
}
```

## Logging

Not applicable. Throws `MailError` on failures with message ID context.

## CRUD Entry Points

- **Create:** `MailStore.insert()`, `MailClient.send()`, `MailClient.sendProtocol()`, `MailClient.reply()`
- **Read:** `getUnread()`, `getAll()`, `getById()`, `getByThread()`, `check()`, `checkInject()`, `list()`
- **Update:** `markRead()`, `MailClient.markRead()`
- **Delete:** `purge()`

## Style Guide

```typescript
import { Database } from "bun:sqlite";
import { MailError } from "../errors.ts";
import type { MailMessage } from "../types.ts";

export function createMailStore(dbPath: string): MailStore {
	const db = new Database(dbPath);
	db.exec("PRAGMA journal_mode = WAL");
	db.exec("PRAGMA synchronous = NORMAL");
	db.exec("PRAGMA busy_timeout = 5000");

	migrateSchema(db);
	db.exec(CREATE_TABLE);
	db.exec(CREATE_INDEXES);

	const insertStmt = db.prepare<void, { ... }>(`
		INSERT INTO messages (...) VALUES (...)
	`);

	return {
		insert(message): MailMessage {
			const id = message.id || `msg-${randomId()}`;
			// ...
		},
		// ...
	};
}
```
