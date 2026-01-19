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
import { describe, it, afterEach, mock, beforeEach } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import {
  DEFAULT_SONAR_EXCLUSIONS,
  REGION_US,
  REGIONS,
  SCANNER_BOOTSTRAPPER_NAME,
  SONARCLOUD_API_BASE_URL,
  SONARCLOUD_URL,
} from '../../src/constants';
import { setDeps, resetDeps } from '../../src/deps';
import { getHostProperties, getProperties } from '../../src/properties';
import { CacheStatus, type ScannerProperties, ScannerProperty } from '../../src/types';
import { createMockProcessDeps } from './test-helpers';

// Environment variables that need to be set on global process.env for proxy-from-env library
// Note: On Windows, env vars are case-insensitive, so HTTP_PROXY and http_proxy are the same
const PROXY_ENV_VARS = ['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY'];
// Store original env values to restore after tests
const originalEnvValues: { [key: string]: string | undefined } = {};
// Track which env vars we've modified in the current test
let modifiedEnvVars: string[] = [];

class FakeProjectMock {
  static getPathForProject(projectName: string) {
    return path.join(__dirname, 'fixtures', projectName);
  }

  private projectPath: string = '';

  private startTimeMs = 1713164095650;

  private envVariables: { [key: string]: string } = {};

  reset(projectName?: string) {
    if (projectName) {
      this.projectPath = FakeProjectMock.getPathForProject(projectName);
    } else {
      this.projectPath = '';
    }
    this.envVariables = {};
    this.applyDeps();
  }

  setEnvironmentVariables(values: { [key: string]: string }) {
    this.envVariables = values;
    this.applyDeps();

    // Also set proxy variables on global process.env for proxy-from-env library
    // Only set/modify the keys that are provided in values (don't delete others)
    for (const key of PROXY_ENV_VARS) {
      if (key in values) {
        // Save original value if not already saved
        if (!(key in originalEnvValues)) {
          originalEnvValues[key] = process.env[key];
        }
        process.env[key] = values[key];
        modifiedEnvVars.push(key);
      }
    }
  }

  private applyDeps() {
    setDeps({
      process: createMockProcessDeps({
        platform: 'win32' as NodeJS.Platform,
        arch: 'arm64' as NodeJS.Architecture,
        env: this.envVariables,
        cwd: () => this.projectPath,
      }),
    });
  }

  getStartTime() {
    return this.startTimeMs;
  }

  getExpectedProperties(): ScannerProperties {
    return {
      'sonar.working.directory': '.scannerwork',
      'sonar.exclusions': DEFAULT_SONAR_EXCLUSIONS,
      'sonar.projectBaseDir': this.projectPath,
      'sonar.scanner.bootstrapStartTime': this.startTimeMs.toString(),
      'sonar.scanner.app': SCANNER_BOOTSTRAPPER_NAME,
      'sonar.scanner.appVersion': 'SNAPSHOT',
      'sonar.scanner.wasEngineCacheHit': 'false',
      'sonar.scanner.wasJreCacheHit': CacheStatus.Disabled,
      'sonar.scanner.os': 'win32',
      'sonar.scanner.arch': 'arm64',
    };
  }
}

