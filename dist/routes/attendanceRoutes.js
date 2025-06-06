"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const attendanceController_1 = require("../controllers/attendanceController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Apply authentication to all routes
router.use(auth_1.authenticate);
/**
 * Attendance Routes
 * Endpoints for tracking actual attendance at flokouts
 */
// Mark attendance for a user
router.post('/flokout/:flokoutId/mark', attendanceController_1.AttendanceController.markAttendance);
// Get attendance for a flokout
router.get('/flokout/:flokoutId', attendanceController_1.AttendanceController.getFlokoutAttendance);
// Get user's attendance history
router.get('/user/history', attendanceController_1.AttendanceController.getUserAttendance);
// Bulk mark attendance (admin only)
router.post('/flokout/:flokoutId/bulk', attendanceController_1.AttendanceController.bulkMarkAttendance);
exports.default = router;
//# sourceMappingURL=attendanceRoutes.js.map