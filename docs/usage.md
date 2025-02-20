## Usage: add code analysis to your build files

_Prerequisite: you've installed the package as a dev dependency._

The following example shows how to run an analysis on a JavaScript
project, and pushing the results to a SonarQube instance:

```javascript
const scanner = require('@sonar/scan').default;

scanner(
  {
    serverUrl: 'https://sonarqube.mycompany.com',
    token: '019d1e2e04eefdcd0caee1468f39a45e69d33d3f',
    options: {
      'sonar.projectName': 'My App',
      'sonar.projectDescription': 'Description for "My App" project...',
      'sonar.sources': 'src',
      'sonar.tests': 'test',
    },
  },
  error => {
    if (error) {
      console.error(error);
    }
    process.exit();
  },
);
```

**Syntax:** scanner **(** `parameters`, [`callback`] **)**

**Arguments**

- `parameters` _Map_
  - `serverUrl` _String_ (optional) The URL of the SonarQube Server or Cloud host. Defaults to https://sonarcloud.io
  - `token` _String_ (optional) The token used to connect to the SonarQube Server v10+ or SonarQube Cloud. Empty by default.
  - `options` _Map_ (optional) Used to pass extra parameters for the analysis. See the [official documentation](http://redirect.sonarsource.com/doc/analysis-parameters.html) for more details.
- `callback` _Function_ (optional)
  Callback (the execution of the analysis is asynchronous).

## Usage: run analyses on the command line

_Prerequisite: you've installed the package globally._

If you want to run an analysis without having to configure anything in the first place, simply run the `sonar` command. The following
example assumes that you have installed SonarQube Server locally:

```
cd my-project
sonar
```

**Specifying properties/settings**

- If there's a `package.json` file in the folder, it will be read to feed the analysis with basic information (like project name or version)
- If there's a `sonar-project.properties` file in the folder, it will behave like the [original SonarScanner](https://redirect.sonarsource.com/doc/install-configure-scanner.html)
- Additional [analysis parameters](https://redirect.sonarsource.com/doc/analysis-parameters.html) can be passed on the command line using the standard `-Dsonar.xxx=yyy` syntax

  - Example:

    `sonar -Dsonar.host.url=https://myserver.com -Dsonar.token=019d1e2e04e`

## Usage: run analyses with npx

To run analyses without explicitly installing the scanner, run the following command instead:

```sh
npx @sonar/scan
```

Similar to the above, you can specify analysis properties and settings using either a `package.json` file, a `sonar-project.properties` file, or command line arguments.
