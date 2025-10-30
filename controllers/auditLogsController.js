const { pool } = require("../database/db");

const getAuditLogs = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM audit_logs ORDER BY created_at DESC");
    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
      res.status(500).json({
          success: false,
          error: error.message,
      });
  }
};

module.exports = { getAuditLogs };