const pup = require('puppeteer');
const scissors = require('scissors');
const fs = require('fs');
const path = require('path');

module.exports = function({ urlMap, collection = 'fundamental', update }) {
  const baseURL = urlMap[collection] || urlMap.fundamental;

  const CACHE_LOCATION = path.join(__dirname, `/data/`);
  const DOWNLOAD_LOCATION = path.join(__dirname, `/pdfs/${collection}`);

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
  (async () => {
    let browser = await pup.launch();
    const page = await browser.newPage();
    console.log('Gathering information...');
    const contents = await extractUrl(page);

    const head = scissors(path.join(DOWNLOAD_LOCATION, 'head.pdf'));
    const allPages = [head].concat(
      contents.urls.map((item) => {
        console.log(item.title);
        return scissors(
          path.join(
            DOWNLOAD_LOCATION,
            `${(item.title || '').replace(/\/|\\/g, '-')}.pdf`
          )
        );
      })
    );
    const EBOOK_LOCATION = path.join(__dirname, 'ebooks');
    console.log('Building ebook...');
    if (!fs.existsSync(EBOOK_LOCATION)) {
      fs.mkdirSync(EBOOK_LOCATION);
    }
    scissors
      .join(...allPages)
      .pdfStream()
      .pipe(
        fs.createWriteStream(
          path.join(EBOOK_LOCATION, `google-web-${collection}.pdf`)
        )
      )
      .on('finish', function() {
        console.log("We're done!");
      })
      .on('error', function(err) {
        throw err;
      });
  })();
};
