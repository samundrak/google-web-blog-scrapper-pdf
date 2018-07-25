const pup = require('puppeteer');
const scissors = require('scissors');
const fs = require('fs');
const path = require('path');

const scrap = process.argv[process.argv.length - 1] || 'fundamental';
const baseURL =
  scrap === 'fundamental'
    ? 'https://developers.google.com/web/fundamentals/design-and-ux/ux-basics/'
    : 'https://developers.google.com/web/updates/2018';
const DOWNLOAD_LOCATION = path.join(__dirname, `/pdfs/${scrap}`);

async function extractUrl(page) {
  await page.goto(baseURL);
  const bodyHandle = await page.$('body');
  const body = await page.evaluate(body => {
    return {
      urls: Array.from(
        body.querySelectorAll('ul.devsite-nav-section a.devsite-nav-title') ||
          [],
      ).map((item, index) => ({
        index,
        url: item.href,
        title: item.querySelector('span').innerHTML,
      })),
    };
  }, bodyHandle);
  return body;
}

(async () => {
  let browser = await pup.launch();
  const page = await browser.newPage();
  console.log('Gathering information...');
  const contents = await extractUrl(page);

  const head = scissors(path.join(DOWNLOAD_LOCATION, 'head.pdf'));
  const allPages = [head].concat(
    contents.urls.map(item => {
      console.log(item.title);
      return scissors(
        path.join(
          DOWNLOAD_LOCATION,
          `${(item.title || '').replace(/\/|\\/g, '-')}.pdf`,
        ),
      );
    }),
  );

  console.log('Building ebook...');
  const ebook = scissors
    .join(...allPages)
    .pdfStream()
    .pipe(fs.createWriteStream(`./ebooks/google-web-${scrap}.pdf`))
    .on('finish', function() {
      console.log("We're done!");
    })
    .on('error', function(err) {
      throw err;
    });
})();
