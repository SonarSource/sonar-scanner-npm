# Developer Guide

## Building

```bash
npm install
npm run build
```

The build process:

1. Runs ESLint license header check (`npm run license`)
2. Compiles TypeScript (`tsc`)
3. Generates `build/package.json` using [package-manifest-generator](https://www.npmjs.com/package/package-manifest-generator)

The generated `build/package.json` is created from:

- Dependencies extracted from the compiled JS files
- Metadata from `.pmgrc.toml` (name, description, bin, engines, etc.)
- Version defaults to `SNAPSHOT` (configured in `.pmgrc.toml`)

## Testing

```bash
# Run unit tests
npm test

# Run a single test file
npx tsx --test test/unit/properties.test.ts

# Run integration tests (requires build first)
npm run build
npm run test-integration
```

## Releasing

Releases are handled by the GitHub Actions workflow (`.github/workflows/release.yml`) when a release is published on GitHub.

### Release Process

1. Create a new release on GitHub
2. Set the tag name (e.g., `1.2.3`)
3. The workflow will:
   - Build the package with the release version
   - Publish to Artifactory
   - Publish to npm under two package names:
     - `@sonar/scan` (primary)
     - `sonarqube-scanner` (legacy alias for backwards compatibility)

### npm Tags

The npm tag is determined automatically:

| Condition                             | npm tag                                  |
| ------------------------------------- | ---------------------------------------- |
| Prerelease checkbox is checked        | `next`                                   |
| Release body contains `[skip-latest]` | `release-X.x` (where X is major version) |
| Otherwise                             | `latest`                                 |

### Releasing Without Updating `latest`

When releasing a patch for an older major version (e.g., releasing `1.2.4` when `2.x` is current), you don't want to move the `latest` tag. To do this:

1. Create the release on GitHub
2. Add `[skip-latest]` anywhere in the release notes body
3. Publish the release

The package will be published with a tag like `release-1.x` instead of `latest`, so users running `npm install @sonar/scan` will continue to get the current latest version.

Example release notes:

```
## Bug Fixes
- Fixed issue with proxy configuration

[skip-latest]
```

### Testing the Release Workflow (Dry Run)

You can test the release workflow without actually publishing by using the manual trigger:

1. Go to **Actions** → **Release** workflow
2. Click **Run workflow**
3. Fill in the inputs:
   - **Dry run**: ✅ checked (skips all publish steps)
   - **Release tag**: The version to simulate (e.g., `1.2.3`)
   - **Simulate prerelease**: Check to test prerelease behavior
   - **Simulate [skip-latest]**: Check to test the skip-latest behavior

The workflow will run and display the npm tag that would be used without performing any actual build or publish operations.

### Sonar Update Center

After publishing a new release, the [Sonar Update Center](https://xtranet-sonarsource.atlassian.net/wiki/spaces/DOC/pages/3385294896/The+Sonar+Update+Center) needs to be updated. This makes release information available at `downloads.sonarsource.com` for documentation and tooling.

#### Update Process

1. **Create a PR** in [sonar-update-center-properties](https://github.com/SonarSource/sonar-update-center-properties) to update `scannernpm.properties`

2. **Add the new version entry** with the following format:

   ```properties
   X.Y.Z.description=Short description of the release
   X.Y.Z.date=YYYY-MM-DD
   X.Y.Z.changelogUrl=https://github.com/SonarSource/sonar-scanner-npm/releases/tag/X.Y.Z
   X.Y.Z.downloadUrl=https://www.npmjs.com/package/@sonar/scan/v/X.Y.Z
   ```

3. **Update version lists**:
   - Move the previous public version to `archivedVersions`
   - Set the new version in `publicVersions`

4. **After PR is merged**, run the scanner release notes GitHub Action on the [SonarQube-Documentation](https://github.com/SonarSource/SonarQube-Documentation) repo to create a PR that pushes the update to product docs

#### Reference

- Initial setup PR: [sonar-update-center-properties#742](https://github.com/SonarSource/sonar-update-center-properties/pull/742)
- Published JSON: `https://downloads.sonarsource.com/sonarqube/update/scannernpm.json`
