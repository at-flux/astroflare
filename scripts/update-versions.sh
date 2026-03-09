#!/bin/bash
# Update version in package files for semantic-release prepare step.

set -e

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Error: Version not provided" >&2
  exit 1
fi

# Remove 'v' prefix if present
VERSION=${VERSION#v}

# Validate semantic versioning format
if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: Invalid version format. Expected semantic version (e.g., 0.0.1)" >&2
  exit 1
fi

echo "Updating version to $VERSION in package files..."

if [ -f "packages/astroflare/package.json" ]; then
  sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" packages/astroflare/package.json
  echo "  ✅ packages/astroflare/package.json"
fi

echo "✅ All package files updated to version $VERSION"
