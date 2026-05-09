require('dotenv').config();
process.env.MONGODB_URI && console.log('MONGO_URI:', process.env.MONGODB_URI);

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');
const path = require('path');
const connectDB = require('./config/db');

const app = express();

connectDB();

app.use(helmet());
app.use(xss());
app.use(cors());
app.use(express.json());

const loginLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        message: 'Too many login attempts, please try again after 1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/auth/login', loginLimiter);

app.use(require('./middleware/logger').logger);

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));

app.use(express.static(path.join(__dirname, '../frontend')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`🌐 Website URL: http://localhost:${PORT}`);
    console.log(`🔒 Security features enabled: Helmet, XSS Protection, Rate Limiting`);
});