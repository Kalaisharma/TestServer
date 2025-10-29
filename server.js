const express = require("express");
const cors = require("cors");
require("dotenv").config();
const protocolRouter = require("./routes/protocols");

const { pool, testConnection } = require("./database/db");

const app = express();

// Serve static files from frontend build
app.use(express.static(path.join(__dirname, "dist")));

const PORT = process.env.SERVER_PORT || 3000;

app.use(cors());
app.use(express.json());

// Use protocol routes
app.use("/api", protocolRouter);

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist/index.html"));
});

// Test database connection
app.get("/api/test-db", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT version(), inet_server_addr() as server_ip, current_database() as db_name"
    );
    res.json({
      success: true,
      message: "Connected to remote PostgreSQL on Raspberry Pi",
      database: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Create table and test data
app.post("/api/setup", async (req, res) => {
  try {
    // Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS test_users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS protocols (
        id SERIAL PRIMARY KEY,
        "protocolName" VARCHAR(100) NOT NULL,
        description TEXT,
        equipment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);


    res.json({
      success: true,
      message: "Tables created and sample data inserted",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get all users
app.get("/api/users", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM test_users ORDER BY created_at DESC"
    );
    res.json({
      success: true,
      count: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Create new user
app.post("/api/users", async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: "Name and email are required",
      });
    }

    const result = await pool.query(
      "INSERT INTO test_users (name, email) VALUES ($1, $2) RETURNING *",
      [name, email]
    );

    res.status(201).json({
      success: true,
      message: "User created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      res.status(400).json({
        success: false,
        error: "Email already exists",
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
});

// Bulk insert test data
app.post("/api/bulk-insert", async (req, res) => {
  try {
    const { count = 1000 } = req.body; // Default to 1000 records

    console.log(`🚀 Starting bulk insert of ${count} records...`);
    const startTime = Date.now();

    // Generate bulk data
    const users = [];
    for (let i = 0; i < count; i++) {
      users.push({
        name: `Test User ${i + 1}`,
        email: `user${i + 1}@test${Math.random()
          .toString(36)
          .substring(2, 8)}.com`,
      });
    }

    // Method 1: Individual inserts (slower but simple)

    // const result = [];
    // for (const user of users) {
    //   const results = await pool.query(
    //     'INSERT INTO test_users (name, email) VALUES ($1, $2) RETURNING id',
    //     [user.name, user.email]
    //   );
    //   result.push(results.rows[0]);
    // }

    // Method 2: Batch insert using UNNEST (FASTEST)
    const names = users.map((u) => u.name);
    const emails = users.map((u) => u.email);

    const result = await pool.query(
      `
      INSERT INTO test_users (name, email) 
      SELECT * FROM UNNEST($1::text[], $2::text[])
      RETURNING id
    `,
      [names, emails]
    );

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log(
      `✅ Bulk insert completed: ${
        result.rowCount
      } records in ${duration.toFixed(2)} seconds`
    );

    res.json({
      success: true,
      message: `Successfully inserted ${result.rowCount} records`,
      stats: {
        totalRecords: result.rowCount,
        durationSeconds: duration.toFixed(2),
        recordsPerSecond: (result.rowCount / duration).toFixed(2),
      },
      sample: result.rows.slice(0, 5), // Show first 5 inserted IDs
    });
  } catch (error) {
    console.error("❌ Bulk insert failed:", error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code,
    });
  }
});

// Get database statistics
app.get("/api/stats", async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_users,
        MIN(created_at) as first_created,
        MAX(created_at) as last_created,
        PG_SIZE_PRETTY(PG_TABLE_SIZE('test_users')) as table_size,
        PG_SIZE_PRETTY(PG_DATABASE_SIZE(CURRENT_DATABASE())) as db_size
      FROM test_users
    `);

    res.json({
      success: true,
      data: stats.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Start server
const startServer = async () => {
  try {
    //Test database connection
    const isConnected = await testConnection();
    if (!isConnected) {
      console.error("❌ Cannot start server: Database connection failed");
      process.exit(1);
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(
        `📊 Connected to PostgreSQL on Raspberry Pi: ${process.env.DB_HOST}`
      );
        console.log(`📱 Local: http://localhost:${PORT}`);
        console.log(`🌐 LAN: http://${getLocalIP()}:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

function getLocalIP() {
  const interfaces = require("os").networkInterfaces();
  for (const interface of Object.values(interfaces).flat()) {
    if (interface.family === "IPv4" && !interface.internal) {
      return interface.address;
    }
  }
  return "localhost";
}

startServer();
