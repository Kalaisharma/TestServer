const { pool } = require("../database/db");

const createExperiment = async (req, res) => {
  try {
    console.log(req.body, "req.body from try");
    const { selectedProtocol, comment, temperatureData, experimentData } =
      req.body;
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
    console.log(req.body, "req.body from catch");
    console.error("Error creating experiment:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

const getExperiments = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT experiments.id, experiments.protocol_id, experiments.comments, protocols."protocolName", experiments.created_at, experiments.approval_status FROM experiments INNER JOIN protocols ON experiments.protocol_id = protocols.id ORDER BY experiments.created_at DESC`
    );
    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Error getting experiments:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

const updateExperimentApprovalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { approval_status } = req.body;
    const experiment = await pool.query(
      "SELECT * FROM experiments WHERE id = $1",
      [id]
    );
    if (!experiment.rows[0]) {
      return res.status(404).json({
        success: false,
        error: "Experiment not found",
      });
    }
    const result = await pool.query(
      "UPDATE experiments SET approval_status = $1 WHERE id = $2",
      [approval_status, id]
    );
    if (approval_status === "Approved") {
      await pool.query(
        "INSERT INTO audit_logs (action) VALUES ($1) RETURNING *",
        [
          "Experiment approved: " +
            id +
            " Experiment: " +
            experiment.rows[0].comments,
        ]
      );
    } else {
      await pool.query(
        "INSERT INTO audit_logs (action) VALUES ($1) RETURNING *",
        [
          "Experiment rejected: " +
            id +
            " Experiment: " +
            experiment.rows[0].comments,
        ]
      );
    }
    return res.status(200).json({
      success: true,
      message: "Experiment approval status updated successfully",
    });
  } catch (error) {
    console.error("Error updating experiment approval status:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

const getExperimentById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT experiments.id, experiments.protocol_id, experiments.comments, experiments.temperature_data, experiments.experiment_data, experiments.approval_status, protocols."protocolName", protocols.description, protocols.equipment, experiments.created_at FROM experiments INNER JOIN protocols ON experiments.protocol_id = protocols.id WHERE experiments.id = $1`,
      [id]
    );
    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error getting experiment by id:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

module.exports = {
  createExperiment,
  getExperiments,
  updateExperimentApprovalStatus,
  getExperimentById,
};
