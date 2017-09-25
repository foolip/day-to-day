'use strict'

const common = require('./common.js')

const fs = require('fs')
const fetch = require('node-fetch')
const URL = require('url').URL

const biblio = ['w3c', 'whatwg', 'wicg']

function processGroup(group) {
  const url = `https://github.com/tobie/specref/raw/master/refs/${group}.json`

  console.log(`Fetching ${url}`)
  return fetch(url)
    .then(response => response.json())
    .then(processRefs.bind(null, group))
}

function processRefs(group, refs) {
  const manifest = []

  for (const name in refs) {
    const info = refs[name]
    const entry = processRef(group, refs[name])
    if (entry)
      manifest.push(entry)
  }

  return manifest
}

// turns group+info into a manifest entry or returns undefined if skipped
function processRef(group, info) {
  if (!info.href || !info.title)
    return

  switch (group) {
  case 'w3c': {
    // ignore everything that isn't maintained
    if (!info.edDraft)
      return
    if (info.status == 'NOTE')
      return

    let url = info.edDraft

    // working around https://github.com/tobie/specref/issues/389
    const OLD_FXTF_PREFIX = 'http://dev.w3.org/fxtf/'
    if (url.startsWith(OLD_FXTF_PREFIX))
      url = 'https://drafts.fxtf.org/' + url.substr(OLD_FXTF_PREFIX.length)

    url = new URL(url)

    const HOSTNAMES = [
      'drafts.css-houdini.org',
      'drafts.csswg.org',
      'drafts.fxtf.org',
      'svgwg.org', // TODO: handle path component
      'w3c.github.io',
      'webaudio.github.io',
    ]

    if (!HOSTNAMES.some(hostname => url.hostname == hostname))
      return

    if (url.hostname.endsWith('.github.io')) {
      const id = url.pathname.split('/')[1]
      const match = url.pathname.match(/^\/([^/]*)\/?(.*)/)

      if (match[2]) {
        // TODO: handle https://w3c.github.io/webdriver/webdriver-spec.html
        return
      }

      if (id != 'webrtc-pc')
        return

      return {
        id: id,
        name: info.title,
        specrepo: `${url.hostname.split('.')[0]}/${match[1]}`,
      }
    }

    // TODO: handle everything else!
    return
  }

  case 'whatwg': {
    if (info.obsoletedBy)
      return

    const url = new URL(info.href)

    if (!url.hostname.endsWith('.idea.whatwg.org') &&
        !url.hostname.endsWith('.spec.whatwg.org'))
      return

    const id = url.hostname.split('.')[0]

    if (id == 'infra')
      return

    return {
      id: id,
      name: info.title.replace(/ Standard$/, ''),
      specrepo: 'whatwg/' + id,
    }
  }

  case 'wicg':
    // TODO: handle it
    return
  }

  throw `Unknown group: ${group}`
}

Promise.all(biblio.map(processGroup))
  .then(manifests => {
    const manifest = [].concat(...manifests)

    // overwrite some manifest entries (O^2 is fast enough)
    const manifestFixes = JSON.parse(fs.readFileSync('manifest-fixes.json'))
    for (const fix of manifestFixes) {
      const entry = manifest.find(e => e.id == fix.id)
      Object.assign(entry, fix)
    }

    manifest.sort((a, b) => common.compareStrings(a.name, b.name))
    console.log('Writing manifest.json')
    fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, '  ') + '\n')
  })
