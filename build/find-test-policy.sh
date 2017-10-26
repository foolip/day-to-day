#!/bin/bash
set -o errexit
set -o nounset
set -o pipefail

DIR="$1"
cd "$DIR"

# find files that include "web-platform-tests" and "type:untestable"
find * -type f | while read f; do
    grep -q web-platform-tests "$f" && grep -q type:untestable "$f" && echo "$f" ||:
done
