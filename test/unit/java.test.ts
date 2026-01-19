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
import { describe, it, beforeEach, afterEach, mock, type Mock } from 'node:test';
import assert from 'node:assert';
import { SONARQUBE_JRE_PROVISIONING_MIN_VERSION } from '../../src/constants';
import { setDeps, resetDeps } from '../../src/deps';
import { fetchJRE, fetchServerVersion, serverSupportsJREProvisioning } from '../../src/java';
import {
  type AnalysisJresResponseType,
  CacheStatus,
  type ScannerProperties,
  ScannerProperty,
} from '../../src/types';
import { createMockFsDeps, createMockHttpDeps } from './test-helpers';

// Mock console.log to suppress output
const mockLog = mock.fn();
mock.method(console, 'log', mockLog);

const MOCKED_PROPERTIES: ScannerProperties = {
  [ScannerProperty.SonarHostUrl]: 'http://sonarqube.com',
  [ScannerProperty.SonarScannerOs]: 'linux',
  [ScannerProperty.SonarScannerArch]: 'arm64',
  [ScannerProperty.SonarUserHome]: '/sonar',
};

const JRE_RESPONSE: AnalysisJresResponseType = [
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
  mockLog.mock.resetCalls();
});

afterEach(() => {
  resetDeps();
});

describe('java', () => {
  describe('version should be detected correctly', () => {
    it('the SonarQube version should be fetched correctly when new endpoint does not exist', async () => {
      // First call to V2 endpoint fails, second call to legacy endpoint succeeds
      const mockFetch = mock.fn() as Mock<() => Promise<{ data: string }>>;
      mockFetch.mock.mockImplementationOnce(() => Promise.reject(new Error('Not Found')));
      mockFetch.mock.mockImplementationOnce(() => Promise.resolve({ data: '3.2.2' }));

      setDeps({ http: createMockHttpDeps({ fetch: mockFetch as any }) });

      const serverSemver = await fetchServerVersion(MOCKED_PROPERTIES);
      assert.strictEqual(serverSemver.toString(), '3.2.2');
    });

    it('the SonarQube version should be fetched correctly using the new endpoint', async () => {
      const mockFetch = mock.fn(() => Promise.resolve({ data: '3.2.1.12313' }));

      setDeps({ http: createMockHttpDeps({ fetch: mockFetch as any }) });

      const serverSemver = await fetchServerVersion(MOCKED_PROPERTIES);
      assert.strictEqual(serverSemver.toString(), '3.2.1');
    });

    it('should fail if both endpoints do not work', async () => {
      const mockFetch = mock.fn(() => Promise.reject(new Error('Not Found')));

      setDeps({ http: createMockHttpDeps({ fetch: mockFetch as any }) });

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
      const mockFetch = mock.fn(() =>
        Promise.resolve({ data: '<!DOCTYPE><HTML><BODY>FORBIDDEN</BODY></HTML>' }),
      );

      setDeps({ http: createMockHttpDeps({ fetch: mockFetch as any }) });

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
      const mockFetch = mock.fn(() => Promise.resolve({ data: '10.6.0.2424' }));
      setDeps({ http: createMockHttpDeps({ fetch: mockFetch as any }) });

      assert.strictEqual(await serverSupportsJREProvisioning(MOCKED_PROPERTIES), true);
    });

    it(`should return false for SQ version < ${SONARQUBE_JRE_PROVISIONING_MIN_VERSION}`, async () => {
      const mockFetch = mock.fn(() => Promise.resolve({ data: '9.9.9' }));
      setDeps({ http: createMockHttpDeps({ fetch: mockFetch as any }) });

      assert.strictEqual(await serverSupportsJREProvisioning(MOCKED_PROPERTIES), false);
    });
  });

  describe('when JRE provisioning is supported', () => {
    describe('when the JRE is cached', () => {
      it('should fetch the latest supported JRE and use the cached version', async () => {
        const properties = { ...MOCKED_PROPERTIES };
        // Mock sha256 hash of empty buffer
        const emptyBufferSha256 =
          'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
        const serverResponseWithCorrectChecksum: AnalysisJresResponseType = [
          {
            id: 'some-id',
            filename: 'mock-jre.tar.gz',
            javaPath: 'jre/bin/java',
            sha256: emptyBufferSha256,
            arch: 'arm64',
            os: 'linux',
          },
        ];

        const mockDownload = mock.fn(() => Promise.resolve());
        const mockFetch = mock.fn(() =>
          Promise.resolve({ data: serverResponseWithCorrectChecksum }),
        );

        setDeps({
          fs: createMockFsDeps({
            existsSync: mock.fn(() => true),
            readFile: mock.fn((path: string, cb: (err: Error | null, data: Buffer) => void) =>
              cb(null, Buffer.from('')),
            ) as any,
          }),
          http: createMockHttpDeps({
            fetch: mockFetch as any,
            download: mockDownload,
          }),
        });

        await fetchJRE(properties);

        assert.strictEqual(mockDownload.mock.callCount(), 0);
        assert.strictEqual(properties[ScannerProperty.SonarScannerWasJreCacheHit], CacheStatus.Hit);
      });
    });

    describe('when the JRE is not cached', () => {
      it('should download the JRE', async () => {
        const properties = { ...MOCKED_PROPERTIES };
        const mockDownload = mock.fn(() => Promise.resolve());
        const mockRemove = mock.fn(() => Promise.resolve());
        const mockFetch = mock.fn(() => Promise.resolve({ data: JRE_RESPONSE }));

        setDeps({
          fs: createMockFsDeps({
            existsSync: mock.fn(() => false),
            mkdirSync: mock.fn() as any,
            readFile: mock.fn((path: string, cb: (err: Error | null, data: Buffer) => void) =>
              cb(null, Buffer.from('')),
            ) as any,
            remove: mockRemove,
          }),
          http: createMockHttpDeps({
            fetch: mockFetch as any,
            download: mockDownload,
          }),
        });

        // This test will fail at checksum validation, but we can verify download was called
        try {
          await fetchJRE(properties);
        } catch (e) {
          // Expected to fail at checksum validation since empty buffer won't match
        }

        // Verify download was attempted
        assert.strictEqual(mockDownload.mock.callCount(), 1);
        assert.strictEqual(
          properties[ScannerProperty.SonarScannerWasJreCacheHit],
          CacheStatus.Miss,
        );
      });

      it('should remove file when checksum does not match', async () => {
        const mockDownload = mock.fn(() => Promise.resolve());
        const mockRemove = mock.fn(() => Promise.resolve());
        const mockFetch = mock.fn(() => Promise.resolve({ data: JRE_RESPONSE }));

        setDeps({
          fs: createMockFsDeps({
            existsSync: mock.fn(() => false),
            mkdirSync: mock.fn() as any,
            readFile: mock.fn((path: string, cb: (err: Error | null, data: Buffer) => void) =>
              cb(null, Buffer.from('wrong content')),
            ) as any,
            remove: mockRemove,
          }),
          http: createMockHttpDeps({
            fetch: mockFetch as any,
            download: mockDownload,
          }),
        });

        await assert.rejects(async () => {
          await fetchJRE({ ...MOCKED_PROPERTIES });
        });

        assert.strictEqual(mockRemove.mock.callCount(), 1);
      });

      it('should fail if no JRE matches', async () => {
        const mockFetch = mock.fn(() => Promise.resolve({ data: [] }));

        setDeps({
          http: createMockHttpDeps({
            fetch: mockFetch as any,
          }),
        });

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
