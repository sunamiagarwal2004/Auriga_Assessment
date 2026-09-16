/**
 * AV Room Gear Tracker - Express Server
 * Main entry point for the application
 *
 * Routes:
 * - GET  /api/equipment              — list equipment types with availability
 * - GET  /api/equipment/:typeId/units — list units of a type
 * - GET  /api/equipment/:typeId/availability — check availability in date range
 * - POST /api/bookings               — create a booking (checkout)
 * - PATCH /api/bookings/:id/return   — return equipment
 * - GET  /api/bookings               — list bookings (with filters)
 * - GET  /api/bookings/:id           — get booking detail
 * - GET  /api/borrowers/:studentId/history — borrower history & stats
 * - GET  /api/alerts/overdue         — list overdue bookings
 * - GET  /api/alerts/due-soon        — list bookings due within 24h
 * - GET  /api/reports/repeat-offenders — chronic late returners
 */

const express = require('express');
const path = require('path');
const { initializeSchema } = require('./db');

// Import route handlers
const equipmentRoutes = require('./routes/equipmentRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const alertRoutes = require('./routes/alertRoutes');
const reportRoutes = require('./routes/reportRoutes');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE
// ==========================================

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`);
  });

  next();
});

// Parse JSON request bodies
app.use(express.json());

// CORS enabled for local development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// ==========================================
// STATIC FILES
// ==========================================

// Serve /public folder as static files
app.use(express.static(path.join(__dirname, '../public')));

// ==========================================
// API ROUTES
// ==========================================

// Equipment routes
app.use('/api/equipment', equipmentRoutes);

// Booking routes
app.use('/api/bookings', bookingRoutes);

// Alert routes
app.use('/api/alerts', alertRoutes);

// Report routes
app.use('/api/reports', reportRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==========================================
// ERROR HANDLING
// ==========================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    method: req.method,
  });
});

// Central error handler (catches all unhandled errors)
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${new Date().toISOString()}`, err);

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ==========================================
// SERVER STARTUP
// ==========================================

// Initialize database schema on startup
try {
  initializeSchema();
  console.log('✓ Database schema initialized');
} catch (error) {
  console.error('✗ Failed to initialize database:', error);
  process.exit(1);
}

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 AV Room Gear Tracker listening on http://localhost:${PORT}`);
  console.log(`📁 API docs: POST/GET /api/...`);
  console.log(`🌐 Frontend: http://localhost:${PORT}\n`);
});

module.exports = app;
