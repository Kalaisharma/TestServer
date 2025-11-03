const express = require("express");
const router = express.Router();
const { getAuditLogs } = require("../controllers/auditLogsController");
const verifyToken = require("../middleware/authmiddleware").default;
// GET /protocols - Get all protocols
router.get("/audit-logs", verifyToken, getAuditLogs);

module.exports = router;
