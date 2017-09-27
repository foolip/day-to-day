'use strict'

function getCommits(url) {
  return fetch(url)
    .then(response => response.text())
    .then(log => {
      if (log == '')
        return []
      return log.trim().split('\n').map(line => {
        const [hash, date, subject] = line.split('\t')
        return {
          hash: hash,
          date: date.substr(0, 10),
          subject: subject
        }
      })
    })
}

function pastDays(fromWhen, numDays) {
  const days = []
  for (let i = numDays - 1; i >= 0; i--) {
    const then = new Date(fromWhen - i * 24 * 3600 * 1000)
    const date = then.toISOString().substr(0, 10)
    days.push(date)
  }
  return Object.freeze(days)
}

function colorFromCommits(commits) {
  // use lightness 64% for 1 commit and 32% for 5+ commits
  console.assert(commits.length)
  const value = Math.max(64 - (commits.length - 1) * 8, 32)
  return `hsl(90, 60%, ${value}%)`
}

function populateTable(table, activity) {
  const specRow = table.insertRow()
  const testRow = table.insertRow()

  let specActiveDays = 0,
      testActiveDays = 0

  for (const date in activity) {
    const entry = activity[date]
    const specCell = specRow.insertCell()
    const testCell = testRow.insertCell()

    specCell._date = testCell._date = date

    if (entry.specCommits) {
      specActiveDays++
      specCell.style.background = colorFromCommits(entry.specCommits)
    }

    if (entry.testCommits) {
      testCell.style.background = colorFromCommits(entry.testCommits)
      testActiveDays++
    }

    if (entry.isolated)
      specCell.classList.add('isolated')
  }

  const spans = table.querySelectorAll('span')
  console.assert(spans.length == 3)
  spans[0].firstChild.data = specActiveDays
  spans[1].firstChild.data = testActiveDays
  spans[2].firstChild.data = specActiveDays + testActiveDays

  // also store active days for easy sorting
  table._specActiveDays = specActiveDays
  table._testActiveDays = testActiveDays

  return table
}

function populateActivity(activity, kind, url) {
  return getCommits(url).then(commits => {
    for (const commit of commits) {
      if (!(commit.date in activity))
        continue
      const entry = activity[commit.date]
      if (!entry[kind])
        entry[kind] = [commit]
      else
        entry[kind].push(commit)
    }
  })
}

function getActivity(id, days) {
  const activity = {}
  for (const day of days) {
    activity[day] = {}
  }
  return Promise.all([
    populateActivity(activity, 'specCommits', `data/${id}.spec.log`),
    populateActivity(activity, 'testCommits', `data/${id}.test.log`)
  ]).then(() => {
    // find and mark days with spec activity but no test activity nearby
    for (let i = GRACE_DAYS; i < NUM_DAYS - GRACE_DAYS; i++) {
      if (activity[days[i]].specCommits) {
        activity[days[i]].isolated = true
        for (let j = i - GRACE_DAYS; j <= i + GRACE_DAYS; j++) {
          if (activity[days[j]].testCommits) {
            activity[days[i]].isolated = false
            break
          }
        }
      }
    }

    return activity
  })
}

function sortTables(container, mode) {
  const key = {
    'total activity': table => -(table._specActiveDays + table._testActiveDays),
    'spec activity': table => -table._specActiveDays,
    'test activity': table => -table._testActiveDays,
  }[mode]

  const tables = [].slice.call(container.childNodes)
  tables.sort((a, b) => {
    if (key) {
      const aKey = key(a),
            bKey = key(b)
      console.assert(typeof aKey ==  'number' && typeof bKey == 'number')
      if (aKey != bKey)
        return aKey - bKey
      // break numeric ties by falling back to the name
    }
    return compareStrings(a._name, b._name)
  })

  // set a class to style the sort key
  container.className = `sort-${mode.split(' ')[0]}`

  // Edge 15 does not support append():
  // container.append(...tables)
  container.textContent = ''
  for (const table of tables)
    container.appendChild(table)
}

function main() {
  document.body.classList.add('loading')

  const lastDay = document.querySelector('meta[name]').content
  const days = pastDays(new Date(lastDay).valueOf(), NUM_DAYS)
  console.assert(days.length == NUM_DAYS)
  console.assert(days[NUM_DAYS-1] == lastDay)

  fetch('manifest.json')
    .then(response => response.text())
    .then(json => {
      const container = document.querySelector('main')
      const template = document.querySelector('template')
      container.textContent = ''

      const promises = []

      const manifest = parseManifest(json)
      for (const entry of manifest) {
        const table = template.content.cloneNode(true).children[0]
        const a = table.querySelector('a')
        a.textContent = entry.name
        a.href = entry.href

        // also store the name for easy sorting
        table._name = entry.name

        promises.push(
          getActivity(entry.id, days)
            .then(activity => {
              populateTable(table, activity)
            }))

        container.appendChild(table)
      }

      // once all tables are populated, sort and show them
      Promise.all(promises).then(() => {
        const select = document.querySelector('select.sortby')
        select.addEventListener('change', event => {
          sortTables(container, event.target.value)
        })
        select.dispatchEvent(new Event('change'))

        document.body.classList.remove('loading')
      })
    })
}

main()
