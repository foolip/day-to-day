'use strict'

const fs = require('fs')

const dataPath = process.argv[3]
console.assert(dataPath)

console.log(`Reading ${dataPath}`)
const specs = JSON.parse(fs.readFileSync(dataPath)).specs

const specsWithoutTestPolicy = specs.filter(spec => !spec.testpolicy)
if (specsWithoutTestPolicy.length) {
  console.log('Specs with no (known) testing policy:')
  specsWithoutTestPolicy.forEach(entry => {
    console.log(`  ${entry.name} <${entry.href}>`)
  })
}
