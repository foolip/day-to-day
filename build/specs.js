'use strict';

const browserSpecs = require('browser-specs');
const fs = require('fs');

// infer some additional information for an entry
function completeEntry(entry) {
  const {id, name, href} = entry;

  function entryFromGitHubIO(url) {
    console.assert(url.hostname.endsWith('.github.io'));

    return Object.assign(entry, {
      name: name
          .replace(/ Level \d+$/, '')
          .replace(/ Module$/, '')
          .replace(/ \d+(\.\d+)?$/, '')
          .replace(/ Specification$/, '')
          .replace(/ -$/, ''),
    });
  }

  function entryFromDraftsOrg(url) {
    console.assert(url.hostname == 'drafts.css-houdini.org' ||
                   url.hostname == 'drafts.csswg.org' ||
                   url.hostname == 'drafts.fxtf.org');

    const testpolicy = {
      'drafts.css-houdini.org': 'https://github.com/w3c/css-houdini-drafts#tests',
      'drafts.csswg.org': 'https://github.com/w3c/csswg-drafts/blob/HEAD/CONTRIBUTING.md',
      'drafts.fxtf.org': 'https://github.com/w3c/fxtf-drafts/blob/HEAD/CONTRIBUTING.md',
    }[url.hostname];

    return Object.assign(entry, {
      name: name
          .replace(/ Level \d+$/, '')
          .replace(/ Module$/, ''),
      href: `https://${url.hostname}/${id}/`,
      // Note: mediaqueries-5 has the highest level on 2017-09-30
      specpath: `${id} ${id}-1 ${id}-2 ${id}-3 ${id}-4 ${id}-5`,
      testpath: `${id} css/${id} css/${id}-1 css/${id}-2 css/${id}-3 ` +
          `css/${id}-4 css/${id}-5`,
      testpolicy: testpolicy,
    });
  }

  function entryFromSvgwgOrg(url) {
    console.assert(url.hostname == 'svgwg.org');

    Object.assign(entry, {
      testpolicy: 'https://github.com/w3c/csswg-drafts/blob/HEAD/CONTRIBUTING.md',
    });

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

  const url = new URL(href);

  // Exact hostname matches
  switch (url.hostname) {
    case 'drafts.css-houdini.org':
    case 'drafts.csswg.org':
    case 'drafts.fxtf.org':
      return entryFromDraftsOrg(url);
    case 'svgwg.org':
      return entryFromSvgwgOrg(url);
    case 'tc39.es':
    case 'registry.khronos.org':
      return entry;
  }

  // Anything hosted on github.io
  if (url.hostname.endsWith('.github.io')) {
    const entry = entryFromGitHubIO(url);

    // the webappsec prefix isn't used in the wpt dirname
    if (entry.id.startsWith('webappsec-')) {
      entry.testpath = entry.id.substr(10);
    }

    // TODO: infer for Web Performance WG using Specref data
    switch (entry.id) {
      case 'beacon':
      case 'device-memory':
      case 'hr-time':
      case 'longtasks':
      case 'navigation-timing':
      case 'network-error-logging':
      case 'page-visibility':
      case 'paint-timing':
      case 'performance-timeline':
      case 'preload':
      case 'reporting':
      case 'requestidlecallback':
      case 'resource-hints':
      case 'resource-timing':
      case 'server-timing':
      case 'timing-entrytypes-registry':
      case 'user-timing':
        entry.testpolicy = 'https://github.com/w3c/web-performance/blob/HEAD/CONTRIBUTING.md';
    }

    return entry;
  }

  // WHATWG specs
  if (url.hostname.endsWith('.idea.whatwg.org') ||
      url.hostname.endsWith('.spec.whatwg.org')) {
    return Object.assign(entry, {
      name: name.replace(/ Standard$/, ''),
      testpolicy: 'https://github.com/whatwg/meta/blob/HEAD/CONTRIBUTING.md',
    });
  }

  // Unmatched spec URL
  return undefined;
}

function uniqueMap(entries, prop) {
  const map = new Map;
  for (const entry of entries) {
    const existingEntry = map.get(entry[prop]);
    if (existingEntry) {
      throw new Error(`duplicate ${prop} ${entry[prop]}:\n` +
                      `${JSON.stringify(existingEntry)}\n` +
                      `${JSON.stringify(entry)}`);
    }
    map.set(entry[prop], entry);
  }
  return map;
}

async function main() {
  const specsPath = process.argv[2];
  console.assert(specsPath);

  console.log('Reading browser-specs');
  const specs = [];
  for (const spec of browserSpecs) {
    // only include the latest level of any spec
    if (spec.shortname != spec.series.currentSpecification) {
      continue;
    }

    const entry = completeEntry({
      id: spec.series.shortname,
      name: spec.title,
      href: spec.nightly.url,
      specrepo: spec.nightly.repository,
    });

    if (entry) {
      specs.push(entry);
    } else {
      console.warn(`Ignoring ${spec.nightly.url}`);
    }
  }

  console.log('Applying specs-fixes.json');
  const idMap = uniqueMap(specs, 'id');
  const specsFixes = JSON.parse(fs.readFileSync('specs-fixes.json'));
  for (const fix of specsFixes) {
    const spec = idMap.get(fix.id);
    if (!spec) {
      throw new Error(`have spec fix with id ${fix.id} but no spec found`);
    }
    for (const [key, value] of Object.entries(fix)) {
      if (key == 'id') {
        continue;
      }
      if (spec[key] === value) {
        throw new Error(`unnecessary fix for spec with id ${fix.id}, ` +
                        `${key} is already ${JSON.stringify(value)}`);
      }
      spec[key] = value;
    }
  }

  specs.sort((a, b) => a.id.localeCompare(b.id));

  // check that things are unique, ignore returned maps
  uniqueMap(specs, 'id');
  uniqueMap(specs, 'name');
  uniqueMap(specs, 'href');

  console.log(`Writing ${specsPath}`);
  fs.writeFileSync(specsPath, JSON.stringify(specs, null, '  ') + '\n');
}

main().catch((reason) => {
  console.error(reason);
  process.exit(1);
});
