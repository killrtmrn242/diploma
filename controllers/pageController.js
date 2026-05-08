const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const { getMetrics, summarizeMetrics } = require("../services/metricsStore");

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((cookies, part) => {
    const [rawName, ...rest] = part.trim().split("=");

    if (!rawName) {
      return cookies;
    }

    cookies[rawName] = decodeURIComponent(rest.join("=") || "");
    return cookies;
  }, {});
}

function getJWTToken(req) {
  if (req.query.token) {
    return req.query.token;
  }

  const cookies = parseCookies(req.headers.cookie || "");
  return cookies.jwtAuthToken || "";
}

function buildDashboardDescription(method) {
  const descriptions = {
    session:
      "Session-based authentication keeps login state on the server. The browser stores only the session cookie, while the server validates a session record on each request.",
    jwt:
      "JWT authentication stores signed claims inside a token. The client sends this token as a bearer token and the server validates the signature without reading server-side session state.",
    oauth:
      "OAuth 2.0 delegates user authentication to Google. After successful consent, the provider returns profile data and the app links it to a local user record."
  };

  return descriptions[method] || descriptions.session;
}

function getMethodFromRequest(req) {
  if (req.query.method === "jwt" || getJWTToken(req)) {
    return "jwt";
  }

  if (req.user && req.user.currentAuthMethod) {
    return req.user.currentAuthMethod;
  }

  if (req.session && req.session.authContext) {
    return req.session.authContext.method || "session";
  }

  return "session";
}

exports.homePage = (req, res) => {
  res.render("pages/home", {
    title: "Home"
  });
};

exports.registerPage = (req, res) => {
  res.render("pages/register", {
    title: "Register"
  });
};

exports.loginPage = (req, res) => {
  res.render("pages/login", {
    title: "Login"
  });
};

