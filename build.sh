#!/bin/bash
set -o errexit
set -o nounset
set -o pipefail

rm -rf out
mkdir out
node update-specs.node.js out/specs.json
node update-data.node.js out/specs.json out/data.json
cp static/* out/
