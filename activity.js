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
  return days
}

function colorFromCommits(commits) {
  // use lightness 64% for 1 commit and 32% for 5+ commits
  console.assert(commits.length)
  const value = Math.max(64 - (commits.length - 1) * 8, 32)
  return `hsl(90, 60%, ${value}%)`
}

function populateTable(table, summary, activity) {
  const specRow = table.insertRow()
  const testRow = table.insertRow()

  let specCommitCount = 0,
      specActiveDays = 0,
      testCommitCount = 0,
      testActiveDays = 0,
      anyActiveDays = 0

  for (const date in activity) {
    const entry = activity[date]
    const specCell = specRow.insertCell()
    const testCell = testRow.insertCell()

    specCell._date = testCell._date = date

    if (entry.specCommits) {
      specCommitCount += entry.specCommits.length
      specActiveDays++
      specCell.style.background = colorFromCommits(entry.specCommits)
    }

    if (entry.testCommits) {
      testCommitCount += entry.testCommits.length
      testCell.style.background = colorFromCommits(entry.testCommits)
      testActiveDays++
    }

    if (entry.specCommits || entry.testCommits)
      anyActiveDays++

    if (entry.highlight)
      specCell.classList.add('highlight')
  }

  summary.textContent = `${specActiveDays} + ${testActiveDays} = ${specActiveDays + testActiveDays}`
  const count = commits => commits ? commits.length : 0
  table._specCommitCount = specCommitCount
  table._specActiveDays = specActiveDays
  table._testCommitCount = testCommitCount
  table._testActiveDays = testActiveDays
  table._anyActiveDays = anyActiveDays

  return table
}

const pre = document.createElement('pre')
function popup(message) {
  pre.textContent = message
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

function getActivity(id) {
  const days = pastDays(Date.now(), NUM_DAYS)
  console.assert(days.length == NUM_DAYS)
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
        activity[days[i]].highlight = true
        for (let j = i - GRACE_DAYS; j <= i + GRACE_DAYS; j++) {
          if (activity[days[j]].testCommits) {
            activity[days[i]].highlight = false
            break
          }
        }
      }
    }

    return activity
  })
}

const sortSelector = document.querySelector('select.sortby')
const tableContainer = document.querySelector('div.tables')
const overlay = document.querySelector('div.overlay')
const overlayDate = overlay.querySelector('.date')
const overlaySpecChanges = overlay.querySelector('.spec.changes')
const overlayTestChanges = overlay.querySelector('.test.changes')

sortSelector.addEventListener('change', event => {
  // observation: this is a different kind of table sorting
  const tables = [].slice.call(tableContainer.childNodes)
  const key = {
    'name': table => table._manifest.name,
    'total activity': table => -(table._specActiveDays + table._testActiveDays),
    'spec activity': table => -table._specActiveDays,
    'test activity': table => -table._testActiveDays,
  }[event.target.value]
  console.assert(key)
  tables.sort((a, b) => {
    let aKey = key(a),
        bKey = key(b)
    if (typeof aKey == 'number' && typeof bKey == 'number')
      return aKey - bKey
    return compareStrings(aKey, bKey)
  })
  tableContainer.append(...tables)
})

document.addEventListener('mousemove', event => {
  if (overlay._locked)
    return

  const date = event.target._date
  if (!date) {
    overlay.hidden = true
    return
  }

  const table = event.target.parentNode.parentNode.parentNode
  console.assert(table.localName == 'table')

  const manifest = table._manifest
  console.assert(manifest)
  const activity = table._activity
  console.assert(activity)
  const entry = activity[date]
  console.assert(entry)

  overlayDate.textContent = date

  // remove all child nodes
  overlaySpecChanges.textContent = overlayTestChanges.textContent = ''

  if (entry.specCommits) {
    for (const commit of entry.specCommits) {
      const li = document.createElement('li')
      const a = li.appendChild(document.createElement('a'))
      a.textContent = commit.subject
      a.href = `${manifest.specrepo}/commit/${commit.hash}`
      overlaySpecChanges.appendChild(li)
    }
  }

  if (entry.testCommits) {
    for (const commit of entry.testCommits) {
      const li = document.createElement('li')
      const a = li.appendChild(document.createElement('a'))
      a.textContent = commit.subject
      a.href = `${manifest.testrepo}/commit/${commit.hash}`
      overlayTestChanges.appendChild(li)
    }
  }

  const rect = table.getBoundingClientRect()
  overlay.style.left = (rect.left + 144) + 'px'
  overlay.style.top = (rect.bottom - 1) + 'px'
  overlay.hidden = false
})

// clicking a cell will lock the overlay open,
// clicking anywhere other will hide it.
document.addEventListener('click', event => {
  if (event.target.localName == 'td' && !overlay.hidden) {
    overlay._locked = true
  } else {
    overlay.hidden = true
    overlay._locked = false
  }
})

fetch('manifest.json')
  .then(response => response.text())
  .then(json => {
    const manifest = parseManifest(json)
    const promises = []

    for (const entry of manifest) {
      const table = document.createElement('table')
      // save the individual manifest entry on the table for later
      table._manifest = entry
      const caption = table.createCaption()
      caption.textContent = entry.name + ' '
      const summary = caption.appendChild(document.createElement('span'))

      promises.push(
        getActivity(entry.id)
          .then(activity => {
            populateTable(table, summary, activity)
            // the activity data is needed for the overlay
            table._activity = activity
          }))

      tableContainer.appendChild(table)
    }

    // once all tables are populated, sort and show them
    Promise.all(promises).then(() => {
      sortSelector.dispatchEvent(new Event('change'))
      tableContainer.hidden = false
      overlay.appendChild(pre)
    })
  })
