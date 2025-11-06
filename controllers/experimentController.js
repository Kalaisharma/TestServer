const { pool } = require("../database/db");

const createExperiment = async (req, res) => {
  try {
    const { selectedProtocol, comments, temperatureData } = req.body;
    const result = await pool.query(
      "INSERT INTO experiments (protocol_id,experiment_data, comments) VALUES ($1, $2, $3) RETURNING *",
      [selectedProtocol, JSON.stringify(temperatureData), comments]
    );
    return res.status(201).json({
      success: true,
      message: "Experiment created successfully",
    });
  } catch (error) {
    console.error("Error creating experiment:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};
module.exports = { createExperiment };
