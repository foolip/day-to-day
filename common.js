(exports => {
  'use strict'

  exports.NUM_WEEKS = 8
  exports.NUM_DAYS = 7 * exports.NUM_WEEKS
  exports.GRACE_DAYS = 1

  exports.parseManifest = json => {
    const manifest = JSON.parse(json)

    for (const entry of manifest) {
      console.assert(entry.id && entry.name && entry.specrepo)

      if (!entry.specrepo.startsWith('https://'))
        entry.specrepo = 'https://github.com/' + entry.specrepo

      if (!entry.testrepo)
        entry.testrepo = 'https://github.com/w3c/web-platform-tests'
      else if (!entry.testrepo.startsWith('https://'))
        entry.testrepo = 'https://github.com/' + entry.testrepo

      if (!entry.testpath)
        entry.testpath = entry.id
    }

    return manifest
  }

  exports.compareStrings = (a, b) => {
    const lowerA = a.toLowerCase(),
          lowerB = b.toLowerCase()
    if (lowerA < lowerB)
      return -1
    if (lowerA > lowerB)
      return 1
    return 0
  }

})(this.exports ? exports : this)
