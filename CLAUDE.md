# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@sonar/scan` is an NPM module that triggers SonarQube Server and SonarCloud analyses on JavaScript codebases without requiring specific tools or Java runtime installation. The scanner detects server capabilities and either uses JRE provisioning (preferred) or falls back to native sonar-scanner-cli.

## Common Commands

| Command                    | Purpose                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `npm run build`            | Compile TypeScript, run license check, generate build/package.json |
| `npm test`                 | Run unit tests                                                     |
| `npm run test-integration` | Run integration tests from test/integration/                       |
| `npm run format`           | Format code with Prettier                                          |
| `npm run check-format`     | Check formatting without changes                                   |
| `npm run license-fix`      | Auto-fix missing license headers                                   |

Run a single test file:

```bash
npx tsx --test test/unit/properties.test.ts
```

## Architecture

### Core Flow (src/scan.ts)

1. **Configuration**: Build scanner properties from env vars, files, CLI args, defaults
2. **Server Detection**: Check server version to determine JRE provisioning support
3. **Execution**: Either provision JRE + run Scanner Engine JAR, or fallback to sonar-scanner-cli

### Key Files

| File                    | Purpose                                                       |
| ----------------------- | ------------------------------------------------------------- |
| `src/index.ts`          | Public API: `scan()`, `customScanner()`, `scanWithCallback()` |
| `src/runner.ts`         | CLI entry point (commander-based)                             |
| `src/scan.ts`           | Main orchestration logic                                      |
| `src/scanner-engine.ts` | Download and run Scanner Engine JAR                           |
| `src/java.ts`           | JRE detection, provisioning, version checking                 |
| `src/properties.ts`     | Configuration building from multiple sources                  |
| `src/scanner-cli.ts`    | Fallback to native sonar-scanner-cli                          |
| `src/request.ts`        | HTTP requests/downloads with proxy support                    |
| `src/types.ts`          | TypeScript interfaces and enums                               |

### Configuration Priority

Properties are resolved in this order (highest to lowest):

1. ScanOptions passed to `scan()`
2. CLI arguments (-D properties)
3. Environment variables (SONAR*\* or npm_config_sonar*\*)
4. sonar-project.properties file
5. package.json sonar config
6. Default values

All configuration uses `ScannerProperty` enum (src/types.ts) and `ScannerProperties` map.

### Caching

Downloads (JRE, Scanner Engine) cached in `~/.sonar/cache/` with SHA256 validation.

## Code Conventions

### License Headers

Every source file requires LGPL-3.0-only header. Run `npm run license-fix` to auto-add. ESLint enforces this.

### Logging

Use structured logging from src/logging.ts:

```typescript
log(LogLevel.DEBUG, 'message', ...args);
logWithPrefix(LogLevel.INFO, 'ComponentName', 'message');
```

### Formatting

Prettier config: 100 char width, trailing commas, single quotes, LF line endings. Pre-commit hook auto-formats staged files.

### External Tools

- Use `gh` CLI to interact with GitHub (issues, PRs, etc.)
- Use `acli` tool to interact with Jira

### Node.js Imports

Always use the `node:` prefix for Node.js built-in modules:

```typescript
// Correct
import path from 'node:path';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

// Incorrect
import path from 'path';
import { spawn } from 'child_process';
```

## Testing

### Unit Tests

Location: `test/unit/`

Uses Node's native test runner with tsx. Mocking is done via dependency injection and `mock.fn()` / `mock.method()` from `node:test`.

Run a single unit test:

```bash
npx tsx --test test/unit/properties.test.ts
```

### Integration Tests

Integration tests run end-to-end scans against a real SonarQube instance. Uses Node's native test runner with tsx.

**How to run:**

```bash
# From project root (requires build first)
npm run build && npm run test-integration

# From integration directory
cd test/integration && npm test
```

The orchestrator (`test/integration/orchestrator/`) manages a local SonarQube instance for testing.
