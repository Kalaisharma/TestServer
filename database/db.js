const { Pool } = require("pg");
require("dotenv").config();

console.log("Database connection details:");
console.log("Host:", process.env.DB_HOST);
console.log("Port:", process.env.DB_PORT);
console.log("Database:", process.env.DB_NAME);
console.log("User:", process.env.DB_USER);

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // Add connection timeout and retry settings
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 20,
  // Add SSL if needed (set to false for local network)
  ssl: false,
});

// Enhanced connection test
const testConnection = async () => {
  let client;
  try {
    console.log("Attempting to connect to database...");
    client = await pool.connect();
    console.log("✅ Connected to database pool");

    const result = await client.query(
      "SELECT version(), current_database(), current_user"
    );
    console.log(
      "✅ Database version:",
      result.rows[0].version.split(",")[0],
      "✅ Current database:",
      result.rows[0].current_database,
      "✅ Current user:",
      result.rows[0].current_user
    );

    client.release();
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:");
    console.error("   Error message:", error.message);
    console.error("   Error code:", error.code);

    if (client) {
      client.release();
    }
    return false;
  }
};

// Test connection on startup
testConnection().then((success) => {
  if (success) {
    console.log("🚀 Database connection established successfully!");
  } else {
    console.log("💥 Failed to establish database connection");
  }
});

// Handle pool errors
pool.on("error", (err, client) => {
  console.error("Unexpected error on idle client", err);
});

module.exports = { pool, testConnection };
