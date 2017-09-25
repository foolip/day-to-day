'use strict'

const DATA_DIR = 'data'
const REPO_CACHE_DIR = 'cache'

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

function getLog(url, since, options) {

  let cmd = `git log --no-merges --since="${since}" --date=iso-strict --pretty="%h %cd %s"`
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

const manifest = common.parseManifest(fs.readFileSync('manifest.json'))
const since = new Date(Date.now() - (common.NUM_DAYS + 1) * 24 * 3600 * 1000).toISOString()

for (const entry of manifest) {
  const specLog = getLog(entry.specrepo, since, { path: entry.specpath })
  const testLog = getLog(entry.testrepo, since, { path: entry.testpath })
  fs.writeFileSync(`${DATA_DIR}/${entry.shortname}.spec.log`, specLog)
  fs.writeFileSync(`${DATA_DIR}/${entry.shortname}.test.log`, testLog)
}
