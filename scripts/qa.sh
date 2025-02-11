#!/bin/bash

set -euo pipefail

VERSION="0.0.0"

source cirrus-env QA

# TODO: https://sonarsource.atlassian.net/browse/BUILD-2397
# We should have a virtual repo that include npmjs and sonarsource-npm-public-qa (ARTIFACTORY_DEPLOY_REPO)
# and an other one that include npmjs and sonarsource-npm-public-builds
# The repo npm is wrongly configured and should only include npmjs and sonarsource-npm-public-releases

cd test/integration
npm install
npm install --no-save "https://$ARTIFACTORY_PRIVATE_USERNAME:$ARTIFACTORY_PRIVATE_PASSWORD@repox.jfrog.io/artifactory/$ARTIFACTORY_DEPLOY_REPO/@sonar/scan/-/@sonar/scan-$VERSION-$COMMIT_ID.tgz"
