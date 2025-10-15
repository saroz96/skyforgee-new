// routes/health.js
const express = require("express");
const router = express.Router();

router.get("/ping", (req, res) => {
  // very lightweight health check
  res.status(200).json({ ok: true, time: Date.now() });
});

module.exports = router;
