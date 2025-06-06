"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables from .env file
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const path_1 = __importDefault(require("path"));
const database_1 = require("./config/database");
const auth_1 = __importDefault(require("./routes/auth"));
const floks_1 = __importDefault(require("./routes/floks"));
const spots_1 = __importDefault(require("./routes/spots"));
const flokouts_1 = __importDefault(require("./routes/flokouts"));
const rsvps_1 = __importDefault(require("./routes/rsvps"));
const expenses_1 = __importDefault(require("./routes/expenses"));
const attendanceRoutes_1 = __importDefault(require("./routes/attendanceRoutes"));
/**
 * Flokout API Server
 *
 * ⚠️  IMPORTANT: This API server works with existing Supabase database
 * It does NOT modify the database schema or web application
 */
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Security middleware
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false // Disable CSP for development
}));
app.use((0, compression_1.default)());
// CORS configuration
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: { error: 'Too many requests, please try again later' }
});
app.use(limiter);
// Body parsing middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Logging
app.use((0, morgan_1.default)('combined'));
// Serve static files from the public directory
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const dbConnected = await (0, database_1.checkDatabaseConnection)();
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            database: dbConnected ? 'Connected' : 'Disconnected',
            version: '1.0.0'
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            database: 'Error',
            error: 'Health check failed'
        });
    }
});
// API routes
app.use('/api/auth', auth_1.default);
app.use('/api/floks', floks_1.default);
app.use('/api/spots', spots_1.default);
app.use('/api/flokouts', flokouts_1.default);
app.use('/api/rsvps', rsvps_1.default);
app.use('/api/expenses', expenses_1.default);
app.use('/api/attendance', attendanceRoutes_1.default);
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
                members: 'GET /api/floks/:id/members',
                join: 'POST /api/floks/:id/join',
                leave: 'POST /api/floks/:id/leave',
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
            }
        }
    });
});
// Error handling middleware
app.use((err, req, res, next) => {
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
exports.default = app;
//# sourceMappingURL=app.js.map