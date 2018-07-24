const pup = require('puppeteer');
const fs = require('fs');
const path = require('path');
const baseURL = 'https://developers.google.com/web/updates/2018';

const OVERWRITE_FILE = false;
const DOWNLOAD_LOCATION = path.join(__dirname, '/pdfs/updates');

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

async function generatePdf(page, content) {
  const location = path.join(
    DOWNLOAD_LOCATION,
    `${(content.title || '').replace(/\/|\\/g, '-')}.pdf`
  );
  if (!OVERWRITE_FILE && fs.existsSync(location)) return;

  const headerTemplate = `${new Date()} ${content.title} ${content.title} ${
    content.index
  } 12`;
  await page.goto(content.url, { waitUntil: 'networkidle2' });
  const bodyHandle = await page.$('body');
  const body = await page.evaluate((body) => {
    const cssLinks = Array.from(
      body.querySelectorAll('link[rel=stylesheet]') || []
    ).map((link) => link.outerHTML);
    const styles = Array.from(document.querySelectorAll('style') || []).map(
      (style) => style.outerHTML
    );
    const article = document.querySelector('article.devsite-article');
    try {
      article.querySelector('#gplus-comment-container').remove();
      article.querySelector('.webFuRSSWidget').remove();
    } catch (e) {
      console.log(e);
    }

    const content = article.outerHTML;
    body.innerHTML = '';
    body.innerHTML = content;
    return {
      content,
      cssLinks,
      styles,
    };
  }, bodyHandle);

  await page.pdf({
    path: location,
    format: 'A4',
    headerTemplate,
    footerTemplate: headerTemplate,
  });
}
(async () => {
  let browser = await pup.launch();
  try {
    console.log('Gathering information...');
    const page = await browser.newPage();
    const contents = await extractUrl(page);
    // await createHeadPage(page, contents.urls);
    browser.close();
    console.log(`Found ${contents.urls.length} items`);
    for await (const item of contents.urls) {
      const count = `${item.index} / ${contents.urls.length}`;
      console.log(`(${count}) Scrapping ${item.url}`);
      browser = await pup.launch();
      const pyaaj = await browser.newPage();
      console.log(`(${count}) Genertating PDF for  ${item.url}`);

      await generatePdf(pyaaj, item);
      console.log(`(${count}) Finished ${item.url}`);
      await browser.close();
    }
    console.log(`Finished....`);
  } catch (e) {
    console.error(e);
    if (browser) {
      await browser.close();
    }
    process.exit(0);
  }
})();
