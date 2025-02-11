#!/bin/bash

set -euo pipefail

PROJECT=sonar-scanner-npm
VERSION="0.0.0"
source cirrus-env BUILD
npm version --no-git-tag-version --allow-same-version "$VERSION-$BUILD_NUMBER"

jfrog c add repox --url https://repox.jfrog.io/ --access-token $ARTIFACTORY_DEPLOY_ACCESS_TOKEN
jfrog c use repox
jfrog npm-config --repo-resolve npm --repo-deploy $ARTIFACTORY_DEPLOY_REPO
#upload to repox QA repository
jfrog npm publish --build-name=$PROJECT --build-number="$BUILD_NUMBER"
#publish buildinfo
jfrog rt build-publish $PROJECT "$BUILD_NUMBER"
