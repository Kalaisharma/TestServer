const express = require("express");
const router = express.Router();
const { createExperiment } = require("../controllers/experimentController");
router.post("/desktop-experiments", createExperiment);
module.exports = router;
