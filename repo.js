'use strict'

const execSync = require('child_process').execSync

// the cache directory is used to reuse checkouts between processes
const DISK_CACHE_DIR = 'cache'

// the cache map is used to memoize calls within the same process
const cache = new Map

// clones or updates a repo, returns its directory name
exports.checkout = function(url, options = { update: true }) {
  if (!url.startsWith('https://'))
    throw 'Use a https:// repo URL!'

  if (cache.has(url))
    return cache.get(url)

  const dir = `${DISK_CACHE_DIR}/${url.substr(8)}`

  if (options.update) {
    console.log(`Updating ${url}`)
    execSync(`sh repo-checkout.sh "${url}" "${dir}"`, {stdio:[0,1,2]})
    cache.set(url, dir)
  }

  return dir
}
