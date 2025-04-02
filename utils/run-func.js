#! /usr/bin/env node
const path = require("path");
const fs = require("fs");
const { parsed: env } = require('dotenv').config({path: '.env'})

const extensionDir = process.argv[2];
const extensionMetaFile = `${extensionDir}/meta.json`;

if (!extensionDir) {
  console.error("File name not provided i.e. run-func ./index.js");
  process.exit();
}

try {
  if (!fs.existsSync(require.resolve(extensionMetaFile))) {
    console.error("Meta file does not exist:", extensionMetaFile);
    process.exit();
  }
} catch (e) {
  console.error("Meta file does not exist:", extensionMetaFile);
  process.exit();
}

const metaFile = fs.readFileSync(extensionMetaFile);
const metaFileJson = JSON.parse(metaFile);

console.log(metaFileJson);

const extensionCodeFile = `${extensionDir}/${metaFileJson.config.code_source}`;

try {
  if (!fs.existsSync(require.resolve(extensionCodeFile))) {
    console.error("Code file does not exist:", extensionCodeFile);
    process.exit();
  }
} catch (e) {
  console.error("Code file does not exist:", extensionCodeFile);
  process.exit();
}

const userModule = require(extensionCodeFile);
executeInModule(userModule);

async function executeInModule(userMod) {
  if (typeof userMod === "function") {
    console.log(await userMod({
      rossum_authorization_token: env.ROSSUM_AUTHORIZATION_TOKEN,
      base_url: env.BASE_URL,
      location: {}
    }));
    return;
  }

  if (!userMod) {
    throw new Error(`Module ${userMod} does not exists`);
  }

  const fnName = "rossum_hook_request_handler";
  if (!userMod[fnName]) {
    throw new Error(
      `Function ${fnName} is not present or exported from module`
    );
  }

  const result = userMod[fnName]({
    rossum_authorization_token: env.ROSSUM_AUTHORIZATION_TOKEN,
    base_url: env.BASE_URL,
    location: {}
  });

  if (typeof result === "object" && result.then) {
    result.then(async (res) => {
      runIntent(res)
    });
  } else if (typeof result !== "undefined") {
    console.log(result);
  }
}

async function runIntent(res) {
  if (typeof res !== "undefined") {
    const puppeteer = require("puppeteer");

    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
    });

    const page = await browser.newPage();

    await page.evaluateOnNewDocument((res) => {
      Object.defineProperty(window, "__intent", {
        get() {
          return res;
        },
      });
    }, res);

    await page.goto(
      `${env.INTENT_PREVIEW_URL}test-intent`
    );

    console.log(await page.evaluate(() => window.__intent));
    
    await page.waitForSelector("#intent-cancel");
    await page.evaluate(() => {
      return new Promise((resolve) => {
        document.querySelector('#intent-cancel').addEventListener('click', () => {
          resolve('Button clicked!');
        });
      });
    });
    await browser.close();
  }
}