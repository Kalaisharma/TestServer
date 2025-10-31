const express = require("express");
const router = express.Router();
const { login, register } = require("../controllers/authController");

// GET /protocols - Get all protocols
router.post("/login", login);
router.post("/register", register);

module.exports = router;
