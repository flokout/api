import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
/**
 * RSVPs Controller - Attendance Management for Flokouts
 */
export declare class RSVPsController {
    /**
     * Create or update RSVP for a flokout
     */
    static createOrUpdateRSVP(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get all RSVPs for a flokout
     */
    static getFlokoutRSVPs(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Remove RSVP for a flokout
     */
    static removeRSVP(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get user's RSVPs
     */
    static getUserRSVPs(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get user's RSVP for specific flokout
     */
    static getUserRSVPForFlokout(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=rsvpsController.d.ts.map