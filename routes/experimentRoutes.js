const express = require("express");
const router = express.Router();
const {
  createExperiment,
  getExperiments,
  updateExperimentApprovalStatus,
} = require("../controllers/experimentController");
const verifyToken = require("../middleware/authmiddleware");
router.post("/desktop-experiments", createExperiment);
router.get("/experiments", verifyToken, getExperiments);
router.put("/experiments/:id", verifyToken, updateExperimentApprovalStatus);
module.exports = router;
