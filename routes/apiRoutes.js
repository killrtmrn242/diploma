const express = require("express");

const checkJWTAuth = require("../middleware/checkJWTAuth");

const router = express.Router();

router.get("/jwt-profile", checkJWTAuth, (req, res) => {
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
});

module.exports = router;
