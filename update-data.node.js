'use strict'

const REPO_CACHE_DIR = 'cache'
const DAY = 24 * 3600 * 1000

const common = require('./common.js')

const fs = require('fs')
const execSync = require('child_process').execSync

// clones or updates a repo, returns its directory name
function cloneOrUpdate(url, repoCache) {
  if (!url.startsWith('https://'))
    throw 'Use a https:// repo URL!'

  if (repoCache.has(url))
    return repoCache.get(url)

  const dir = `${REPO_CACHE_DIR}/${url.substr(8)}`
  console.log(`Updating ${url}`)
  execSync(`sh clone-or-update.sh "${url}" "${dir}"`, {stdio:[0,1,2]})

  repoCache.set(url, dir)

  return dir
}

// dirs with no tests / old tests
const IGNORE_WPT_DIRS = new Set([
  'acid', // Acid2 and Acid3
  'common',
  'conformance-checkers',
  'css', // tests are in subdirs
  'css/CSS1', // https://www.w3.org/TR/CSS1/
  'css/fonts',
  'css/reference',
  'css/support',
  'css/tools',
  'css/vendor-imports',
  'css/work-in-progress',
  'docs',
  'fonts',
  'images',
  'infrastructure',
  'interfaces',
  'media',
  'old-tests',
  'resources',
  'tools',
])

// dirs that need some kind of action
const TODO_WPT_DIRS = new Set([
  'annotation-model', // https://www.w3.org/TR/annotation-model/
  'annotation-protocol', // https://www.w3.org/TR/annotation-protocol/
  'annotation-vocab', // https://www.w3.org/TR/annotation-vocab/
  'apng', // https://wiki.mozilla.org/APNG_Specification
  'cookies', // https://github.com/w3c/web-platform-tests/pull/7531#issuecomment-333397939
  'core-aam', // https://w3c.github.io/aria/core-aam/core-aam.html
  'css-scroll-anchoring', // https://github.com/w3c/web-platform-tests/issues/7765
  'css/WOFF2', // https://dev.w3.org/webfonts/WOFF2/spec/
  'css/css-block-3', // https://github.com/w3c/web-platform-tests/issues/7652
  'domxpath', // https://www.w3.org/TR/xpath/
  'dpub-aam', // https://w3c.github.io/aria/dpub-aam/dpub-aam.html
  'dpub-aria', // http://w3c.github.io/aria/aria/dpub.html
  'editing',
  'geolocation-API', // https://www.w3.org/TR/geolocation-API/
  'html-imports', // https://w3c.github.io/webcomponents/spec/imports/
  'html-longdesc', // https://www.w3.org/TR/html-longdesc/
  'http', // https://tools.ietf.org/html/rfc7230
  'js', // https://github.com/w3c/web-platform-tests/issues/6462
  'mathml', // https://www.w3.org/TR/MathML/
  'svg-aam', // https://w3c.github.io/aria/svg-aam/svg-aam.html
  'trusted-types', // https://github.com/mikewest/trusted-types
  'viewport', // https://github.com/w3c/web-platform-tests/issues/7749
  'wai-aria', // http://w3c.github.io/aria/aria/aria.html
  'wasm', // https://github.com/WebAssembly/spec/issues/529
  'webgl', // https://github.com/w3c/web-platform-tests/issues/5927
  'x-frame-options', // https://tools.ietf.org/html/rfc7034
])

// spec ids for which no tests exist
const TODO_SPEC_IDS = new Set([
  'BackgroundSync',
  'InputDeviceCapabilities',
  'animation-worklet',
  'aom',
  'books',
  'browserext',
  'budget-api',
  'cors-rfc1918',
  'css-contain',
  'css-content',
  'css-device-adapt',
  'css-inline',
  'css-line-grid',
  'css-overflow',
  'css-page-floats',
  'css-properties-values-api',
  'css-scroll-snap',
  'css-sizing',
  'css-will-change',
  'dnt',
  'execCommand',
  'figures',
  'fill-stroke',
  'geolocation-sensor',
  'manifest',
  'mediacapture-depth',
  'mediacapture-screen-share',
  'mimesniff',
  'mst-content-hint',
  'native-messaging',
  'payment-method-manifest',
  'permissions',
  'push-api',
  'resource-hints',
  'scroll-animations',
  'scroll-boundary-behavior',
  'shape-detection-api',
  'svg-integration',
  'svg-markers',
  'svg-paths',
  'svg-strokes',
  'web-midi-api',
  'webappsec-csp-embedded', // in content-security-policy/embedded-enforcement
  'webrtc-stats',
])

