const { Builder, By, until } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const TEST_EMAIL = process.env.TEST_EMAIL || "security-negative@example.com";
const TEST_PASSWORD = process.env.TEST_PASSWORD || "security-password-123";
const HEADLESS = process.env.HEADLESS !== "false";

function printResult({ passed, method, weakness, actual }) {
  const status = passed ? "PASS" : "FAIL";
  console.log(`[${status}] ${method} | ${weakness} | ${actual}`);
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
  const options = new chrome.Options();

  if (HEADLESS) {
    options.addArguments("--headless=new");
  }

  options.addArguments("--window-size=1440,1000");

  return new Builder()
    .forBrowser("chrome")
    .setChromeOptions(options)
    .build();
}

async function clearBrowserState(driver) {
  await driver.manage().deleteAllCookies();
  await driver.get(BASE_URL);
  await driver.executeScript("localStorage.clear(); sessionStorage.clear();");
}

async function loginWithSession(driver) {
  await driver.get(`${BASE_URL}/login`);
  await driver.findElement(By.id("session-email")).clear();
  await driver.findElement(By.id("session-email")).sendKeys(TEST_EMAIL);
  await driver.findElement(By.id("session-password")).clear();
  await driver.findElement(By.id("session-password")).sendKeys(TEST_PASSWORD);
  await driver.findElement(By.css('form[action="/login-session"] button[type="submit"]')).click();
  await driver.wait(until.urlContains("/dashboard"), 10000);
}

async function loginWithJWTForm(driver) {
  await driver.get(`${BASE_URL}/login`);
  await driver.findElement(By.id("jwt-email")).clear();
  await driver.findElement(By.id("jwt-email")).sendKeys(TEST_EMAIL);
  await driver.findElement(By.id("jwt-password")).clear();
  await driver.findElement(By.id("jwt-password")).sendKeys(TEST_PASSWORD);
  await driver.findElement(By.css("#jwtLoginForm button[type='submit']")).click();

  await driver.wait(async () => {
    const token = await driver.executeScript("return localStorage.getItem('jwtToken');");
    return Boolean(token);
  }, 10000);

  return driver.executeScript("return localStorage.getItem('jwtToken');");
}

