const inquirer = require('inquirer');
const InquirerConfigBuilder = require('inquirer_config_builder');
const pdfs = require('./pdfs');
const ebook = require('./ebook');

const urlMap = {
  updates: 'https://developers.google.com/web/updates/2018',
  fundamental:
    'https://developers.google.com/web/fundamentals/design-and-ux/ux-basics/',
  ['tools:lighthouse']: 'https://developers.google.com/web/tools/lighthouse/',
  ['tools:chrome-devtools']:
    'https://developers.google.com/web/tools/chrome-devtools/',
  ['tools:puppeteer']:
    'https://developers.google.com/web/tools/puppeteer/articles/ssr',
  ['tools:workbox']:
    'https://developers.google.com/web/tools/workbox/guides/get-started',
};

(async () => {
  const schema = {
    init: {
      task: {
        message: 'Please select task',
        required: true,
        choices: ['Generate PDFs of collections', 'Generte ebook of PDFs'],
        type: 'list',
      },
    },
    pdfs: {
      collection: {
        message: 'Select collection of article to generate pdfs',
        type: 'list',
        required: true,
        choices: Object.keys(urlMap),
      },
      update: {
        message: 'Do you want to update collection lists?',
        type: 'confirm',
        required: true,
        default: false,
      },
    },
    ebook: {
      collection: {
        message: 'Select collection of article to generate ebook',
        type: 'list',
        required: true,
        choices: Object.keys(urlMap),
      },
    },
  };
  let questionReadyObject = InquirerConfigBuilder.questions(schema.init);
  let answers = await inquirer.prompt(questionReadyObject);
  let configReadyObject = InquirerConfigBuilder.create(answers);

  switch (configReadyObject.task) {
    case 'Generte ebook of PDFs':
      questionReadyObject = InquirerConfigBuilder.questions(schema.ebook);
      answers = await inquirer.prompt(questionReadyObject);
      configReadyObject = InquirerConfigBuilder.create(answers);
      ebook({
        urlMap,
        ...configReadyObject,
      });
      break;
    default:
      questionReadyObject = InquirerConfigBuilder.questions(schema.pdfs);
      answers = await inquirer.prompt(questionReadyObject);
      configReadyObject = InquirerConfigBuilder.create(answers);
      pdfs({
        urlMap,
        ...configReadyObject,
      });
      break;
  }
})();
