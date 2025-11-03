const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { pool } = require("../database/db");

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await pool.query(
      "SELECT * FROM user_accounts WHERE username = $1",
      [username]
    );
    if (!user.rows[0] || !user.rows[0].status) {
      await pool.query("INSERT INTO audit_logs (action) VALUES ($1)", [
        "Login failed: User not found or inactive: Username: " + username,
      ]);
      return res.status(401).json({ message: "User not found or inactive" });
    }
    if (!(await bcrypt.compare(password, user.rows[0].password))) {
      await pool.query("INSERT INTO audit_logs (action) VALUES ($1)", [
        "Login failed: Invalid password: Username: " + username,
      ]);
      return res.status(401).json({ message: "Invalid password" });
    }
    await pool.query("INSERT INTO audit_logs (action) VALUES ($1)", [
      "Login successful: Username: " + username,
    ]);
    const token = jwt.sign(
      {
        username: user.rows[0].username,
        role: user.rows[0].role,
        id: user.rows[0].id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 1,
      path: "/",
    });
    return res.status(200).json({
      message: "Login successful",
      user: {
        username: user.rows[0].username,
        role: user.rows[0].role,
        id: user.rows[0].id,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const register = async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const current_user = await pool.query(
      "SELECT * FROM user_accounts WHERE username = $1",
      [username]
    );
    if (current_user.rows[0]) {
      return res.status(400).json({ message: "User already exists" });
    }
    const hashed_password = await bcrypt.hash(password, 10);
    const user = await pool.query(
      "INSERT INTO user_accounts (username, password, role) VALUES ($1, $2, $3)",
      [username, hashed_password, role]
    );
    return res.status(200).json({ message: "Register successful" });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const getUsers = async (req, res) => {
  try {
    const users = await pool.query("SELECT * FROM user_accounts");
    return res.status(200).json({ users: users.rows });
  } catch (error) {
    console.error("Get users error:", error);
    return res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

const logout = async (req, res) => {
  try {
    const { username } = req.body;
    const token = req.cookies.authToken;
    if (token) {
      res.clearCookie("authToken", {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 0,
        path: "/",
      });
    }
    await pool.query("INSERT INTO audit_logs (action) VALUES ($1)", [
      "Logout successful: Username: " + username,
    ]);
    return res.status(200).json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await pool.query("SELECT * FROM user_accounts WHERE id = $1", [
      id,
    ]);
    if (!user.rows[0]) {
      return res.status(404).json({ message: "User not found" });
    }
    const status = user.rows[0].status;
    console.log(status, "status");
    console.log(!status, "!status");
    await pool.query("UPDATE user_accounts SET status = $1 WHERE id = $2", [
      !status,
      id,
    ]);
    await pool.query("INSERT INTO audit_logs (action) VALUES ($1)", [
      "User status updated: Username: " +
        user.rows[0].username +
        " Status: " +
        !status.toString(),
    ]);
    return res
      .status(200)
      .json({ message: "User status updated", status: status.toString() });
  } catch (error) {
    console.error("Update user status error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
module.exports = { login, register, getUsers, logout, updateUserStatus };
