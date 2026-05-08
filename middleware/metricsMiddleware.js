const {
  addMetric,
  runWithMetrics
} = require("../services/metricsStore");

function classifyRequest(req) {
  const path = req.path;
  const method = req.method.toUpperCase();
  const hasBearerToken = (req.headers.authorization || "").startsWith("Bearer ");

  if (method === "POST" && ["/login-session", "/auth/login/local"].includes(path)) {
    return {
      method: "session",
      type: "login",
      authSource: "session",
      measuredRoute: "POST /auth/login/local"
    };
  }

  if (method === "POST" && ["/login-jwt", "/auth/login/jwt"].includes(path)) {
    return {
      method: "jwt",
      type: "login",
      authSource: "jwt",
      measuredRoute: "POST /auth/login/jwt"
    };
  }

  if (method === "GET" && path === "/auth/google/callback") {
    return {
      method: "oauth",
      type: "login",
      authSource: "oauth",
      measuredRoute: "GET /auth/google/callback"
    };
  }

  if (method === "GET" && path === "/dashboard") {
    const isSessionAuthenticated = req.isAuthenticated && req.isAuthenticated();

    if (isSessionAuthenticated) {
      return {
        method: "session",
        type: "protected",
        authSource: "session",
        measuredRoute: "/dashboard with cookie"
      };
    }

    return null;
  }

  if (method === "GET" && ["/api/jwt-profile", "/api/profile"].includes(path)) {
    if (hasBearerToken && req.metricsAuthSource === "jwt") {
      return {
        method: "jwt",
        type: "protected",
        authSource: "jwt",
        measuredRoute: "/api/profile with Bearer token"
      };
    }

    return null;
  }

  return null;
}

function getByteLength(value = "") {
  return Buffer.byteLength(String(value), "utf8");
}

function getBearerToken(req) {
  const authorization = req.headers.authorization || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  req.metricsStartTime = start;
  const context = {
    dbQueries: 0,
    data: {}
  };

  return runWithMetrics(context, () => {
    res.on("finish", () => {
      if (req.skipMetricsMiddlewareRecord) {
        return;
      }

      const routeInfo = classifyRequest(req);

      if (!routeInfo) {
        return;
      }

      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      const authorizationHeader = req.headers.authorization || "";
      const bearerToken = getBearerToken(req);
      const authorizationBytes = getByteLength(authorizationHeader);
      const tokenSize = context.data.tokenSize || getByteLength(bearerToken);

      const metric = {
        ...routeInfo,
        responseTime: Number(durationMs.toFixed(2)),
        dbQueries: context.dbQueries,
        statusCode: res.statusCode,
        tokenSize,
        cookieSize: getByteLength(req.headers.cookie || ""),
        authorizationBytes,
        authorizationHeaderSize: authorizationBytes,
        requestSizeOverhead: {
          cookie: getByteLength(req.headers.cookie || ""),
          authorization: authorizationBytes
        },
        timestamp: Date.now()
      };

      addMetric(metric);
      console.log("Metric recorded:", metric);
    });

    return next();
  });
}

module.exports = metricsMiddleware;
