#!/bin/bash

set -euo pipefail

VERSION=$(grep version package.json | head -1  | awk -F: '{ print $2 }' | sed 's/[",]//g')
export VERSION

PROJECT=sonar-scanner-npm
source cirrus-env PROMOTE
cirrus_jfrog_promote

# Burgr notification.
BURGR_FILE=promote.burgr
cat > $BURGR_FILE <<EOF
{
  "version":"${VERSION}",
  "url":"",
  "buildNumber":"${BUILD_NUMBER}"
}
EOF
HTTP_CODE=$(curl -s -o /dev/null -w %{http_code} -X POST -d @$BURGR_FILE -H "Content-Type:application/json" -u"${BURGR_USERNAME}:${BURGR_PASSWORD}" "${BURGR_URL}/api/promote/${CIRRUS_REPO_OWNER}/${CIRRUS_REPO_NAME}/${CIRRUS_BUILD_ID}")
if [ "$HTTP_CODE" != "200" ]; then
  echo "Cannot notify BURGR ($HTTP_CODE)"
else
  echo "BURGR notified"
fi
