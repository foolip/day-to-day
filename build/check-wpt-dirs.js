'use strict';

const fs = require('fs');
const repo = require('./repo');

function main() {
  const specsPath = process.argv[2];
  console.assert(specsPath);

  console.log(`Reading ${specsPath}`);
  const specs = JSON.parse(fs.readFileSync(specsPath));

  const wptDir = repo.checkout('https://github.com/web-platform-tests/wpt', {
    update: false,
  });

  const specsWithoutWptDirs = [];

  for (const entry of specs) {
    // skips specs where the tests aren't in wpt
    if (entry.testrepo && entry.testrepo != 'web-platform-tests/wpt') {
      continue;
    }

    // TODO: this duplicates logic (entry.testpath || entry.id) in data.js
    if (!entry.testpath) {
      entry.testpath = entry.id;
    }

    const paths = entry.testpath.split(' ');
    const somePathExists = paths.some((path) => {
      return fs.existsSync(`${wptDir}/${path}`);
    });
    if (!somePathExists) {
      specsWithoutWptDirs.push(entry);
    }
  }

  if (specsWithoutWptDirs.length) {
    console.log('Specs without wpt dirs:');
    for (const entry of specsWithoutWptDirs) {
      console.log(`  ${entry.id} (looked for: ${entry.testpath})`);
    }
  }
}

main();
