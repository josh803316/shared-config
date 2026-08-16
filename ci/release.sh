#!/bin/bash
set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  exit 1
fi

echo "$VERSION" > /tmp/pre-release.version
echo "Version $VERSION prepared for release."
