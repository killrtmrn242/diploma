const BASE_URL = process.env.METRICS_BASE_URL || "http://localhost:3000";
const REQUESTS = Number(process.env.METRICS_REQUESTS || 30);
const email = process.env.METRICS_EMAIL || `metrics-${Date.now()}@example.com`;
const password = process.env.METRICS_PASSWORD || "metrics-password-123";

function getSetCookie(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const value = headers.get("set-cookie");
  return value ? [value] : [];
}

function buildCookieHeader(setCookieHeaders) {
  return setCookieHeaders
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

async function timedRequest(label, url, options = {}) {
  const start = performance.now();
  const response = await fetch(url, options);
  const responseTime = performance.now() - start;

  return {
    label,
    response,
    responseTime
  };
}

function summarizeClientTimings(items) {
  const times = items.map((item) => item.responseTime);
  const total = times.reduce((sum, value) => sum + value, 0);

  return {
    count: times.length,
    avg: Number((total / times.length).toFixed(2)),
    min: Number(Math.min(...times).toFixed(2)),
    max: Number(Math.max(...times).toFixed(2))
  };
}

function findSummary(summary, method, type) {
  return summary.find((item) => item.method === method && item.type === type);
}

function formatMetric(value, fallback = "N/A") {
  return value === undefined || value === null ? fallback : value;
}

function printSection(title, serverMetric, clientMetric) {
  console.log(`\n${title}:`);
  console.log(`- client avg response time: ${clientMetric.avg} ms`);
  console.log(`- client min / max: ${clientMetric.min} ms / ${clientMetric.max} ms`);
  console.log(`- server avg response time: ${formatMetric(serverMetric && serverMetric.avgResponseTime)} ms`);
  console.log(`- avg DB queries: ${formatMetric(serverMetric && serverMetric.avgDbQueries)}`);
  console.log(`- total DB queries: ${formatMetric(serverMetric && serverMetric.totalDbQueries)}`);
}

async function resetMetrics() {
  await fetch(`${BASE_URL}/metrics/reset`, {
    method: "POST"
  });
}

async function registerBenchmarkUser() {
  await fetch(`${BASE_URL}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ email, password }),
    redirect: "manual"
  });
}

async function loginSession() {
  const result = await timedRequest("session-login", `${BASE_URL}/auth/login/local`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ email, password }),
    redirect: "manual"
  });

  return {
    ...result,
    cookie: buildCookieHeader(getSetCookie(result.response.headers))
  };
}

async function loginJWT() {
  const result = await timedRequest("jwt-login", `${BASE_URL}/auth/login/jwt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });
  const data = await result.response.json();

  return {
    ...result,
    token: data.token,
    tokenSize: data.token ? Buffer.byteLength(data.token, "utf8") : 0
  };
}

async function logoutSession(cookie) {
  await fetch(`${BASE_URL}/auth/logout-session`, {
    method: "POST",
    headers: cookie
      ? {
          Cookie: cookie
        }
      : {},
    redirect: "manual"
  });
}

async function runBenchmark() {
  console.log(`Benchmark target: ${BASE_URL}`);
  console.log(`Requests per measured group: ${REQUESTS}`);
  console.log(`Benchmark account: ${email}`);

  await resetMetrics();
  await registerBenchmarkUser();

  const sessionLogins = [];

  for (let i = 0; i < REQUESTS; i += 1) {
    sessionLogins.push(await loginSession());
  }

  const sessionCookie = sessionLogins[sessionLogins.length - 1].cookie;
  const protectedSession = [];

  for (let i = 0; i < REQUESTS; i += 1) {
    protectedSession.push(
      await timedRequest("session-protected", `${BASE_URL}/dashboard`, {
        headers: {
          Cookie: sessionCookie
        },
        redirect: "manual"
      })
    );
  }

  await logoutSession(sessionCookie);

  const jwtLogins = [];

  for (let i = 0; i < REQUESTS; i += 1) {
    jwtLogins.push(await loginJWT());
  }

  const jwtToken = jwtLogins[jwtLogins.length - 1].token;
  const protectedJWT = [];

  for (let i = 0; i < REQUESTS; i += 1) {
    protectedJWT.push(
      await timedRequest("jwt-protected", `${BASE_URL}/api/profile`, {
        headers: {
          Authorization: `Bearer ${jwtToken}`
        }
      })
    );
  }

  const summaryResponse = await fetch(`${BASE_URL}/metrics/summary`);
  const { summary } = await summaryResponse.json();
  const sessionLoginServer = findSummary(summary, "session", "login");
  const jwtLoginServer = findSummary(summary, "jwt", "login");
  const oauthLoginServer = findSummary(summary, "oauth", "login");
  const sessionProtectedServer = findSummary(summary, "session", "protected");
  const jwtProtectedServer = findSummary(summary, "jwt", "protected");

  printSection("Session login", sessionLoginServer, summarizeClientTimings(sessionLogins));
  printSection("JWT login", jwtLoginServer, summarizeClientTimings(jwtLogins));
  printSection("Session protected route", sessionProtectedServer, summarizeClientTimings(protectedSession));
  printSection("JWT protected API", jwtProtectedServer, summarizeClientTimings(protectedJWT));

  console.log("\nJWT token:");
  console.log(`- size: ${jwtLogins[jwtLogins.length - 1].tokenSize} bytes`);
  console.log(`- avg Authorization header size: ${formatMetric(jwtProtectedServer && jwtProtectedServer.avgAuthorizationHeaderSize)} bytes`);
  console.log(`- avg session cookie size: ${formatMetric(sessionProtectedServer && sessionProtectedServer.avgCookieSize)} bytes`);

  console.log("\nOAuth:");
  if (oauthLoginServer) {
    console.log(`- avg response time: ${oauthLoginServer.avgResponseTime} ms`);
    console.log(`- avg DB queries: ${oauthLoginServer.avgDbQueries}`);
  } else {
    console.log("- no OAuth callback metric yet; perform one Google login in the browser and run this script again or open /metrics/summary");
  }

  console.log("\nComparison table:");
  console.log("| Method | Avg Response Time | DB Queries | Storage | Scalability |");
  console.log("|--------|------------------:|-----------:|---------|-------------|");
  console.log(`| Session | ${formatMetric(sessionProtectedServer && sessionProtectedServer.avgResponseTime)} ms | ${formatMetric(sessionProtectedServer && sessionProtectedServer.avgDbQueries)} | Server | Low |`);
  console.log(`| JWT | ${formatMetric(jwtProtectedServer && jwtProtectedServer.avgResponseTime)} ms | ${formatMetric(jwtProtectedServer && jwtProtectedServer.avgDbQueries)} | Client | High |`);
  console.log(`| OAuth | ${formatMetric(oauthLoginServer && oauthLoginServer.avgResponseTime)} ms | ${formatMetric(oauthLoginServer && oauthLoginServer.avgDbQueries)} | External | Medium |`);

  console.log("\nAcademic explanation:");
  console.log("The collected metrics show that authentication methods differ not only by security model, but also by request processing cost.");
  console.log("Session-based authentication relies on server-side state and may require database access when the session user is deserialized.");
  console.log("JWT authentication moves identity claims into a signed token, which reduces server-side state requirements for protected API requests.");
  console.log("OAuth 2.0 introduces an external identity provider, so its response time depends on redirect and provider callback processing.");
  console.log("Therefore, session authentication is simpler for server-rendered web applications, JWT is more scalable for API-oriented systems, and OAuth improves usability through delegated login.");
}

runBenchmark().catch((error) => {
  console.error("Metrics benchmark failed:", error.message);
  process.exit(1);
});
