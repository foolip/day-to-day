'use strict';

const fs = require('fs');
const fetch = require('node-fetch');
const URL = require('url').URL;

const biblio = ['biblio', 'w3c', 'whatwg', 'wicg'];

// specref names to drop on the floor
const blocklist = [
  'API-DESIGN-PRINCIPLES',
  'BBC-SUBTITLE',
  'COWL',
  'CSP2',
  'CSS2',
  'CSS-PARSER-API', // https://github.com/WICG/admin/pull/45
  'DASHIFIOP',
  'DIFFERENCES',
  'GraphQL',
  'HTML-EXTENSIONS',
  'INFRA',
  'LOADER',
  'REPORTING',
  'UISecurity',
  'WICG-GEOLOCATION-SENSOR', // https://github.com/tobie/specref/commit/a807c9e6c5ff88a1a7d3c1c32791f18248afed48
  'WICG-MST-CONTENT-HINT', // https://github.com/tobie/specref/pull/473
  'WICG-NETWORK-ERROR-LOGGING',
  'WCAG21',
  'accname-aam-1.1',
  'act-rules-format-1.0',
  'activitypub',
  'activitystreams-core',
  'activitystreams-vocabulary',
  'alreq',
  'annotation-model',
  'annotation-protocol',
  'annotation-vocab',
  'charmod-norm',
  'clreq',
  'coga-gap-analysis',
  'coga-user-research',
  'core-aam-1.1',
  'css3-images',
  'css3-mediaqueries',
  'css-break-3',
  'css-cascade-3',
  'css-color-3',
  'css-fonts-3',
  'css-grid-1',
  'css-overflow-3',
  'css-text-3',
  'css-text-decor-3',
  'css-ui-3',
  'css-values-3',
  'css-writing-modes-3',
  'csv2json',
  'csv2rdf',
  'custom-elements',
  'dom41',
  'dpub-aam-1.0',
  'dpub-aria-1.0',
  'dpub-css-priorities',
  'dpub-latinreq',
  'dwbp',
  'dx-prof',
  'dx-prof-conneg',
  'elreq',
  'graphics-aam-1.0',
  'graphics-aria-1.0',
  'html-aam-1.0',
  'html-aria',
  'html-imports',
  'html52',
  'html53',
  'ilreq',
  'indie-ui-context',
  'indie-ui-events',
  'international-specs',
  'json-ld',
  'json-ld-api',
  'json-ld-syntax',
  'json-ld11',
  'json-ld11-api',
  'json-ld11-framing',
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
  'personalization-semantics-content-1.0',
  'personalization-semantics-help-1.0',
  'personalization-semantics-tools-1.0',
  'poe-ucr',
  'pointerlock',
  'pwpub',
  'resource-timing-1',
  'selectors-4',
  'selectors-nonelement-1',
  'service-workers-nightly',
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
  'user-timing-2',
  'using-aria',
  'vehicle-information-api',
  'vehicle-information-service',
  'verifiable-claims-data-model',
  'vocab-dcat-2',
  'vocab-ssn',
  'vocab-ssn-ext',
  'wai-aria-1.1',
  'wai-aria-practices',
  'wai-aria-practices-1.1',
  'wai-aria-practices-1.2',
  'wcag2-ext-req',
  'webpayments-http-api',
  'webpayments-http-messages',
  'webstorage',
  'websub',
  'webvr',
  'widgets-apis',
  'wot-architecture',
  'wot-scripting-api',
  'wot-thing-description',
  'wpub',
  'wpub-ann',
];

async function processGroup(group) {
  const url = `https://github.com/tobie/specref/raw/master/refs/${group}.json`;

  console.log(`Fetching ${url}`);
  const refs = await (await fetch(url)).json();
  return processRefs(group, refs);
}

function processRefs(group, refs) {
  const specs = [];

  for (const name in refs) {
    if (blocklist.includes(name)) {
      continue;
    }
    const entry = processRef(group, refs[name]);
    if (entry) {
      specs.push(entry);
    }
  }

  return specs;
}

