# scripts/ -- Build and Release Scripts

## Purpose

Contains utility scripts for project maintenance tasks such as version bumping. These are developer-facing tools run manually or via npm scripts.

## Technology

- TypeScript executed directly by Bun (`#!/usr/bin/env bun`)
- Uses Bun built-in APIs (`Bun.file()`, `Bun.write()`)

## Contents

| File | Description |
|------|-------------|
| `version-bump.ts` | Bumps semver version in both `package.json` and `src/index.ts` |

## Key Functions

### `version-bump.ts`

- `parseVersion(version: string): [number, number, number]` -- Splits a semver string into components
- `bumpVersion(version: string, type: BumpType): string` -- Increments the specified semver component
- `main(): Promise<void>` -- Reads CLI arg, updates `package.json` and `src/index.ts`, prints next steps

## Data Types

```typescript
type BumpType = "major" | "minor" | "patch";
```

## Logging

Writes to `console.log` and `console.error` for human feedback.

## CRUD Entry Points

- **Create:** Not applicable
- **Read:** `Bun.file(pkgPath).text()` reads `package.json`; `Bun.file(indexPath).text()` reads `src/index.ts`
- **Update:** `Bun.write()` overwrites both files with bumped version
- **Delete:** Not applicable

## Style Guide

- Shebang line: `#!/usr/bin/env bun`
- Tab indentation (Biome enforced)
- `const` by default, no explicit `any`
- Direct `Bun.file()` / `Bun.write()` for file I/O

```typescript
async function main(): Promise<void> {
	const bumpType = process.argv[2] as BumpType | undefined;

	if (!bumpType || !["major", "minor", "patch"].includes(bumpType)) {
		console.error(USAGE);
		process.exit(1);
	}

	const pkgPath = `${import.meta.dir}/../package.json`;
	const pkgText = await Bun.file(pkgPath).text();
	const pkg = JSON.parse(pkgText) as { version: string };
	const oldVersion = pkg.version;
	const newVersion = bumpVersion(oldVersion, bumpType);
	pkg.version = newVersion;
	await Bun.write(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`);
}
```
