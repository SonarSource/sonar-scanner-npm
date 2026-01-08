# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@sonar/scan` is an NPM module that triggers SonarQube Server and SonarCloud analyses on JavaScript codebases without requiring specific tools or Java runtime installation. The scanner detects server capabilities and either uses JRE provisioning (preferred, SonarQube 10.6+) or falls back to native sonar-scanner-cli.

## Common Commands

| Command                    | Purpose                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `npm run build`            | Compile TypeScript, run license check, generate build/package.json |
| `npm test`                 | Run Jest unit tests with coverage                                  |
| `npm run test-integration` | Run integration tests from test/integration/                       |
| `npm run format`           | Format code with Prettier                                          |
| `npm run check-format`     | Check formatting without changes                                   |
| `npm run license-fix`      | Auto-fix missing license headers                                   |

Run a single test file:

```bash
npx jest test/unit/properties.test.ts
```

Run tests matching a pattern:

```bash
npx jest --testNamePattern="should build properties"
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

## Testing

### Unit Tests

Location: `test/unit/`

```
test/unit/
├── tsconfig.json        # TypeScript config for unit tests
├── setup.ts             # Jest setup - mocks logging to suppress output
├── mocks/               # Test mocks (ChildProcessMock, FakeProjectMock)
├── fixtures/            # Test fixture projects
└── *.test.ts            # Test files
```

Run a single unit test:

```bash
npx jest test/unit/properties.test.ts
npx jest --testNamePattern="should build properties"
```

### Integration Tests

Integration tests run end-to-end scans against a real SonarQube instance. Uses Node's native test runner with tsx.

**Structure:**

```
test/integration/
├── package.json              # Separate npm project (ESM, tsx, node:test)
├── tsconfig.json             # TypeScript config for integration tests
├── scanner.test.ts           # Integration tests (API and CLI)
├── orchestrator/             # SonarQube lifecycle management
│   ├── download.ts           # Download SonarQube
│   ├── sonarqube.ts          # Start/stop, API calls
│   ├── index.ts              # Exports
│   └── stop.java             # Java helper to stop SonarQube
└── fixtures/
    └── fake_project_for_integration/
        └── src/index.js      # Test project with intentional code issue
```

**How to run:**

```bash
# From project root (requires build first)
npm run build && npm run test-integration

# From integration directory
cd test/integration && npm test
```

**Orchestrator functions (from `test/integration/orchestrator/`):**

Manages a local SonarQube instance:

- Downloads SonarQube Community Edition (cached in `~/.sonar/sonarqube/`)
- Starts/stops SonarQube on localhost:9000
- Generates authentication tokens
- Creates test projects
- Polls for analysis completion

Key functions:

- `getLatestSonarQube()` - Download/cache SonarQube
- `startAndReady(sqPath, maxWaitMs)` - Start and wait until operational
- `stop(sqPath)` - Stop SonarQube instance
- `generateToken()` - Generate GLOBAL_ANALYSIS_TOKEN
- `createProject()` - Create project with random key
- `waitForAnalysisFinished(maxWaitMs)` - Poll until analysis queue empty
- `getIssues(projectKey)` - Fetch detected issues

**What the integration test validates:**

1. SonarQube provisioning and startup
2. Token generation and project creation
3. Scanner invocation via API (`scan()` function)
4. Scanner invocation via CLI (`npx sonar`)
5. Issue detection (fake project has intentional issue at line 21)
6. Result verification (asserts exactly 1 issue found)

**Configuration:**

- Timeout: 500 seconds (SonarQube startup is slow)
- SonarQube credentials: admin:admin (hardcoded in orchestrator)
- Optional env vars: `ARTIFACTORY_URL`, `ARTIFACTORY_ACCESS_TOKEN` for SonarQube download
