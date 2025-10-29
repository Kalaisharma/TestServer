const { pool } = require("../database/db");

// GET /protocols - Get all protocols
const getAllProtocols = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM protocols ORDER BY created_at DESC"
    );
    console.log(result.rows, "result.rows");

    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching protocols:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// POST /protocols - Create a new protocol
const createProtocol = async (req, res) => {
  try {
    const { protocolName, description, equipment } = req.body;
    console.log(req.body, "req.body");
    // Validate required fields
    if (!protocolName || !description) {
      return res.status(400).json({
        success: false,
        error: "Name and description are required",
      });
    }
    const result = await pool.query(
      'INSERT INTO protocols ("protocolName", description, equipment) VALUES ($1, $2, $3) RETURNING *',
      [protocolName, description, JSON.stringify(equipment) || "No equipment"]
    );

    res.status(201).json({
      success: true,
      message: "Protocol created successfully",
      //data: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating protocol:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// PUT /protocols - Update a protocol
const updateProtocol = async (req, res) => {
  try {
    const { id } = req.params;
    const { protocolName, description, equipment } = req.body;

    // Validate required fields
    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Protocol ID is required for update",
      });
    }

    const result = await pool.query(
        `UPDATE protocols SET "protocolName" = $1, description = $2, equipment = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *`,
      [protocolName, description, JSON.stringify(equipment), id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: "Protocol not found",
      });
    }

    res.json({
      success: true,
      message: "Protocol updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating protocol:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getProtocolById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM protocols WHERE id = $1", [
      id,
    ]);
    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error getting protocol by ID:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getAllProtocols,
  createProtocol,
  updateProtocol,
  getProtocolById,
};
