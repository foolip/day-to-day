#!/bin/bash
set -o errexit
set -o nounset
set -o pipefail

TRAVIS=${TRAVIS:-false}
COMMIT=`git rev-parse HEAD`

# move out/ into new clone of gh-pages branch
rm -rf deploy
git clone --branch gh-pages git@github.com:foolip/day-to-day.git deploy
rm deploy/*
cp out/* deploy/

# commit and push
cd deploy
git add -A

if [[ "$TRAVIS" == "true" ]]; then
    git commit -m "Deploy from $COMMIT" -m "https://travis-ci.org/foolip/day-to-day/builds/$TRAVIS_BUILD_ID"
else
    git commit -m "Deploy from $COMMIT (manual)"
fi
git push
