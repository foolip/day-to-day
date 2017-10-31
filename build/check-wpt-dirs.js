'use strict'

const execSync = require('child_process').execSync
const fs = require('fs')
const repo = require('./repo')

const IGNORE_WPT_DIRS = new Set([
  'acid', // Acid2 and Acid3
  'annotation-model', // https://www.w3.org/TR/annotation-model/
  'annotation-protocol', // https://www.w3.org/TR/annotation-protocol/
  'annotation-vocab', // https://www.w3.org/TR/annotation-vocab/
  'common',
  'conformance-checkers',
  'core-aam', // https://w3c.github.io/aria/core-aam/core-aam.html
  'css', // tests are in subdirs
  'css/CSS1', // https://www.w3.org/TR/CSS1/
  'css/fonts',
  'css/reference',
  'css/support',
  'css/tools',
  'css/vendor-imports',
  'css/work-in-progress',
  'docs',
  'dpub-aam', // https://w3c.github.io/aria/dpub-aam/dpub-aam.html
  'dpub-aria', // http://w3c.github.io/aria/aria/dpub.html
  'fonts',
  'html-imports', // https://w3c.github.io/webcomponents/spec/imports/
  'html-longdesc', // https://www.w3.org/TR/html-longdesc/
  'images',
  'infrastructure',
  'interfaces',
  'js', // https://github.com/w3c/web-platform-tests/issues/6462
  'media',
  'old-tests',
  'resources',
  'svg-aam', // https://w3c.github.io/aria/svg-aam/svg-aam.html
  'tools',
  'wai-aria', // http://w3c.github.io/aria/aria/aria.html
  'wasm', // https://github.com/WebAssembly/spec/issues/529
])

function findWptDirs(dir) {
  const cmd = 'find * -maxdepth 0 -type d -print0; find css/* -maxdepth 0 -type d -print0'
  const dirs = execSync(cmd, { cwd: dir }).toString().split('\0').filter(dir => dir != '')
  dirs.sort()
  return new Set(dirs)
}

function main() {
  const specsPath = process.argv[2]
  console.assert(specsPath)

  console.log(`Reading ${specsPath}`)
  const specs = JSON.parse(fs.readFileSync(specsPath))

  // set of all dirs that (currently) really exist in wpt
  const wptDir = repo.checkout('https://github.com/w3c/web-platform-tests', { update: false })
  const realWptDirs = findWptDirs(wptDir)

  // set of all dirs in wpt that are used by some entry
  const usedWptDirs = new Set

  // list of specs (entries) for which no tests are found in wpt
  const specsWithoutWptDirs = []

  for (const entry of specs) {
    // skips specs where the tests aren't int wpt
    if (entry.testrepo && !entry.testrepo != 'w3c/web-platform-tests')
      continue

    // Note: some of the dirs may not exist, they are the arguments to git log
    // TODO: this duplicates logic (entry.testpath || entry.id) in data.js
    const dirs = (entry.testpath || entry.id).split(' ')

    dirs.forEach(dir => usedWptDirs.add(dir))

    if (!dirs.some(dir => realWptDirs.has(dir)))
      specsWithoutWptDirs.push(entry)
  }

  if (specsWithoutWptDirs.length) {
    console.log('Specs without tests (in wpt):')
    for (const entry of specsWithoutWptDirs)
      console.log(`  ${entry.name} <${entry.href}>`)
  }

  const wptDirsWithoutSpec = Array.from(realWptDirs)
        .filter(dir => !usedWptDirs.has(dir) && !IGNORE_WPT_DIRS.has(dir))
  if (wptDirsWithoutSpec.length) {
    console.log('Directories (in wpt) without spec:')
    for (const dir of wptDirsWithoutSpec)
      console.log(`  ${dir}`)
  }
}

main()
