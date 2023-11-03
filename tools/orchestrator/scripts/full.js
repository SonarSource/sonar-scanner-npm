/*
 * sonar-scanner-npm
 * Copyright (C) 2022-2023 SonarSource SA
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

const { getLatestSonarQube } = require('../dist/download');
const {
  createProject,
  generateToken,
  startAndReady,
  stop,
  waitForAnalysisFinished,
  getIssues,
} = require('../dist/sonarqube');

(async () => {
  try {
    const latest = await getLatestSonarQube();
    console.log('finished', latest);
    await startAndReady(latest);
    const token = await generateToken();
    console.log('got token', token);
    const projectKey = await createProject();
    console.log('got project', projectKey);
    await waitForAnalysisFinished();
    console.log('no analysis waiting');
    const issues = await getIssues(projectKey);
    console.log('got issues', issues);
    await stop(latest);
  } catch (error) {
    console.log('got err', error.response.data);
  }
})();
