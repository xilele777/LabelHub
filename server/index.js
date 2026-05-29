const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');

// Middleware
const responseMiddleware = require('./middleware/response');
const requestId = require('./middleware/requestId');
const securityHeaders = require('./middleware/securityHeaders');
const { authMiddleware } = require('./middleware/auth');

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const taskRoutes = require('./routes/tasks');
const templateRoutes = require('./routes/templates');
const annotationItemRoutes = require('./routes/annotationItems');
const reviewRoutes = require('./routes/reviews');
const assignmentRoutes = require('./routes/assignments');
const notificationRoutes = require('./routes/notifications');

// Notification Service (WebSocket)
const { initNotificationService } = require('./services/notificationService');
const { startTimelinessReminderService } = require('./services/timelinessReminderService');

// DB
const db = require('./store/db');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);

function buildCorsOptions() {
  const configuredOrigins = process.env.CORS_ORIGIN || process.env.CORS_ORIGINS;
  if (configuredOrigins) {
    const allowList = configuredOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    return {
      origin(origin, callback) {
        if (!origin || allowList.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`CORS origin blocked: ${origin}`));
      },
      credentials: true,
    };
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('CORS_ORIGIN is required when NODE_ENV=production');
  }

  return {
    origin: true,
    credentials: true,
  };
}

// ─── Global middleware ────────────────────────────────────
app.use(requestId);                       // Correlate requests across logs and responses
app.use(securityHeaders);                 // Basic hardening headers
app.use(cors(buildCorsOptions()));        // Allow configured frontend origins
app.use(responseMiddleware);              // Unified response helpers (MUST be before json parser so res.fail is always available)
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(authMiddleware);                  // Attach currentUser to req

// ─── Auto-seed on first run ────────────────────────────────
if (!db.isSeeded()) {
  console.log('🔄 Database is empty, running seed...');
  require('./seed');
}

// ─── Routes ───────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/annotation-items', annotationItemRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', assignmentRoutes);

// ─── Health check ─────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.success({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    collections: {
      users: db.count('users'),
      tasks: db.count('tasks'),
      templates: db.count('templates'),
      annotationItems: db.count('annotation-items'),
      reviews: db.count('reviews'),
    },
  });
});

// ─── 404 fallback ─────────────────────────────────────────
app.use('/api', (req, res) => {
  res.notFound(`API route not found: ${req.method} ${req.originalUrl}`);
});

// ─── Global error handler ─────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  // res.fail may not be available if error occurred before responseMiddleware
  if (typeof res.fail === 'function') {
    res.fail(err.message || '服务器内部错误', 500);
  } else {
    res.status(500).json({ code: 500, message: err.message || '服务器内部错误', data: null });
  }
});

// ─── Start server ─────────────────────────────────────────
server.listen(PORT, () => {
  // 初始化 WebSocket 通知服务
  initNotificationService(server);
  startTimelinessReminderService();

  console.log('');
  console.log('🚀 LabelHub Backend Server');
  console.log(`   URL:  http://localhost:${PORT}`);
  console.log(`   API:  http://localhost:${PORT}/api`);
  console.log(`   WS:   http://localhost:${PORT}/socket.io/`);
  console.log('');
  console.log('📌 Available endpoints:');
  console.log('   POST /api/auth/login');
  console.log('   GET  /api/auth/me');
  console.log('   CRUD /api/users');
  console.log('   CRUD /api/tasks');
  console.log('   CRUD /api/templates');
  console.log('   CRUD /api/annotation-items  (+ save-draft, submit, approve, reject, resubmit)');
  console.log('   CRUD /api/reviews           (+ by-item/:dataItemId, by-task/:taskId)');
  console.log('   POST /api/tasks/:id/assign  (+ clear, stats, items)');
  console.log('   GET  /api/assignments/annotators');
  console.log('   GET  /api/health');
  console.log('');
  console.log('🔔 Real-time notifications:');
  console.log('   review_approved    - 审核通过通知（→ 标注员）');
  console.log('   review_rejected    - 审核驳回通知（→ 标注员）');
  console.log('   task_assigned      - 任务分配通知（→ 标注员）');
  console.log('   task_submitted     - 标注提交通知（→ 审核员）');
  console.log('   task_resubmitted   - 标注重新提交通知（→ 审核员）');
  console.log('   ai_review_complete - AI预审完成通知（→ 审核员）');
  console.log('');
});
