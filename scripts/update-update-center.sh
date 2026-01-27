#!/bin/bash
#
# Updates the scannernpm.properties file in sonar-update-center-properties
# for a new release.
#
# Usage: update-update-center.sh <file> <version> <description>
#
# This script:
# 1. Moves the current publicVersions to archivedVersions
# 2. Sets the new version as publicVersions
# 3. Adds version metadata (description, date, URLs)
#
set -euo pipefail

if [ $# -ne 3 ]; then
  echo "Usage: $0 <file> <version> <description>"
  exit 1
fi

FILE="$1"
VERSION="$2"
DESCRIPTION="$3"
DATE=$(date +%Y-%m-%d)

if [ ! -f "$FILE" ]; then
  echo "Error: File not found: $FILE"
  exit 1
fi

# Get current publicVersions
CURRENT_PUBLIC=$(grep "^publicVersions=" "$FILE" | cut -d= -f2)

# Get current archivedVersions
CURRENT_ARCHIVED=$(grep "^archivedVersions=" "$FILE" | cut -d= -f2)

# Update archivedVersions: append current public versions
if [ -n "$CURRENT_ARCHIVED" ]; then
  NEW_ARCHIVED="${CURRENT_ARCHIVED},${CURRENT_PUBLIC}"
else
  NEW_ARCHIVED="${CURRENT_PUBLIC}"
fi

# Update the file
sed -i "s/^archivedVersions=.*/archivedVersions=${NEW_ARCHIVED}/" "$FILE"
sed -i "s/^publicVersions=.*/publicVersions=${VERSION}/" "$FILE"

# Find the line number of publicVersions and insert new version entry after it
LINE_NUM=$(grep -n "^publicVersions=" "$FILE" | cut -d: -f1)

# Create the new version entry
NEW_ENTRY="${VERSION}.description=${DESCRIPTION}
${VERSION}.date=${DATE}
${VERSION}.changelogUrl=https://github.com/SonarSource/sonar-scanner-npm/releases/tag/${VERSION}
${VERSION}.downloadUrl=https://www.npmjs.com/package/@sonar/scan/v/${VERSION}"

# Insert after the publicVersions line
awk -v line="$LINE_NUM" -v entry="$NEW_ENTRY" 'NR==line {print; print ""; print entry; next} 1' "$FILE" > tmp && mv tmp "$FILE"

echo "Updated $FILE for version $VERSION"
