const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "..");
const SCREENSHOTS_DIR = path.join(PROJECT_ROOT, "selenium-results", "screenshots");

function parseExecutionMode() {
  const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
  const rawMode = modeArg ? modeArg.split("=")[1] : process.env.SELENIUM_MODE;
  const normalizedMode = String(rawMode || "headless").toLowerCase();

  return normalizedMode === "demo" || normalizedMode === "visible" ? "demo" : "headless";
}

const executionMode = parseExecutionMode();
const isDemoMode = executionMode === "demo";

const config = {
  baseUrl: process.env.TEST_BASE_URL || "http://localhost:3000",
  testEmail: process.env.TEST_EMAIL || "security-attack-demo@example.com",
  testPassword: process.env.TEST_PASSWORD || "security-password-123",
  executionMode,
  isDemoMode,
  demoDelayMs: isDemoMode ? Number(process.env.SELENIUM_DEMO_DELAY_MS || 1500) : 0,
  resultsPath: path.join(PROJECT_ROOT, "selenium-security-results.json"),
  screenshotsDir: SCREENSHOTS_DIR,
  projectRoot: PROJECT_ROOT
};

function createChromeOptions(chrome) {
  const options = new chrome.Options();

  options.addArguments("--window-size=1440,1000");
  options.addArguments("--disable-dev-shm-usage");
  options.addArguments("--no-sandbox");

  if (!isDemoMode) {
    options.addArguments("--headless=new");
  }

  return options;
}

async function configureBrowserWindow(driver) {
  if (isDemoMode) {
    try {
      await driver.manage().window().maximize();
    } catch (error) {
      await driver.manage().window().setRect({
        width: 1440,
        height: 1000,
        x: 0,
        y: 0
      });
    }
  }
}

module.exports = {
  config,
  createChromeOptions,
  configureBrowserWindow
};
