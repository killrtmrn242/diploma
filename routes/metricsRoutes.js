const express = require("express");

const {
  clearMetrics,
  getMetrics,
  summarizeMetrics
} = require("../services/metricsStore");

const router = express.Router();

router.get("/metrics", (req, res) => {
  res.json({
    success: true,
    metrics: getMetrics()
  });
});

router.get("/metrics/summary", (req, res) => {
  res.json({
    success: true,
    summary: summarizeMetrics()
  });
});

router.post("/metrics/reset", (req, res) => {
  clearMetrics();
  res.json({
    success: true,
    message: "Metrics storage was cleared."
  });
});

module.exports = router;
