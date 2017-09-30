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
  'css-overflow-3',
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
  'intersection-observer',
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
    id = id.replace(/-\d$/, '')
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

    const url = new URL(info.edDraft)

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

    if (url.hostname.endsWith('.github.io'))
      return entryFromGitHubIO(url)

    if (url.hostname.startsWith('drafts.'))
      return entryFromDraftsOrg(url)

    // TODO: handle everything else!
    return
  }

  case 'whatwg': {
    if (info.obsoletedBy)
      return

    const url = new URL(info.href)

    if (url.hostname == 'whatwg.github.io')
      return entryFromGitHubIO(url)

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
