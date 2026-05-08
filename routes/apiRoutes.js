const express = require("express");

const checkJWTAuth = require("../middleware/checkJWTAuth");
const checkJWTStatelessAuth = require("../middleware/checkJWTStatelessAuth");
const { addMetric, getCurrentContext } = require("../services/metricsStore");

const router = express.Router();

function jwtProfileHandler(req, res) {
  res.json({
    success: true,
    message: "JWT-protected profile data fetched successfully.",
    user: {
      id: req.jwtUser.id,
      email: req.jwtUser.email,
      authMethod: req.jwtPayload.authMethod,
      authMethods: req.jwtUser.authMethods,
      oauthProvider: req.jwtUser.oauthProvider || null,
      createdAt: req.jwtUser.createdAt
    }
  });
}

router.get("/jwt-profile", checkJWTAuth, jwtProfileHandler);
router.get("/profile", checkJWTStatelessAuth, (req, res) => {
  console.log("JWT protected API called");
  const startTime = req.metricsStartTime || process.hrtime.bigint();
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const context = getCurrentContext();
  const measuredMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;

  const metric = {
    method: "jwt",
    authSource: "jwt",
    type: "protected",
    measuredRoute: "/api/profile with Bearer token",
    responseTime: Number(measuredMs.toFixed(2)),
    dbQueries: context ? context.dbQueries : 0,
    tokenSize: Buffer.byteLength(token, "utf8"),
    authorizationBytes: Buffer.byteLength(authorization, "utf8"),
    authorizationHeaderSize: Buffer.byteLength(authorization, "utf8"),
    cookieBytes: req.headers.cookie ? Buffer.byteLength(req.headers.cookie, "utf8") : 0,
    cookieSize: req.headers.cookie ? Buffer.byteLength(req.headers.cookie, "utf8") : 0,
    statusCode: 200,
    timestamp: Date.now()
  };

  addMetric(metric);
  req.skipMetricsMiddlewareRecord = true;
  console.log("JWT protected metric saved", metric);

  res.json({
    success: true,
    message: "JWT-protected stateless profile data fetched successfully.",
    user: {
      id: req.jwtPayload.userId,
      email: req.jwtPayload.email,
      authMethod: req.jwtPayload.authMethod
    }
  });
});

module.exports = router;
