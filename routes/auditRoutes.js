const express = require("express");
const router = express.Router();
const {
  getAuditLogs,
} = require("../controllers/auditLogsController");

// GET /protocols - Get all protocols
router.get("/audit-logs", getAuditLogs);

module.exports = router;
