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

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { REDACTED_VALUE, redactArguments, redactProperties, redactUrl } from '../../src/secrets.js';
import { ScannerProperty } from '../../src/types.js';

describe('secrets', () => {
  it('should redact known, custom, and URL property credentials without changing the input', () => {
    const token = 'sqp_secrets_test_token';
    const deprecatedLogin = 'secrets-test-login';
    const customSecret = 'secrets-test-custom-secret';
    const mirrorPassword = 'secrets-test-mirror%40password';
    const javaOptionsPassword = 'secrets-test-java-options-password';
    const properties = {
      [ScannerProperty.SonarToken]: token,
      [ScannerProperty.SonarLogin]: deprecatedLogin,
      'sonar.custom.secret': customSecret,
      [ScannerProperty.SonarScannerCliMirror]: `https://user:${mirrorPassword}@mirror.example/scanner/`,
      [ScannerProperty.SonarScannerJavaOptions]: `-Xmx512m -Djavax.net.ssl.keyStorePassword=${javaOptionsPassword}`,
      'sonar.projectKey': 'visible-project-key',
    };
    const redacted = redactProperties(properties);
    const output = JSON.stringify(redacted);

    for (const secret of [
      token,
      deprecatedLogin,
      customSecret,
      mirrorPassword,
      javaOptionsPassword,
    ]) {
      assert.ok(!output.includes(secret));
    }
    assert.ok(output.includes(REDACTED_VALUE));
    assert.ok(output.includes('visible-project-key'));
    assert.strictEqual(properties[ScannerProperty.SonarToken], token);
    assert.ok(properties[ScannerProperty.SonarScannerCliMirror].includes(mirrorPassword));
    assert.ok(properties[ScannerProperty.SonarScannerJavaOptions].includes(javaOptionsPassword));
  });

  it('should redact sensitive JVM arguments and authenticated URLs', () => {
    assert.deepStrictEqual(
      redactArguments([
        '-Dsonar.token=sqp_argument_token',
        '-Dsonar.login=argument-login',
        '-Dhttps.proxyPassword=argument-proxy-password',
        '-Dsonar.custom.secret=argument-custom-secret',
        '-Ddownload.url=https://user:url-password@mirror.example/file.zip',
        '-Dsonar.projectKey=visible-project-key',
        '-jar',
        '/scanner-engine.jar',
      ]),
      [
        `-Dsonar.token=${REDACTED_VALUE}`,
        `-Dsonar.login=${REDACTED_VALUE}`,
        `-Dhttps.proxyPassword=${REDACTED_VALUE}`,
        `-Dsonar.custom.secret=${REDACTED_VALUE}`,
        `-Ddownload.url=https://user:${REDACTED_VALUE}@mirror.example/file.zip`,
        '-Dsonar.projectKey=visible-project-key',
        '-jar',
        '/scanner-engine.jar',
      ],
    );
  });

  it('should not retain secrets between redactions', () => {
    const previousToken = 'sqp_previous_scan_token';
    const firstRedaction = redactProperties({ [ScannerProperty.SonarToken]: previousToken });
    assert.strictEqual(firstRedaction[ScannerProperty.SonarToken], REDACTED_VALUE);

    const secondRedaction = redactProperties({ 'sonar.projectName': previousToken });
    assert.strictEqual(secondRedaction['sonar.projectName'], previousToken);
  });

  it('should leave URLs without credentials and non-URLs unchanged', () => {
    assert.strictEqual(
      redactUrl('https://mirror.example/file.zip'),
      'https://mirror.example/file.zip',
    );
    assert.strictEqual(redactUrl('not a URL'), 'not a URL');
  });
});
