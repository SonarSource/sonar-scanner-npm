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
import sinon from 'sinon';
import {
  DEFAULT_SONAR_EXCLUSIONS,
  SCANNER_BOOTSTRAPPER_NAME,
  SONARCLOUD_URL,
} from '../../src/constants';
import { LogLevel, log } from '../../src/logging';
import { getHostProperties, getProperties } from '../../src/properties';
import { ScannerProperty } from '../../src/types';
import { FakeProjectMock } from './mocks/FakeProjectMock';

jest.mock('../../src/logging');

jest.mock('../../package.json', () => ({
  version: '1.2.3',
}));

const projectHandler = new FakeProjectMock();

afterEach(() => {
  sinon.restore();
  projectHandler.reset();
});

describe('getProperties', () => {
  it('should provide default values', () => {
    projectHandler.reset('fake_project_with_no_package_file');
    projectHandler.setEnvironmentVariables({});

    const properties = getProperties({}, projectHandler.getStartTime());

    expect(properties).toEqual({
      ...projectHandler.getExpectedProperties(),
      'sonar.host.url': 'https://sonarcloud.io',
      'sonar.scanner.internal.isSonarCloud': 'true',
      'sonar.projectDescription': 'No description.',
      'sonar.sources': '.',
      'sonar.exclusions': DEFAULT_SONAR_EXCLUSIONS,
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
            'sonar.scanner.sonarcloudUrl': 'https://dev.sc-dev.io',
          },
        },
        projectHandler.getStartTime(),
      );

      expect(properties).toEqual({
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'https://dev.sc-dev.io',
        'sonar.scanner.sonarcloudUrl': 'https://dev.sc-dev.io',
        'sonar.scanner.internal.isSonarCloud': 'true',
        'sonar.projectKey': 'use-this-project-key',
        'sonar.projectDescription': 'No description.',
        'sonar.sources': '.',
        'sonar.exclusions': DEFAULT_SONAR_EXCLUSIONS,
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
          },
        },
        projectHandler.getStartTime(),
      );

      expect(properties).toEqual({
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'http://localhost/sonarqube',
        'sonar.scanner.internal.isSonarCloud': 'false',
        'sonar.token': 'dummy-token',
        'sonar.verbose': 'true',
        'sonar.projectKey': 'use-this-project-key',
        'sonar.projectName': 'Foo',
        'sonar.projectVersion': '1.0-SNAPSHOT',
        'sonar.sources': 'the-sources',
        'sonar.scanner.os': 'some-os',
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

      expect(properties['sonar.verbose']).toBe('false');
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

      expect(properties).toEqual({
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'http://localhost/sonarqube',
        'sonar.scanner.internal.isSonarCloud': 'false',
        'sonar.javascript.lcov.reportPaths': 'coverage/lcov.info',
        'sonar.projectKey': 'fake-basic-project',
        'sonar.projectName': 'fake-basic-project',
        'sonar.projectDescription': 'No description.',
        'sonar.projectVersion': '1.0.0',
        'sonar.sources': '.',
        'sonar.exclusions': DEFAULT_SONAR_EXCLUSIONS + ',coverage/**',
        'sonar.scanner.app': SCANNER_BOOTSTRAPPER_NAME,
        'sonar.scanner.appVersion': '1.2.3',
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

      expect(properties).toEqual({
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'http://localhost/sonarqube',
        'sonar.scanner.internal.isSonarCloud': 'false',
        'sonar.projectKey': 'fake-project',
        'sonar.projectName': 'fake-project',
        'sonar.projectDescription': 'A fake project',
        'sonar.projectVersion': '1.0.0',
        'sonar.links.homepage': 'https://github.com/fake/project',
        'sonar.links.issue': 'https://github.com/fake/project/issues',
        'sonar.links.scm': 'git+https://github.com/fake/project.git',
        'sonar.sources': '.',
        'sonar.testExecutionReportPaths': 'xunit.xml',
        'sonar.exclusions': DEFAULT_SONAR_EXCLUSIONS,
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

      expect(properties).toEqual({
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'http://localhost/sonarqube',
        'sonar.scanner.internal.isSonarCloud': 'false',
        'sonar.projectDescription': 'No description.',
        'sonar.sources': '.',
        'sonar.exclusions': DEFAULT_SONAR_EXCLUSIONS,
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

      expect(properties).toEqual({
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'http://localhost/sonarqube',
        'sonar.scanner.internal.isSonarCloud': 'false',
        'sonar.projectDescription': 'No description.',
        'sonar.sources': '.',
        'sonar.exclusions': DEFAULT_SONAR_EXCLUSIONS,
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

      expect(properties).toEqual({
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'http://localhost/sonarqube',
        'sonar.scanner.internal.isSonarCloud': 'false',
        'sonar.javascript.lcov.reportPaths': 'jest-coverage/lcov.info',
        'sonar.projectKey': 'fake-basic-project',
        'sonar.projectName': 'fake-basic-project',
        'sonar.projectDescription': 'No description.',
        'sonar.projectVersion': '1.0.0',
        'sonar.sources': '.',
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

      expect(properties).toEqual({
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'http://localhost/sonarqube',
        'sonar.scanner.internal.isSonarCloud': 'false',
        'sonar.javascript.lcov.reportPaths': 'nyc-coverage/lcov.info',
        'sonar.projectKey': 'fake-basic-project',
        'sonar.projectName': 'fake-basic-project',
        'sonar.projectDescription': 'No description.',
        'sonar.projectVersion': '1.0.0',
        'sonar.sources': '.',
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

      expect(properties['sonar.token']).toBeUndefined();
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

      expect(properties).toEqual({
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'http://localhost/sonarqube',
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

      expect(properties).toEqual({
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'https://sonarqube.com/',
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

      expect(properties).toEqual({
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': SONARCLOUD_URL,
        'sonar.scanner.internal.isSonarCloud': 'true',
        'sonar.projectKey': 'foo',
        'sonar.projectName': 'Foo',
        'sonar.projectVersion': '1.0-SNAPSHOT',
        'sonar.sources': 'the-sources',
        'sonar.scanner.someVar': 'some-value',
      });
    });

    it.each([
      ['http', 'HTTP_PROXY'],
      ['https', 'HTTPS_PROXY'],
    ])('should detect %s_proxy env variable', (protocol: string, envName: string) => {
      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({
        [envName]: `${protocol}://user:pass@my-proxy.io:1234`,
        SONAR_HOST_URL: `${protocol}://localhost/sonarqube`,
      });

      const properties = getProperties({}, projectHandler.getStartTime());

      expect(properties).toEqual({
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': `${protocol}://localhost/sonarqube`,
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

    it('should use SONAR_SCANNER_JSON_PARAMS', () => {
      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({
        SONAR_SCANNER_JSON_PARAMS: JSON.stringify({
          'sonar.token': 'this-is-another-token',
        }),
      });

      const properties = getProperties({}, projectHandler.getStartTime());

      expect(properties).toEqual({
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': SONARCLOUD_URL,
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

      expect(properties).toEqual({
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': SONARCLOUD_URL,
        'sonar.scanner.internal.isSonarCloud': 'true',
        'sonar.projectKey': 'foo',
        'sonar.projectName': 'Foo',
        'sonar.projectVersion': '1.0-SNAPSHOT',
        'sonar.sources': 'the-sources',
      });
      expect(log).toHaveBeenCalledWith(
        LogLevel.WARN,
        expect.stringMatching(/Failed to parse JSON parameters/),
      );
    });

    it('should use deprecated SONARQUBE_SCANNER_PARAMS', () => {
      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({
        SONARQUBE_SCANNER_PARAMS: JSON.stringify({
          'sonar.token': 'this-is-another-token',
        }),
      });

      const properties = getProperties({}, projectHandler.getStartTime());

      expect(properties).toEqual({
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': SONARCLOUD_URL,
        'sonar.scanner.internal.isSonarCloud': 'true',
        'sonar.projectKey': 'foo',
        'sonar.projectName': 'Foo',
        'sonar.projectVersion': '1.0-SNAPSHOT',
        'sonar.sources': 'the-sources',
        'sonar.token': 'this-is-another-token',
      });
      expect(log).toHaveBeenCalledWith(
        LogLevel.WARN,
        'SONARQUBE_SCANNER_PARAMS is deprecated, please use SONAR_SCANNER_JSON_PARAMS instead',
      );
    });

    it('should set the [ScannerProperty.SonarScannerCliVersion] for all existing formats', () => {
      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({
        npm_config_sonar_scanner_version: '4.8.1.3023',
      });

      // "NPM Config" format `npm_config_sonar_scanner_${property_name}`
      const npmConfigProperties = getProperties({}, projectHandler.getStartTime());
      expect(npmConfigProperties[ScannerProperty.SonarScannerCliVersion]).toEqual('4.8.1.3023');

      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({
        SONAR_SCANNER_VERSION: '5.0.0.2966',
      });

      // "SONAR_SCANNER" format `SONAR_SCANNER_${PROPERTY_NAME}`
      const SonarScannerProperties = getProperties({}, projectHandler.getStartTime());
      expect(SonarScannerProperties[ScannerProperty.SonarScannerCliVersion]).toEqual('5.0.0.2966');

      projectHandler.reset('fake_project_with_sonar_properties_file');
      // js scan options format
      const jsScanOptionsProperties = getProperties(
        {
          version: '4.7.0.2747',
        },
        projectHandler.getStartTime(),
      );
      expect(jsScanOptionsProperties[ScannerProperty.SonarScannerCliVersion]).toEqual('4.7.0.2747');
    });

    it('should support the old SONAR_BINARY_CACHE environment variable', () => {
      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({
        SONAR_BINARY_CACHE: '/tmp/.sonar/',
      });

      const properties = getProperties({}, projectHandler.getStartTime());

      expect(properties['sonar.userHome']).toEqual('/tmp/.sonar/');
    });

    it('should support the old SONAR_SCANNER_MIRROR environment variable', () => {
      projectHandler.reset('fake_project_with_sonar_properties_file');
      projectHandler.setEnvironmentVariables({
        SONAR_SCANNER_MIRROR: 'https://mirror.com/',
      });

      const properties = getProperties({}, projectHandler.getStartTime());

      expect(properties['sonar.scanner.mirror']).toEqual('https://mirror.com/');
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
        { define: ['sonar.token=my-token', '-javaagent:/ignored-value.jar'] },
      );

      expect(properties).toEqual({
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'http://localhost/sonarqube',
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

      expect(properties).toEqual({
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'http://localhost/sonarqube',
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
          'sonar.scanner.wasJreCacheHit': 'true',
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
            'sonar.scanner.wasJreCacheHit': 'true',
            'sonar.scanner.wasEngineCacheHit': 'true',
          },
        },
        projectHandler.getStartTime(),
        { define: ['sonar.scanner.app=ignored'] },
      );

      expect(properties).toEqual({
        ...projectHandler.getExpectedProperties(),
        'sonar.host.url': 'http://localhost/sonarqube',
        'sonar.scanner.internal.isSonarCloud': 'false',
        'sonar.projectKey': 'foo',
        'sonar.projectName': 'Foo',
        'sonar.projectVersion': '1.0-SNAPSHOT',
        'sonar.sources': 'the-sources',
      });
    });

    it.each([
      ['http', 'HTTP_PROXY'],
      ['https', 'HTTPS_PROXY'],
    ])(
      'should not use HTTP_PROXY if proxy is passed through CLI',
      (protocol: string, envName: string) => {
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

        expect(properties).toEqual({
          ...projectHandler.getExpectedProperties(),
          'sonar.host.url': `${protocol}://localhost/sonarqube`,
          'sonar.scanner.internal.isSonarCloud': 'false',
          'sonar.projectKey': 'foo',
          'sonar.projectName': 'Foo',
          'sonar.projectVersion': '1.0-SNAPSHOT',
          'sonar.sources': 'the-sources',
          [ScannerProperty.SonarScannerProxyHost]: 'use-this-proxy.io',
        });
      },
    );
  });
});

describe('addHostProperties', () => {
  it('should detect SonarCloud', () => {
    const expected = {
      [ScannerProperty.SonarScannerInternalIsSonarCloud]: 'true',
      [ScannerProperty.SonarHostUrl]: 'https://sonarcloud.io',
    };

    // SonarCloud used by default
    expect(getHostProperties({})).toEqual(expected);

    // Backward-compatible use-case
    expect(
      getHostProperties({
        [ScannerProperty.SonarHostUrl]: 'https://sonarcloud.io',
      }),
    ).toEqual(expected);

    // Using www.
    expect(
      getHostProperties({
        [ScannerProperty.SonarHostUrl]: 'https://www.sonarcloud.io',
      }),
    ).toEqual(expected);

    // Using trailing slash (ensures trailing slash is dropped)
    expect(
      getHostProperties({
        [ScannerProperty.SonarHostUrl]: 'https://www.sonarcloud.io/',
      }),
    ).toEqual(expected);
  });

  it('should detect SonarCloud with custom URL', () => {
    const endpoint = getHostProperties({
      [ScannerProperty.SonarHostUrl]: 'https://sonarcloud.io/',
      [ScannerProperty.SonarScannerSonarCloudURL]: 'http://that-is-a-sonarcloud-custom-url.com',
    });

    expect(endpoint).toEqual({
      [ScannerProperty.SonarScannerInternalIsSonarCloud]: 'true',
      [ScannerProperty.SonarHostUrl]: 'http://that-is-a-sonarcloud-custom-url.com',
    });
  });

  it('should detect SonarQube', () => {
    const endpoint = getHostProperties({
      [ScannerProperty.SonarHostUrl]: 'https://next.sonarqube.com',
    });

    expect(endpoint).toEqual({
      [ScannerProperty.SonarScannerInternalIsSonarCloud]: 'false',
      [ScannerProperty.SonarHostUrl]: 'https://next.sonarqube.com',
    });
  });

  it('should ignore SonarCloud custom URL if sonar host URL does not match sonarcloud', () => {
    const endpoint = getHostProperties({
      [ScannerProperty.SonarHostUrl]: 'https://next.sonarqube.com',
      [ScannerProperty.SonarScannerSonarCloudURL]: 'http://that-is-a-sonarcloud-custom-url.com',
    });

    expect(endpoint).toEqual({
      [ScannerProperty.SonarScannerInternalIsSonarCloud]: 'false',
      [ScannerProperty.SonarHostUrl]: 'https://next.sonarqube.com',
    });
  });
});
