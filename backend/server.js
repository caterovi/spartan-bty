const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const pool = require('./config/db');

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'))
);

// Test route para malaman kung gumagana ang backend
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Spartan BTY MIS API is running.',
  });
});

// Test route para sa MySQL connection
app.get('/api/health', async (req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        DATABASE() AS database_name,
        NOW() AS server_time
    `);

    res.json({
      success: true,
      message: 'Backend and MySQL are connected.',
      database: rows[0].database_name,
      serverTime: rows[0].server_time,
    });
  } catch (error) {
    next(error);
  }
});

// Authentication routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/dashboard',require('./routes/dashboard.routes'));
app.use('/api/sales',require('./routes/sales.routes'));
app.use('/api/cdm',require('./routes/cdm.routes'));
app.use('/api/supply-chain',require('./routes/supplychain.routes'));
app.use('/api/fulfillment',require('./routes/fulfillment.routes'));
app.use('/api/crm',require('./routes/crm.routes'));
app.use('/api/marketing',require('./routes/marketing.routes'));
app.use('/api/reports',require('./routes/reports.routes'));

// Route not found
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API route not found.',
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Server error:', error);

  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error.',
  });
});

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
  console.log(`Spartan BTY MIS backend running on port ${PORT}`);
});