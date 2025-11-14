const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const socketIo = require("socket.io");
const cookieParser = require("cookie-parser");
const expressUseragent = require("express-useragent");
const useragent = require("useragent");

require("dotenv").config();
const protocolRouter = require("./routes/protocols");
const auditRouter = require("./routes/auditRoutes");
const authRouter = require("./routes/authRoutes");
const { pool, testConnection } = require("./database/db");
const experimentRouter = require("./routes/experimentRoutes");
const app = express();

// Create HTTP server
const server = http.createServer(app);
app.use(express.json());
app.use(cookieParser());
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:5173", "http://192.168.1.31:3000"], // Allow all origins for development (mobile access)
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);

// Helper function to detect mobile/tablet from user agent string
function isMobileDevice(userAgentString) {
  const mobileRegex =
    /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  return mobileRegex.test(userAgentString);
}

function isTabletDevice(userAgentString) {
  const tabletRegex = /iPad|Android(?!.*Mobile)|Tablet|PlayBook|Silk/i;
  return tabletRegex.test(userAgentString);
}

// Socket.io connection handling with device detection
io.use((socket, next) => {
  const userAgentString = socket.handshake.headers["user-agent"] || "";
  const parsedUA = useragent.parse(userAgentString);

  const isMobile = isMobileDevice(userAgentString);
  const isTablet = isTabletDevice(userAgentString);

  const deviceInfo = {
    device: isMobile ? "Mobile" : isTablet ? "Tablet" : "Desktop",
    platform: parsedUA.os.family || "Unknown",
    os: parsedUA.os.toString() || "Unknown",
    browser: parsedUA.family || "Unknown",
    version: parsedUA.toVersion() || "Unknown",
    ip: socket.handshake.address,
  };

  console.log("🔌 WebSocket connection attempt:", {
    socketId: socket.id,
    device: deviceInfo.device,
    platform: deviceInfo.platform,
    os: deviceInfo.os,
    browser: deviceInfo.browser,
    version: deviceInfo.version,
    ip: deviceInfo.ip,
  });

  // Block mobile and tablet devices
  if (isMobile || isTablet) {
    console.log(
      `❌ WebSocket access denied: ${deviceInfo.device} device detected`
    );
    return next(new Error("Access denied: Desktop devices only"));
  }

  // Store device info in socket for later use
  socket.deviceInfo = deviceInfo;
  console.log(`✅ WebSocket access granted: Desktop device (${deviceInfo.os})`);
  next();
});

io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id, socket.deviceInfo);

  socket.on("disconnect", () => {
    console.log("🔌 Client disconnected:", socket.id);
  });
});

const PORT = process.env.SERVER_PORT || 3000;

app.use(
  cors({
    origin: ["http://localhost:5173", "http://192.168.1.31:3000"], // Allow all origins for development (mobile access)
    credentials: true,
  })
);

// User agent parsing middleware
app.use(expressUseragent.express());

// Device detection middleware - Block non-desktop devices
app.use((req, res, next) => {
  const deviceInfo = {
    device: req.useragent.isMobile
      ? "Mobile"
      : req.useragent.isTablet
      ? "Tablet"
      : "Desktop",
    platform: req.useragent.platform,
    os: req.useragent.os,
    browser: req.useragent.browser,
    version: req.useragent.version,
    source: req.useragent.source,
    ip:
      req.ip || req.connection.remoteAddress || req.headers["x-forwarded-for"],
    userAgent: req.headers["user-agent"],
  };

  if (deviceInfo.userAgent.includes("Electron")) {
    deviceInfo.device = "Desktop";
    deviceInfo.platform = "Desktop";
    deviceInfo.os = "Desktop";
    deviceInfo.browser = "Chrome";
    deviceInfo.userAgent = "Electron";
  }

  // Log device information
  console.log("📱 Device Info:", {
    device: deviceInfo.device,
    platform: deviceInfo.platform,
    os: deviceInfo.os,
    browser: deviceInfo.browser,
    version: deviceInfo.version,
    ip: deviceInfo.ip,
    path: req.path,
  });

  // Block mobile and tablet devices
  if (deviceInfo.device==="Mobile" || deviceInfo.device==="Tablet") {
    console.log(`❌ Access denied: ${deviceInfo.device} device detected`);

    // If it's an API request, return JSON
    if (req.path.startsWith("/api/")) {
      return res.status(403).json({
        success: false,
        message: "Access denied: Desktop devices only",
        deviceInfo: {
          device: deviceInfo.device,
          platform: deviceInfo.platform,
          os: deviceInfo.os,
        },
      });
    }

    // For regular page requests, return HTML
    const htmlPage = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Access Denied - Desktop Only</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 100%;
            padding: 40px;
            text-align: center;
        }
        .icon {
            font-size: 80px;
            margin-bottom: 20px;
        }
        h1 {
            color: #333;
            font-size: 28px;
            margin-bottom: 15px;
            font-weight: 600;
        }
        p {
            color: #666;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 30px;
        }
        .device-info {
            background: #f5f5f5;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
            text-align: left;
        }
        .device-info h3 {
            color: #333;
            font-size: 14px;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .device-info p {
            color: #666;
            font-size: 14px;
            margin: 5px 0;
        }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 30px;
            border-radius: 25px;
            text-decoration: none;
            font-weight: 500;
            transition: transform 0.2s, box-shadow 0.2s;
            margin-top: 10px;
        }
        .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🚫</div>
        <h1>Access Denied</h1>
        <p>This application is only accessible from desktop devices. Please use a desktop or laptop computer to access this service.</p>
        
        <div class="device-info">
            <h3>Detected Device Information</h3>
            <p><strong>Device Type:</strong> ${deviceInfo.device}</p>
            <p><strong>Platform:</strong> ${deviceInfo.platform}</p>
            <p><strong>Operating System:</strong> ${deviceInfo.os}</p>
            <p><strong>Browser:</strong> ${deviceInfo.browser} ${
      deviceInfo.version || ""
    }</p>
        </div>
        
        <p style="font-size: 14px; color: #999; margin-top: 20px;">
            If you believe this is an error, please contact the administrator.
        </p>
    </div>
</body>
</html>
    `;

    return res.status(403).send(htmlPage);
  }

  // Allow desktop devices
  console.log(`✅ Access granted: Desktop device (${deviceInfo.os})`);
  next();
});

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
module.exports = { app, server, io };
