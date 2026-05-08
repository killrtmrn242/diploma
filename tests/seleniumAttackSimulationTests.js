const fs = require("fs");
const path = require("path");
const {
  config,
  createChromeOptions,
  configureBrowserWindow
} = require("./seleniumConfig");

let Builder;
let By;
let until;
let chrome;

try {
  ({ Builder, By, until } = require("selenium-webdriver"));
  chrome = require("selenium-webdriver/chrome");
} catch (error) {
  if (error.code === "MODULE_NOT_FOUND" && error.message.includes("selenium-webdriver")) {
    console.error("[FAIL] Missing dependency | selenium-webdriver is not installed.");
    console.error("Run: npm install");
    console.error("Then run: npm run test:selenium");
    process.exit(1);
  }

  throw error;
}

const BASE_URL = config.baseUrl;
const TEST_EMAIL = config.testEmail;
const TEST_PASSWORD = config.testPassword;
const RESULTS_PATH = config.resultsPath;
const SCREENSHOTS_DIR = config.screenshotsDir;
const DEMO_DELAY_MS = config.demoDelayMs;

const results = [];
const screenshotTasks = [];
const demoScreenshots = [];
let activeDriver = null;

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms = DEMO_DELAY_MS) {
  if (!config.isDemoMode || ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeFileName(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function queueScreenshot(result) {
  if (!config.isDemoMode || !activeDriver) {
    return;
  }

  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const index = String(results.length).padStart(2, "0");
  const fileName = `${index}-${safeFileName(result.method)}-${safeFileName(result.testName)}.png`;
  const screenshotPath = path.join(SCREENSHOTS_DIR, fileName);
  result.screenshot = path.relative(config.projectRoot, screenshotPath).replace(/\\/g, "/");

  const task = activeDriver
    .takeScreenshot()
    .then((image) => {
      fs.writeFileSync(screenshotPath, image, "base64");
    })
    .catch((error) => {
      result.screenshotError = error.message;
    });

  screenshotTasks.push(task);
}

async function captureDemoScreenshot(driver, label) {
  if (!config.isDemoMode) {
    return null;
  }

  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const fileName = `demo-${safeFileName(label)}.png`;
  const screenshotPath = path.join(SCREENSHOTS_DIR, fileName);
  const image = await driver.takeScreenshot();
  fs.writeFileSync(screenshotPath, image, "base64");

  const relativePath = path.relative(config.projectRoot, screenshotPath).replace(/\\/g, "/");
  demoScreenshots.push({
    label,
    path: relativePath
  });
  return relativePath;
}

function addResult(method, testName, expected, actual, passed, explanation) {
  const status = passed ? "PASS" : "FAIL";
  const result = {
    method,
    testName,
    expected,
    actual,
    status,
    explanation,
    timestamp: nowIso()
  };

  results.push(result);
  queueScreenshot(result);
  console.log(`[${status}] ${method} | ${testName} | ${actual}`);
  return result;
}

function addFail(method, testName, expected, error) {
  return addResult(
    method,
    testName,
    expected,
    error.message || String(error),
    false,
    "The simulation step failed before the expected security behavior could be verified."
  );
}

function buildReport() {
  const passed = results.filter((result) => result.status === "PASS").length;
  const failed = results.filter((result) => result.status === "FAIL").length;

  return {
    generatedAt: nowIso(),
    baseUrl: BASE_URL,
    executionMode: config.executionMode,
    chromeMode: config.isDemoMode ? "visible" : "headless",
    testUser: TEST_EMAIL,
    screenshotsDir: config.isDemoMode
      ? path.relative(config.projectRoot, SCREENSHOTS_DIR).replace(/\\/g, "/")
      : null,
    demoScreenshots,
    summary: {
      total: results.length,
      passed,
      failed
    },
    results
  };
}

async function writeReport() {
  await Promise.allSettled(screenshotTasks);

  const report = buildReport();
  fs.writeFileSync(RESULTS_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`\nSaved Selenium security results to ${RESULTS_PATH}`);
  if (config.isDemoMode) {
    console.log(`Saved screenshots to ${SCREENSHOTS_DIR}`);
  }
  console.log("\nFinal summary");
  console.log(`Total tests: ${report.summary.total}`);
  console.log(`Passed: ${report.summary.passed}`);
  console.log(`Failed: ${report.summary.failed}`);
}

async function ensureTestUser() {
  await fetch(`${BASE_URL}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    }),
    redirect: "manual"
  });
}

async function createDriver() {
  const options = createChromeOptions(chrome);

  const driver = await new Builder()
    .forBrowser("chrome")
    .setChromeOptions(options)
    .build();

  await driver.manage().setTimeouts({
    implicit: 2000,
    pageLoad: 15000,
    script: 15000
  });

  await configureBrowserWindow(driver);

  return driver;
}

async function clearBrowserState(driver) {
  await driver.manage().deleteAllCookies();
  await driver.get(BASE_URL);
  await sleep();
  await driver.executeScript("localStorage.clear(); sessionStorage.clear();");
  await sleep(1000);
}

async function currentPath(driver) {
  const url = await driver.getCurrentUrl();

  try {
    return new URL(url).pathname;
  } catch (error) {
    return url;
  }
}

async function openDashboardExpectDenied(driver, method, testName) {
  await driver.get(`${BASE_URL}/dashboard`);
  await sleep();
  await captureDemoScreenshot(driver, "unauthorized-access");

  const url = await driver.getCurrentUrl();
  const pathName = await currentPath(driver);
  const denied = pathName === "/login" || !url.includes("/dashboard");

  addResult(
    method,
    testName,
    "Redirect to /login or access denied",
    url,
    denied,
    denied
      ? "The protected dashboard did not open for an unauthenticated request."
      : "The dashboard was reachable without the expected session state."
  );
}

async function loginWithSession(driver) {
  await driver.get(`${BASE_URL}/login`);
  await sleep();
  await captureDemoScreenshot(driver, "login-page");
  await driver.findElement(By.id("session-email")).clear();
  await driver.findElement(By.id("session-email")).sendKeys(TEST_EMAIL);
  await driver.findElement(By.id("session-password")).clear();
  await driver.findElement(By.id("session-password")).sendKeys(TEST_PASSWORD);
  await sleep(1000);
  await driver.findElement(By.css('form[action="/login-session"] button[type="submit"]')).click();
  await driver.wait(until.urlContains("/dashboard"), 10000);
  await sleep();
  await captureDemoScreenshot(driver, "dashboard");
}

async function loginWithJWTForm(driver) {
  await driver.get(`${BASE_URL}/login`);
  await sleep();
  await captureDemoScreenshot(driver, "jwt-login-page");
  await driver.findElement(By.id("jwt-email")).clear();
  await driver.findElement(By.id("jwt-email")).sendKeys(TEST_EMAIL);
  await driver.findElement(By.id("jwt-password")).clear();
  await driver.findElement(By.id("jwt-password")).sendKeys(TEST_PASSWORD);
  await sleep(1000);
  await driver.findElement(By.css("#jwtLoginForm button[type='submit']")).click();

  await driver.wait(async () => {
    const token = await driver.executeScript("return localStorage.getItem('jwtToken');");
    return Boolean(token);
  }, 10000);

  const token = await driver.executeScript("return localStorage.getItem('jwtToken');");
  await sleep(2000);
  return token;
}

async function showApiResult(driver, title, result) {
  const status = result.error ? result.error : result.displayStatus || `HTTP ${result.status}`;
  const body = result.body ? JSON.stringify(result.body, null, 2) : "";

  await driver.executeScript(
    `
      const title = arguments[0];
      const status = arguments[1];
      const body = arguments[2];
      document.body.innerHTML = "";
      document.body.style.fontFamily = "Arial, sans-serif";
      document.body.style.background = "#f4efe5";
      document.body.style.color = "#132238";
      const main = document.createElement("main");
      main.style.cssText = "max-width: 900px; margin: 48px auto; padding: 32px; background: white; border-radius: 18px; box-shadow: 0 18px 50px rgba(24,49,83,.16);";

      const label = document.createElement("p");
      label.textContent = "Selenium API attack simulation";
      label.style.cssText = "font-size: 13px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #9d361c;";

      const heading = document.createElement("h1");
      heading.textContent = title;
      heading.style.cssText = "margin: 0 0 20px; font-size: 32px;";

      const statusNode = document.createElement("div");
      statusNode.textContent = status;
      statusNode.style.cssText = "font-size: 26px; font-weight: 800; margin-bottom: 20px;";

      const pre = document.createElement("pre");
      pre.textContent = body;
      pre.style.cssText = "white-space: pre-wrap; padding: 18px; border-radius: 12px; background: #f1f3f5; overflow-wrap: anywhere;";

      main.append(label, heading, statusNode, pre);
      document.body.append(main);
    `,
    title,
    status,
    body
  );
  await sleep();
}

async function browserFetchProfile(driver, useBearerToken) {
  return driver.executeAsyncScript(
    `
      const useBearerToken = arguments[0];
      const done = arguments[arguments.length - 1];
      const token = localStorage.getItem("jwtToken") || localStorage.getItem("token");
      const headers = { "Accept": "application/json" };

      if (useBearerToken && token) {
        headers.Authorization = "Bearer " + token;
      }

      fetch("/api/profile", {
        method: "GET",
        headers
      })
        .then(async (response) => {
          let body = null;
          try {
            body = await response.json();
          } catch (error) {
            body = { parseError: error.message };
          }

          done({
            status: response.status,
            ok: response.ok,
            body
          });
        })
        .catch((error) => done({ error: error.message }));
    `,
    useBearerToken
  );
}

async function testSessionAttackSimulation(driver) {
  console.log("\n[SESSION TEST]");
  console.log("Session-based authentication attack simulation");
  await clearBrowserState(driver);

  try {
    await openDashboardExpectDenied(driver, "Session", "Open /dashboard without login");
  } catch (error) {
    addFail("Session", "Open /dashboard without login", "Redirect to /login or access denied", error);
  }

  try {
    await loginWithSession(driver);
    const url = await driver.getCurrentUrl();

    addResult(
      "Session",
      "Login with valid session credentials",
      "Dashboard opens",
      url,
      url.includes("/dashboard"),
      "Valid session credentials created a server-side login session."
    );
  } catch (error) {
    addFail("Session", "Login with valid session credentials", "Dashboard opens", error);
  }

  try {
    await driver.manage().deleteCookie("connect.sid");
    await sleep();
    await openDashboardExpectDenied(driver, "Session", "Delete session cookie and reopen /dashboard");
  } catch (error) {
    addFail("Session", "Delete session cookie and reopen /dashboard", "Redirect to /login or access denied", error);
  }

  try {
    await loginWithSession(driver);
    await sleep();
    await driver.findElement(By.css('form[action="/logout"] button[type="submit"]')).click();
    await driver.wait(until.urlContains("/login"), 10000);
    await sleep();
    await openDashboardExpectDenied(driver, "Session", "Logout session and verify /dashboard is protected again");
  } catch (error) {
    addFail("Session", "Logout session and verify /dashboard is protected again", "Redirect to /login or access denied", error);
  }
}

async function testJWTAttackSimulation(driver) {
  console.log("\n[JWT TEST]");
  console.log("JWT authentication attack simulation");
  await clearBrowserState(driver);
  await driver.get(`${BASE_URL}/login`);
  await sleep();

  try {
    const noHeader = await browserFetchProfile(driver, false);
    await showApiResult(driver, "Call /api/profile without Authorization header", noHeader);
    addResult(
      "JWT",
      "Call /api/profile without Authorization header",
      "HTTP 401 Unauthorized",
      noHeader.error || `HTTP ${noHeader.status}`,
      noHeader.status === 401,
      "The stateless JWT API rejected a request without a bearer token."
    );
  } catch (error) {
    addFail("JWT", "Call /api/profile without Authorization header", "HTTP 401 Unauthorized", error);
  }

  try {
    const token = await loginWithJWTForm(driver);
    addResult(
      "JWT",
      "Login through JWT form",
      "JWT token exists in localStorage",
      token ? `token length ${token.length}` : "missing token",
      Boolean(token),
      "The JWT login form stored the signed token under localStorage jwtToken."
    );
  } catch (error) {
    addFail("JWT", "Login through JWT form", "JWT token exists in localStorage", error);
  }

  try {
    const validBearer = await browserFetchProfile(driver, true);
    await showApiResult(driver, "Call /api/profile with valid Bearer token", validBearer);
    addResult(
      "JWT",
      "Call /api/profile with valid Bearer token",
      "HTTP 200",
      validBearer.error || `HTTP ${validBearer.status}`,
      validBearer.status === 200,
      "The API accepted the valid JWT bearer token."
    );
  } catch (error) {
    addFail("JWT", "Call /api/profile with valid Bearer token", "HTTP 200", error);
  }

  try {
    await driver.executeScript("localStorage.setItem('jwtToken', 'fake.fake.fake');");
    await showApiResult(driver, "Replace JWT token with fake.fake.fake", {
      displayStatus: "localStorage updated",
      body: { jwtToken: "fake.fake.fake" }
    });
    const fakeBearer = await browserFetchProfile(driver, true);
    await showApiResult(driver, "Retry /api/profile with fake token", fakeBearer);
    await captureDemoScreenshot(driver, "invalid-jwt-response");
    addResult(
      "JWT",
      "Replace token with fake.fake.fake and call /api/profile",
      "HTTP 401 Unauthorized",
      fakeBearer.error || `HTTP ${fakeBearer.status}`,
      fakeBearer.status === 401,
      "The JWT middleware rejected the forged token."
    );
  } catch (error) {
    addFail("JWT", "Replace token with fake.fake.fake and call /api/profile", "HTTP 401 Unauthorized", error);
  }

  try {
    await driver.executeScript("localStorage.removeItem('jwtToken'); localStorage.removeItem('token');");
    await showApiResult(driver, "Clear JWT token from localStorage", {
      displayStatus: "localStorage cleared",
      body: { jwtToken: null, token: null }
    });
    const clearedToken = await browserFetchProfile(driver, true);
    await showApiResult(driver, "Retry /api/profile after clearing token", clearedToken);
    addResult(
      "JWT",
      "Clear token from localStorage and call /api/profile",
      "HTTP 401 Unauthorized",
      clearedToken.error || `HTTP ${clearedToken.status}`,
      clearedToken.status === 401,
      "The API rejected the request after the bearer token was removed."
    );
  } catch (error) {
    addFail("JWT", "Clear token from localStorage and call /api/profile", "HTTP 401 Unauthorized", error);
  }
}

async function testOAuthAttackSimulation(driver) {
  console.log("\n[OAUTH TEST]");
  console.log("OAuth 2.0 attack simulation");
  await clearBrowserState(driver);

  try {
    await driver.get(`${BASE_URL}/auth/google/callback`);
    await sleep();
    await captureDemoScreenshot(driver, "oauth-error-without-code");
    const url = await driver.getCurrentUrl();
    const blocked = !url.includes("/dashboard");

    addResult(
      "OAuth 2.0",
      "Open /auth/google/callback without code",
      "Redirect or authentication error",
      url,
      blocked,
      "The callback did not create an authenticated dashboard session without a provider code."
    );
  } catch (error) {
    addFail("OAuth 2.0", "Open /auth/google/callback without code", "Redirect or authentication error", error);
  }

  try {
    await driver.get(`${BASE_URL}/auth/google/callback?code=fake_test_code`);
    await sleep(2000);
    await captureDemoScreenshot(driver, "oauth-error-invalid-code");
    const url = await driver.getCurrentUrl();
    const blocked = !url.includes("/dashboard");

    addResult(
      "OAuth 2.0",
      "Open /auth/google/callback?code=fake_test_code",
      "Authentication failure",
      url,
      blocked,
      "The callback did not authenticate a deliberately fake provider code. Real Google login is intentionally not automated."
    );
  } catch (error) {
    addFail("OAuth 2.0", "Open /auth/google/callback?code=fake_test_code", "Authentication failure", error);
  }

  try {
    await driver.get(`${BASE_URL}/dashboard`);
    await sleep();

    const dashboardOpened = (await driver.getCurrentUrl()).includes("/dashboard");

    if (dashboardOpened) {
      await driver.findElement(By.css('form[action="/logout"] button[type="submit"]')).click();
      await driver.wait(until.urlContains("/login"), 10000);
      await sleep();
      await openDashboardExpectDenied(driver, "OAuth 2.0", "OAuth-created session logout protects /dashboard");
      return;
    }

    addResult(
      "OAuth 2.0",
      "If OAuth session exists, logout and verify /dashboard is protected",
      "No dashboard access remains after logout",
      "No existing OAuth session detected",
      true,
      "The simulation did not automate real Google login, and no OAuth-created local session was present."
    );
  } catch (error) {
    addFail("OAuth 2.0", "If OAuth session exists, logout and verify /dashboard is protected", "No dashboard access remains after logout", error);
  }
}

async function run() {
  await ensureTestUser();

  const driver = await createDriver();
  activeDriver = driver;

  try {
    console.log(`Selenium attack simulation target: ${BASE_URL}`);
    console.log(`Test user: ${TEST_EMAIL}`);
    console.log(`Chrome mode: ${config.isDemoMode ? "visible demo" : "headless silent"}`);
    console.log("Real Google OAuth login is intentionally not automated.");

    await testSessionAttackSimulation(driver);
    await testJWTAttackSimulation(driver);
    await testOAuthAttackSimulation(driver);
  } finally {
    await writeReport();
    activeDriver = null;
    await driver.quit();
  }

  const report = buildReport();
  if (report.summary.failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  addFail("Runner", "Unexpected Selenium runner error", "All simulations complete", error);
  writeReport().finally(() => process.exit(1));
});
