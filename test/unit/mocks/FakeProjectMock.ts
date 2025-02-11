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
import path from 'path';
import sinon from 'sinon';
import { DEFAULT_SONAR_EXCLUSIONS, SCANNER_BOOTSTRAPPER_NAME } from '../../../src/constants';
import { CacheStatus } from '../../../src/types';

const baseEnvVariables = process.env;

export class FakeProjectMock {
  static getPathForProject(projectName: string) {
    return path.join(__dirname, '../', 'fixtures', projectName);
  }

  private projectPath: string = '';

  private startTimeMs = 1713164095650;

  reset(projectName?: string) {
    if (projectName) {
      this.projectPath = FakeProjectMock.getPathForProject(projectName);
    } else {
      this.projectPath = '';
    }
    sinon.stub(process, 'platform').value('windows');
    sinon.stub(process, 'arch').value('aarch64');
    sinon.stub(process, 'env').value(baseEnvVariables);
    sinon.stub(process, 'cwd').value(() => this.projectPath);
  }

  setEnvironmentVariables(values: { [key: string]: string }) {
    if (values.npm_package_version === undefined) {
      values.npm_package_version = '1.2.3';
    }

    sinon.stub(process, 'env').value(values);
  }

  getStartTime() {
    return this.startTimeMs;
  }

  getExpectedProperties() {
    return {
      'sonar.working.directory': '.scannerwork',
      'sonar.exclusions': DEFAULT_SONAR_EXCLUSIONS,
      'sonar.projectBaseDir': this.projectPath,
      'sonar.scanner.bootstrapStartTime': this.startTimeMs.toString(),
      'sonar.scanner.app': SCANNER_BOOTSTRAPPER_NAME,
      'sonar.scanner.appVersion': '1.2.3',
      'sonar.scanner.wasEngineCacheHit': 'false',
      'sonar.scanner.wasJreCacheHit': CacheStatus.Disabled,
      'sonar.userHome': expect.stringMatching(/\.sonar$/),
      'sonar.scanner.os': 'windows',
      'sonar.scanner.arch': 'aarch64',
    };
  }
}
