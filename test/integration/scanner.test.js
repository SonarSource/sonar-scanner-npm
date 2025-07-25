/*
 * sonar-scanner-npm
 * Copyright (C) 2022-2024 SonarSource SA
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

const { scan } = require('@sonar/scan');
const path = require('path');
const {
  getLatestSonarQube,
  createProject,
  generateToken,
  startAndReady,
  stop,
  waitForAnalysisFinished,
  getIssues,
} = require('../../tools/orchestrator/dist');

const TIMEOUT_MS = 500_000;

describe('scanner', function () {
  describe('on local SonarQube', function () {
    let sqPath, token, projectKey;
    beforeAll(async function () {
      sqPath = await getLatestSonarQube();
      await startAndReady(sqPath, TIMEOUT_MS);
      try {
        token = await generateToken();
        projectKey = await createProject();
      } catch (error) {
        console.log(error);
      }
    }, TIMEOUT_MS);
    afterAll(async function () {
      await stop(sqPath);
    }, TIMEOUT_MS);
    it(
      'should run an analysis',
      async function () {
        await scan({
          serverUrl: 'http://localhost:9000',
          token,
          options: {
            'sonar.projectName': projectKey,
            'sonar.projectKey': projectKey,
            'sonar.log.level': 'DEBUG',
            'sonar.sources': path.join(
              __dirname.replace(/\\+/g, '/'),
              '/fixtures/fake_project_for_integration/src',
            ),
          },
        });
        await waitForAnalysisFinished(TIMEOUT_MS);
        const issues = await getIssues(projectKey);
        assert.equal(issues.length, 1);
        assert.deepEqual(issues[0].textRange, {
          startLine: 21,
          endLine: 21,
          startOffset: 0,
          endOffset: 7,
        });
      },
      TIMEOUT_MS,
    );
  });
});
