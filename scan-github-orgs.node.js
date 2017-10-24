const GitHub = require('github-api')
const URL = require('url').URL
const fetch = require('node-fetch')
const fs = require('fs')
const JSDOM = require('jsdom').JSDOM

const orgs = ['w3c', 'whatwg', 'WICG']

// repos that aren't specs or are abandoned, and that would either cause errors
// or contribute boring URLs.
const REPO_BLOCKLIST = new Set([
  'WICG/EventListenerOptions', // merged into DOM
  'WICG/ScrollAnchoring', // moved to CSSWG
  'WICG/admin',
  'WICG/auxclick', // merged into UI Events
  'WICG/cors-rfc1918', // https://github.com/WICG/cors-rfc1918/issues/12
  'WICG/historical-a11yapi',
  'WICG/historical-web-payments-browser-api',
  'WICG/hsts-priming', // https://github.com/tmpvar/jsdom/issues/2026
  'WICG/wicg.io',
  'w3c/2dcontext',
  'w3c/EasyChecks',
  'w3c/Eunomia',
  'w3c/Guide',
  'w3c/Micropub',
  'w3c/Mobile-A11y-Extension',
  'w3c/Mobile-A11y-TF-Note',
  'w3c/Mobile-Checker',
  'w3c/ShEx',
  'w3c/UAAG',
  'w3c/UAAG-Implementations',
  'w3c/Unitas',
  'w3c/WCAG21-Chinese-Unoffical-Translation',
  'w3c/Web-and-TV-IG',
  'w3c/WebPlatformWG',
  'w3c/XMLHttpRequest',
  'w3c/a11ySlackers',
  'w3c/accessibility-intro',
  'w3c/activitypub',
  'w3c/activitystreams',
  'w3c/alreq',
  'w3c/alt-techniques',
  'w3c/animation-timing', // merged into HTML
  'w3c/apiary',
  'w3c/aria-in-html',
  'w3c/aria-practices',
  'w3c/ash-nazg',
  'w3c/automotive',
  'w3c/automotive-bg',
  'w3c/automotive-pay',
  'w3c/bp-i18n-specdev',
  'w3c/cg-charter',
  'w3c/charmod-norm',
  'w3c/charter-drafts',
  'w3c/charter-html',
  'w3c/charter-timed-text',
  'w3c/charter-webperf',
  'w3c/charters-dashboard',
  'w3c/clreq',
  'w3c/css-validator',
  'w3c/csswg-apiclient',
  'w3c/csswg-test',
  'w3c/csswg-w3ctestlib',
  'w3c/csvw',
  'w3c/dap-charter',
  'w3c/data-shapes',
  'w3c/design',
  'w3c/developers',
  'w3c/devicesensors-wg',
  'w3c/dom',
  'w3c/dpub',
  'w3c/dpub-accessibility',
  'w3c/dpub-annotation',
  'w3c/dpub-aria-2.0',
  'w3c/dpub-charter',
  'w3c/dpub-content-and-markup',
  'w3c/dpub-metadata',
  'w3c/dpub-pagination',
  'w3c/dpub-pwp',
  'w3c/dpub-pwp-arch',
  'w3c/dpub-pwp-loc',
  'w3c/dpub-pwp-ucr',
  'w3c/dpub-stem',
  'w3c/dpubwg-charter',
  'w3c/dummy',
  'w3c/dwbp',
  'w3c/dxwg',
  'w3c/echidna',
  'w3c/elements-of-html',
  'w3c/elreq',
  'w3c/encodingtests',
  'w3c/epub4',
  'w3c/epubweb',
  'w3c/eventsource',
  'w3c/fingerprinting-guidance',
  'w3c/gh-issue-dashboard',
  'w3c/hcls',
  'w3c/hcls-fhir-rdf',
  'w3c/hlreq',
  'w3c/html',
  'w3c/html-cr-exit',
  'w3c/html-extensions',
  'w3c/html-landscape',
  'w3c/html-normative-references',
  'w3c/html-reference',
  'w3c/htmldiff-nav',
  'w3c/i18n-activity',
  'w3c/i18n-checker',
  'w3c/i18n-discuss',
  'w3c/i18n-drafts',
  'w3c/idn-issues',
  'w3c/ilreq',
  'w3c/imsc-tests',
  'w3c/imsc-vnext-reqs',
  'w3c/its2req',
  'w3c/jlreq',
  'w3c/kiss',
  'w3c/klreq',
  'w3c/ldn',
  'w3c/ldp-testsuite',
  'w3c/libwww',
  'w3c/link-checker',
  'w3c/low-vision-SC',
  'w3c/low-vision-a11y-tf',
  'w3c/ltli',
  'w3c/mailing-list-archives',
  'w3c/manual-of-style',
  'w3c/markup-validator',
  'w3c/mathonwebpages',
  'w3c/media-web-roadmap',
  'w3c/mediartc-roadmap-ui',
  'w3c/microdata',
  'w3c/microdata-rdf',
  'w3c/mlreq',
  'w3c/mlw-metadata-us-impl',
  'w3c/mmi',
  'w3c/mmi-discovery',
  'w3c/modern-tooling',
  'w3c/node-w3capi',
  'w3c/omn',
  'w3c/opentrack-cg',
  'w3c/perf-security-privacy',
  'w3c/perf-timing-primer',
  'w3c/personalization-semantics',
  'w3c/pfwg',
  'w3c/ping',
  'w3c/ping-security-questionnaire',
  'w3c/poe',
  'w3c/privacy-considerations',
  'w3c/publ-a11y',
  'w3c/publ-bg',
  'w3c/publ-cg',
  'w3c/publ-epub-revision',
  'w3c/publ-loc',
  'w3c/publ-wg',
  'w3c/publishing',
  'w3c/pwpub',
  'w3c/rdf-tests',
  'w3c/rdfa-md-service',
  'w3c/respec',
  'w3c/respec-docs',
  'w3c/rqtf',
  'w3c/scholarly-html',
  'w3c/scribejs',
  'w3c/sdw',
  'w3c/security-disclosure',
  'w3c/service-workers-wg',
  'w3c/share-psi',
  'w3c/smufl',
  'w3c/sparql-exists',
  'w3c/spec-dashboard',
  'w3c/spec-releases',
  'w3c/specberus',
  'w3c/standards-track',
  'w3c/string-meta',
  'w3c/string-search',
  'w3c/svgwg',
  'w3c/test-results',
  'w3c/testing-how-to',
  'w3c/testtwf-website',
  'w3c/timed-text-dashboard',
  'w3c/tlreq',
  'w3c/tpac2016',
  'w3c/tr-design',
  'w3c/tr-links',
  'w3c/tr-pages',
  'w3c/transitions',
  'w3c/tt-profile-registry',
  'w3c/ttml-webvtt-mapping',
  'w3c/type-samples',
  'w3c/typography',
  'w3c/using-aria',
  'w3c/validate-repos',
  'w3c/vc-data-model',
  'w3c/vc-test-suite',
  'w3c/vc-use-cases',
  'w3c/vctf',
  'w3c/verifiable-claims',
  'w3c/voiceinteraction',
  'w3c/vr-workshop',
  'w3c/w3c-api',
  'w3c/w3c-waet',
  'w3c/w3c.github.io',
  'w3c/w3process',
  'w3c/w3process-obsolete-rescinded',
  'w3c/wai-act-quickref',
  'w3c/wai-aria-intro',
  'w3c/wai-bcase',
  'w3c/wai-components',
  'w3c/wai-components-gallery',
  'w3c/wai-contacting-orgs',
  'w3c/wai-develop-training',
  'w3c/wai-eo-mobile',
  'w3c/wai-eval-report-templates',
  'w3c/wai-eval-tools',
  'w3c/wai-first-aid',
  'w3c/wai-gh-training-2015-06-29',
  'w3c/wai-home',
  'w3c/wai-intro-accessibility',
  'w3c/wai-intro-linking',
  'w3c/wai-intro-wcag',
  'w3c/wai-media-intro',
  'w3c/wai-mobile-intro',
  'w3c/wai-older-users',
  'w3c/wai-people-use-web',
  'w3c/wai-planning-and-implementation',
  'w3c/wai-policies-prototype',
  'w3c/wai-policieslist',
  'w3c/wai-quick-start',
  'w3c/wai-resources',
  'w3c/wai-selecting-eval-tools',
  'w3c/wai-showcase-examples',
  'w3c/wai-tips-procuring',
  'w3c/wai-training',
  'w3c/wai-tutorials',
  'w3c/wai-wcag-quickref',
  'w3c/wai-website',
  'w3c/wai-website-components',
  'w3c/wai-website-design',
  'w3c/wai-website-personas',
  'w3c/wasm', // https://webassembly.github.io/spec/
  'w3c/wasm-wg',
  'w3c/wbs-design',
  'w3c/wcag',
  'w3c/wcag-act',
  'w3c/wcag-act-rules',
  'w3c/wcag-em-report-tool',
  'w3c/wcag21',
  'w3c/web-annotation',
  'w3c/web-based-signage-bg',
  'w3c/web-platform-tests',
  'w3c/web-roadmaps',
  'w3c/web5g-workshop',
  'w3c/webappsec-cors-for-developers',
  'w3c/webmediaguidelines',
  'w3c/webmessaging',
  'w3c/webpayments-ig',
  'w3c/webpayments-overview',
  'w3c/webperf-dashboard',
  'w3c/websockets',
  'w3c/webstorage', // merged into HTML
  'w3c/websub',
  'w3c/webvr-charter',
  'w3c/webvr-content-workshop',
  'w3c/workers',
  'w3c/wot',
  'w3c/wot-architecture',
  'w3c/wot-binding-templates',
  'w3c/wot-scripting-api',
  'w3c/wot-thing-description',
  'w3c/wotwg',
  'w3c/wptdashboard',
  'w3c/wptrunner',
  'w3c/wpub',
  'whatwg/html-differences',
  'whatwg/infra',
  'whatwg/loader',
  'whatwg/platform.html5.org',
  'whatwg/serial',
  'whatwg/whatwg.org',
])

