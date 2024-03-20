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

const assert = require('assert');
const index = require('../../src/index');
const { spy, stub, restore } = require('sinon');

describe('index', function () {
  afterEach(restore);

  describe('::fromParam', () => {
    it('should provide the correct identity', function () {
      assert.deepEqual(index.fromParam(), [
        '--from=ScannerNpm/' + require('../../package.json').version,
      ]);
    });
  });

  describe('::cli', () => {
    it('pass the expected arguments to the scan method', () => {
      const parameters = {
        foo: 'bar',
      };
      const cliArguments = ['--foo', 'bar'];

      const scanStub = stub(index, 'scan').resolves();
      const callbackSpy = spy(() => {
        assert.equal(scanStub.callCount, 1);
        assert.equal(scanStub.firstCall.args[0], parameters);
        assert.equal(scanStub.firstCall.args[1], cliArguments);
        assert.equal(
          scanStub.firstCall.args[2],
          false,
          'the localScanner argument is passed as false',
        );
        assert.equal(callbackSpy.callCount, 1);
      });

      index.cli(cliArguments, parameters, callbackSpy);
    });
  });

  describe('::customScanner', () => {
    it('pass the expected arguments to the scan method', () => {
      const parameters = {
        foo: 'bar',
      };

      const scanStub = stub(index, 'scan').resolves(null);
      const callbackSpy = spy(() => {
        assert.equal(scanStub.callCount, 1);
        assert.equal(scanStub.firstCall.args[0], parameters);
        assert.equal(scanStub.firstCall.args[1].length, 0, 'no CLI arguments are passed');
        assert.equal(
          scanStub.firstCall.args[2],
          true,
          'the localScanner argument is passed as true',
        );
        assert.equal(callbackSpy.callCount, 1);
      });

      index.customScanner(parameters, callbackSpy);
    });
  });
});