function restoreProxyEnvVars() {
  // Only restore keys we actually modified
  for (const key of modifiedEnvVars) {
    if (key in originalEnvValues) {
      if (originalEnvValues[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnvValues[key];
      }
      delete originalEnvValues[key];
    }
  }
  modifiedEnvVars = [];
}

// Mock console.log to suppress output and capture log calls
const mockLog = mock.fn();
mock.method(console, 'log', mockLog);

const projectHandler = new FakeProjectMock();

beforeEach(() => {
  mockLog.mock.resetCalls();
});

afterEach(() => {
  resetDeps();
  restoreProxyEnvVars();
});

// Helper to check if a specific log level and message pattern was logged
function assertLoggedWithLevel(level: string, messagePattern: string | RegExp): void {
  const found = mockLog.mock.calls.some(call =>
    call.arguments.some((arg: unknown) => {
      if (typeof arg !== 'string') return false;
      // Check if the log entry includes the level and matches the message
      const matchesPattern =
        messagePattern instanceof RegExp ? messagePattern.test(arg) : arg.includes(messagePattern);
      return arg.includes(level) || matchesPattern;
    }),
  );
  assert.ok(
    found,
    `Expected log with level ${level} matching ${messagePattern}. Calls: ${JSON.stringify(mockLog.mock.calls.map(c => c.arguments))}`,
  );
}

// Helper to assert properties match expected, with sonar.userHome checked via pattern if not explicitly expected
function assertProperties(actual: ScannerProperties, expected: ScannerProperties): void {
  // If sonar.userHome is explicitly set in expected, include it in comparison
  if ('sonar.userHome' in expected) {
    assert.deepStrictEqual(actual, expected);
    return;
  }

  // Otherwise check sonar.userHome ends with .sonar (OS-dependent path)
  const userHome = actual['sonar.userHome'];
  assert.ok(
    userHome?.endsWith('.sonar') || userHome?.includes('.sonar'),
    `Expected sonar.userHome to contain .sonar, got: ${userHome}`,
  );

  // Compare the rest
  const { 'sonar.userHome': _actualUserHome, ...actualRest } = actual;
  assert.deepStrictEqual(actualRest, expected);
}

describe('getProperties', () => {
  it('should provide default values', () => {
    projectHandler.reset('fake_project_with_no_package_file');
    projectHandler.setEnvironmentVariables({});

    const properties = getProperties({}, projectHandler.getStartTime());

    assertProperties(properties, {
      ...projectHandler.getExpectedProperties(),
      'sonar.host.url': SONARCLOUD_URL,
      'sonar.scanner.apiBaseUrl': SONARCLOUD_API_BASE_URL,
      'sonar.scanner.internal.isSonarCloud': 'true',
    });
  });

  it('should ignore undefined values and convert null to empty strings', () => {
    projectHandler.reset('fake_project_with_no_package_file');
    projectHandler.setEnvironmentVariables({});

    const properties = getProperties(
      {
        options: {
          'sonar.analysis.mode': undefined as unknown as string,
          'sonar.analysis.mode2': null as unknown as string,
        },
      },
      projectHandler.getStartTime(),
    );

    assertProperties(properties, {
      ...projectHandler.getExpectedProperties(),
      'sonar.host.url': SONARCLOUD_URL,
      'sonar.scanner.apiBaseUrl': SONARCLOUD_API_BASE_URL,
      'sonar.scanner.internal.isSonarCloud': 'true',
      'sonar.analysis.mode2': '',
    });
  });

  it('should support equal signs in values', () => {
    projectHandler.reset('fake_project_with_no_package_file');
    projectHandler.setEnvironmentVariables({});

    const properties = getProperties({}, projectHandler.getStartTime(), {
      define: ['sonar.scanner.javaOpts=-XX:+PrintFlagsFinal -Xlog:gc*:file=gc.log'],
    });

    assertProperties(properties, {
      ...projectHandler.getExpectedProperties(),
      'sonar.host.url': SONARCLOUD_URL,
      'sonar.scanner.apiBaseUrl': SONARCLOUD_API_BASE_URL,
      'sonar.scanner.internal.isSonarCloud': 'true',
      'sonar.scanner.javaOpts': '-XX:+PrintFlagsFinal -Xlog:gc*:file=gc.log',
    });
  });

  it('should set verbose mode when CLI debug flag is set', () => {
    projectHandler.reset('fake_project_with_no_package_file');
    projectHandler.setEnvironmentVariables({});

    const properties = getProperties({}, projectHandler.getStartTime(), {
      debug: true,
    });

    assertProperties(properties, {
      ...projectHandler.getExpectedProperties(),
      'sonar.host.url': SONARCLOUD_URL,
      'sonar.scanner.apiBaseUrl': SONARCLOUD_API_BASE_URL,
      'sonar.scanner.internal.isSonarCloud': 'true',
      'sonar.verbose': 'true',
    });
  });

  describe('should handle JS API scan options params correctly', () => {
    it('should detect custom SonarCloud endpoint', () => {
      projectHandler.reset('fake_project_with_no_package_file');
      projectHandler.setEnvironmentVariables({});

      const properties = getProperties(
        {
          options: {
            'sonar.projectKey': 'use-this-project-key',
            'sonar.scanner.apiBaseUrl': 'https://dev.sc-dev.io',
          },
        },
        projectHandler.getStartTime(),
      );

      assertProperties(properties, {
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': SONARCLOUD_URL,
        'sonar.scanner.apiBaseUrl': 'https://dev.sc-dev.io',
        'sonar.scanner.internal.isSonarCloud': 'true',
        'sonar.projectKey': 'use-this-project-key',
      });
    });

    it('should detect and use user-provided scan option params', () => {
      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({});

      const properties = getProperties(
        {
          serverUrl: 'http://localhost/sonarqube',
          token: 'dummy-token',
          verbose: true,
          options: {
            'sonar.projectKey': 'use-this-project-key',
            'sonar.scanner.os': 'some-os',
            'sonar.working.directory': '.override',
          },
        },
        projectHandler.getStartTime(),
      );

      assertProperties(properties, {
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'http://localhost/sonarqube',
        'sonar.scanner.apiBaseUrl': 'http://localhost/sonarqube/api/v2',
        'sonar.scanner.internal.isSonarCloud': 'false',
        'sonar.token': 'dummy-token',
        'sonar.verbose': 'true',
        'sonar.projectKey': 'use-this-project-key',
        'sonar.projectName': 'Foo',
        'sonar.projectVersion': '1.0-SNAPSHOT',
        'sonar.sources': 'the-sources',
        'sonar.scanner.os': 'some-os',
        'sonar.working.directory': '.override',
      });
    });

    it('should not set verbose mode when explicitly turned off', () => {
      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({});

      const properties = getProperties(
        {
          serverUrl: 'http://localhost/sonarqube',
          verbose: false,
        },
        projectHandler.getStartTime(),
      );

      assert.strictEqual(properties['sonar.verbose'], 'false');
    });
  });

  describe('should handle package.json correctly', () => {
    it('should generate default properties with package.json', () => {
      projectHandler.reset('fake_project_with_basic_package_file');
      projectHandler.setEnvironmentVariables({});

      const properties = getProperties(
        {
          serverUrl: 'http://localhost/sonarqube',
        },
        projectHandler.getStartTime(),
      );

      assertProperties(properties, {
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'http://localhost/sonarqube',
        'sonar.scanner.apiBaseUrl': 'http://localhost/sonarqube/api/v2',
        'sonar.scanner.internal.isSonarCloud': 'false',
        'sonar.javascript.lcov.reportPaths': 'coverage/lcov.info',
        'sonar.projectVersion': '1.0.0',
        'sonar.exclusions': DEFAULT_SONAR_EXCLUSIONS + ',coverage/**',
        'sonar.scanner.app': SCANNER_BOOTSTRAPPER_NAME,
        'sonar.scanner.appVersion': 'SNAPSHOT',
      });
    });

    it('should use all available information from package.json', () => {
      projectHandler.reset('fake_project_with_complete_package_file');
      projectHandler.setEnvironmentVariables({});

      const properties = getProperties(
        {
          serverUrl: 'http://localhost/sonarqube',
        },
        projectHandler.getStartTime(),
      );

      assertProperties(properties, {
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'http://localhost/sonarqube',
        'sonar.scanner.apiBaseUrl': 'http://localhost/sonarqube/api/v2',
        'sonar.scanner.internal.isSonarCloud': 'false',
        'sonar.projectKey': 'fake-project',
        'sonar.projectName': 'fake-project',
        'sonar.projectDescription': 'A fake project',
        'sonar.projectVersion': '1.0.0',
        'sonar.links.homepage': 'https://github.com/fake/project',
        'sonar.links.issue': 'https://github.com/fake/project/issues',
        'sonar.links.scm': 'git+https://github.com/fake/project.git',
        'sonar.testExecutionReportPaths': 'xunit.xml',
      });
    });

    it('should allow package.json not to exist', () => {
      projectHandler.reset('fake_project_with_no_package_file');
      projectHandler.setEnvironmentVariables({});

      const properties = getProperties(
        {
          serverUrl: 'http://localhost/sonarqube',
        },
        projectHandler.getStartTime(),
      );

      assertProperties(properties, {
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'http://localhost/sonarqube',
        'sonar.scanner.apiBaseUrl': 'http://localhost/sonarqube/api/v2',
        'sonar.scanner.internal.isSonarCloud': 'false',
      });
    });

    it('should slugify scoped package names', () => {
      projectHandler.reset('fake_project_with_scoped_package_name');
      projectHandler.setEnvironmentVariables({});

      const properties = getProperties(
        {
          serverUrl: 'http://localhost/sonarqube',
        },
        projectHandler.getStartTime(),
      );

      assertProperties(properties, {
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'http://localhost/sonarqube',
        'sonar.scanner.apiBaseUrl': 'http://localhost/sonarqube/api/v2',
        'sonar.scanner.internal.isSonarCloud': 'false',
        'sonar.projectKey': 'myfake-basic-project',
        'sonar.projectName': '@my/fake-basic-project',
        'sonar.projectVersion': '1.0.0',
      });
    });

    it('should detect jest report file', () => {
      projectHandler.reset('fake_project_with_jest_report_file');
      projectHandler.setEnvironmentVariables({});

      const properties = getProperties(
        {
          serverUrl: 'http://localhost/sonarqube',
        },
        projectHandler.getStartTime(),
      );

      assertProperties(properties, {
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'http://localhost/sonarqube',
        'sonar.scanner.apiBaseUrl': 'http://localhost/sonarqube/api/v2',
        'sonar.scanner.internal.isSonarCloud': 'false',
        'sonar.javascript.lcov.reportPaths': 'jest-coverage/lcov.info',
        'sonar.projectKey': 'fake-basic-project',
        'sonar.projectName': 'fake-basic-project',
        'sonar.projectVersion': '1.0.0',
        'sonar.exclusions': DEFAULT_SONAR_EXCLUSIONS + ',jest-coverage/**',
      });
    });

    it('should detect nyc report file', () => {
      projectHandler.reset('fake_project_with_nyc_report_file');
      projectHandler.setEnvironmentVariables({});

      const properties = getProperties(
        {
          serverUrl: 'http://localhost/sonarqube',
        },
        projectHandler.getStartTime(),
      );

      assertProperties(properties, {
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'http://localhost/sonarqube',
        'sonar.scanner.apiBaseUrl': 'http://localhost/sonarqube/api/v2',
        'sonar.scanner.internal.isSonarCloud': 'false',
        'sonar.javascript.lcov.reportPaths': 'nyc-coverage/lcov.info',
        'sonar.projectKey': 'fake-basic-project',
        'sonar.projectName': 'fake-basic-project',
        'sonar.projectVersion': '1.0.0',
        'sonar.exclusions': DEFAULT_SONAR_EXCLUSIONS + ',nyc-coverage/**',
      });
    });
  });

  describe('should handle sonar-project.properties correctly', () => {
    it('should parse sonar-project.properties properly', () => {
      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({});

      const properties = getProperties(
        {
          serverUrl: 'http://localhost/sonarqube',
        },
        projectHandler.getStartTime(),
      );

      assert.strictEqual(properties['sonar.token'], undefined);
    });
    it('should not set default values if sonar-project.properties file exists', () => {
      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({});

      const properties = getProperties(
        {
          serverUrl: 'http://localhost/sonarqube',
        },
        projectHandler.getStartTime(),
      );

      assertProperties(properties, {
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'http://localhost/sonarqube',
        'sonar.scanner.apiBaseUrl': 'http://localhost/sonarqube/api/v2',
        'sonar.scanner.internal.isSonarCloud': 'false',
        'sonar.projectKey': 'foo',
        'sonar.projectName': 'Foo',
        'sonar.projectVersion': '1.0-SNAPSHOT',
        'sonar.sources': 'the-sources',
      });
    });
  });

  describe('should handle environment variables', () => {
    it('should detect known environment variables', () => {
      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({
        SONAR_TOKEN: 'my-token',
        SONAR_HOST_URL: 'https://sonarqube.com/',
        SONAR_USER_HOME: '/tmp/.sonar/',
        SONAR_ORGANIZATION: 'my-org',
      });

      const properties = getProperties({}, projectHandler.getStartTime());

      assertProperties(properties, {
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'https://sonarqube.com',
        'sonar.scanner.apiBaseUrl': 'https://sonarqube.com/api/v2',
        'sonar.scanner.internal.isSonarCloud': 'false',
        'sonar.projectKey': 'foo',
        'sonar.projectName': 'Foo',
        'sonar.projectVersion': '1.0-SNAPSHOT',
        'sonar.sources': 'the-sources',
        'sonar.token': 'my-token',
        'sonar.userHome': '/tmp/.sonar/',
        'sonar.organization': 'my-org',
      });
    });

    it('should detect generic environment variables', () => {
      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({
        SONAR_SCANNER_SOME_VAR: 'some-value',
      });

      const properties = getProperties({}, projectHandler.getStartTime());

      assertProperties(properties, {
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': SONARCLOUD_URL,
        'sonar.scanner.apiBaseUrl': SONARCLOUD_API_BASE_URL,
        'sonar.scanner.internal.isSonarCloud': 'true',
        'sonar.projectKey': 'foo',
        'sonar.projectName': 'Foo',
        'sonar.projectVersion': '1.0-SNAPSHOT',
        'sonar.sources': 'the-sources',
        'sonar.scanner.someVar': 'some-value',
      });
    });

    it('should detect npm_config_sonar_scanner_ environment variables and convert to camelCase', () => {
      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({
        npm_config_sonar_scanner_some_option: 'npm-value',
      });

      const properties = getProperties({}, projectHandler.getStartTime());

      assertProperties(properties, {
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': SONARCLOUD_URL,
        'sonar.scanner.apiBaseUrl': SONARCLOUD_API_BASE_URL,
        'sonar.scanner.internal.isSonarCloud': 'true',
        'sonar.projectKey': 'foo',
        'sonar.projectName': 'Foo',
        'sonar.projectVersion': '1.0-SNAPSHOT',
        'sonar.sources': 'the-sources',
        'sonar.scanner.someOption': 'npm-value',
      });
    });

    const proxyTestCases = [
      ['http', 'HTTP_PROXY'],
      ['https', 'HTTPS_PROXY'],
    ] as const;

    for (const [protocol, envName] of proxyTestCases) {
      it(`should detect ${protocol}_proxy env variable`, () => {
        projectHandler.reset('fake_project_with_sonar_properties_file');
        projectHandler.setEnvironmentVariables({
          [envName]: `${protocol}://user:pass@my-proxy.io:1234`,
          SONAR_HOST_URL: `${protocol}://localhost/sonarqube`,
        });

        const properties = getProperties({}, projectHandler.getStartTime());

        assertProperties(properties, {
          ...projectHandler.getExpectedProperties(),
          'sonar.host.url': `${protocol}://localhost/sonarqube`,
          'sonar.scanner.apiBaseUrl': `${protocol}://localhost/sonarqube/api/v2`,
          'sonar.scanner.internal.isSonarCloud': 'false',
          'sonar.projectKey': 'foo',
          'sonar.projectName': 'Foo',
          'sonar.projectVersion': '1.0-SNAPSHOT',
          'sonar.sources': 'the-sources',
          'sonar.scanner.proxyHost': 'my-proxy.io',
          'sonar.scanner.proxyPort': '1234',
          'sonar.scanner.proxyUser': 'user',
          'sonar.scanner.proxyPassword': 'pass',
        });
      });
    }

    it('should use SONAR_SCANNER_JSON_PARAMS', () => {
      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({
        SONAR_SCANNER_JSON_PARAMS: JSON.stringify({
          'sonar.token': 'this-is-another-token',
        }),
      });

      const properties = getProperties({}, projectHandler.getStartTime());

      assertProperties(properties, {
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': SONARCLOUD_URL,
        'sonar.scanner.apiBaseUrl': SONARCLOUD_API_BASE_URL,
        'sonar.scanner.internal.isSonarCloud': 'true',
        'sonar.projectKey': 'foo',
        'sonar.projectName': 'Foo',
        'sonar.projectVersion': '1.0-SNAPSHOT',
        'sonar.sources': 'the-sources',
        'sonar.token': 'this-is-another-token',
      });
    });

    it('should not throw if SONAR_SCANNER_JSON_PARAMS is incorrectly formatted', () => {
      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({
        SONAR_SCANNER_JSON_PARAMS: 'this is def not JSON',
      });

      const properties = getProperties({}, projectHandler.getStartTime());

      assertProperties(properties, {
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': SONARCLOUD_URL,
        'sonar.scanner.apiBaseUrl': SONARCLOUD_API_BASE_URL,
        'sonar.scanner.internal.isSonarCloud': 'true',
        'sonar.projectKey': 'foo',
        'sonar.projectName': 'Foo',
        'sonar.projectVersion': '1.0-SNAPSHOT',
        'sonar.sources': 'the-sources',
      });
      assertLoggedWithLevel('WARN', 'Failed to parse JSON parameters');
    });

    it('should use deprecated SONARQUBE_SCANNER_PARAMS', () => {
      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({
        SONARQUBE_SCANNER_PARAMS: JSON.stringify({
          'sonar.token': 'this-is-another-token',
        }),
      });

      const properties = getProperties({}, projectHandler.getStartTime());

      assertProperties(properties, {
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': SONARCLOUD_URL,
        'sonar.scanner.apiBaseUrl': SONARCLOUD_API_BASE_URL,
        'sonar.scanner.internal.isSonarCloud': 'true',
        'sonar.projectKey': 'foo',
        'sonar.projectName': 'Foo',
        'sonar.projectVersion': '1.0-SNAPSHOT',
        'sonar.sources': 'the-sources',
        'sonar.token': 'this-is-another-token',
      });
      assertLoggedWithLevel(
        'WARN',
        'SONARQUBE_SCANNER_PARAMS is deprecated, please use SONAR_SCANNER_JSON_PARAMS instead',
      );
    });

    it('should warn and replace deprecated properties', () => {
      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({
        SONAR_SCANNER_JSON_PARAMS: JSON.stringify({
          'sonar.ws.timeout': '000',
        }),
      });

      const properties = getProperties(
        {
          options: {
            'sonar.scanner.responseTimeout': '111',
            'http.proxyHost': 'my-proxy.io',
            'sonar.login': 'my-login',
          },
        },
        projectHandler.getStartTime(),
      );

      // Check specific deprecated properties handling
      assert.strictEqual(properties['sonar.scanner.responseTimeout'], '111');
      assert.strictEqual(properties['sonar.ws.timeout'], '111');
      assert.strictEqual(properties['sonar.scanner.proxyHost'], 'my-proxy.io');
      assert.strictEqual(properties['http.proxyHost'], 'my-proxy.io');
      assert.strictEqual(properties['sonar.login'], 'my-login');
      assert.strictEqual(properties['sonar.token'], 'my-login');
      assertLoggedWithLevel(
        'WARN',
        'Both properties "sonar.ws.timeout" and "sonar.scanner.responseTimeout" are set',
      );
      assertLoggedWithLevel('WARN', 'Property "http.proxyHost" is deprecated');
    });

    it('should set the [ScannerProperty.SonarScannerCliVersion] for all existing formats', () => {
      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({
        npm_config_sonar_scanner_version: '4.8.1.3023',
      });

      const npmConfigProperties = getProperties({}, projectHandler.getStartTime());
      assert.strictEqual(npmConfigProperties[ScannerProperty.SonarScannerCliVersion], '4.8.1.3023');

      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({
        SONAR_SCANNER_VERSION: '5.0.0.2966',
      });

      const SonarScannerProperties = getProperties({}, projectHandler.getStartTime());
      assert.strictEqual(
        SonarScannerProperties[ScannerProperty.SonarScannerCliVersion],
        '5.0.0.2966',
      );

      projectHandler.reset('fake_project_with_sonar_properties_file');
      const jsScanOptionsProperties = getProperties(
        {
          version: '4.7.0.2747',
        },
        projectHandler.getStartTime(),
      );
      assert.strictEqual(
        jsScanOptionsProperties[ScannerProperty.SonarScannerCliVersion],
        '4.7.0.2747',
      );
    });

    it('should support the old SONAR_BINARY_CACHE environment variable', () => {
      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({
        SONAR_BINARY_CACHE: '/tmp/.sonar/',
      });

      const properties = getProperties({}, projectHandler.getStartTime());

      assert.strictEqual(properties['sonar.userHome'], '/tmp/.sonar/');
    });

    it('should support the old SONAR_SCANNER_MIRROR environment variable', () => {
      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({
        SONAR_SCANNER_MIRROR: 'https://mirror.com/',
      });

      const properties = getProperties({}, projectHandler.getStartTime());

      assert.strictEqual(properties['sonar.scanner.mirror'], 'https://mirror.com/');
    });
  });

  describe('should handle command line properties', () => {
    it('should use command line properties', () => {
      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({});

      const properties = getProperties(
        {
          serverUrl: 'http://localhost/sonarqube',
        },
        projectHandler.getStartTime(),
        { define: ['sonar.token=my-token'] },
      );

      assertProperties(properties, {
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'http://localhost/sonarqube',
        'sonar.scanner.apiBaseUrl': 'http://localhost/sonarqube/api/v2',
        'sonar.scanner.internal.isSonarCloud': 'false',
        'sonar.projectKey': 'foo',
        'sonar.projectName': 'Foo',
        'sonar.projectVersion': '1.0-SNAPSHOT',
        'sonar.sources': 'the-sources',
        'sonar.token': 'my-token',
      });
    });
  });

  describe('should handle priorities properly', () => {
    it('priority should respect CLI > Project conf > Global conf > Env', () => {
      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({
        SONAR_TOKEN: 'ignored',
        SONAR_HOST_URL: 'http://ignored',
        SONAR_USER_HOME: '/tmp/used',
        SONAR_ORGANIZATION: 'ignored',
        SONAR_SCANNER_JSON_PARAMS: JSON.stringify({
          'sonar.userHome': 'ignored',
          'sonar.scanner.someVar': 'used',
        }),
      });

      const properties = getProperties(
        {
          serverUrl: 'http://localhost/sonarqube',
          options: {
            'sonar.projectKey': 'used',
            'sonar.token': 'ignored',
            'sonar.organization': 'used',
          },
        },
        projectHandler.getStartTime(),
        { define: ['sonar.token=only-this-will-be-used'] },
      );

      assertProperties(properties, {
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'http://localhost/sonarqube',
        'sonar.scanner.apiBaseUrl': 'http://localhost/sonarqube/api/v2',
        'sonar.scanner.internal.isSonarCloud': 'false',
        'sonar.projectKey': 'used',
        'sonar.projectName': 'Foo',
        'sonar.projectVersion': '1.0-SNAPSHOT',
        'sonar.sources': 'the-sources',
        'sonar.token': 'only-this-will-be-used',
        'sonar.userHome': '/tmp/used',
        'sonar.organization': 'used',
        'sonar.scanner.someVar': 'used',
      });
    });

    it('should correctly merge package.json and sonar-project.properties', () => {
      projectHandler.reset('fake_project_with_package_and_sonar_properties');
      projectHandler.setEnvironmentVariables({});

      const properties = getProperties(
        {
          serverUrl: 'http://localhost/sonarqube',
        },
        projectHandler.getStartTime(),
      );

      assertProperties(properties, {
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'http://localhost/sonarqube',
        'sonar.scanner.apiBaseUrl': 'http://localhost/sonarqube/api/v2',
        'sonar.scanner.internal.isSonarCloud': 'false',
        'sonar.projectKey': 'that-is-the-project-key',
        'sonar.projectName': 'that-is-the-project-key',
        'sonar.projectVersion': '1.0.0',
        'sonar.sources': 'the-sources',
      });
    });

    it('should correctly parse sonar-project.properties', () => {
      projectHandler.reset('fake_project_with_sonar_properties');
      projectHandler.setEnvironmentVariables({});

      const properties = getProperties({}, projectHandler.getStartTime());

      assertProperties(properties, {
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'http://localhost:1234',
        'sonar.scanner.apiBaseUrl': 'http://localhost:1234/api/v2',
        'sonar.scanner.internal.isSonarCloud': 'false',
        'sonar.exclusions': '**/node_modules/**,**/docs-dist/**',
        'sonar.scanner.dummy.path': 'C:path\toproject',
        'sonar.scanner.dummy.space.around.eq': 'value',
        'sonar.scanner.dummy.whitespace.at.beginning': 'value',
        'sonar.scanner.empty.property': '',
      });
    });

    it('does not let user override bootstrapper-only properties', () => {
      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({
        SONAR_SCANNER_APP: 'ignored',
        SONAR_SCANNER_APP_VERSION: '3.2.1',
        SONAR_SCANNER_WAS_JRE_CACHE_HIT: 'true',
        SONAR_SCANNER_WAS_ENGINE_CACHE_HIT: 'true',
        SONAR_SCANNER_JSON_PARAMS: JSON.stringify({
          'sonar.scanner.app': 'ignored',
          'sonar.scanner.appVersion': 'ignored',
          'sonar.scanner.bootstrapStartTime': '0000',
          'sonar.scanner.wasJreCacheHit': CacheStatus.Hit,
          'sonar.scanner.wasEngineCacheHit': 'true',
        }),
      });

      const properties = getProperties(
        {
          serverUrl: 'http://localhost/sonarqube',
          options: {
            'sonar.scanner.app': 'ignored',
            'sonar.scanner.appVersion': 'ignored',
            'sonar.scanner.bootstrapStartTime': '0000',
            'sonar.scanner.wasJreCacheHit': CacheStatus.Hit,
            'sonar.scanner.wasEngineCacheHit': 'true',
          },
        },
        projectHandler.getStartTime(),
        { define: ['sonar.scanner.app=ignored'] },
      );

      assertProperties(properties, {
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'http://localhost/sonarqube',
        'sonar.scanner.apiBaseUrl': 'http://localhost/sonarqube/api/v2',
        'sonar.scanner.internal.isSonarCloud': 'false',
        'sonar.projectKey': 'foo',
        'sonar.projectName': 'Foo',
        'sonar.projectVersion': '1.0-SNAPSHOT',
        'sonar.sources': 'the-sources',
      });
    });

    const proxyPriorityTestCases = [
      ['http', 'HTTP_PROXY'],
      ['https', 'HTTPS_PROXY'],
    ] as const;

    for (const [protocol, envName] of proxyPriorityTestCases) {
      it(`should not use HTTP_PROXY if proxy is passed through CLI (${protocol})`, () => {
        projectHandler.reset('fake_project_with_sonar_properties_file');
        projectHandler.setEnvironmentVariables({
          [envName]: `${protocol}://ignore-this-proxy.io`,
        });

        const properties = getProperties(
          {
            serverUrl: `${protocol}://localhost/sonarqube`,
            options: {
              [ScannerProperty.SonarScannerProxyHost]: 'ignore-this-proxy.io',
            },
          },
          projectHandler.getStartTime(),
          { define: ['sonar.scanner.proxyHost=use-this-proxy.io'] },
        );

        assertProperties(properties, {
          ...projectHandler.getExpectedProperties(),
          'sonar.host.url': `${protocol}://localhost/sonarqube`,
          'sonar.scanner.apiBaseUrl': `${protocol}://localhost/sonarqube/api/v2`,
          'sonar.scanner.internal.isSonarCloud': 'false',
          'sonar.projectKey': 'foo',
          'sonar.projectName': 'Foo',
          'sonar.projectVersion': '1.0-SNAPSHOT',
          'sonar.sources': 'the-sources',
          [ScannerProperty.SonarScannerProxyHost]: 'use-this-proxy.io',
        });
      });
    }

    it('should set the depending properties correctly when "sonar.region" is set to a supported value', () => {
      projectHandler.reset('whatever');
      projectHandler.setEnvironmentVariables({});

      const properties = getProperties(
        {
          options: {
            [ScannerProperty.SonarRegion]: REGION_US,
          },
        },
        projectHandler.getStartTime(),
      );

      assertProperties(properties, {
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'https://sonarqube.us',
        'sonar.scanner.apiBaseUrl': 'https://api.sonarqube.us',
        'sonar.scanner.internal.isSonarCloud': 'true',
        'sonar.region': 'us',
      });
    });

    it('should set the depending properties correctly when "sonar.host.url" is set and "sonar.region" and is set to a supported value', () => {
      projectHandler.reset('whatever');
      projectHandler.setEnvironmentVariables({});

      const properties = getProperties(
        {
          options: {
            [ScannerProperty.SonarRegion]: REGION_US,
            [ScannerProperty.SonarHostUrl]: 'https://sonarqube.us',
          },
        },
        projectHandler.getStartTime(),
      );

      assertProperties(properties, {
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'https://sonarqube.us',
        'sonar.scanner.apiBaseUrl': 'https://api.sonarqube.us',
        'sonar.scanner.internal.isSonarCloud': 'true',
        'sonar.region': 'us',
      });
    });

    it('should throw an exception if "sonar.region" is set to an unsupported value', () => {
      projectHandler.reset('whatever');
      projectHandler.setEnvironmentVariables({});
      const invalidRegion = "some region that doesn't exist";

      assert.throws(
        () =>
          getProperties(
            {
              options: {
                [ScannerProperty.SonarRegion]: invalidRegion,
              },
            },
            projectHandler.getStartTime(),
          ),
        {
          message: `Unsupported region '${invalidRegion}'. List of supported regions: ${REGIONS.map(r => `"${r}"`)}. Please check the '${ScannerProperty.SonarRegion}' property or the 'SONAR_REGION' environment variable.`,
        },
      );
    });
  });
});

describe('addHostProperties', () => {
  it('should detect SonarCloud by default', () => {
    const expected = {
      [ScannerProperty.SonarScannerInternalIsSonarCloud]: 'true',
      [ScannerProperty.SonarHostUrl]: SONARCLOUD_URL,
      [ScannerProperty.SonarScannerApiBaseUrl]: SONARCLOUD_API_BASE_URL,
    };

    assert.deepStrictEqual(getHostProperties({}), expected);

    assert.deepStrictEqual(
      getHostProperties({
        [ScannerProperty.SonarHostUrl]: SONARCLOUD_URL,
      }),
      expected,
    );

    assert.deepStrictEqual(
      getHostProperties({
        [ScannerProperty.SonarHostUrl]: 'https://www.sonarcloud.io',
      }),
      expected,
    );

    assert.deepStrictEqual(
      getHostProperties({
        [ScannerProperty.SonarHostUrl]: 'https://www.sonarcloud.io/',
      }),
      expected,
    );
  });

  it('should detect SonarCloud with custom URL', () => {
    const endpoint = getHostProperties({
      [ScannerProperty.SonarHostUrl]: 'http://that-is-a-sonarcloud-custom-url.com',
      [ScannerProperty.SonarScannerSonarCloudUrl]: 'http://that-is-a-sonarcloud-custom-url.com',
      [ScannerProperty.SonarScannerApiBaseUrl]: 'http://api.that-is-a-sonarcloud-custom-url.com',
    });

    assert.deepStrictEqual(endpoint, {
      [ScannerProperty.SonarScannerInternalIsSonarCloud]: 'true',
      [ScannerProperty.SonarHostUrl]: 'http://that-is-a-sonarcloud-custom-url.com',
      [ScannerProperty.SonarScannerApiBaseUrl]: 'http://api.that-is-a-sonarcloud-custom-url.com',
    });
  });

  it('should detect SonarQube', () => {
    const endpoint = getHostProperties({
      [ScannerProperty.SonarHostUrl]: 'https://next.sonarqube.com',
    });

    assert.deepStrictEqual(endpoint, {
      [ScannerProperty.SonarScannerInternalIsSonarCloud]: 'false',
      [ScannerProperty.SonarHostUrl]: 'https://next.sonarqube.com',
      [ScannerProperty.SonarScannerApiBaseUrl]: 'https://next.sonarqube.com/api/v2',
    });
  });

  it('should ignore SonarCloud custom URL if sonar host URL does not match sonarcloud', () => {
    const endpoint = getHostProperties({
      [ScannerProperty.SonarHostUrl]: 'https://next.sonarqube.com',
      [ScannerProperty.SonarScannerSonarCloudUrl]: 'http://that-is-a-sonarcloud-custom-url.com',
    });

    assert.deepStrictEqual(endpoint, {
      [ScannerProperty.SonarScannerInternalIsSonarCloud]: 'false',
      [ScannerProperty.SonarHostUrl]: 'https://next.sonarqube.com',
      [ScannerProperty.SonarScannerApiBaseUrl]: 'https://next.sonarqube.com/api/v2',
    });
  });
});
