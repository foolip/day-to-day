'use strict';

function pastDays(fromWhen, numDays) {
  const days = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const then = new Date(fromWhen - i * 24 * 3600 * 1000);
    const date = then.toISOString().substr(0, 10);
    days.push(date);
  }
  return Object.freeze(days);
}

// turn an array of log entries into a date -> commit count map
function activityFromLog(log) {
  const activity = {};

  for (const entry of log) {
    let date;
    if (typeof entry === 'object') {
      date = entry.date;
    } else {
      // TODO(foolip): remove this code path later
      date = entry.split(' ')[0];
    }
    if (date in activity) {
      activity[date]++;
    } else {
      activity[date] = 1;
    }
  }

  return activity;
}

function colorFromCommitCount(count) {
  console.assert(count > 0);
  // use lightness 64% for 1 commit and 32% for 5+ commits
  const value = Math.max(64 - (count - 1) * 8, 32);
  return `hsl(90, 60%, ${value}%)`;
}

function populateTable(table, days, entry) {
  const specRow = table.insertRow();
  const testRow = table.insertRow();

  // maps between dates and commit counts
  const specActivity = activityFromLog(entry.speclog);
  const testActivity = activityFromLog(entry.testlog);

  // the logs may have more days, so these aren't the same as
  // Object.keys(*Activity).length
  let specActiveDays = 0;
  let testActiveDays = 0;

  for (const date of days) {
    const specCell = specRow.insertCell();
    const testCell = testRow.insertCell();

    const specChanges = specActivity[date] || 0;
    const testChanges = testActivity[date] || 0;

    if (specChanges) {
      specActiveDays++;
      specCell.style.background = colorFromCommitCount(specChanges);
    }

    if (testChanges) {
      testActiveDays++;
      testCell.style.background = colorFromCommitCount(testChanges);
    }

    // put summary information in title attribute
    // TODO: nice popups on hover; click to shows commits
    const s = (count) => count == 1 ? '' : 's';
    specCell.title = `${date} (${specChanges} spec change${s(specChanges)})`;
    testCell.title = `${date} (${testChanges} test change${s(testChanges)})`;
  }

  const spans = table.querySelectorAll('span');
  console.assert(spans.length == 3);
  spans[0].firstChild.data = specActiveDays;
  spans[1].firstChild.data = testActiveDays;
  spans[2].firstChild.data = specActiveDays + testActiveDays;

  // also store active days for easy sorting
  table._specActiveDays = specActiveDays;
  table._testActiveDays = testActiveDays;

  return table;
}

function compareStrings(a, b) {
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  if (lowerA < lowerB) {
    return -1;
  }
  if (lowerA > lowerB) {
    return 1;
  }
  return 0;
}

function sortTables(container, mode) {
  const key = {
    'total activity': (table) => {
      return -(table._specActiveDays + table._testActiveDays);
    },
    'spec activity': (table) => -table._specActiveDays,
    'test activity': (table) => -table._testActiveDays,
  }[mode];

  const tables = [].slice.call(container.childNodes);
  tables.sort((a, b) => {
    if (key) {
      const aKey = key(a);
      const bKey = key(b);
      console.assert(typeof aKey == 'number' && typeof bKey == 'number');
      if (aKey != bKey) {
        return aKey - bKey;
      }
      // break numeric ties by falling back to the name
    }
    return compareStrings(a._name, b._name);
  });

  // set a class to style the sort key
  container.className = `sort-${mode.split(' ')[0]}`;

  // Edge 15 does not support append():
  // container.append(...tables)
  container.textContent = '';
  for (const table of tables) {
    container.appendChild(table);
  }
}

function timeSince(when) {
  const minutes = Math.floor((Date.now() - Date.parse(when)) / 60000);

  if (minutes < 2) {
    return 'moments';
  }
  if (minutes < 120) {
    return `${minutes} minutes`;
  }
  return `${Math.floor(minutes / 60)} hours`;
}

function main() {
  document.body.classList.add('loading');

  fetch('data.json')
      .then((response) => response.json())
      .then((data) => {
        const lastDay = data.until.substr(0, 10);
        const days = pastDays(new Date(lastDay).valueOf(), data.days);
        console.assert(days.length == data.days);
        console.assert(days[data.days - 1] == lastDay);

        const container = document.querySelector('main');
        const template = document.querySelector('template');
        container.textContent = '';

        for (const entry of data.specs) {
          const table = template.content.cloneNode(true).children[0];
          const a = table.querySelector('a');
          a.textContent = entry.name;
          a.href = entry.href;

          // store the name for easy sorting
          table._name = entry.name;

          populateTable(table, days, entry);

          container.appendChild(table);
        }

        // sort and show the table
        const select = document.querySelector('select.sortby');
        select.addEventListener('change', (event) => {
          sortTables(container, event.target.value);
        });
        select.dispatchEvent(new Event('change'));

        // show the freshness of the data
        const ago = document.querySelector('footer span');
        ago.title = data.until;
        ago.textContent = timeSince(data.until);

        document.body.classList.remove('loading');
      });
}

main();
