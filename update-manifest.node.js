'use strict'

const common = require('./common.js')

const fs = require('fs')
const fetch = require('node-fetch')
const URL = require('url').URL

const biblio = ['biblio', 'w3c', 'whatwg', 'wicg']

// specref names to drop on the floor
const blocklist = [
  'API-DESIGN-PRINCIPLES',
  'COWL',
  'CSP2',
  'DIFFERENCES',
  'GraphQL',
  'HTML-EXTENSIONS',
  'INFRA',
  'LOADER',
  'UISecurity',
  'WCAG21',
  'accname-aam-1.1',
  'act-rules-format-1.0',
  'activitypub',
  'activitystreams-core',
  'activitystreams-vocabulary',
  'annotation-model',
  'annotation-protocol',
  'annotation-vocab',
  'charmod-norm',
  'clreq',
  'coga-user-research',
  'core-aam-1.1',
  'csp-embedded-enforcement',
  'css-cascade-3',
  'css-fonts-3',
  'css-overflow-3',
  'css-text-3',
  'css-ui-3',
  'csv2json',
  'csv2rdf',
  'custom-elements',
  'dom41',
  'dpub-aam-1.0',
  'dpub-aria-1.0',
  'dpub-css-priorities',
  'dpub-latinreq',
  'dwbp',
  'elreq',
  'graphics-aam-1.0',
  'graphics-aria-1.0',
  'html-aam-1.0',
  'html-aria',
  'html-imports',
  'html52',
  'ilreq',
  'indie-ui-context',
  'indie-ui-events',
  'international-specs',
  'klreq',
  'low-vision-needs',
  'ltli',
  'matrix',
  'microdata',
  'mobile-accessibility-mapping',
  'odrl-model',
  'odrl-vocab',
  'owl-time',
  'personalization-semantics-1.0',
  'poe-ucr',
  'pointerlock',
  'resource-timing-1',
  'selectors-nonelement-1',
  'shacl',
  'shadow-dom',
  'svg-aam-1.0',
  'tabular-data-model',
  'tabular-metadata',
  'ttml-imsc1.0.1',
  'ttml2',
  'typography',
  'uievents-code',
  'uievents-key',
  'using-aria',
  'vehicle-information-api',
  'vehicle-information-service',
  'verifiable-claims-data-model',
  'vocab-ssn',
  'wai-aria-1.1',
  'wai-aria-practices-1.1',
  'wcag2-ext-req',
  'webpayments-http-api',
  'webpayments-http-messages',
  'webstorage',
  'websub',
  'widgets-apis',
  'wot-architecture',
  'wot-scripting-api',
  'wot-thing-description',
]

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
    if (blocklist.includes(name))
      continue
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

  function entryFromGitHubIO(url) {
    console.assert(url.hostname.endsWith('.github.io'))

    const id = url.pathname.split('/')[1]

    return {
      id: id,
      name: info.title
        .replace(/:.*/, '')
        .replace(/ Level \d+$/, '')
        .replace(/ \d+(\.\d+)?$/, '')
        .replace(/ Specification$/, '')
        .replace(/ API$/, ''),
      href: url.href,
      specrepo: `${url.hostname.split('.')[0]}/${id}`,
    }
  }

  function entryFromDraftsOrg(url) {
    console.assert(url.hostname == 'drafts.css-houdini.org' ||
                   url.hostname == 'drafts.csswg.org' ||
                   url.hostname == 'drafts.fxtf.org')

    const org = url.hostname.split('.')[1]
    const match = /^\/(.*)\/$/.exec(url.pathname)
    let id = match[1]
    console.assert(!id.includes('/'))
    // no versions thanks
    if (id.startsWith('css3')) {
      if (id == 'css3-background')
        id = 'css-backgrounds' // plural
      else
        id = id.replace('css3', 'css')
    } else {
      id = id.replace(/-\d$/, '')
    }
    url.pathname = `/${id}/`

    return {
      id: id,
      name: info.title
        .replace(/ Level \d+$/, '')
        .replace(/ Module$/, ''),
      href: url.href,
      specrepo: `w3c/${org}-drafts`,
      // Note: mediaqueries-5 has the highest level on 2017-09-30
      specpath: `${id} ${id}-1 ${id}-2 ${id}-3 ${id}-4 ${id}-5`,
      testpath: `${id} css/${id} css/${id}-1 css/${id}-2 css/${id}-3 css/${id}-4 css/${id}-5`,
    }
  }

  function entryFromSvgwgOrg(url) {
    console.assert(url.hostname == 'svgwg.org')

    const entry = {
      id: undefined, // just for the order
      name: info.title,
      href: url.href,
      specrepo: 'w3c/svgwg',
    }

    if (url.pathname == '/svg2-draft/') {
      entry.id = 'svg',
      entry.name = 'SVG'
      entry.specpath = 'master'
    } else {
      console.assert(url.pathname.startsWith('/specs/')  &&
                     url.pathname.endsWith('/'))
      const id = url.pathname.split('/')[2]
      entry.id = `svg-${id}`
      entry.specpath = `specs/${id}`
    }

    return entry
  }

  switch (group) {
  case 'biblio': {
    const url = new URL(info.href)
    if (url.hostname.endsWith('.github.io'))
      return entryFromGitHubIO(url)

    // TODO: handle more interesting things, like WebGL
    return
  }

  case 'w3c': {
    // ignore everything that isn't maintained
    if (!info.edDraft)
      return
    if (info.status == 'NOTE')
      return

    let url = info.edDraft

    // workaround before fix in https://www.w3.org/2002/01/tr-automation/tr.rdf
    const OLD_CSS_PREFIX = 'http://dev.w3.org/csswg/'
    if (url.startsWith(OLD_CSS_PREFIX))
      url = 'https://drafts.csswg.org/' + url.substr(OLD_CSS_PREFIX.length)

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
      const entry = entryFromGitHubIO(url)

      // the webappsec prefix isn't used in the wpt dirname
      if (entry.id.startsWith('webappsec-'))
        entry.testpath = entry.id.substr(10)

      return entry
    }

    if (url.hostname.startsWith('drafts.'))
      return entryFromDraftsOrg(url)

    console.assert(url.hostname == 'svgwg.org')
    return entryFromSvgwgOrg(url)
  }

  case 'whatwg': {
    if (info.obsoletedBy)
      return

    const url = new URL(info.href)

    console.assert(url.hostname.endsWith('.idea.whatwg.org') ||
                   url.hostname.endsWith('.spec.whatwg.org'))

    const id = url.hostname.split('.')[0]

    return {
      id: id,
      name: info.title
        .replace(/ Standard$/, '')
        .replace(/ API$/, ''),
      href: url.href,
      specrepo: 'whatwg/' + id,
    }
  }

  case 'wicg': {
    const url = new URL(info.href)
    console.assert(url.hostname.endsWith('.github.io'))
    return entryFromGitHubIO(url)
  }

  }

  throw `Unknown group: ${group}`
}

Promise.all(biblio.map(processGroup))
  .then(manifests => {
    const manifest = [].concat(...manifests)

    function uniqueMap(prop) {
      const map = new Map
      for (const entry of manifest) {
        if (map.has(entry[prop]))
          throw `duplicate ${prop}: ${entry[prop]}`
        map.set(entry[prop], entry)
      }
      return map
    }

    const idMap = uniqueMap('id')

    const manifestFixes = JSON.parse(fs.readFileSync('manifest-fixes.json'))
    for (const fix of manifestFixes) {
      Object.assign(idMap.get(fix.id), fix)
    }

    // check that names are unique, ignore returned map
    uniqueMap('name')

    // sort the manifest in the same way as the client would
    manifest.sort((a, b) => common.compareStrings(a.name, b.name))

    console.log('Writing manifest.json')
    fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, '  ') + '\n')
  })
