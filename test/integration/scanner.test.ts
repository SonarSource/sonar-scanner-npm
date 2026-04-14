/*
 * sonar-scanner-npm
 * Copyright (C) SonarSource Sàrl
 * mailto:info AT sonarsource DOT com
 *
 * You can redistribute and/or modify this program under the terms of
 * the Sonar Source-Available License Version 1, as published by SonarSource Sàrl.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the Sonar Source-Available License for more details.
 *
 * You should have received a copy of the Sonar Source-Available License
 * along with this program; if not, see https://sonarsource.com/license/ssal/
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { scan } from '@sonar/scan';
import {
  getLatestSonarQube,
  createProject,
  generateToken,
  startAndReady,
  stop,
  waitForAnalysisFinished,
  getIssues,
} from './orchestrator/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TIMEOUT_MS = 500_000;
const SONAR_HOST_URL = 'http://localhost:9000';

function getSourcesPath() {
  return path.join(__dirname.replace(/\\+/g, '/'), '/fixtures/fake_project_for_integration/src');
}

async function assertAnalysisSucceeded(projectKey: string) {
  await waitForAnalysisFinished(TIMEOUT_MS);
  const issues = await getIssues(projectKey);
  // The fake project has one intentional issue
  assert.ok(issues.length > 0, 'Expected at least one issue to be detected');
}

describe('scanner', { timeout: TIMEOUT_MS }, () => {
  let sqPath: string;
  let token: string;

  before(async () => {
    sqPath = await getLatestSonarQube();
    await startAndReady(sqPath, TIMEOUT_MS);
    try {
      token = await generateToken();
    } catch (error) {
      console.log(error);
    }
  });

  after(async () => {
    await stop(sqPath);
  });

  it('should run an analysis via API', async () => {
    const projectKey = await createProject();
    await scan({
      serverUrl: SONAR_HOST_URL,
      token,
      options: {
        'sonar.projectName': projectKey,
        'sonar.projectKey': projectKey,
        'sonar.log.level': 'DEBUG',
        'sonar.sources': getSourcesPath(),
      },
    });
    await assertAnalysisSucceeded(projectKey);
  });

  it('should run an analysis via CLI', async () => {
    const projectKey = await createProject();
    // Use the locally installed package bin to ensure we test the right version
    const sonarBin = path.join(__dirname, 'node_modules', '.bin', 'sonar');
    execSync(
      `"${sonarBin}" ` +
        `-Dsonar.host.url=${SONAR_HOST_URL} ` +
        `-Dsonar.token=${token} ` +
        `-Dsonar.projectKey=${projectKey} ` +
        `-Dsonar.projectName=${projectKey} ` +
        `-Dsonar.log.level=DEBUG ` +
        `-Dsonar.sources=${getSourcesPath()}`,
      { stdio: 'inherit', cwd: __dirname },
    );
    await assertAnalysisSucceeded(projectKey);
  });
});
