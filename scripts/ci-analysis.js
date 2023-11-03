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
const path = require('path');
const { execSync } = require('child_process');

// Regular users will call 'require('sonarqube-scanner')' - but not here: eat your own dog food! :-)
const scanner = require('../src').scan;

// We just run an analysis and push it to SonarCloud
// (No need to pass the server URL and the token, we're using the Travis
//  Addon for SonarCloud which does this for you.)
// ---------
const options = {
  'sonar.projectKey': 'SonarSource_sonar-scanner-npm',
  'sonar.organization': 'sonarsource',
  'sonar.projectName': 'SonarScanner for NPM',
  'sonar.projectDescription': 'SonarQube/SonarCloud Scanner for the JavaScript world',
  'sonar.sources': 'src',
  'sonar.tests': 'test',
  'sonar.host.url': 'https://sonarcloud.io',
  'sonar.javascript.lcov.reportPaths': path.join(__dirname, '..', 'coverage', 'lcov.info'),
};

if (!isMasterBranch()) {
  options['sonar.pullrequest.base'] = 'master';
}

scanner({
  options,
}).catch(err => {
  process.exitCode = err.status;
});

function isMasterBranch() {
  try {
    const stdout = execSync('git rev-parse --abbrev-ref HEAD');
    return typeof stdout === 'string' && stdout.trim() === 'master';
  } catch (err) {
    console.error(`failed to retrieve branch information: ${err}`);
  }
  return false;
}
