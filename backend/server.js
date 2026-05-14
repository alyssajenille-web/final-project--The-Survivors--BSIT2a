require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const path = require('path');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Trust Render's reverse proxy
app.set('trust proxy', 1);

connectDB();

// Body parsing FIRST — must be before validation middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Security middleware AFTER body parsing
app.use(helmet({ contentSecurityPolicy: false }));
app.use(mongoSanitize());

app.use(cors({
  origin: '*',
  credentials: false
}));

const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Too many login attempts, please try again after 1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Too many registration attempts, please try again after 15 minutes'
  }
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);

app.use(require('./middleware/logger').logger);

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/classes', require('./routes/classRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/schedule', require('./routes/classScheduleRoutes'));
app.use('/api/sessions', require('./routes/attendanceSessionRoutes'));
app.use('/api/roster', require('./routes/classRosterRoutes'));

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Website URL: http://localhost:${PORT}`);
  console.log(`🔒 Security features enabled: Helmet, Mongo Sanitize, Rate Limiting`);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
});
