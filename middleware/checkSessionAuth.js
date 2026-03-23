function checkSessionAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    req.session.authContext = { method: req.user.currentAuthMethod || "session" };
    return next();
  }

  if (req.query.method === "jwt" && req.query.token) {
    return next();
  }

  req.flash("error", "Please log in with Session-based authentication, JWT, or OAuth 2.0 first.");
  return res.redirect("/login");
}

module.exports = checkSessionAuth;
