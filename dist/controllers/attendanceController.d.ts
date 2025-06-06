import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
/**
 * Attendance Controller - Track who actually attended flokouts
 */
export declare class AttendanceController {
    /**
     * Mark user as attended for a flokout
     */
    static markAttendance(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get attendance for a flokout
     */
    static getFlokoutAttendance(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get user's attendance history
     */
    static getUserAttendance(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Bulk mark attendance for a flokout (admin only)
     */
    static bulkMarkAttendance(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=attendanceController.d.ts.map