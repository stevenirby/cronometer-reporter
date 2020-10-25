"use strict";

const fs = require("fs");
const express = require("express")
const puppeteer = require("puppeteer");
const flatCache = require("flat-cache");
const debounce = require("underscore/cjs/debounce");
const EventSource = require("eventsource");
const cache = flatCache.load("cache");
const PORT = process.env.PORT || 3001;
const USERNAME = process.env.USERNAME || "<your email here if you want>";
const PASSWORD = process.env.PASSWORD || "<your password here>";
const WEBHOOKURL = process.env.WEBHOOKURL || "<webhook url here>";
const DEBUG = process.env.DEBUG || false;
const HEADLESS = process.env.HEADLESS === "false" ? false : true;
const app = express();
const getFileUpdatedDate = () => fs.statSync(cache._pathToFile).mtime;
const log = (msg) => {if (DEBUG) console.log(msg)};

try {
  // if no cache exists initialize it
  if (!fs.existsSync(cache._pathToFile)) {
    const pastDate = new Date('Wed Jan 1 2020 00:00:00 GMT+0800 (CST)');
    cache.setKey("cookie", JSON.stringify({}));
    cache.setKey("carbs", null);
    cache.setKey("calories", null);
    cache.save(true);
    fs.utimesSync(cache._pathToFile, pastDate, pastDate);
  }
} catch(err) {
  // do nothing
}

// if there is a webhook url set listen for incoming data from it.
if (WEBHOOKURL) {
  const evtSource = new EventSource(WEBHOOKURL);

  evtSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    log("Saving data from webhook");
    saveData(data);
    log("Data saved from webhook: "+ event.data);
  };
}

// debounce this so it doesn't open 10,000 browser sessions if user hits refresh non-stop.
const checkForData = debounce(() => {
  const hours = 60 * 120 * 1000;
  const lastUpdated = getFileUpdatedDate();

  log("Date last updated: " + lastUpdated);
  if (!lastUpdated || new Date() - new Date(lastUpdated) > hours) {
    log("Fetching new data via webdriver...")
    startDataScrape(cache);
  }
}, 1000);

const saveData = (data) => {
  cache.setKey("carbs", data.carbs);
  cache.setKey("calories", data.calories);
  cache.save(true);
};

async function doLogin(page) {
  await page.waitFor(1000);

  const emailInput = "#login_user_form input[name=username]";
  const passwordInput = "#login_user_form input[name=password]";
  const loginSubmitBtn = "#login_user_form button[type=submit]";

  await page.focus(emailInput);
  await page.type(emailInput, USERNAME);
  await page.type(passwordInput, PASSWORD);
  await page.click(loginSubmitBtn);

  await page.waitForSelector(".servingsPanel");
}

async function saveCookies(page) {
  const cookiesObject = await page.cookies();

  log("***** Cooke data saved *****");
  log("cookie: " + JSON.stringify(cookiesObject));
  cache.setKey("cookie", JSON.stringify(cookiesObject));
  cache.save(true);
}

async function parseData(page, cache) {
  await page.waitFor(4000);

  const data = await page.evaluate(function() {
    let carbs = document.querySelector(".diary_side_box .summary-carbs").textContent;
    carbs = carbs.replace(/\s\(\d?\d%\)/gi, "").replace(/\sg/gi, "").replace(/\s+/gi, "").split("/");

    const carbsAllowed = carbs[1];
    const calories = document.querySelectorAll(".diary_side_box img")[1].nextElementSibling.textContent;
    const totalCarbs = Math.round(carbsAllowed - parseFloat(carbs[0]));
    const totalCalories = parseInt(calories, 10);

    if (totalCarbs && totalCalories) {
        return {
            carbs: totalCarbs,
            calories: totalCalories,
        };
      }
  });

  log("***** Data parsed *****");
  log(data);
  saveData(data);
}

async function startDataScrape(cache) {
  const url = "https://cronometer.com/";
  const cookies = JSON.parse(cache.getKey("cookie"));
  const browser = await puppeteer.launch({headless: HEADLESS});
  const page = await browser.newPage();


  if (cookies && cookies.length) {
    for (let cookie of cookies) {
      await page.setCookie(cookie);
    }

    log("***** Current session cookies set *****");
  }

  page.on("console", consoleObj => log(consoleObj.text()));
  await page.goto(url);
  await page.waitFor(1000);

  // Surely there's a better way?
  try {
      await page.waitForSelector(".servingsPanel", 10000);
      log("**** LOGGED IN ****");
      await parseData(page, cache);
      await saveCookies(page);
    } catch (err) {
      await page.goto("https://cronometer.com/login/");
      log("**** NOT LOGGED IN: logging in... ****");
      await doLogin(page);
      await parseData(page, cache);
      await saveCookies(page);
  }

  browser.close();
}

// Use pug templates cuz I'm hipster like that.
app.set("view engine", "pug");
app.set("views", "./templates");
app.use(express.static(__dirname + "/public"));
app.get("/json", async (req, res, next) => {
  await checkForData();

  res.json({
    carbs: cache.getKey("carbs"),
    calories: cache.getKey("calories")
  });

  next();
});
app.get("/", async (req, res, next) => {
    await checkForData();

    res.render("base", {
      carbs: cache.getKey("carbs"),
      calories: cache.getKey("calories")
    });

    next();
});
app.listen(PORT, () => console.log(`Example app listening on port ${PORT}!`));
