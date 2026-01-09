/*
 * sonar-scanner-npm
 * Copyright (C) 2022-2025 SonarSource Sàrl
 * mailto:info AT sonarsource DOT com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
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

async function assertOneIssueAtLine21(projectKey: string) {
  await waitForAnalysisFinished(TIMEOUT_MS);
  const issues = await getIssues(projectKey);
  assert.strictEqual(issues.length, 1);
  assert.deepStrictEqual(issues[0].textRange, {
    startLine: 21,
    endLine: 21,
    startOffset: 0,
    endOffset: 7,
  });
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
    await assertOneIssueAtLine21(projectKey);
  });

  it('should run an analysis via CLI', async () => {
    const projectKey = await createProject();
    execSync(
      `npx sonar ` +
        `-Dsonar.host.url=${SONAR_HOST_URL} ` +
        `-Dsonar.token=${token} ` +
        `-Dsonar.projectKey=${projectKey} ` +
        `-Dsonar.projectName=${projectKey} ` +
        `-Dsonar.log.level=DEBUG ` +
        `-Dsonar.sources=${getSourcesPath()}`,
      { stdio: 'inherit' },
    );
    await assertOneIssueAtLine21(projectKey);
  });
});
