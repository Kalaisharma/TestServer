const express = require("express");
const router = express.Router();
const { login, register, getUsers, logout } = require("../controllers/authController");
const verifyToken = require("../middleware/authmiddleware");
// GET /protocols - Get all protocols
router.post("/login", login);
router.post("/register", verifyToken, register);
router.get("/users", verifyToken, getUsers);
router.post("/logout", logout);
module.exports = router;
