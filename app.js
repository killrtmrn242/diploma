require("dotenv").config();

const path = require("path");
const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const methodOverride = require("method-override");

const connectDB = require("./config/db");
const configurePassport = require("./config/passport");
const pageRoutes = require("./routes/pageRoutes");
const authRoutes = require("./routes/authRoutes");
const apiRoutes = require("./routes/apiRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

connectDB();
configurePassport(passport);
app.set("passport", passport);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "fallback_session_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 1000 * 60 * 60
    }
  })
);

app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.currentUser = req.user || null;
  res.locals.isAuthenticated = req.isAuthenticated ? req.isAuthenticated() : false;
  res.locals.successMessage = req.flash("success");
  res.locals.errorMessage = req.flash("error");
  res.locals.infoMessage = req.flash("info");
  next();
});

app.use("/", pageRoutes);
app.use("/", authRoutes);
app.use("/api", apiRoutes);

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
