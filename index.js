const pup = require('puppeteer');
const fs = require('fs');
const Thekdar = require('thekdar');
const path = require('path');
const ThekdarUi = require('thekdar-ui');

const scrap = process.argv[process.argv.length - 1] || 'fundamental';

const baseURL =
  scrap === 'fundamental'
    ? 'https://developers.google.com/web/fundamentals/design-and-ux/ux-basics/'
    : 'https://developers.google.com/web/updates/2018';
const { events, Task } = Thekdar;

const DOWNLOAD_LOCATION = path.join(__dirname, `/pdfs/${scrap}`);
const MAX_WORKER = 5;
const MAX_TASK_PER_WORKER = 2;
// Create new thekdar object
const thekdar = new Thekdar();

// Path of script to be executed and type of worker
thekdar.addWorkerAddress('./worker/fork.js', Task.TYPE_FORK);
thekdar.setMaxWorker(MAX_WORKER);
thekdar.setMaxTaskPerWorker(MAX_TASK_PER_WORKER);
thekdar.deployWorkers();
thekdar.addPluggin(
  new ThekdarUi({
    port: 9191,
    pidUsage: false,
  })
);
async function extractUrl(page) {
  await page.goto(baseURL);
  const bodyHandle = await page.$('body');
  const body = await page.evaluate((body) => {
    return {
      urls: Array.from(
        body.querySelectorAll('ul.devsite-nav-section a.devsite-nav-title') ||
          []
      ).map((item, index) => ({
        index,
        url: item.href,
        title: item.querySelector('span').innerHTML,
      })),
    };
  }, bodyHandle);
  return body;
}

async function createHeadPage(page, contents) {
  await page.goto('https://www.google.com');
  await page.evaluate((contents) => {
    const bookContents = contents.map(
      (item) => `<tr>
    <td style="padding:10px">${item.title}</td>
    <td style="padding:10px">${item.index}</td>
    </tr>`
    );
    document.body.innerHTML = `<table border="1">
    <tr>
    <th>Content</th>
    <th>Page</th>
    </tr>
      ${bookContents.join(' ')}
      </table>`;
  }, contents);
  await page.pdf({
    path: path.join(DOWNLOAD_LOCATION, 'head.pdf'),
    format: 'A4',
  });
}

function handleThekdarMessage(urls, totalContents) {
  return (message) => {
    switch (message.type) {
      case events.TASK_ERROR:
      case events.TASK_COMPLETE:
        dispatchTask(urls, totalContents);
        break;
    }
  };
}
function dispatchTask(urls, totalContents) {
  const task = new Task();
  const itemToGen = urls.shift();
  if (!itemToGen) return;
  task.setData({ item: itemToGen, total: totalContents, scrap });
  task.setType(Task.TYPE_FORK);
  thekdar.addTask(task, (err) => {
    console.log(`New Task for ${data.url} (${err ? 'ERROR' : 'SUCCESS'})`);
  });
}
(async () => {
  let browser = await pup.launch();
  try {
    console.log('Gathering information...');
    const page = await browser.newPage();
    const contents = await extractUrl(page);
    await createHeadPage(page, contents.urls);
    browser.close();
    console.log(`Found ${contents.urls.length} items`);
    const urls = [].concat(contents.urls);
    const totalContents = urls.length;

    thekdar.on('message', handleThekdarMessage(urls, totalContents));
    Array(MAX_WORKER)
      .fill(true)
      .forEach(() => {
        dispatchTask(urls, totalContents);
      });
  } catch (e) {
    if (browser) {
      await browser.close();
    }
    console.error(e);
    process.exit(0);
  }
})();
