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
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { LogLevel } from '../../src/logging';
import { API_V2_JRE_ENDPOINT, SONARQUBE_JRE_PROVISIONING_MIN_VERSION } from '../../src/constants';
import { FsDeps } from '../../src/deps';
import { fetchJRE, fetchServerVersion, serverSupportsJREProvisioning } from '../../src/java';
import * as request from '../../src/request';
import {
  AnalysisJresResponseType,
  CacheStatus,
  ScannerProperties,
  ScannerProperty,
} from '../../src/types';

// Mock console.log to suppress output
const mockLog = mock.fn();
mock.method(console, 'log', mockLog);

const axiosMock = new MockAdapter(axios);

const MOCKED_PROPERTIES: ScannerProperties = {
  [ScannerProperty.SonarHostUrl]: 'http://sonarqube.com',
  [ScannerProperty.SonarScannerOs]: 'linux',
  [ScannerProperty.SonarScannerArch]: 'arm64',
  [ScannerProperty.SonarUserHome]: '/sonar',
};

beforeEach(async () => {
  mockLog.mock.resetCalls();
  await request.initializeAxios(MOCKED_PROPERTIES);
  axiosMock.reset();
});

describe('java', () => {
  describe('version should be detected correctly', () => {
    it('the SonarQube version should be fetched correctly when new endpoint does not exist', async () => {
      axiosMock.onGet('http://sonarqube.com/api/server/version').reply(200, '3.2.2');
      axiosMock.onGet('/api/v2/analysis/version').reply(404, 'Not Found');

      const serverSemver = await fetchServerVersion(MOCKED_PROPERTIES);
      assert.strictEqual(serverSemver.toString(), '3.2.2');
    });

    it('the SonarQube version should be fetched correctly using the new endpoint', async () => {
      axiosMock.onGet('http://sonarqube.com/api/server/version').reply(200, '3.2.1.12313');

      const serverSemver = await fetchServerVersion(MOCKED_PROPERTIES);
      assert.strictEqual(serverSemver.toString(), '3.2.1');
    });

    it('should fail if both endpoints do not work', async () => {
      axiosMock.onGet('http://sonarqube.com/api/server/version').reply(404, 'Not Found');
      axiosMock.onGet('/api/v2/server/version').reply(404, 'Not Found');

      await assert.rejects(async () => {
        await fetchServerVersion(MOCKED_PROPERTIES);
      });

      // Check that error was logged
      assert.ok(
        mockLog.mock.calls.some(call =>
          call.arguments.some(
            (arg: unknown) =>
              typeof arg === 'string' &&
              arg.includes(`Verify that ${MOCKED_PROPERTIES[ScannerProperty.SonarHostUrl]}`),
          ),
        ),
      );
    });

    it('should fail if version can not be parsed', async () => {
      axiosMock
        .onGet('http://sonarqube.com/api/server/version')
        .reply(200, '<!DOCTYPE><HTML><BODY>FORBIDDEN</BODY></HTML>');

      await assert.rejects(async () => {
        await fetchServerVersion(MOCKED_PROPERTIES);
      });
    });
  });

  describe('JRE provisioning should be detected correctly', () => {
    it('should return true for sonarcloud', async () => {
      assert.strictEqual(
        await serverSupportsJREProvisioning({
          ...MOCKED_PROPERTIES,
          [ScannerProperty.SonarScannerInternalIsSonarCloud]: 'true',
        }),
        true,
      );
    });

    it(`should return true for SQ version >= ${SONARQUBE_JRE_PROVISIONING_MIN_VERSION}`, async () => {
      axiosMock.onGet('http://sonarqube.com/api/server/version').reply(200, '10.6.0.2424');
      assert.strictEqual(await serverSupportsJREProvisioning(MOCKED_PROPERTIES), true);
    });

    it(`should return false for SQ version < ${SONARQUBE_JRE_PROVISIONING_MIN_VERSION}`, async () => {
      axiosMock.onGet('http://sonarqube.com/api/server/version').reply(200, '9.9.9');
      assert.strictEqual(await serverSupportsJREProvisioning(MOCKED_PROPERTIES), false);
    });
  });

  describe('when JRE provisioning is supported', () => {
    const serverResponse: AnalysisJresResponseType = [
      {
        id: 'some-id',
        filename: 'mock-jre.tar.gz',
        javaPath: 'jre/bin/java',
        sha256: 'd41d8cd98f00b204e9800998ecf8427e',
        arch: 'arm64',
        os: 'linux',
      },
    ];

    beforeEach(() => {
      axiosMock
        .onGet(API_V2_JRE_ENDPOINT, {
          params: {
            os: MOCKED_PROPERTIES[ScannerProperty.SonarScannerOs],
            arch: MOCKED_PROPERTIES[ScannerProperty.SonarScannerArch],
          },
        })
        .reply(200, serverResponse);
    });

    describe('when the JRE is cached', () => {
      it('should fetch the latest supported JRE and use the cached version', async () => {
        const properties = { ...MOCKED_PROPERTIES };
        const mockGetCacheFileLocation = mock.fn(() => Promise.resolve('mocked/path/to/file'));
        const mockDownload = mock.fn(() => Promise.resolve());

        await fetchJRE(properties, {
          getCacheFileLocationFn: mockGetCacheFileLocation,
          downloadFn: mockDownload,
        });

        assert.strictEqual(mockGetCacheFileLocation.mock.callCount(), 1);
        assert.strictEqual(mockDownload.mock.callCount(), 0);
        assert.strictEqual(properties[ScannerProperty.SonarScannerWasJreCacheHit], CacheStatus.Hit);
      });
    });

    describe('when the JRE is not cached', () => {
      const mockCacheDirectories = {
        archivePath: '/mocked-archive-path',
        unarchivePath: '/mocked-archive-path_extracted',
      };

      it('should download the JRE', async () => {
        const properties = { ...MOCKED_PROPERTIES };
        const mockGetCacheFileLocation = mock.fn(() => Promise.resolve(null));
        const mockGetCacheDirectories = mock.fn(() => Promise.resolve(mockCacheDirectories));
        const mockDownload = mock.fn(() => Promise.resolve());
        const mockValidateChecksum = mock.fn(() => Promise.resolve());
        const mockExtractArchive = mock.fn(() => Promise.resolve());

        await fetchJRE(properties, {
          getCacheFileLocationFn: mockGetCacheFileLocation,
          getCacheDirectoriesFn: mockGetCacheDirectories,
          downloadFn: mockDownload,
          validateChecksumFn: mockValidateChecksum,
          extractArchiveFn: mockExtractArchive,
        });

        assert.strictEqual(mockGetCacheFileLocation.mock.callCount(), 1);
        assert.strictEqual(mockDownload.mock.callCount(), 1);
        assert.deepStrictEqual(mockDownload.mock.calls[0].arguments, [
          `${API_V2_JRE_ENDPOINT}/${serverResponse[0].id}`,
          mockCacheDirectories.archivePath,
        ]);
        assert.strictEqual(mockValidateChecksum.mock.callCount(), 1);
        assert.strictEqual(mockExtractArchive.mock.callCount(), 1);
        assert.strictEqual(
          properties[ScannerProperty.SonarScannerWasJreCacheHit],
          CacheStatus.Miss,
        );
      });

      it('should remove file when checksum does not match', async () => {
        const mockGetCacheFileLocation = mock.fn(() => Promise.resolve(null));
        const mockGetCacheDirectories = mock.fn(() => Promise.resolve(mockCacheDirectories));
        const mockDownload = mock.fn(() => Promise.resolve());
        const mockValidateChecksum = mock.fn(() => Promise.reject(new Error('Checksum mismatch')));
        const mockRemove = mock.fn(() => Promise.resolve());
        const mockFsDeps: Partial<FsDeps> = {
          remove: mockRemove,
        };

        await assert.rejects(async () => {
          await fetchJRE(MOCKED_PROPERTIES, {
            fsDeps: mockFsDeps as FsDeps,
            getCacheFileLocationFn: mockGetCacheFileLocation,
            getCacheDirectoriesFn: mockGetCacheDirectories,
            downloadFn: mockDownload,
            validateChecksumFn: mockValidateChecksum,
          });
        });

        assert.strictEqual(mockRemove.mock.callCount(), 1);
        assert.deepStrictEqual(mockRemove.mock.calls[0].arguments, ['/mocked-archive-path']);
      });

      it('should fail if no JRE matches', async () => {
        axiosMock
          .onGet(API_V2_JRE_ENDPOINT, {
            params: {
              os: MOCKED_PROPERTIES[ScannerProperty.SonarScannerOs],
              arch: MOCKED_PROPERTIES[ScannerProperty.SonarScannerArch],
            },
          })
          .reply(200, []);

        await assert.rejects(
          async () => {
            await fetchJRE({ ...MOCKED_PROPERTIES });
          },
          {
            message: 'No JREs available for your platform linux arm64',
          },
        );
      });
    });
  });
});
