#!/bin/bash
set -o errexit
set -o nounset
set -o pipefail

for script in build/check-*; do
    echo "Running $script"
    node "$script" out/specs.json out/data.json
done
