#!/bin/bash
set -o errexit
set -o nounset
set -o pipefail

rm -rf out
mkdir out
node update-manifest.node.js out/manifest.json
node update-data.node.js out/manifest.json out/data.json
cp static/* out/
