const jwt = require("jsonwebtoken");

function checkJWTStatelessAuth(req, res, next) {
  try {
    const authorization = req.headers.authorization || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. JWT token is missing."
      });
    }

    req.jwtPayload = jwt.verify(token, process.env.JWT_SECRET || "fallback_jwt_secret");
    req.metricsAuthSource = "jwt";
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired JWT token."
    });
  }
}

module.exports = checkJWTStatelessAuth;
