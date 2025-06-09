import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { checkDatabaseConnection } from './config/database';
import authRoutes from './routes/auth';
import floksRoutes from './routes/floks';
import spotsRoutes from './routes/spots';
import flokoutsRoutes from './routes/flokouts';
import rsvpsRoutes from './routes/rsvps';
import expensesRoutes from './routes/expenses';
import attendanceRoutes from './routes/attendanceRoutes';
import notificationsRoutes from './routes/notifications';
import feedbackRoutes from './routes/feedback';
import metadataRoutes from './routes/metadata';

/**
 * Flokout API Server
 * 
 * ⚠️  IMPORTANT: This API server works with existing Supabase database
 * It does NOT modify the database schema or web application
 */

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable CSP for development
}));
app.use(compression());

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: { error: 'Too many requests, please try again later' }
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan('combined'));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbConnected = await checkDatabaseConnection();
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: dbConnected ? 'Connected' : 'Disconnected',
      version: '1.0.0'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      database: 'Error',
      error: 'Health check failed'
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/floks', floksRoutes);
app.use('/api/spots', spotsRoutes);
app.use('/api/flokouts', flokoutsRoutes);
app.use('/api/rsvps', rsvpsRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/metadata', metadataRoutes);

// API base endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Flokout API Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: {
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        me: 'GET /api/auth/me',
        logout: 'POST /api/auth/logout',
        refresh: 'POST /api/auth/refresh'
      },
      floks: {
        list: 'GET /api/floks',
        create: 'POST /api/floks',
        get: 'GET /api/floks/:id',
        update: 'PUT /api/floks/:id',
        delete: 'DELETE /api/floks/:id',
        reactivate: 'PUT /api/floks/:id/reactivate',
        purge: 'DELETE /api/floks/:id/purge',
        members: 'GET /api/floks/:id/members',
        join: 'POST /api/floks/:id/join',
        leave: 'POST /api/floks/:id/leave',
        associateSpot: 'POST /api/floks/:id/spots',
        disassociateSpot: 'DELETE /api/floks/:id/spots/:spotId',
        createInvite: 'POST /api/floks/:id/invites',
        getInvites: 'GET /api/floks/:id/invites'
      },
      spots: {
        list: 'GET /api/spots',
        create: 'POST /api/spots',
        get: 'GET /api/spots/:id',
        update: 'PUT /api/spots/:id',
        delete: 'DELETE /api/spots/:id',
        search: 'GET /api/spots/search/:query',
        byFlok: 'GET /api/spots/flok/:flokId'
      },
      flokouts: {
        list: 'GET /api/flokouts',
        create: 'POST /api/flokouts',
        get: 'GET /api/flokouts/:id',
        update: 'PUT /api/flokouts/:id',
        delete: 'DELETE /api/flokouts/:id',
        updateStatus: 'PUT /api/flokouts/:id/status',
        confirm: 'POST /api/flokouts/:id/confirm',
        byFlok: 'GET /api/flokouts/flok/:flokId',
        userCreated: 'GET /api/flokouts/user/created',
        userAttending: 'GET /api/flokouts/user/attending'
      },
      rsvps: {
        createUpdate: 'POST /api/rsvps/flokout/:flokoutId',
        getForFlokout: 'GET /api/rsvps/flokout/:flokoutId',
        remove: 'DELETE /api/rsvps/flokout/:flokoutId',
        getUserRSVPs: 'GET /api/rsvps/user/rsvps',
        getUserRSVPForFlokout: 'GET /api/rsvps/user/rsvp/:flokoutId'
      },
      expenses: {
        list: 'GET /api/expenses',
        create: 'POST /api/expenses',
        get: 'GET /api/expenses/:id',
        update: 'PUT /api/expenses/:id',
        delete: 'DELETE /api/expenses/:id',
        getShares: 'GET /api/expenses/:expenseId/shares',
        settleUpCalculate: 'GET /api/expenses/settle-up/calculate',
        markAsSent: 'POST /api/expenses/settle-up/mark-sent',
        markAsReceived: 'POST /api/expenses/settle-up/mark-received'
      },
      attendance: {
        markAttendance: 'POST /api/attendance/flokout/:flokoutId/mark',
        getFlokoutAttendance: 'GET /api/attendance/flokout/:flokoutId',
        getUserHistory: 'GET /api/attendance/user/history',
        bulkMark: 'POST /api/attendance/flokout/:flokoutId/bulk'
      },
      notifications: {
        list: 'GET /api/notifications',
        unreadCount: 'GET /api/notifications/unread-count',
        markAsRead: 'PUT /api/notifications/:id/read',
        markAllAsRead: 'PUT /api/notifications/mark-all-read',
        create: 'POST /api/notifications/create',
        delete: 'DELETE /api/notifications/:id'
      },
      feedback: {
        submit: 'POST /api/feedback',
        list: 'GET /api/feedback',
        get: 'GET /api/feedback/:id',
        update: 'PUT /api/feedback/:id',
        delete: 'DELETE /api/feedback/:id',
        admin: 'GET /api/feedback/admin/all'
      },
      metadata: {
        list: 'GET /api/metadata',
        create: 'POST /api/metadata',
        get: 'GET /api/metadata/:id',
        update: 'PUT /api/metadata/:id',
        delete: 'DELETE /api/metadata/:id'
      }
    }
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Flokout API Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 API base: http://localhost:${PORT}/api`);
  console.log(`🔧 API Test Interface: http://localhost:${PORT}/test-api.html`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

export default app; 