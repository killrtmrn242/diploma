require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const methodOverride = require("method-override");
const jwt = require("jsonwebtoken");

const connectDB = require("./config/db");
const configurePassport = require("./config/passport");
const pageRoutes = require("./routes/pageRoutes");
const authRoutes = require("./routes/authRoutes");
const apiRoutes = require("./routes/apiRoutes");
const metricsRoutes = require("./routes/metricsRoutes");
const metricsMiddleware = require("./middleware/metricsMiddleware");

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";

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

connectDB();
configurePassport(passport);
app.set("passport", passport);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("trust proxy", 1);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));
app.use("/selenium-results", express.static(path.join(__dirname, "selenium-results")));
app.use(metricsMiddleware);

app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback_session_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60
    }
  })
);

app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  const cookies = parseCookies(req.headers.cookie || "");
  const jwtToken = cookies.jwtAuthToken || "";
  let hasValidJWT = false;

  if (jwtToken) {
    try {
      jwt.verify(jwtToken, process.env.JWT_SECRET || "fallback_jwt_secret");
      hasValidJWT = true;
    } catch (error) {
      hasValidJWT = false;
    }
  }

  res.locals.currentUser = req.user || null;
  res.locals.hasSessionAuth = req.isAuthenticated ? req.isAuthenticated() : false;
  res.locals.isAuthenticated = res.locals.hasSessionAuth || hasValidJWT;
  res.locals.hasJWTSession = hasValidJWT;
  res.locals.successMessage = req.flash("success");
  res.locals.errorMessage = req.flash("error");
  res.locals.infoMessage = req.flash("info");
  next();
});

app.use("/", pageRoutes);
app.use("/", authRoutes);
app.use("/api", apiRoutes);
app.use("/", metricsRoutes);

app.use((req, res) => {
  res.status(404).render("pages/error", {
    title: "Page Not Found",
    statusCode: 404,
    message: "The page you requested does not exist."
  });
});

app.use((err, req, res, next) => {
  console.error(err);

  if (req.originalUrl.startsWith("/api")) {
    return res.status(500).json({
      success: false,
      message: "Internal server error."
    });
  }

  return res.status(err.status || 500).render("pages/error", {
    title: "Server Error",
    statusCode: err.status || 500,
    message: err.message || "Something went wrong. Please try again."
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
