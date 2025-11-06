const express = require("express");
const router = express.Router();
const {
  createExperiment,
  getExperiments,
} = require("../controllers/experimentController");
const verifyToken = require("../middleware/authmiddleware");
router.post("/desktop-experiments", createExperiment);
router.get("/experiments", verifyToken, getExperiments);
module.exports = router;
