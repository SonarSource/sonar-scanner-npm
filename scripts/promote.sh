#!/bin/bash

set -euo pipefail
set -x

PROJECT_VERSION=$(grep version package.json | head -1  | awk -F: '{ print $2 }' | sed 's/[",]//g').$BUILD_NUMBER
export PROJECT_VERSION

source cirrus-env PROMOTE
cirrus_jfrog_promote

github-notify-promotion
burgr-notify-promotion

