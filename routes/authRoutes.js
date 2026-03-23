const express = require("express");
const passport = require("passport");

const authController = require("../controllers/authController");

const router = express.Router();

router.post("/register", authController.register);
router.post("/login-session", authController.loginSession);
router.post("/login-jwt", authController.loginJWT);
router.post("/logout", authController.logout);

router.get(
  "/auth/google",
  authController.googleAuth,
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account consent"
  })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    failureFlash: "Google OAuth authentication failed."
  }),
  authController.googleCallback
);

module.exports = router;
