const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();
const formsRouter = require('./routes/forms');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(morgan("combined"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Static files for uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "Safety Forms API",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
  });
});

// API Routes
app.get("/api/test", (req, res) => {
  res.json({
    message: "Safety Forms API is running!",
    version: "1.0.0",
    endpoints: [
  "GET /health - Health check",
  "GET /api/test - Test endpoint", 
  "POST /api/forms/upload - Upload and process form image",
  "GET /api/forms - Get processed forms (coming soon)",
  "GET /api/stats - Processing statistics (coming soon)",
  ]
  });
});


app.use('/api/forms', formsRouter);

// Placeholder routes for future implementation

app.get("/api/stats", (req, res) => {
  res.status(501).json({
    error: "Stats endpoint not implemented yet",
    message: "This will return processing statistics and analytics",
  });
});

// Welcome message for root
app.get("/", (req, res) => {
  res.json({
    service: "Safety Forms API",
    version: "1.0.0",
    message: "Welcome to the Safety Forms Processing API",
    documentation: "/api/test for available endpoints",
    health: "/health for service status",
  });
});

// Request logging middleware for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err.stack);

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === "development";

  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : "Internal server error",
    ...(isDevelopment && { stack: err.stack }),
  });
});

// 404 handler - must be last
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
    message: "The requested endpoint does not exist",
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log("🚀 Safety Forms API Server Started");
  console.log(`📍 Server running on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API test: http://localhost:${PORT}/api/test`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("─".repeat(50));
});

module.exports = app;
