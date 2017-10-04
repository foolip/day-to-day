'use strict'

const DATA_DIR = 'data'
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

// dirs with no tests
const IGNORE_WPT_DIRS = new Set([
  'assumptions',
  'common',
  'conformance-checkers',
  'css', // tests are in subdirs
  'css/fonts',
  'css/reference',
  'css/support',
  'css/tools',
  'docs',
  'fonts',
  'images',
  'infrastructure',
  'interfaces',
  'media',
  'resources',
  'tools',
])

// dirs that need some kind of action
const TODO_WPT_DIRS = new Set([
  'WebIDL',
  'annotation-model',
  'annotation-protocol',
  'annotation-vocab',
  'apng',
  'background-fetch',
  'cookies',
  'core-aam',
  'css/CSS1',
  'css/WOFF2',
  'css/css-block-3',
  'css/vendor-imports',
  'css/work-in-progress',
  'domxpath',
  'dpub-aam',
  'dpub-aria',
  'editing',
  'ext-xhtml-pubid',
  'geolocation-API',
  'html-imports',
  'html-longdesc',
  'http', // IETF spec
  'input-events',
  'js', // should be merged with test262
  'keyboard-lock',
  'mathml',
  'old-tests',
  'orientation-event',
  'progress-events',
  'resize-observer',
  'scroll-anchoring',
  'speech-api',
  'staticrange',
  'svg-aam',
  'trusted-types',
  'viewport',
  'wai-aria',
  'wasm',
  'web-nfc',
  'webgl',
  'webvr',
  'x-frame-options',
])

// spec ids for which no tests exist
const TODO_SPEC_IDS = new Set([
  'BackgroundSync',
  'books',
  'browserext',
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
  'figures',
  'fill-stroke',
  'loader',
  'manifest',
  'mediacapture-depth',
  'mediacapture-screen-share',
  'mimesniff',
  'native-messaging',
  'payment-method-manifest',
  'permissions',
  'push-api',
  'requestidlecallback',
  'resource-hints',
  'svg-integration',
  'svg-markers',
  'svg-paths',
  'svg-strokes',
  'wake-lock',
  'web-midi-api',
  'webrtc-stats',
])

function getWptDirs() {
  const dir = `${REPO_CACHE_DIR}/github.com/w3c/web-platform-tests`
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
  let cmd = `git log --no-merges --since="${since}" --until="${until}" --date=iso-strict --pretty="%h %cd %s"`
  if (options.path)
    cmd += ` -- ${options.path}`

  const lines = execSync(cmd, { cwd: dir }).toString().split('\n')
  let log = ''
  for (const line of lines) {
    if (line == '')
      continue
    const parts = line.split(/\s+/)
    const tabLine = `${parts[0]}\t${new Date(parts[1]).toISOString().substr(0, 10)}\t${parts.splice(2).join(' ')}`
    console.assert(tabLine.split('\t').length == 3)
    log += tabLine + '\n'
  }
  return log
}

function update() {
  const now = Date.now()
  const today = now - (now % DAY)
  const since = new Date(today - (common.NUM_DAYS + common.GRACE_DAYS) * DAY).toISOString()
  const until = new Date(today).toISOString()

  // set of all dirs that (currently) really exist in wpt
  const realWptDirs = getWptDirs()

  // set of all dirs in wpt that are used by some entry
  const usedWptDirs = new Set

  const manifest = common.parseManifest(fs.readFileSync('manifest.json'))

  // a url->dir map to avoid updating the same repo twice
  const repoCache = new Map

  for (const entry of manifest) {
    const specDir = cloneOrUpdate(entry.specrepo, repoCache)
    const testDir = cloneOrUpdate(entry.testrepo, repoCache)

    const specLog = getLog(specDir, since, until, { path: entry.specpath })
    const testLog = getLog(testDir, since, until, { path: entry.testpath })

    fs.writeFileSync(`${DATA_DIR}/${entry.id}.spec.log`, specLog)
    fs.writeFileSync(`${DATA_DIR}/${entry.id}.test.log`, testLog)

    if (entry.testrepo.includes('web-platform-tests')) {
      const entryDirs = entry.testpath.split(' ')
      entryDirs.forEach(dir => {
        usedWptDirs.add(dir)
      })

      if (!TODO_SPEC_IDS.has(entry.id) && !entryDirs.some(dir => realWptDirs.has(dir)))
        console.info(`${entry.id} spec does not have any wpt dirs (${entry.testpath} checked)`)
    }
  }

  // update the date <meta> in the index.html with the last date to show
  let html = fs.readFileSync('index.html').toString()
  html = html.replace(/\d{4}-\d{2}-\d{2}/, new Date(today - DAY).toISOString().substr(0, 10))
  fs.writeFileSync('index.html', html)


  // report which wpt dirs don't have a corresponding entry
  for (const dir of realWptDirs) {
    if (!usedWptDirs.has(dir))
      console.warn(`${dir} dir is not claimed by any spec`)
  }
}

update()