// turns group+info into a spec entry or returns undefined if skipped
function processRef(group, info) {
  if (!info.href || !info.title) {
    return;
  }

  function entryFromGitHubIO(url) {
    console.assert(url.hostname.endsWith('.github.io'));

    const id = url.pathname.split('/')[1];

    return {
      id: id,
      name: info.title
          .replace(/ Level \d+$/, '')
          .replace(/ Module$/, '')
          .replace(/ \d+(\.\d+)?$/, '')
          .replace(/ Specification$/, ''),
      href: url.href,
      specrepo: `${url.hostname.split('.')[0]}/${id}`,
    };
  }

  function entryFromDraftsOrg(url) {
    console.assert(url.hostname == 'drafts.css-houdini.org' ||
                   url.hostname == 'drafts.csswg.org' ||
                   url.hostname == 'drafts.fxtf.org');

    const org = url.hostname.split('.')[1];
    const match = /^\/(.*)\/$/.exec(url.pathname);
    let id = match[1];
    console.assert(!id.includes('/'));
    // no versions thanks
    if (id.startsWith('css3')) {
      if (id == 'css3-background') {
        id = 'css-backgrounds'; // plural
      } else {
        id = id.replace('css3', 'css');
      }
    } else {
      id = id.replace(/-\d$/, '');
    }
    url.pathname = `/${id}/`;

    const testpolicy = {
      'drafts.css-houdini.org': 'https://github.com/w3c/css-houdini-drafts#tests',
      'drafts.csswg.org': 'https://github.com/w3c/csswg-drafts/blob/HEAD/CONTRIBUTING.md',
      'drafts.fxtf.org': 'https://github.com/w3c/fxtf-drafts/blob/HEAD/CONTRIBUTING.md',
    }[url.hostname];

    return {
      id: id,
      name: info.title
          .replace(/ Level \d+$/, '')
          .replace(/ Module$/, ''),
      href: url.href,
      specrepo: `w3c/${org}-drafts`,
      // Note: mediaqueries-5 has the highest level on 2017-09-30
      specpath: `${id} ${id}-1 ${id}-2 ${id}-3 ${id}-4 ${id}-5`,
      testpath: `${id} css/${id} css/${id}-1 css/${id}-2 css/${id}-3 `
          + `css/${id}-4 css/${id}-5`,
      testpolicy: testpolicy,
    };
  }

  function entryFromSvgwgOrg(url) {
    console.assert(url.hostname == 'svgwg.org');

    const entry = {
      id: undefined, // just for the order
      name: info.title,
      href: url.href,
      specrepo: 'w3c/svgwg',
      testpolicy: 'https://github.com/w3c/csswg-drafts/blob/HEAD/CONTRIBUTING.md',
    };

    if (url.pathname == '/svg2-draft/') {
      entry.id = 'svg',
      entry.name = 'SVG';
      entry.specpath = 'master';
    } else {
      console.assert(url.pathname.startsWith('/specs/') &&
                     url.pathname.endsWith('/'));
      const id = url.pathname.split('/')[2];
      entry.id = `svg-${id}`;
      entry.specpath = `specs/${id}`;
    }

    return entry;
  }

  switch (group) {
    case 'biblio': {
      const url = new URL(info.href);
      if (url.hostname.endsWith('.github.io')) {
        return entryFromGitHubIO(url);
      }

      // TODO: handle more interesting things, like WebGL
      return;
    }

    case 'w3c': {
    // ignore everything that isn't maintained
      if (info.status != 'ED' && !info.edDraft) {
        return;
      }
      if (info.status == 'NOTE') {
        return;
      }

      let url = info.edDraft || info.href;

      // workaround before fix in https://www.w3.org/2002/01/tr-automation/tr.rdf
      const OLD_CSS_PREFIX = 'http://dev.w3.org/csswg/';
      if (url.startsWith(OLD_CSS_PREFIX)) {
        url = 'https://drafts.csswg.org/' + url.substr(OLD_CSS_PREFIX.length);
      }

      url = new URL(url);

      const HOSTNAMES = [
        'drafts.css-houdini.org',
        'drafts.csswg.org',
        'drafts.fxtf.org',
        'heycam.github.io',
        'svgwg.org',
        'w3c.github.io',
        'webaudio.github.io',
      ];

      if (!HOSTNAMES.some((hostname) => url.hostname == hostname)) {
        return;
      }

      if (url.hostname.endsWith('.github.io')) {
        const entry = entryFromGitHubIO(url);

        // the webappsec prefix isn't used in the wpt dirname
        if (entry.id.startsWith('webappsec-')) {
          entry.testpath = entry.id.substr(10);
        }

        // the Web Performance WG has a testing policy
        if (info.deliveredBy &&
          info.deliveredBy.includes('https://www.w3.org/webperf/')) {
          entry.testpolicy = 'https://github.com/w3c/web-performance/blob/HEAD/CONTRIBUTING.md';
        }

        return entry;
      }

      if (url.hostname.startsWith('drafts.')) {
        return entryFromDraftsOrg(url);
      }

      console.assert(url.hostname == 'svgwg.org');
      return entryFromSvgwgOrg(url);
    }

    case 'whatwg': {
      if (info.obsoletedBy) {
        return;
      }

      const url = new URL(info.href);

      console.assert(url.hostname.endsWith('.idea.whatwg.org') ||
                   url.hostname.endsWith('.spec.whatwg.org'));

      const id = url.hostname.split('.')[0];

      return {
        id: id,
        name: info.title.replace(/ Standard$/, ''),
        href: url.href,
        specrepo: 'whatwg/' + id,
        testpolicy: 'https://github.com/whatwg/meta/blob/HEAD/CONTRIBUTING.md',
      };
    }

    case 'wicg': {
      const url = new URL(info.href);
      console.assert(url.hostname.endsWith('.github.io'));
      const entry = entryFromGitHubIO(url);
      // TODO: it might be simpler to just use the specref ids more
      if (entry.href == 'https://wicg.github.io/shape-detection-api/text.html') {
        entry.id = 'text-detection-api';
      }
      return entry;
    }
  }

  throw new Error(`Unknown group: ${group}`);
}

async function main() {
  const specsPath = process.argv[2];
  console.assert(specsPath);

  console.log('Reading specs-manual.json');
  const specsManual = JSON.parse(fs.readFileSync('specs-manual.json'));
  const specGroups = await Promise.all(biblio.map(processGroup));
  const specs = [].concat(specsManual, ...specGroups);

  function uniqueMap(prop) {
    const map = new Map;
    for (const entry of specs) {
      if (map.has(entry[prop])) {
        throw new Error(`duplicate ${prop}: ${entry[prop]}`);
      }
      map.set(entry[prop], entry);
    }
    return map;
  }

  const idMap = uniqueMap('id');

  console.log('Applying specs-fixes.json');
  const specsFixes = JSON.parse(fs.readFileSync('specs-fixes.json'));
  for (const fix of specsFixes) {
    Object.assign(idMap.get(fix.id), fix);
  }

  // check that names are unique, ignore returned map
  uniqueMap('name');

  // done
  console.log(`Writing ${specsPath}`);
  fs.writeFileSync(specsPath, JSON.stringify(specs, null, '  ') + '\n');
}

main();
