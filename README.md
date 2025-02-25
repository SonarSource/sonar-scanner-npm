# NPM module to run SonarQube Server and Cloud analyses

`@sonar/scan` makes it very easy to trigger SonarQube [Server](https://www.sonarqube.org)
and [Cloud](https://sonarcloud.io) analyses on a JavaScript code base, without needing
to install any specific tool or (Java) runtime.

This module is analyzed on SonarQube Cloud.

[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=SonarSource_sonar-scanner-npm&metric=alert_status)](https://sonarcloud.io/project/overview?id=SonarSource_sonar-scanner-npm) [![Maintainability](https://sonarcloud.io/api/project_badges/measure?project=SonarSource_sonar-scanner-npm&metric=sqale_rating)](https://sonarcloud.io/project/overview?id=SonarSource_sonar-scanner-npm) [![Reliability](https://sonarcloud.io/api/project_badges/measure?project=SonarSource_sonar-scanner-npm&metric=reliability_rating)](https://sonarcloud.io/project/overview?id=SonarSource_sonar-scanner-npm) [![Security](https://sonarcloud.io/api/project_badges/measure?project=SonarSource_sonar-scanner-npm&metric=security_rating)](https://sonarcloud.io/project/overview?id=SonarSource_sonar-scanner-npm) [![Releases](https://img.shields.io/github/release/SonarSource/sonar-scanner-npm.svg)](https://github.com/SonarSource/sonar-scanner-npm/releases) [![npm version](https://badge.fury.io/js/@sonar%2Fscan.svg)](https://badge.fury.io/js/@sonar%2Fscan)

This is the documentation for v4. If you are using v3, refer to [the v3 documentation](https://github.com/SonarSource/sonar-scanner-npm/tree/3.5.0).

## Installation

_Prerequisite: Node v18+ (for v4 and above)_

_Prerequisite: Node v16+ (for [v3](https://github.com/SonarSource/sonar-scanner-npm/tree/3.5.0), otherwise use sonarqube-scanner [v2.9.1](https://github.com/SonarSource/sonar-scanner-npm/tree/2.9.1))_

This package is available on npm as: [`@sonar/scan`](https://www.npmjs.com/package/@sonar/scan)

To install the scanner globally and be able to run analyses on the command line:

```sh
npm install -g @sonar/scan
```

## Getting Started

If you want to run an analysis without having to configure anything in the first place, simply run the `sonar` command. The following
example assumes that you have installed SonarQube Server locally:

```
cd my-project
sonar
```

or you can use `npx` without installing:

```
cd my-project
npx @sonar/scan
```

## Documentation

For the extended information, please refer to its [documentation](https://docs.sonarsource.com/sonarqube-server/latest/analyzing-source-code/scanners/npm/introduction/).

## License

`@sonar/scan` is licensed under the [LGPL v3 License](http://www.gnu.org/licenses/lgpl.txt).
