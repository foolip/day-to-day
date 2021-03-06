#!/bin/bash
set -o errexit
set -o nounset
set -o pipefail

URL="$1"
DIR="$2"

if [ ! -e "$DIR" ]; then
    # clone
    mkdir -p "$DIR"
    git clone -q "$URL" "$DIR"
else
    # update
    cd "$DIR"
    git fetch -q
    git checkout -q origin/HEAD
fi