async function browserFetchProfile(driver, mode) {
  return driver.executeAsyncScript(
    `
      const mode = arguments[0];
      const done = arguments[arguments.length - 1];
      const token = localStorage.getItem("jwtToken") || localStorage.getItem("token");
      const headers = { "Accept": "application/json" };

      if (mode === "bearer" && token) {
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
    mode
  );
}

async function testSessionAuthentication(driver) {
  await clearBrowserState(driver);

  await driver.get(`${BASE_URL}/dashboard`);
  await driver.wait(until.urlContains("/login"), 10000);
  printResult({
    passed: (await driver.getCurrentUrl()).includes("/login"),
    method: "Session",
    weakness: "Access /dashboard without login",
    actual: await driver.getCurrentUrl()
  });

  await loginWithSession(driver);
  printResult({
    passed: (await driver.getCurrentUrl()).includes("/dashboard"),
    method: "Session",
    weakness: "Login with valid credentials",
    actual: await driver.getCurrentUrl()
  });

  await driver.findElement(By.css('form[action="/logout"] button[type="submit"]')).click();
  await driver.wait(until.urlContains("/login"), 10000);
  await driver.get(`${BASE_URL}/dashboard`);
  await driver.wait(until.urlContains("/login"), 10000);
  printResult({
    passed: (await driver.getCurrentUrl()).includes("/login"),
    method: "Session",
    weakness: "Access /dashboard after logout",
    actual: await driver.getCurrentUrl()
  });

  await loginWithSession(driver);
  await driver.manage().deleteCookie("connect.sid");
  await driver.get(`${BASE_URL}/dashboard`);
  await driver.wait(until.urlContains("/login"), 10000);
  printResult({
    passed: (await driver.getCurrentUrl()).includes("/login"),
    method: "Session",
    weakness: "Access /dashboard after deleting session cookie",
    actual: await driver.getCurrentUrl()
  });
}

async function testJWTAuthentication(driver) {
  await clearBrowserState(driver);
  await driver.get(`${BASE_URL}/login`);

  const noTokenResult = await browserFetchProfile(driver, "none");
  printResult({
    passed: noTokenResult.status === 401,
    method: "JWT",
    weakness: "Access /api/profile without token",
    actual: `status ${noTokenResult.status}`
  });

  const token = await loginWithJWTForm(driver);
  printResult({
    passed: Boolean(token),
    method: "JWT",
    weakness: "JWT login stores token in localStorage",
    actual: token ? `token length ${token.length}` : "missing token"
  });

  const validTokenResult = await browserFetchProfile(driver, "bearer");
  printResult({
    passed: validTokenResult.status === 200,
    method: "JWT",
    weakness: "Access /api/profile with valid Bearer token",
    actual: `status ${validTokenResult.status}`
  });

  await driver.executeScript("localStorage.setItem('jwtToken', 'invalid.jwt.token');");
  const invalidTokenResult = await browserFetchProfile(driver, "bearer");
  printResult({
    passed: invalidTokenResult.status === 401,
    method: "JWT",
    weakness: "Access /api/profile with invalid token",
    actual: `status ${invalidTokenResult.status}`
  });

  await driver.executeScript("localStorage.removeItem('jwtToken'); localStorage.removeItem('token');");
  const clearedTokenResult = await browserFetchProfile(driver, "bearer");
  printResult({
    passed: clearedTokenResult.status === 401,
    method: "JWT",
    weakness: "Access /api/profile after clearing token",
    actual: `status ${clearedTokenResult.status}`
  });
}

async function testOAuthAuthentication(driver) {
  await clearBrowserState(driver);

  await driver.get(`${BASE_URL}/auth/google/callback`);
  await driver.sleep(1500);
  printResult({
    passed: !(await driver.getCurrentUrl()).includes("/dashboard"),
    method: "OAuth 2.0",
    weakness: "Callback without authorization code",
    actual: await driver.getCurrentUrl()
  });

  await driver.get(`${BASE_URL}/auth/google/callback?code=invalid-code`);
  await driver.sleep(2000);
  printResult({
    passed: !(await driver.getCurrentUrl()).includes("/dashboard"),
    method: "OAuth 2.0",
    weakness: "Callback with invalid authorization code",
    actual: await driver.getCurrentUrl()
  });

  await driver.get(`${BASE_URL}/dashboard`);
  await driver.sleep(1000);

  const dashboardOpened = (await driver.getCurrentUrl()).includes("/dashboard");

  if (dashboardOpened) {
    await driver.findElement(By.css('form[action="/logout"] button[type="submit"]')).click();
    await driver.wait(until.urlContains("/login"), 10000);
    await driver.get(`${BASE_URL}/dashboard`);
    await driver.wait(until.urlContains("/login"), 10000);
  }

  printResult({
    passed: !dashboardOpened || (await driver.getCurrentUrl()).includes("/login"),
    method: "OAuth 2.0",
    weakness: "Existing OAuth-created session must still protect /dashboard after logout",
    actual: dashboardOpened ? await driver.getCurrentUrl() : "No existing OAuth session; real Google login intentionally not automated"
  });
}

async function run() {
  await ensureTestUser();

  const driver = await createDriver();

  try {
    console.log(`Security negative tests target: ${BASE_URL}`);
    console.log(`Test user: ${TEST_EMAIL}`);
    console.log("Real Google OAuth login is intentionally not automated.\n");

    await testSessionAuthentication(driver);
    await testJWTAuthentication(driver);
    await testOAuthAuthentication(driver);
  } finally {
    await driver.quit();
  }
}

run().catch((error) => {
  console.error(`[FAIL] Test runner | Unexpected error | ${error.message}`);
  process.exit(1);
});
