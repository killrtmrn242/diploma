const jwt = require("jsonwebtoken");

const User = require("../models/User");

async function checkJWTAuth(req, res, next) {
  try {
    const authorization = req.headers.authorization || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. JWT token is missing."
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_jwt_secret");
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User linked to this token was not found."
      });
    }

    req.jwtPayload = decoded;
    req.jwtUser = user;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired JWT token."
    });
  }
}

module.exports = checkJWTAuth;
