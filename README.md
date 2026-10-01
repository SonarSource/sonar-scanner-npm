<!-- Sonar Marketing hosts these approved brand assets on its Kentico Kontent CDN (assets-eu-01.kc-usercontent.com). Shared URLs are intentional; consult Marketing before replacing them. -->
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://assets-eu-01.kc-usercontent.com/ef593040-b591-0198-9506-ed88b30bc023/a23fc7ba-23f0-489a-829d-ed88c0748521/Sonar_Logo_Dark%20Backgrounds.svg">
    <img src="https://assets-eu-01.kc-usercontent.com/ef593040-b591-0198-9506-ed88b30bc023/82c13eba-d95c-4bb8-8007-7ce77c14e043/Sonar_Logo_Light%20Backgrounds.svg" alt="Sonar logo" width="400">
  </picture>
</p>

[![Build](https://github.com/SonarSource/sonar-scanner-npm/actions/workflows/build.yml/badge.svg)](https://github.com/SonarSource/sonar-scanner-npm/actions/workflows/build.yml) [![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=SonarSource_sonar-scanner-npm&metric=alert_status)](https://sonarcloud.io/project/overview?id=SonarSource_sonar-scanner-npm) [![Maintainability](https://sonarcloud.io/api/project_badges/measure?project=SonarSource_sonar-scanner-npm&metric=sqale_rating)](https://sonarcloud.io/project/overview?id=SonarSource_sonar-scanner-npm) [![Reliability](https://sonarcloud.io/api/project_badges/measure?project=SonarSource_sonar-scanner-npm&metric=reliability_rating)](https://sonarcloud.io/project/overview?id=SonarSource_sonar-scanner-npm) [![Security](https://sonarcloud.io/api/project_badges/measure?project=SonarSource_sonar-scanner-npm&metric=security_rating)](https://sonarcloud.io/project/overview?id=SonarSource_sonar-scanner-npm) [![Releases](https://img.shields.io/github/release/SonarSource/sonar-scanner-npm.svg)](https://github.com/SonarSource/sonar-scanner-npm/releases) [![npm version](https://badge.fury.io/js/@sonar%2Fscan.svg)](https://badge.fury.io/js/@sonar%2Fscan)

<!-- sonar-marketing:start -->
<!-- Marketing maintains this section. For wording changes, consult the relevant Product Marketing Manager (PMM). Repository CODEOWNERS review accuracy and merge changes. -->

# SonarScanner for npm

`@sonar/scan` runs SonarQube analysis for JavaScript and TypeScript projects without requiring a separate scanner or Java runtime.

Install [`@sonar/scan` from npm](https://www.npmjs.com/package/@sonar/scan), or learn more about [SonarQube Server](https://www.sonarsource.com/products/sonarqube/server/) and [SonarQube Cloud](https://www.sonarsource.com/products/sonarqube/cloud/).

<!-- sonar-marketing:end -->

This is the documentation for v5. If you are using v4, refer to
[the v4 documentation](https://github.com/SonarSource/sonar-scanner-npm/tree/4.3.8). If
you are using v3, refer to
[the v3 documentation](https://github.com/SonarSource/sonar-scanner-npm/tree/3.5.0).

## Installation

_Prerequisite: Node v22.12.0+ (for v5 and above)_

_Prerequisite: Node v18+ (for
[v4](https://github.com/SonarSource/sonar-scanner-npm/tree/4.3.8))_

_Prerequisite: Node v16+ (for
[v3](https://github.com/SonarSource/sonar-scanner-npm/tree/3.5.0), otherwise use
sonarqube-scanner
[v2.9.1](https://github.com/SonarSource/sonar-scanner-npm/tree/2.9.1))_

This package is available on npm as: [`@sonar/scan`](https://www.npmjs.com/package/@sonar/scan)

To install the scanner globally and be able to run analyses on the command line:

```sh
npm install -g @sonar/scan
```

## Getting Started

If you want to run an analysis without having to configure anything in the first place,
simply run the `sonar-scanner-npm` command. The following example assumes that you have
installed SonarQube Server locally:

```
cd my-project
sonar-scanner-npm
```

The deprecated `sonar` and `sonar-scanner` executable aliases were removed in v5. Update
global invocations and package scripts to use `sonar-scanner-npm` instead.

or you can use `npx` without installing:

```
cd my-project
npx @sonar/scan
```

## JavaScript API

`@sonar/scan` v5 is published as an ES module. Use `import` syntax when calling it
from ESM JavaScript:

```js
import { scan } from '@sonar/scan';

await scan({
  serverUrl: 'http://localhost:9000',
  token: process.env.SONAR_TOKEN,
});
```

To force the scanner to use a locally installed `sonar-scanner` executable:

```js
import { customScanner } from '@sonar/scan';

await customScanner({
  serverUrl: 'http://localhost:9000',
  token: process.env.SONAR_TOKEN,
});
```

For CommonJS projects, load `@sonar/scan` with dynamic `import()` instead of
`require()`:

```js
async function run() {
  const { scan } = await import('@sonar/scan');
  await scan({
    serverUrl: 'http://localhost:9000',
    token: process.env.SONAR_TOKEN,
  });
}

run();
```

## Documentation

For the extended information, please refer to its [documentation](https://docs.sonarsource.com/sonarqube-server/latest/analyzing-source-code/scanners/npm/introduction/).

## License

`@sonar/scan` is licensed under the [LGPL v3 License](http://www.gnu.org/licenses/lgpl.txt).