function getWptDirs(dir) {
  const cmd = 'find * -maxdepth 0 -type d -print0; find css/* -maxdepth 0 -type d -print0'
  const dirs = execSync(cmd, { cwd: dir }).toString().split('\0').filter(dir => {
    if (dir == '')
      return false
    if (IGNORE_WPT_DIRS.has(dir))
      return false
    if (TODO_WPT_DIRS.has(dir))
      return false
    return true
  })
  dirs.sort()
  return new Set(dirs)
}

function getLog(dir, since, until, options) {
  // --date=short-local combined with TZ=UTC gets us the UTC date.
  let cmd = `git log --no-merges --since="${since}" --until="${until}" --date=short-local --pretty="%cd %h %s"`
  if (options.path)
    cmd += ` -- ${options.path}`

  const stdout = execSync(cmd, {
    cwd: dir,
    env: { 'TZ': 'UTC' },
  }).toString()

  return stdout.split('\n').filter(line => line != '')
}

function getTestPolicy(dir) {
  const cmd = `sh find-test-policy.sh "${dir}"`
  const matches = execSync(cmd)
        .toString().split('\n').filter(line => line != '')
  if (matches.length == 1)
    return matches[0]
}

function getSpecRepo(entry) {
  let repo = entry.specrepo

  if (repo.startsWith('https://'))
    return repo

  return 'https://github.com/' + repo
}

function getTestRepo(entry) {
  let repo = entry.testrepo

  if (!repo)
    return 'https://github.com/w3c/web-platform-tests'

  if (repo.startsWith('https://'))
    return repo

  return 'https://github.com/' + repo
}

function main() {
  const manifestPath = process.argv[2],
        dataPath = process.argv[3]
  console.assert(manifestPath && dataPath)

  const now = Date.now()
  const today = now - (now % DAY)
  const since = new Date(today - (common.NUM_DAYS + common.GRACE_DAYS) * DAY).toISOString()
  const until = new Date(today).toISOString()

  // a url->dir map to avoid updating the same repo twice
  const repoCache = new Map

  // set of all dirs that (currently) really exist in wpt
  const wptDir = cloneOrUpdate('https://github.com/w3c/web-platform-tests', repoCache)
  const realWptDirs = getWptDirs(wptDir)

  // set of all dirs in wpt that are used by some entry
  const usedWptDirs = new Set

  // list of specs (entries) for which no tests are found in wpt
  const specsWithoutWptDirs = []

  const manifest = JSON.parse(fs.readFileSync(manifestPath))

  for (const entry of manifest) {
    console.assert(entry.id && entry.name && entry.specrepo)

    const specRepo = getSpecRepo(entry)
    const testRepo = getTestRepo(entry)

    const specDir = cloneOrUpdate(specRepo, repoCache)
    const testDir = cloneOrUpdate(testRepo, repoCache)

    const specPath = entry.specpath
    const testPath = entry.testpath || entry.id

    const specLog = getLog(specDir, since, until, { path: specPath })
    const testLog = getLog(testDir, since, until, { path: testPath })

    entry.speclog = specLog
    entry.testlog = testLog

    if (TODO_SPEC_IDS.has(entry.id))
      continue

    if (!entry.testpolicy) {
      // look for a testing policy (anywhere in the repo, ignore specPath)
      const testPolicy = getTestPolicy(specDir)
      if (testPolicy)
        entry.testpolicy = `https://github.com/${entry.specrepo}/blob/HEAD/${testPolicy}`
    }

    if (testRepo.includes('web-platform-tests')) {
      const entryDirs = testPath.split(' ')
      entryDirs.forEach(dir => {
        usedWptDirs.add(dir)
      })

      if (!entryDirs.some(dir => realWptDirs.has(dir)))
        specsWithoutWptDirs.push(entry)
    }
  }

  console.log(`Writing ${dataPath}`)
  const data = {
    date: new Date(today - DAY).toISOString().substr(0, 10),
    specs: manifest,
  }
  fs.writeFileSync(dataPath, JSON.stringify(data, null, '  ') + '\n')

  // report on missing things

  if (specsWithoutWptDirs.length) {
    console.log('Specs without tests (in wpt):')
    for (const entry of specsWithoutWptDirs)
      console.log(`  ${entry.name} <${entry.href}>`)
  }

  const specsWithoutTestPolicy = manifest.filter(entry => {
    return !entry.testpolicy && !TODO_SPEC_IDS.has(entry.id)
  })
  if (specsWithoutTestPolicy.length) {
    console.log('Specs with no (known) testing policy:')
    specsWithoutTestPolicy.forEach(entry => {
      console.log(`  ${entry.name} <${entry.href}>`)
    })
  }

  const wptDirsWithoutSpec = Array.from(realWptDirs)
        .filter(dir => !usedWptDirs.has(dir))
  if (wptDirsWithoutSpec.length) {
    console.log('Directories (in wpt) without spec:')
    for (const dir of wptDirsWithoutSpec)
      console.log(`  ${dir}`)
  }
}

main()
