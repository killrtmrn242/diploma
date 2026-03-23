const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const User = require("../models/User");

function sanitizeEmail(email) {
  return String(email || "").toLowerCase().trim();
}

function addAuthMethod(user, method) {
  if (!user.authMethods.includes(method)) {
    user.authMethods.push(method);
  }
}

exports.register = async (req, res, next) => {
  try {
    const email = sanitizeEmail(req.body.email);
    const password = String(req.body.password || "").trim();

    if (!email || !password) {
      req.flash("error", "Email and password are required.");
      return res.redirect("/register");
    }

    if (password.length < 6) {
      req.flash("error", "Password must contain at least 6 characters.");
      return res.redirect("/register");
    }

    const existingUser = await User.findOne({ email });

    if (existingUser && existingUser.passwordHash) {
      req.flash("error", "A local account with this email already exists.");
      return res.redirect("/register");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    if (existingUser) {
      existingUser.passwordHash = passwordHash;
      addAuthMethod(existingUser, "session");
      addAuthMethod(existingUser, "jwt");
      await existingUser.save();
    } else {
      await User.create({
        email,
        passwordHash,
        authMethods: ["session", "jwt"]
      });
    }

    req.flash("success", "Registration successful. You can now sign in with Session or JWT.");
    return res.redirect("/login");
  } catch (error) {
    return next(error);
  }
};

exports.loginSession = (req, res, next) => {
  req.session.authContext = { method: "session" };

  req.app.get("passport").authenticate("local", (err, user, info) => {
    if (err) {
      return next(err);
    }

    if (!user) {
      req.flash("error", info && info.message ? info.message : "Session login failed.");
      return res.redirect("/login");
    }

    user.currentAuthMethod = "session";

    return req.logIn(user, (loginError) => {
      if (loginError) {
        return next(loginError);
      }

      req.flash("success", "Logged in using Session-based Authentication.");
      return res.redirect("/dashboard");
    });
  })(req, res, next);
};

exports.loginJWT = async (req, res, next) => {
  try {
    const email = sanitizeEmail(req.body.email);
    const password = String(req.body.password || "").trim();

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required."
      });
    }

    const user = await User.findOne({ email });
    if (!user || !user.passwordHash) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    addAuthMethod(user, "jwt");
    await user.save();

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        authMethod: "jwt"
      },
      process.env.JWT_SECRET || "fallback_jwt_secret",
      {
        expiresIn: "1h"
      }
    );

    return res.json({
      success: true,
      message: "JWT authentication successful.",
      token,
      redirectUrl: "/dashboard?method=jwt",
      user: {
        id: user.id,
        email: user.email,
        authMethod: "jwt"
      }
    });
  } catch (error) {
    return next(error);
  }
};

exports.logout = (req, res, next) => {
  req.logout((logoutError) => {
    if (logoutError) {
      return next(logoutError);
    }

    return req.session.destroy((sessionError) => {
      if (sessionError) {
        return next(sessionError);
      }

      res.clearCookie("connect.sid");
      return res.redirect("/login");
    });
  });
};

exports.googleAuth = (req, res, next) => {
  req.session.authContext = { method: "oauth" };
  next();
};

exports.googleCallback = (req, res) => {
  req.flash("success", "Logged in using OAuth 2.0 Authentication via Google.");
  res.redirect("/dashboard");
};
