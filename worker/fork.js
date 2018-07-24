const fs = require('fs');
const path = require('path');
const pup = require('puppeteer');

const OVERWRITE_FILE = false;
let DOWNLOAD_LOCATION = path.join(__dirname, '../pdfs/fundamental');
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

process.on('message', async (data) => {
  DOWNLOAD_LOCATION = path.join(__dirname, `../pdfs/${data.task.data.scrap}`);
  if (data.type === 'task:add') {
    try {
      const item = data.task.data.item;
      const count = `${item.index} / ${data.task.data.total}`;
      console.log(`(${count}) Scrapping ${item.url}`);
      const browser = await pup.launch();
      const pyaaj = await browser.newPage();
      console.log(`(${count}) Genertating PDF for  ${item.url}`);

      await generatePdf(pyaaj, item);
      console.log(`(${count}) Finished ${item.url}`);
      await browser.close();
      process.send({
        type: 'task:complete',
        taskId: data.task.id,
        workerId: data.workerId,
        data: {},
      });
    } catch (e) {
      console.error(e);
      process.send({
        type: 'task:error',
        taskId: data.task.id,
        workerId: data.workerId,
        data: {},
      });
    }
  }
});
