// authMiddleware.js
const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  console.log(req.cookies, "req.cookies");

  const token = req.cookies.authToken;
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "No session found. Please login.",
    });
  }

  try {
    console.log("before token verification");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("after token verification");

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please login again.",
      });
    }

    // For any other token error
    return res.status(401).json({
      success: false,
      message: "Invalid session. Please login again.",
    });
  }
};

module.exports = verifyToken;
