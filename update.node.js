'use strict'

const DATA_DIR = 'data'
const REPO_CACHE_DIR = 'cache'
const DAY = 24 * 3600 * 1000

const common = require('./common.js')

const fs = require('fs')
const execSync = require('child_process').execSync

// clones or updates a repo, returns its directory name
function cloneOrUpdate(url) {
  if (!url.startsWith('https://'))
    throw 'Use a https:// repo URL!'

  const dir = `${REPO_CACHE_DIR}/${url.substr(8)}`
  execSync(`sh clone-or-update.sh "${url}" "${dir}"`, {stdio:[0,1,2]})

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
  'audio-output',
  'background-fetch',
  'battery-status',
  'clear-site-data',
  'cookies',
  'core-aam',
  'credential-management',
  'css-backgrounds', // id is css-background
  'css/CSS1',
  'css/WOFF2',
  'css/css-animations-1',
  'css/css-backgrounds-3', // id is css-background
  'css/css-block-3',
  'css/css-conditional-3',
  'css/css-multicol-1',
  'css/css-page-3',
  'css/css-speech-1',
  'css/css3-color',
  'css/css3-selectors',
  'css/selectors4',
  'css/vendor-imports',
  'css/work-in-progress',
  'domxpath',
  'dpub-aam',
  'dpub-aria',
  'editing',
  'encrypted-media',
  'ext-xhtml-pubid',
  'geolocation-API',
  'html-imports',
  'html-longdesc',
  'http',
  'input-events',
  'intersection-observer',
  'js',
  'keyboard-lock',
  'longtask-timing',
  'mathml',
  'media-capabilities',
  'netinfo',
  'old-tests',
  'orientation-event',
  'progress-events',
  'referrer-policy',
  'scroll-anchoring',
  'secure-contexts',
  'selectors',
  'speech-api',
  'staticrange',
  'subresource-integrity',
  'svg-aam',
  'touch-events',
  'trusted-types',
  'uievents',
  'upgrade-insecure-requests',
  'viewport',
  'wai-aria',
  'wasm',
  'web-nfc',
  'web-share',
  'webgl',
  'webvr',
  'x-frame-options',
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

function getLog(url, since, until, options) {
  let cmd = `git log --no-merges --since="${since}" --until="${until}" --date=iso-strict --pretty="%h %cd %s"`
  if (options.path)
    cmd += ` -- ${options.path}`

  const dir = cloneOrUpdate(url)

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

  // set of all dirs in wpt that are used by some entry
  const usedWptDirs = new Set

  const manifest = common.parseManifest(fs.readFileSync('manifest.json'))
  for (const entry of manifest) {
    const specLog = getLog(entry.specrepo, since, until, { path: entry.specpath })
    const testLog = getLog(entry.testrepo, since, until, { path: entry.testpath })
    fs.writeFileSync(`${DATA_DIR}/${entry.id}.spec.log`, specLog)
    fs.writeFileSync(`${DATA_DIR}/${entry.id}.test.log`, testLog)

    if (entry.testrepo.includes('web-platform-tests')) {
      entry.testpath.split(' ').forEach(dir => {
        // it doesn't matter that some of these directories don't exist
        usedWptDirs.add(dir)
      })
    }
  }

  // update the date <meta> in the index.html with the last date to show
  let html = fs.readFileSync('index.html').toString()
  html = html.replace(/\d{4}-\d{2}-\d{2}/, new Date(today - DAY).toISOString().substr(0, 10))
  fs.writeFileSync('index.html', html)

  // report which wpt dirs don't have a corresponding entry
  //console.log(usedWptDirs)
  for (const dir of getWptDirs()) {
    if (!usedWptDirs.has(dir))
      console.warn(`${dir} is not claimed by any spec`)
  }
}

update()
