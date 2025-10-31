const { pool } = require("../database/db");

const getAuditLogs = async (req, res) => {
  const { action } = req.query;
  console.log(action, "action");
  try {
    let result;
    if (!action) {
      result = await pool.query(
        "SELECT * FROM audit_logs ORDER BY created_at DESC"
      );
    } else {
      result = await pool.query(
        "SELECT * FROM audit_logs WHERE action ILIKE $1 ORDER BY created_at DESC",
        [`${action}%`]
      );
    }
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
