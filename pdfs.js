const pup = require('puppeteer');
const fs = require('fs');
const Thekdar = require('thekdar');
const path = require('path');
const ThekdarUi = require('thekdar-ui');

module.exports = function({ urlMap, collection = 'fundamental', update }) {
  const baseURL = urlMap[collection] || urlMap.fundamental;
  const { events, Task } = Thekdar;

  const CACHE_LOCATION = path.join(__dirname, `/data/`);
  const DOWNLOAD_LOCATION = path.join(__dirname, `/pdfs/${collection}`);
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
    if (!update) {
      try {
        const data = JSON.parse(
          fs.readFileSync(
            path.join(CACHE_LOCATION, `${collection}.json`),
            'utf-8'
          )
        );
        return data;
      } catch (e) {
        console.log('cache doesnt exists');
      }
    }
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
    fs.writeFileSync(
      path.join(CACHE_LOCATION, `${collection}.json`),
      JSON.stringify(body)
    );
    return body;
  }

  async function createHeadPage(page, contents) {
    await page.goto('https://www.google.com');
    await page.evaluate((contents) => {
      const bookContents = contents.map(
        (item) => `<tr>
    <td style="padding:10px">${item.title}</td>
    </tr>`
      );
      document.body.innerHTML = `<table border="1">
    <tr>
    <th>Content</th>
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
    task.setData({ item: itemToGen, total: totalContents, collection });
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
      if (!fs.existsSync(DOWNLOAD_LOCATION)) {
        fs.mkdirSync(DOWNLOAD_LOCATION);
      }
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
};
