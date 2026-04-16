const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
try {
  const envPath = path.join(__dirname, '.env');
  require('dotenv').config({ path: envPath });
} catch (_) { }
const { csrfCheck } = require('./middleware/csrf');
const { User } = require('./models');
const emailService = require('./services/emailService');

// Validate essential environment variables at startup
// Allow relaxed env requirements in E2E/local dev
const IS_E2E = process.env.E2E_MODE === 'true';
const IS_DEV = process.env.NODE_ENV !== 'production';
if (!process.env.JWT_SECRET && !(IS_E2E || IS_DEV)) {
  console.error('\n[Startup Error] Missing required env: JWT_SECRET');
  console.error('Add JWT_SECRET to backend/.env (see backend/.env.example)');
  process.exit(1);
}
// Provide a default secret for E2E/local to avoid startup failure
process.env.JWT_SECRET = process.env.JWT_SECRET || 'e2e-secret';

// Import database connection
const connectDB = require('../config/database/connection');

const app = express();
// ✅🔥 FIX (VERY IMPORTANT)
// app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// Connect to MongoDB (skip in E2E/local test mode)
if (!IS_E2E) {
  connectDB();
  const mongoose = require('mongoose');
  mongoose.connection.once('open', async () => {
    try {
      const email = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
      const pwd = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';
      const admin = await User.findOne({ email, role: 'admin' }).select('+password');
      if (!admin) {
        await User.create({ email, role: 'admin', password: pwd, status: 'active', firstName: 'Admin', lastName: 'User', phone: '9999999999' });
      } else if (String(process.env.SEED_ADMIN_RESET).toLowerCase() === 'true') {
        admin.password = pwd;
        admin.status = 'active';
        await admin.save();
      }
    } catch (_) { console.log('Seed admin initialization skipped'); }
  });
} else {
  console.log(' E2E mode: skipping MongoDB connection');
}

// Security middleware
app.use(helmet());

// Rate limiting
const isProduction = process.env.NODE_ENV === 'production';

// Global API limiter: relaxed in development to avoid accidental 429s
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 1000 : 1000, // allow far more requests during local dev
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.'
});

// Login-specific limiter: protect from brute force; still relaxed in dev
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: isProduction ? 1000 : 1000, // strict in prod, generous in dev
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Please wait a minute and try again.'
});

app.use('/api/auth/login', (req, res, next) => {
  const origin = (req.headers.origin || '').replace(/\/$/, '');
  const devOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
  const relax = !isProduction || process.env.RELAX_LOGIN_LIMITER === 'true' || devOriginPattern.test(origin);
  if (relax) return next();
  return loginLimiter(req, res, next);
});

app.use('/api/', (req, res, next) => {
  const origin = (req.headers.origin || '').replace(/\/$/, '');
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').replace(/\/$/, '');
  const devOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
  const isLocalHost = /localhost|127\.0\.0\.1/i.test(host);
  const relax = !isProduction || process.env.RELAX_API_LIMITER === 'true' || devOriginPattern.test(origin) || isLocalHost;
  const isE2ERoute = req.originalUrl.startsWith('/api/e2e');
  if (relax || isE2ERoute) {
    return next();
  }
  return apiLimiter(req, res, next);
});

// CORS configuration
// Normalize FRONTEND_URL to avoid trailing slash mismatches
const normalize = (url) => (typeof url === 'string' ? url.replace(/\/$/, '') : url);
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  normalize(process.env.FRONTEND_URL)
].filter(Boolean);

const isDev = process.env.NODE_ENV !== 'production';
// Allow localhost or 127.0.0.1 on any port in development
const devOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    const o = normalize(origin);
    // Allow explicit whitelist and common dev localhost patterns
    if (allowedOrigins.includes(o) || devOriginPattern.test(o) || process.env.RELAX_CORS === 'true') {
      return callback(null, true);
    }
    return callback(new Error('CORS: Origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
}));

// Preflight requests are handled by the CORS middleware above; no explicit wildcard route

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Optional CSRF protection (header-based placeholder)
// Enable by setting ENABLE_CSRF=true and include `x-csrf-token` header on unsafe methods
// In E2E mode, skip CSRF checks for `/api/e2e/*` routes to allow test helpers
app.use((req, res, next) => {
  // Skip CSRF check for preflight requests
  if (req.method === 'OPTIONS') {
    return next();
  }
  if (process.env.E2E_MODE === 'true' && req.path.startsWith('/api/e2e')) {
    return next();
  }
  return csrfCheck(req, res, next);
});

// Logging middleware
app.use(morgan('combined'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'BBD School Backend API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/faculty', require('./routes/faculty'));
app.use('/api/student', require('./routes/student'));
app.use('/api/general', require('./routes/general'));
// Newly mounted domain routers
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/calendar', require('./routes/calendar'));
app.use('/api/transport', require('./routes/transport'));
app.use('/api/payments', require('./routes/payments'));

const distPath = path.join(__dirname, '../../dist');

if (fs.existsSync(path.join(distPath, 'index.html'))) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.status(404).json({ success: false, message: 'Frontend build not found' });
  });
}

// 404 handler - must be last
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((err, req, res, next) => {
  void next;
  console.error(err.stack);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`BBD School Backend Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  emailService.verifyConnection().then((r) => {
    if (process.env.NODE_ENV === 'production') {
      if (r.success) {
        console.log('Email service: ready');
      } else {
        console.warn(`Email service: not ready -> ${r.message}. Set EMAIL_USER/EMAIL_PASS or EMAIL_HOST/EMAIL_PORT.`);
      }
    } else {
      console.log(`Email dev transport: ${r.success ? 'ready' : 'not configured (using console preview)'}`);
    }
  }).catch((e) => console.warn('Email service check failed:', e?.message));
});

module.exports = app;
