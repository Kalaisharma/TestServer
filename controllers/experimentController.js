const { pool } = require("../database/db");

const createExperiment = async (req, res) => {
  try {
      console.log(req.body, "req.body");
      const { selectedProtocol, comment, temperatureData, experimentData } = JSON.parse(req.body);
    const result = await pool.query(
      "INSERT INTO experiments (protocol_id, temperature_data, experiment_data, comments) VALUES ($1, $2, $3, $4) RETURNING *",
      [
        selectedProtocol,
        JSON.stringify(temperatureData),
        JSON.stringify(experimentData),
        comment,
      ]
    );
    await pool.query(
      "INSERT INTO audit_logs (action) VALUES ($1) RETURNING *",
      [
        "Experiment created successfully: " +
          result.rows[0].id +
          " Comments: " +
          comment,
      ]
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
