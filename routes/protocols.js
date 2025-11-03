const express = require("express");
const router = express.Router();
const {
  getAllProtocols,
  createProtocol,
  updateProtocol,
  getProtocolById,
} = require("../controllers/protocolController");
const verifyToken = require("../middleware/authmiddleware");
// GET /protocols - Get all protocols
router.get("/protocols", verifyToken, getAllProtocols);

// POST /protocols - Create a new protocol
router.post("/protocols", verifyToken, createProtocol);

// PUT /protocols - Update a protocol
router.put("/protocols/:id", verifyToken, updateProtocol);

// GET /protocols/:id - Get a protocol by ID
router.get("/protocols/:id", verifyToken, getProtocolById);

module.exports = router;
