const { pool } = require("../database/db");

const getAuditLogs = async (req, res) => {
  const { action, start_date, end_date } = req.query;
  try {
    let query = "SELECT * FROM audit_logs WHERE 1=1";
    const params = [];
    let paramCount = 0;

    if (action && action !== "" && typeof action === "string") {
      paramCount++;
      query += ` AND action ILIKE $${paramCount}`;
      params.push(`${action}%`);
    }

    if (start_date) {
      paramCount++;
      query += ` AND DATE(created_at) >= $${paramCount}`;
      params.push(start_date);
    }

    if (end_date) {
      paramCount++;
      query += ` AND DATE(created_at) <= $${paramCount}`;
      params.push(end_date);
    }

    query += " ORDER BY created_at DESC";
    const result = await pool.query(query, params);

    const actions = await pool.query(
      `SELECT DISTINCT SUBSTRING(action FROM '^[^:]+') as action_type FROM audit_logs  WHERE action LIKE '%:%' ORDER BY action_type`
    );
    res.json({
      success: true,
      data: result.rows,
      actions: actions.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = { getAuditLogs };