function normalizeUrl(urlString) {
  const url = new URL(urlString)
  url.protocol = 'https:'
  return url.toString()
}

// fetches url and follows <meta http-equiv=refresh> redirects. Returns the
// final response and has no protection against redirect loops.
async function followRedirects(url) {
  const response = await fetch(url)
  if (response.status != 200)
    return response

  // parse the response as HTML to find <meta http-equiv=refresh>
  //console.log(`Parsing ${url}`)
  const text = await response.text()
  const document = new JSDOM(text).window.document
  const metas = document.querySelectorAll('meta[http-equiv=refresh i][content]')

  for (let i = 0; i < metas.length; i++) {
    const content = metas[i].getAttribute('content')

    // do something simple, the correct behavior is complicated:
    // https://html.spec.whatwg.org/multipage/semantics.html#attr-meta-http-equiv-refresh
    try {
      const url = normalizeUrl(content.split('=')[1].replace(/['" ]/g, ''))
      return followRedirects(url)
    } catch(e) {}
  }

  return response
}

async function main() {
  const token = process.env.GH_TOKEN
  if (!token)
    console.warn('Warning: no GitHub token given, provide it via GH_TOKEN')

  const gh = new GitHub({ token: token })

  const fetches = []

  for (const org of orgs) {
    console.log(`Processing ${org}`)
    const repos = (await gh.getOrganization(org).getRepos()).data

    for (const repo of repos) {
      if (REPO_BLOCKLIST.has(repo.full_name)) {
        console.log(`  Skipping ${repo.full_name} (in blocklist)`)
        continue
      }

      console.log(`  Processing ${repo.full_name}`)

      let candidates = new Set

      // try the homepage
      try {
        const url = normalizeUrl(repo.homepage.trim())
        candidates.add(url.toString())
      } catch(e) {}

      // try the github.io URL if it's different (never for WHATWG)
      if (org != 'whatwg')
        candidates.add(`https://${org.toLowerCase()}.github.io/${repo.name}/`)

      if (candidates.size) {
        for (const url of candidates) {
          console.log(`    Following ${url}`)
          fetches.push(followRedirects(url).then(response => {
            // attach the repo to the response for later logging
            response.repo = repo
            return response
          }))
        }
      } else {
        console.log('    No candidate URLs found')
      }
    }
  }

  const responses = (await Promise.all(fetches)).filter(r => r.status == 200)

  // make responses unique (we can end up at the same URL many times)
  const urlMap = new Map
  for (const response of responses) {
    if (!urlMap.has(response.url))
      urlMap.set(response.url, response)
  }

  console.log('All URLs found:')
  for (const response of urlMap.values()) {
    console.log(`  ${response.url} (${response.repo.full_name})`)
  }

  const response = await fetch('https://foolip.github.io/day-to-day/data.json')
  const data = await response.json()
  console.log('URLs not in the day-to-day data:')
  for (const response of urlMap.values()) {
    const url = response.url
    if (!data.some(spec => spec.href.startsWith(url)))
      console.log(`  ${url} (${response.repo.full_name})`)
  }

  console.log('All done')
}

main()
