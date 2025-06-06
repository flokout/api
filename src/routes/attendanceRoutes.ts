import { Router } from 'express';
import { AttendanceController } from '../controllers/attendanceController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * Attendance Routes
 * Endpoints for tracking actual attendance at flokouts
 */

// Mark attendance for a user
router.post('/flokout/:flokoutId/mark', AttendanceController.markAttendance);

// Get attendance for a flokout
router.get('/flokout/:flokoutId', AttendanceController.getFlokoutAttendance);

// Get user's attendance history
router.get('/user/history', AttendanceController.getUserAttendance);

// Bulk mark attendance (admin only)
router.post('/flokout/:flokoutId/bulk', AttendanceController.bulkMarkAttendance);

export default router; 