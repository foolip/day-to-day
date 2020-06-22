'use strict';

function commitFromLine(line) {
  const parts = line.split(' ');
  return {
    date: parts[0],
    hash: parts[1],
    subject: parts.splice(2).join(' '),
  };
}

function main() {
  fetch('data.json')
      .then((response) => response.json())
      .then((data) => {
        let order = 0;
        const commits = [];

        for (const entry of data.specs) {
          for (const line of entry.speclog) {
            const commit = commitFromLine(line);
            commits.push({
              order: order++,
              date: commit.date,
              subject: commit.subject,
              name: entry.name,
              // Note: This assumes GitHub's URL structure.
              url: `${entry.specrepo}/commit/${commit.hash}`,
            });
          }
        }

        commits.sort((a, b) => {
          if (a.date < b.date) {
            return 1;
          }
          if (a.date > b.date) {
            return -1;
          }
          if (a.order < b.order) {
            return -1;
          }
          if (a.order > b.order) {
            return 1;
          }
          return 0;
        });

        const list = document.createElement('ol');

        for (const commit of commits) {
          const listItem = document.createElement('li');
          listItem.textContent = `${commit.date}: ${commit.name}: `;
          const link = document.createElement('a');
          link.href = commit.url;
          link.textContent = commit.subject;
          listItem.appendChild(link);
          list.appendChild(listItem);
        }

        document.body.appendChild(list);
      });
}

main();
