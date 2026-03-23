const express = require("express");

const pageController = require("../controllers/pageController");
const checkSessionAuth = require("../middleware/checkSessionAuth");

const router = express.Router();

router.get("/", pageController.homePage);
router.get("/register", pageController.registerPage);
router.get("/login", pageController.loginPage);
router.get("/dashboard", checkSessionAuth, pageController.dashboardPage);
router.get("/profile", checkSessionAuth, pageController.profilePage);
router.get("/compare", pageController.comparePage);

module.exports = router;
