const express = require("express");
const router = express.Router();
const {
  getAllProtocols,
  createProtocol,
  updateProtocol,
  getProtocolById,
} = require("../controllers/protocolController");

// GET /protocols - Get all protocols
router.get("/protocols", getAllProtocols);

// POST /protocols - Create a new protocol
router.post("/protocols", createProtocol);

// PUT /protocols - Update a protocol
router.put("/protocols/:id", updateProtocol);

// GET /protocols/:id - Get a protocol by ID
router.get("/protocols/:id", getProtocolById);

module.exports = router;
