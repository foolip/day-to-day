'use strict';

const DAY = 24 * 3600 * 1000;

const fs = require('fs');
const execSync = require('child_process').execSync;
const path = require('path');
const repo = require('./repo');

function getLog(dir, since, until, options) {
  // --date=short-local combined with TZ=UTC gets us the UTC date.
  let cmd = `git log --no-merges --since="${since}" --until="${until}" ` +
      `--date=short-local --pretty="%cd\t%ae\t%h\t%s"`;
  if (options.path) {
    cmd += ` -- ${options.path}`;
  }

  const stdout = execSync(cmd, {
    cwd: dir,
    env: {'TZ': 'UTC'},
  }).toString();

  return stdout.split('\n').filter((line) => line != '').map((line) => {
    const [date, author, hash, subject] = line.split('\t');
    return {date, author, hash, subject};
  });
}

function getTestPolicy(dir) {
  const script = path.join(path.dirname(module.filename),
      'find-test-policy.sh');
  const matches = execSync(`${script} "${dir}"`)
      .toString().split('\n').filter((line) => line != '');
  if (matches.length == 1) {
    return matches[0];
  }
}

function getSpecRepo(entry) {
  const repo = entry.specrepo;

  if (!repo.startsWith('https://')) {
    throw new Error(`specrepo must be a HTTPS URL: ${repo}`);
  }

  return repo;
}

function getTestRepo(entry) {
  const repo = entry.testrepo;

  if (!repo) {
    return 'https://github.com/web-platform-tests/wpt';
  }

  if (repo.startsWith('https://')) {
    return repo;
  }

  return 'https://github.com/' + repo;
}

function main() {
  const specsPath = process.argv[2];
  const dataPath = process.argv[3];
  console.assert(specsPath && dataPath);

  console.log('Reading config.json');
  const config = JSON.parse(fs.readFileSync('config.json'));

  const now = Date.now();
  // days+1 so that there are enough whole UTC days in range
  const since = new Date(now - (config.days + 1) * DAY).toISOString();
  const until = new Date(now).toISOString();

  console.log(`Reading ${specsPath}`);
  const specs = JSON.parse(fs.readFileSync(specsPath));

  for (const entry of specs) {
    console.assert(entry.id && entry.name && entry.specrepo);

    const specRepo = getSpecRepo(entry);
    const testRepo = getTestRepo(entry);

    const specDir = repo.checkout(specRepo);
    const testDir = repo.checkout(testRepo);

    const specPath = entry.specpath;
    const testPath = entry.testpath || entry.id;

    const specLog = getLog(specDir, since, until, {path: specPath});
    const testLog = getLog(testDir, since, until, {path: testPath});

    entry.speclog = specLog;
    entry.testlog = testLog;

    if (!entry.testpolicy) {
      // look for a testing policy (anywhere in the repo, ignore specPath)
      const testPolicy = getTestPolicy(specDir);
      if (testPolicy) {
        // Note: This assumes GitHub's URL structure.
        entry.testpolicy = `${specRepo}/blob/HEAD/${testPolicy}`;
      }
    }
  }

  // delete that aren't (going to be) used by the client
  for (const entry of specs) {
    delete entry.id;
    delete entry.specpath;
    delete entry.testpath;
  }

  console.log(`Writing ${dataPath}`);
  const data = {
    days: config.days,
    since: since,
    until: until,
    specs: specs,
  };
  fs.writeFileSync(dataPath, JSON.stringify(data, null, '  ') + '\n');
}

main();
