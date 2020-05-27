'use strict';

const execSync = require('child_process').execSync;
const fs = require('fs');
const repo = require('./repo');

function findWptDirs(dir) {
  const cmd = 'find * -maxdepth 0 -type d -print0; ' +
      'find css/* -maxdepth 0 -type d -print0';
  const dirs = execSync(cmd, {cwd: dir})
      .toString().split('\0').filter((dir) => dir != '');
  dirs.sort();
  return new Set(dirs);
}

function main() {
  const specsPath = process.argv[2];
  console.assert(specsPath);

  console.log(`Reading ${specsPath}`);
  const specs = JSON.parse(fs.readFileSync(specsPath));

  // set of all dirs that (currently) really exist in wpt
  const wptDir = repo.checkout('https://github.com/web-platform-tests/wpt', {update: false});
  const realWptDirs = findWptDirs(wptDir);

  // set of all dirs in wpt that are used by some entry
  const usedWptDirs = new Set;

  // list of specs (entries) for which no tests are found in wpt
  const specsWithoutWptDirs = [];

  for (const entry of specs) {
    // skips specs where the tests aren't in wpt
    if (entry.testrepo && !entry.testrepo != 'web-platform-tests/wpt') {
      continue;
    }

    // Note: some of the dirs may not exist, they are the arguments to git log
    // TODO: this duplicates logic (entry.testpath || entry.id) in data.js
    const dirs = (entry.testpath || entry.id).split(' ');

    dirs.forEach((dir) => usedWptDirs.add(dir));

    if (!dirs.some((dir) => realWptDirs.has(dir))) {
      specsWithoutWptDirs.push(entry);
    }
  }

  if (specsWithoutWptDirs.length) {
    console.log('Specs without tests (in wpt):');
    for (const entry of specsWithoutWptDirs) {
      console.log(`  ${entry.name} <${entry.href}>`);
    }
  }
}

main();
