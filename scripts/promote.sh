#!/bin/bash

set -euo pipefail
set -x


source cirrus-env PROMOTE

PROJECT_VERSION=$(grep version package.json | head -1  | awk -F: '{ print $2 }' | sed 's/[",]//g').$BUILD_NUMBER
export PROJECT_VERSION

export SHELLOPTS

cirrus_jfrog_promote

github-notify-promotion

