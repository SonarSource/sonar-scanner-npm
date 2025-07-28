/*
 * sonar-scanner-npm
 * Copyright (C) 2022-2025 SonarSource SA
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

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { ChildProcess, spawn } from 'child_process';
import fsExtra from 'fs-extra';
import sinon from 'sinon';
import { Readable } from 'stream';
import { API_V2_SCANNER_ENGINE_ENDPOINT, SONAR_SCANNER_ALIAS } from '../../src/constants';
import * as file from '../../src/file';
import { logWithPrefix } from '../../src/logging';
import * as request from '../../src/request';
import { fetchScannerEngine, runScannerEngine } from '../../src/scanner-engine';
import { AnalysisEngineResponseType, ScannerProperties, ScannerProperty } from '../../src/types';
import { ChildProcessMock } from './mocks/ChildProcessMock';

const mock = new MockAdapter(axios);

const MOCKED_PROPERTIES: ScannerProperties = {
  [ScannerProperty.SonarHostUrl]: 'http://sonarqube.com',
  [ScannerProperty.SonarToken]: 'dummy-token',
};

const MOCK_CACHE_DIRECTORIES = {
  archivePath: 'mocked/path/to/sonar/cache/sha_test/scanner-engine-1.2.3.jar',
  unarchivePath: 'mocked/path/to/sonar/cache/sha_test/scanner-engine-1.2.3.jar_extracted',
};
jest.mock('../../src/constants', () => ({
  ...jest.requireActual('../../src/constants'),
  SONAR_CACHE_DIR: 'mocked/path/to/sonar/cache',
}));

jest.mock('child_process');

let childProcessHandler = new ChildProcessMock();

beforeEach(() => {
  childProcessHandler.reset();
  jest.clearAllMocks();
  mock.reset();
});

describe('scanner-engine', () => {
  beforeEach(async () => {
    await request.initializeAxios(MOCKED_PROPERTIES);
    mock.onGet(API_V2_SCANNER_ENGINE_ENDPOINT).reply(200, {
      filename: 'scanner-engine-1.2.3.jar',
      sha256: 'sha_test',
    } as AnalysisEngineResponseType);
    mock
      .onGet(API_V2_SCANNER_ENGINE_ENDPOINT, {
        params: expect.objectContaining({
          Accept: expect.stringMatching(/application\/octet-stream/),
        }),
      })
      .reply(() => {
        const readable = new Readable({
          read() {
            this.push('sha_test');
            this.push(null); // Indicates end of stream
          },
        });
        return [200, readable];
      });

    jest.spyOn(file, 'getCacheFileLocation').mockResolvedValue(null);
    jest.spyOn(file, 'extractArchive').mockResolvedValue();
    jest.spyOn(file, 'validateChecksum').mockResolvedValue();
    jest.spyOn(file, 'getCacheDirectories').mockResolvedValue(MOCK_CACHE_DIRECTORIES);
    jest.spyOn(request, 'download').mockResolvedValue();
  });

  describe('fetchScannerEngine', () => {
    it('should fetch the latest version of the scanner engine', async () => {
      await fetchScannerEngine(MOCKED_PROPERTIES);

      expect(file.getCacheFileLocation).toHaveBeenCalledWith(MOCKED_PROPERTIES, {
        checksum: 'sha_test',
        filename: 'scanner-engine-1.2.3.jar',
        alias: SONAR_SCANNER_ALIAS,
      });
    });

    it('should remove file when checksum does not match', async () => {
      jest.spyOn(file, 'validateChecksum').mockRejectedValue(new Error());
      jest.spyOn(fsExtra, 'remove');

      await expect(fetchScannerEngine(MOCKED_PROPERTIES)).rejects.toBeDefined();

      expect(fsExtra.remove).toHaveBeenCalledWith(
        'mocked/path/to/sonar/cache/sha_test/scanner-engine-1.2.3.jar',
      );
    });

    describe('when the scanner engine is cached', () => {
      beforeEach(() => {
        jest.spyOn(file, 'getCacheFileLocation').mockResolvedValue('mocked/path/to/scanner-engine');
      });

      it('should use the cached scanner engine', async () => {
        const scannerEngine = await fetchScannerEngine(MOCKED_PROPERTIES);

        expect(file.getCacheFileLocation).toHaveBeenCalledWith(MOCKED_PROPERTIES, {
          checksum: 'sha_test',
          filename: 'scanner-engine-1.2.3.jar',
          alias: SONAR_SCANNER_ALIAS,
        });
        expect(request.download).not.toHaveBeenCalled();
        expect(file.extractArchive).not.toHaveBeenCalled();

        expect(scannerEngine).toEqual('mocked/path/to/scanner-engine');
      });
    });

    describe('when the scanner engine is not cached', () => {
      it('should download and extract the scanner engine', async () => {
        const scannerEngine = await fetchScannerEngine(MOCKED_PROPERTIES);

        expect(file.getCacheFileLocation).toHaveBeenCalledWith(MOCKED_PROPERTIES, {
          checksum: 'sha_test',
          filename: 'scanner-engine-1.2.3.jar',
          alias: SONAR_SCANNER_ALIAS,
        });
        expect(request.download).toHaveBeenCalledTimes(1);

        expect(scannerEngine).toEqual(
          'mocked/path/to/sonar/cache/sha_test/scanner-engine-1.2.3.jar',
        );
      });
    });
  });

  describe('runScannerEngine', () => {
    it('should launch scanner engine and write properties to stdin', async () => {
      const write = jest.fn();
      childProcessHandler.setChildProcessMock({
        stdin: {
          write,
          end: jest.fn(),
        } as unknown as ChildProcess['stdin'],
      });

      const properties = {
        ...MOCKED_PROPERTIES,
        [ScannerProperty.SonarScannerJavaOptions]: '-Xmx512m',
      };

      await runScannerEngine(
        'java',
        '/some/path/to/scanner-engine',
        {
          jvmOptions: ['-Dsome.custom.opt=123'],
        },
        properties,
      );

      expect(write).toHaveBeenCalledTimes(1);
      expect(write).toHaveBeenCalledWith(
        JSON.stringify({
          scannerProperties: Object.entries(properties).map(([key, value]) => ({
            key,
            value,
          })),
        }),
      );
      expect(spawn).toHaveBeenCalledWith('java', [
        '-Dsome.custom.opt=123',
        '-Xmx512m',
        '-jar',
        '/some/path/to/scanner-engine',
      ]);
    });

    it('should reject when child process exits with code 1', async () => {
      childProcessHandler.setExitCode(1);

      await expect(
        runScannerEngine(
          '/some/path/to/java',
          '/some/path/to/scanner-engine',
          {},
          MOCKED_PROPERTIES,
        ),
      ).rejects.toBeInstanceOf(Error);
    });

    it('should output scanner engine output', async () => {
      const stdoutStub = sinon.stub(process.stdout, 'write').value(jest.fn());

      const output = [
        JSON.stringify({ level: 'DEBUG', message: 'the message' }),
        JSON.stringify({ level: 'INFO', message: 'another message' }),
        "some non-JSON message which shouldn't crash the bootstrapper",
        JSON.stringify({
          level: 'ERROR',
          message: 'final message',
          stacktrace: 'this is a stacktrace',
        }),
      ];
      childProcessHandler.setOutput(output.join('\n'));

      await runScannerEngine(
        '/some/path/to/java',
        '/some/path/to/scanner-engine',
        {},
        MOCKED_PROPERTIES,
      );

      expect(logWithPrefix).toHaveBeenCalledWith('DEBUG', 'ScannerEngine', 'the message');
      expect(logWithPrefix).toHaveBeenCalledWith('INFO', 'ScannerEngine', 'another message');
      expect(logWithPrefix).toHaveBeenCalledWith('ERROR', 'ScannerEngine', 'final message');
      expect(process.stdout.write).toHaveBeenCalledWith(
        "some non-JSON message which shouldn't crash the bootstrapper",
      );

      stdoutStub.restore();
    });

    it('should dump data to file when dumpToFile property is set', async () => {
      childProcessHandler.setExitCode(1); // Make it so the scanner would fail
      const writeFile = jest.spyOn(fsExtra.promises, 'writeFile').mockResolvedValue();

      await runScannerEngine(
        '/some/path/to/java',
        '/some/path/to/scanner-engine',
        {},
        {
          ...MOCKED_PROPERTIES,
          [ScannerProperty.SonarScannerInternalDumpToFile]: '/path/to/dump.json',
        },
      );

      expect(writeFile).toHaveBeenCalledWith('/path/to/dump.json', expect.any(String));
    });

    it.each([['http'], ['https']])(
      'should forward proxy %s properties to JVM',
      async (protocol: string) => {
        await runScannerEngine(
          '/some/path/to/java',
          '/some/path/to/scanner-engine',
          {},
          {
            [ScannerProperty.SonarHostUrl]: `${protocol}://my-sonarqube.comp.org`,
            [ScannerProperty.SonarScannerProxyHost]: 'some-proxy.io',
            [ScannerProperty.SonarScannerProxyPort]: '4244',
            [ScannerProperty.SonarScannerProxyUser]: 'the-user',
            [ScannerProperty.SonarScannerProxyPassword]: 'the-pass',
          },
        );

        expect(spawn).toHaveBeenCalledWith('/some/path/to/java', [
          `-D${protocol}.proxyHost=some-proxy.io`,
          `-D${protocol}.proxyPort=4244`,
          `-D${protocol}.proxyUser=the-user`,
          `-D${protocol}.proxyPassword=the-pass`,
          '-jar',
          '/some/path/to/scanner-engine',
        ]);
      },
    );
  });
});
