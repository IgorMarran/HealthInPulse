const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const path       = require('path');
const fs         = require('fs');

const authRoutes         = require('./routes/authRoutes');
const patientRoutes      = require('./routes/patientRoutes');
const doctorRoutes       = require('./routes/doctorRoutes');
const examRoutes         = require('./routes/examRoutes');
const triageRoutes       = require('./routes/triageRoutes');
const { router: notifRouter }       = require('./routes/notificationRoutes');
const { router: aiReportRouter }    = require('./routes/aiReportRoutes');
const { router: appointmentRouter } = require('./routes/appointmentRoutes');
const { router: wearableRouter }    = require('./routes/wearableRoutes');
const goalRoutes    = require('./routes/goalRoutes');
const rewardRoutes  = require('./routes/rewardRoutes');
const errorMiddleware = require('./middlewares/errorMiddleware');
const logger = require('./utils/logger');

const app = express();

// Atrás de proxy reverso (Render, Railway, Nginx) o IP real vem no
// X-Forwarded-For; sem isso o rate limit trata todo mundo como um IP só.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

// ─── segurança ───────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// ─── rate limiting (somente em produção) ─────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use('/api/auth', rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    // Numa sala de aula todo mundo sai pelo mesmo IP: suba via env na demo
    max: Number(process.env.AUTH_RATE_LIMIT) || 30,
    message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  }));
}

// ─── parsing ─────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── logging HTTP ────────────────────────────────────────────
app.use(morgan(
  process.env.NODE_ENV === 'development' ? 'dev' : 'combined',
  { stream: { write: (msg) => logger.http(msg.trim()) } },
));

// ─── arquivos estáticos (uploads) ────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── rotas ───────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/patient',       patientRoutes);
app.use('/api/doctor',        doctorRoutes);
app.use('/api/exams',         examRoutes);
app.use('/api/triage',        triageRoutes);
app.use('/api/notifications', notifRouter);
app.use('/api/ai-reports',    aiReportRouter);
app.use('/api/appointments',  appointmentRouter);
app.use('/api/wearables',     wearableRouter);
app.use('/api/goals',         goalRoutes);
app.use('/api/rewards',       rewardRoutes);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// ─── frontend (build de produção) ────────────────────────────
// Em produção o backend serve o build do Vite: um processo, uma porta, sem CORS.
// Em dev esta pasta não existe e o Vite (5173) serve o frontend.
const FRONTEND_DIST = process.env.FRONTEND_DIST
  || path.join(__dirname, '..', '..', 'frontend', 'dist');

if (fs.existsSync(path.join(FRONTEND_DIST, 'index.html'))) {
  app.use(express.static(FRONTEND_DIST, { index: false }));
  // Rotas do React Router (/patient/..., /doctor/...) caem no index.html
  app.get(/^\/(?!(api|uploads|socket\.io)(\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

// Rota não encontrada
app.use((_req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

// ─── erro global ─────────────────────────────────────────────
app.use(errorMiddleware);

module.exports = app;
