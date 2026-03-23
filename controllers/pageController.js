const jwt = require("jsonwebtoken");

const User = require("../models/User");

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
  if (req.query.method === "jwt") {
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
      const token = req.query.token || "";
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
        authMethod === "jwt" && req.query.token
          ? `/profile?method=jwt&token=${encodeURIComponent(req.query.token)}`
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
    const token = req.query.token || "";

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