exports.dashboardPage = async (req, res, next) => {
  try {
    const authMethod = getMethodFromRequest(req);
    let user = req.user || null;
    let tokenPreview = "";

    if (authMethod === "jwt") {
      const token = getJWTToken(req);
      if (!token) {
        req.flash("error", "JWT demonstration requires a valid token from the login form.");
        return res.redirect("/login");
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_jwt_secret");
      user = await User.findById(decoded.userId);
      tokenPreview = `${token.slice(0, 36)}...`;
    }

    if (!user) {
      req.flash("error", "Please authenticate first.");
      return res.redirect("/login");
    }

    return res.render("pages/dashboard", {
      title: "Dashboard",
      user,
      authMethod,
      explanation: buildDashboardDescription(authMethod),
      tokenPreview,
      profileLink:
        authMethod === "jwt" && getJWTToken(req)
          ? `/profile?method=jwt`
          : "/profile"
    });
  } catch (error) {
    req.flash("error", "The provided JWT token is invalid or expired.");
    return res.redirect("/login");
  }
};

exports.profilePage = async (req, res) => {
  const authMethod = getMethodFromRequest(req);
  let user = req.user || null;

  if (authMethod === "jwt") {
    const token = getJWTToken(req);

    if (!token) {
      req.flash("error", "JWT profile view requires the token generated during JWT login.");
      return res.redirect("/login");
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_jwt_secret");
      user = await User.findById(decoded.userId);
    } catch (error) {
      req.flash("error", "The JWT token is invalid or expired.");
      return res.redirect("/login");
    }
  }

  if (!user) {
    req.flash("error", "Authenticated user data could not be loaded.");
    return res.redirect("/login");
  }

  return res.render("pages/profile", {
    title: "Profile",
    user,
    authMethod
  });
};

exports.comparePage = (req, res) => {
  const comparisonRows = [
    {
      criterion: "Security",
      session: "High when cookies are protected and session identifiers are managed securely on the server.",
      jwt: "High when short token lifetime, secure transport, and proper storage are used.",
      oauth: "High because identity verification is delegated to a trusted provider, though integration must be configured correctly."
    },
    {
      criterion: "Complexity",
      session: "Low to medium. Straightforward for monolithic server-rendered applications.",
      jwt: "Medium. Requires token lifecycle management and API-oriented validation.",
      oauth: "High. Requires provider setup, redirect flow, callback processing, and identity mapping."
    },
    {
      criterion: "Scalability",
      session: "Lower without shared session storage in distributed systems.",
      jwt: "High because protected APIs can remain mostly stateless.",
      oauth: "High for authentication delegation, but still needs app-side state handling after callback."
    },
    {
      criterion: "Usability",
      session: "Very convenient for classic websites with forms and server-rendered pages.",
      jwt: "Convenient for APIs, SPAs, and mobile clients.",
      oauth: "Very convenient because users can sign in with an existing external account."
    },
    {
      criterion: "Session storage",
      session: "Stored on the server and referenced through a browser cookie.",
      jwt: "Stored on the client as a signed token.",
      oauth: "Authentication happens at the provider, then the application stores local state after callback."
    },
    {
      criterion: "External provider dependency",
      session: "No.",
      jwt: "No.",
      oauth: "Yes, because this prototype relies on Google OAuth 2.0."
    },
    {
      criterion: "Suitability for SPA/mobile apps",
      session: "Possible, but usually less convenient than bearer token APIs.",
      jwt: "Very suitable for SPA, mobile, and microservice-oriented systems.",
      oauth: "Suitable when combined with a provider-centric login experience and a local state strategy."
    }
  ];

  const theoryCards = [
    {
      title: "Session-Based Authentication",
      summary:
        "The server stores login state and the browser keeps only the session identifier in a cookie.",
      advantages:
        "Simple mental model, centralized session invalidation, and excellent fit for traditional server-rendered web applications.",
      disadvantages:
        "Requires server-side session storage and may need extra infrastructure for horizontal scaling.",
      scenarios:
        "Recommended for dashboards, intranet systems, administrative panels, and classic web sites."
    },
    {
      title: "JWT Authentication",
      summary:
        "A JSON Web Token stores signed claims such as user identifier, email, and authentication method.",
      advantages:
        "Stateless validation, clean API support, and strong compatibility with SPAs and mobile applications.",
      disadvantages:
        "Token revocation is harder and unsafe client-side storage can create security risks.",
      scenarios:
        "Recommended for REST APIs, single-page applications, mobile clients, and distributed systems."
    },
    {
      title: "OAuth 2.0 Authentication",
      summary:
        "The application delegates authentication to an external identity provider, which verifies the user and returns profile data after consent.",
      advantages:
        "Reduces local password handling, improves user convenience, and speeds up onboarding.",
      disadvantages:
        "Depends on third-party provider availability and adds integration complexity.",
      scenarios:
        "Recommended for public web services, social sign-in, and systems where rapid onboarding is important."
    }
  ];

  res.render("pages/compare", {
    title: "Compare Methods",
    comparisonRows,
    theoryCards
  });
};

exports.securityTestsPage = (req, res) => {
  res.render("pages/security-tests", {
    title: "Security Tests"
  });
};

exports.securityTestResults = (req, res) => {
  const resultsPath = path.join(__dirname, "..", "selenium-security-results.json");

  fs.readFile(resultsPath, "utf8", (error, content) => {
    if (error) {
      return res.status(404).json({
        success: false,
        message: "No Selenium security results file found. Run npm run test:selenium first."
      });
    }

    try {
      return res.json({
        success: true,
        report: JSON.parse(content)
      });
    } catch (parseError) {
      return res.status(500).json({
        success: false,
        message: "Selenium security results file could not be parsed."
      });
    }
  });
};

function findMetric(summary, method, type) {
  return summary.find((item) => item.method === method && item.type === type) || null;
}

function formatValue(value, fallback = "No data") {
  return value === undefined || value === null || value === 0 ? fallback : value;
}

exports.metricsDashboardPage = (req, res) => {
  const metrics = getMetrics();
  const summary = summarizeMetrics(metrics);
  const sessionProtected = findMetric(summary, "session", "protected");
  const jwtProtected = findMetric(summary, "jwt", "protected");
  const oauthLogin = findMetric(summary, "oauth", "login");
  const sessionLogin = findMetric(summary, "session", "login");
  const jwtLogin = findMetric(summary, "jwt", "login");

  const comparisonTable = [
    {
      method: "Session protected route",
      route: "/dashboard with cookie",
      avgResponseTime: sessionProtected ? `${sessionProtected.avgResponseTime} ms` : "No data",
      dbQueries: sessionProtected ? sessionProtected.avgDbQueries : "No data",
      storage: "Server",
      scalability: "Low"
    },
    {
      method: "JWT protected route",
      route: "/api/profile with Bearer token",
      avgResponseTime: jwtProtected ? `${jwtProtected.avgResponseTime} ms` : "No data",
      dbQueries: jwtProtected ? jwtProtected.avgDbQueries : "No data",
      storage: "Client",
      scalability: "High"
    },
    {
      method: "OAuth login flow",
      route: "Google login/callback flow only",
      avgResponseTime: oauthLogin ? `${oauthLogin.avgResponseTime} ms` : "Run Google login",
      dbQueries: oauthLogin ? oauthLogin.avgDbQueries : "Run Google login",
      storage: "External provider + local session after callback",
      scalability: "Medium"
    }
  ];

  const cards = [
    {
      label: "Session Protected Avg",
      value: sessionProtected ? `${sessionProtected.avgResponseTime} ms` : "No data",
      hint: "Measured on /dashboard",
      className: "metric-session"
    },
    {
      label: "JWT Protected Avg",
      value: jwtProtected ? `${jwtProtected.avgResponseTime} ms` : "No data",
      hint: "Measured on /api/profile",
      className: "metric-jwt"
    },
    {
      label: "JWT Token Size",
      value: jwtLogin && jwtLogin.avgTokenSize ? `${jwtLogin.avgTokenSize} bytes` : "No data",
      hint: "Average generated token length",
      className: "metric-token"
    },
    {
      label: "Total Measurements",
      value: metrics.length,
      hint: "Stored in memory",
      className: "metric-total"
    }
  ];

  const requestOverhead = {
    sessionCookie: sessionProtected ? `${formatValue(sessionProtected.avgCookieSize)} bytes` : "No data",
    jwtAuthorization: jwtProtected ? `${formatValue(jwtProtected.avgAuthorizationHeaderSize)} bytes` : "No data"
  };
  const cookies = parseCookies(req.headers.cookie || "");
  const hasSessionCookie = Boolean(cookies["connect.sid"]);
  const hasJWTCookie = Boolean(cookies.jwtAuthToken);
  const mixedServerState = Boolean(hasSessionCookie && hasJWTCookie);

  res.render("pages/metrics", {
    title: "Metrics",
    cards,
    comparisonTable,
    summary,
    metrics: metrics.slice(-12).reverse(),
    requestOverhead,
    sessionLogin,
    jwtLogin,
    oauthLogin,
    mixedServerState,
    hasSessionCookie,
    hasJWTCookie
  });
};
