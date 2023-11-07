#!/bin/bash

set -euo pipefail

VERSION=$(grep version package.json | head -1  | awk -F: '{ print $2 }' | sed 's/[",]//g')
export VERSION

source cirrus-env PROMOTE
cirrus_jfrog_promote

burgr-notify-promotion

