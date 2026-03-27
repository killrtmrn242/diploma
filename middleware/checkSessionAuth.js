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

function checkSessionAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    req.session.authContext = { method: req.user.currentAuthMethod || "session" };
    return next();
  }

  const cookies = parseCookies(req.headers.cookie || "");

  if ((req.query.method === "jwt" && req.query.token) || cookies.jwtAuthToken) {
    return next();
  }

  req.flash("error", "Please log in with Session-based authentication, JWT, or OAuth 2.0 first.");
  return res.redirect("/login");
}

module.exports = checkSessionAuth;
