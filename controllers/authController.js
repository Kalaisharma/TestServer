const bcrypt = require("bcrypt");
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
    return res.status(200).json({ message: "Login successful" });
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

module.exports = { login, register };
