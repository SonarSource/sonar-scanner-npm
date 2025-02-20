## FAQ

#### _I constantly get "Impossible to download and extract binary [...] In such situation, the best solution is to install the standard SonarScanner", what can I do?_

You can install manually the [standard SonarScanner](https://docs.sonarsource.com/sonarqube/latest/analyzing-source-code/scanners/sonarscanner/),
which requires to have a Java Runtime Environment available too (Java 8+).

It is important to make sure that the SonarScanner `$install_directory/bin` location is added to the system `$PATH` environment variable. This will ensure that `sonar-scanner` command will be resolved by the customScanner, and prevent the error:

```javascript
Error: Local install of SonarScanner not found.
    at getLocalSonarScannerExecutable (<project_dir>/node_modules/@sonar/scan/src/sonar-scanner-executable.js:153:11)
    at scanUsingCustomScanner (<project_dir>/node_modules/@sonar/scan/src/index.js:52:3)
...
```

Once local installation is done, you can replace the 2nd line of the example:

```javascript
var scanner = require('@sonar/scan').customScanner;
```

### In my Docker container, the scanner fails with ".../jre/bin/java: not found", how do I solve this?

You are probably relying on Alpine for your Docker image, and Alpine does not include glibc by default.
It needs to be [installed manually](https://laptrinhx.com/docker-for-mac-alpine-glibc-issues-802275018).

Thanks to [Philipp Eschenbach](https://github.com/peh) for troubleshooting this on [issue #59](https://github.com/bellingard/sonar-scanner-npm/issues/59).

## Download From Mirrors (SQ < 10.6 only)

By default, the scanner binaries are downloaded from `https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/`.
To use a custom mirror, set `$SONAR_SCANNER_MIRROR`. Or download precise version with `$SONAR_SCANNER_VERSION`

**Example:**

```shell
export SONAR_SCANNER_MIRROR=https://npm.taobao.org/mirrors/sonar-scanner/
export SONAR_SCANNER_VERSION=3.2.0.1227
```

or alternatively set variable in `.npmrc`

```
    sonar_scanner_mirror=https://npm.taobao.org/mirrors/sonar-scanner/
    sonar_scanner_version=3.2.0.1227
```

For mirrors using Basic HTTP authentication (e.g. Sonatype Nexus 3 `raw-proxy`, Artifactory with `artifactory-cache-proxy`), simply specify the username and password
as part of the URL:

```shell
export SONAR_SCANNER_MIRROR=https://username:password@repo.example.com/mirrors/sonar-scanner/
```

Proxy authentication is supported as well, see below.

## Specifying the cache folder

By default, the scanner binaries are cached into `$HOME/.sonar/native-sonar-scanner` folder.
To use a custom cache folder instead of `$HOME`, set `$SONAR_BINARY_CACHE`.

**Example:**

```shell
export SONAR_BINARY_CACHE=/Users/myaccount/cache
```

or alternatively set variable in `.npmrc`

```
    sonar_binary_cache=/Users/myaccount/cache
```

## Download behind proxy

We support the environment variables `http_proxy`/`https_proxy`/`no_proxy` to be able to download binaries behind a proxy.

**Example:**

```shell
export http_proxy=http://mycompanyproxy.com:PORT
export https_proxy=http://mycompanyproxy.com:PORT
#export no_proxy=.some-domain.io # (Optional)

export http_proxy=https://encryptedcompanyproxy.com:PORT
export https_proxy=https://encryptedcompanyproxy.com:PORT
#export no_proxy=.some-domain.io # (Optional)
```

**Behind authenticated proxy:**

```shell
export http_proxy=http://user:password@mycompanyproxy.com:PORT
export https_proxy=http://user:password@mycompanyproxy.com:PORT
#export no_proxy=.some-domain.io # (Optional)

export http_proxy=https://user:password@encryptedcompanyproxy.com:PORT
export https_proxy=https://user:password@encryptedcompanyproxy.com:PORT
#export no_proxy=.some-domain.io # (Optional)
```
