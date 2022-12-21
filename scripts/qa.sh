#!/bin/bash

set -euo pipefail

VERSION=$(grep version package.json | head -1  | awk -F: '{ print $2 }' | sed 's/[",]//g')

source cirrus-env QA
jfrog config add repox --url $ARTIFACTORY_URL --access-token $ARTIFACTORY_DEPLOY_ACCESS_TOKEN
npm config set registry https://repox.jfrog.io/artifactory/api/npm/sonarsource-npm-public-builds/
cd test && npm install "sonarqube-scanner@$VERSION-$BUILD_NUMBER"
