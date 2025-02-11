#!/bin/bash

set -euo pipefail
set -x


source cirrus-env PROMOTE

PROJECT_VERSION=0.0.0.$BUILD_NUMBER
export PROJECT_VERSION

export SHELLOPTS

cirrus_jfrog_promote

github-notify-promotion

