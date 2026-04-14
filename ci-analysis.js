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
const path = require('node:path');

// Regular users will call 'require('@sonar/scan')' - but not here: eat your own dog food! :-)
const scanner = require('./build').scan;

// We just run an analysis and push it to SonarCloud
// (No need to pass the server URL and the token, we're using the Travis
//  Addon for SonarCloud which does this for you.)
// ---------
scanner({
  options: {
    'sonar.projectKey': 'SonarSource_sonar-scanner-npm',
    'sonar.organization': 'sonarsource',
    'sonar.projectName': 'SonarScanner for NPM',
    'sonar.projectDescription': 'SonarQube/SonarCloud Scanner for the JavaScript world',
    'sonar.sources': 'src',
    'sonar.tests': 'test',
    'sonar.host.url': process.env.SONAR_HOST_URL,
    'sonar.javascript.lcov.reportPaths': path.join(__dirname, 'coverage', 'lcov.info'),
    'sonar.testExecutionReportPaths': path.join(__dirname, 'test-report.xml'),
    'sonar.verbose': 'true',
  },
}).catch(err => {
  process.exitCode = err.status;
});
