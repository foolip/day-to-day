const fs = require('fs')
const execSync = require('child_process').execSync
const common = require('./common.js')

const manifest = common.parseManifest(fs.readFileSync('manifest.json'))
const since = new Date(Date.now() - (common.NUM_DAYS + 1) * 24 * 3600 * 1000).toISOString()

function getLog(repo, since, options) {
  let cmd = `git log --no-merges --since="${since}" --date=iso-strict --pretty="%h %cd %s"`
  if (options.path)
    cmd += ` -- ${options.path}`

  let cwd
  if (repo.includes('/web-platform-tests'))
    cwd = '/Users/foolip/web-platform-tests'
  else if (repo.includes('/whatwg/'))
    cwd = repo.replace(/.*\//g, '/Users/foolip/whatwg/')
  else if (repo.includes('/w3c/'))
    cwd = repo.replace(/.*\//g, '/Users/foolip/w3c/')
  else
    throw "I'm stuck on a plane"

  const lines = execSync(cmd, { cwd: cwd }).toString().trim().split('\n')
  let log = ''
  for (const line of lines) {
    const parts = line.split(/\s+/)
    const tabLine = `${parts[0]}\t${new Date(parts[1]).toISOString().substr(0, 10)}\t${parts.splice(2).join(' ')}`
    console.assert(tabLine.split('\t').length == 3)
    log += tabLine + '\n'
  }
  return log
}

for (const entry of manifest) {
  const specLog = getLog(entry.specrepo, since, { path: entry.specpath })
  const testLog = getLog(entry.testrepo, since, { path: entry.testpath })
  fs.writeFileSync(`data/${entry.shortname}.spec.log`, specLog)
  fs.writeFileSync(`data/${entry.shortname}.test.log`, testLog)
}
