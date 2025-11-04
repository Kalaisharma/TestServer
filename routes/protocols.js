const express = require("express");
const router = express.Router();
const {
  getAllProtocols,
  createProtocol,
  updateProtocol,
  getProtocolById,
  updateProtocolStatus,
  archiveProtocol,
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

// PUT /protocols/status/:id - Update a protocol status
router.put("/protocols/status/:id", verifyToken, updateProtocolStatus);

//PUT /protocols/archive/:id - Archive a protocol
router.put("/protocols/archive/:id", verifyToken, archiveProtocol);

module.exports = router;
