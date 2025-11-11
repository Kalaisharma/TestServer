const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const socketIo = require("socket.io");
const cookieParser = require("cookie-parser");

require("dotenv").config();
const protocolRouter = require("./routes/protocols");
const auditRouter = require("./routes/auditRoutes");
const authRouter = require("./routes/authRoutes");
const { pool, testConnection } = require("./database/db");
const experimentRouter = require("./routes/experimentRoutes");
const app = express();

// Get server's local IP and subnet
function getLocalIP() {
  const interfaces = require("os").networkInterfaces();
  for (const interface of Object.values(interfaces).flat()) {
    if (interface.family === "IPv4" && !interface.internal) {
      return interface.address;
    }
  }
  return "localhost";
}

const SERVER_IP = getLocalIP();
const SERVER_SUBNET = SERVER_IP.split(".").slice(0, 3).join("."); // e.g., "192.168.1"

// Check if IP is in the same subnet
function isSameSubnet(ip) {
  if (!ip || ip === "localhost" || ip === "127.0.0.1" || ip === "::1") {
    return true; // Allow localhost
  }

  // Extract IP from various formats (could be "192.168.1.100" or "::ffff:192.168.1.100")
  const ipv4Match = ip.match(/(\d+\.\d+\.\d+\.\d+)/);
  if (!ipv4Match) return false;

  const clientSubnet = ipv4Match[1].split(".").slice(0, 3).join(".");
  return clientSubnet === SERVER_SUBNET;
}

// Check if origin is from same subnet
function isSameSubnetOrigin(origin) {
  if (!origin) return false;

  // Allow localhost for development
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
    return true;
  }

  // Extract IP from origin URL (e.g., "http://192.168.1.100:3000")
  const urlMatch = origin.match(/https?:\/\/([\d.]+)/);
  if (!urlMatch) return false;

  return isSameSubnet(urlMatch[1]);
}

// Dynamic CORS origin validator
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    if (isSameSubnetOrigin(origin)) {
      callback(null, true);
    } else {
      console.warn(
        `🚫 CORS blocked: ${origin} (not in subnet ${SERVER_SUBNET}.x)`
      );
      callback(
        new Error(
          `Not allowed by CORS. Must be from same LAN subnet (${SERVER_SUBNET}.x)`
        )
      );
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Create HTTP server
const server = http.createServer(app);

// Trust proxy to get correct client IP (important for mobile devices behind routers)
app.set("trust proxy", true);

app.use(express.json());
app.use(cookieParser());

// Middleware to validate client IP is in same subnet
app.use((req, res, next) => {
  // Allow CORS preflight requests to pass through
  if (req.method === "OPTIONS") {
    return next();
  }

  // Get client IP with proper handling for proxied connections
  const forwardedIP = req.headers["x-forwarded-for"]?.split(",")[0]?.trim();
  const clientIP =
    forwardedIP ||
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress;
  const actualIP = clientIP || "unknown";

  // Log connection attempt for debugging
  if (req.path !== "/favicon.ico") {
    console.log(`📡 Request from ${actualIP} to ${req.method} ${req.path}`);
  }

  if (!isSameSubnet(actualIP)) {
    console.warn(
      `🚫 Access denied: ${actualIP} (not in subnet ${SERVER_SUBNET}.x)`
    );
    return res.status(403).json({
      error:
        "Access denied. Server only accepts connections from the same LAN subnet.",
      requiredSubnet: `${SERVER_SUBNET}.x`,
      yourIP: actualIP,
    });
  }

  next();
});

const io = socketIo(server, {
  cors: corsOptions,
  allowRequest: (req, callback) => {
    const forwardedIP = req.headers["x-forwarded-for"]?.split(",")[0]?.trim();
    const clientIP =
      forwardedIP ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.headers["x-real-ip"];

    if (isSameSubnet(clientIP)) {
      callback(null, true);
    } else {
      console.warn(
        `🚫 Socket.io blocked: ${clientIP} (not in subnet ${SERVER_SUBNET}.x)`
      );
      callback(
        new Error(
          `Not allowed. Must be from same LAN subnet (${SERVER_SUBNET}.x)`
        ),
        false
      );
    }
  },
});

app.set("io", io);

// Socket.io connection handling
io.on("connection", (socket) => {
  const clientIP =
    socket.handshake.address || socket.request.connection.remoteAddress;
  console.log(`🔌 New client connected: ${socket.id} from ${clientIP}`);

  socket.on("disconnect", () => {
    console.log(`🔌 Client disconnected: ${socket.id} from ${clientIP}`);
  });
});

const PORT = process.env.SERVER_PORT || 3000;

// Apply CORS middleware
app.use(cors(corsOptions));

// Use protocol routes
app.use("/api", protocolRouter);
app.use("/api", auditRouter);
app.use("/api", authRouter);
app.use("/api", experimentRouter);
// app.get("/", (req, res) => {
//   res.sendFile(path.join(__dirname, "dist/index.html"));
// });

// ✅ Serve static files from dist folder
app.use(express.static(path.join(__dirname, "dist")));
// ✅ SPA fallback - MUST be after static files

app.get(
  [
    "/",
    "/protocols",
    "/logs",
    "/user-management",
    "/register",
    "/document-approval",
    "/unauthorized",
  ],
  (req, res) => {
    // Don't handle API routes
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "API endpoint not found" });
    }

    res.sendFile(path.join(__dirname, "dist/index.html"));
  }
);

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
        active BOOLEAN DEFAULT TRUE,
        archived BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        action VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS experiments (
        id SERIAL PRIMARY KEY,
        protocol_id INT NOT NULL REFERENCES protocols(id),
        temperature_data TEXT,
        experiment_data TEXT,
        comments TEXT,
        approval_status VARCHAR(100) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_accounts (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        role VARCHAR(100) NOT NULL,
        status BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(
        `📊 Connected to PostgreSQL on Raspberry Pi: ${process.env.DB_HOST}`
      );
      console.log(`🔌 WebSocket server ready on port ${PORT}`);
      console.log(`📱 Local: http://localhost:${PORT}`);
      console.log(`🌐 LAN: http://${SERVER_IP}:${PORT}`);
      console.log(
        `🔒 Security: Only accepting connections from subnet ${SERVER_SUBNET}.x`
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
module.exports = { app, server, io };
