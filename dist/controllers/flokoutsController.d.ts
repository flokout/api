import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
/**
 * Flokouts Controller - Events Management
 */
export declare class FlokoutsController {
    /**
     * Get flokouts with optional filters
     */
    static getFlokouts(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Create new flokout
     */
    static createFlokout(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get flokout by ID
     */
    static getFlokoutById(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Update flokout
     */
    static updateFlokout(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Delete flokout
     */
    static deleteFlokout(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Update flokout status
     */
    static updateFlokoutStatus(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Confirm flokout (change status to confirmed)
     */
    static confirmFlokout(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get flokouts for specific flok
     */
    static getFlokoutsByFlok(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get user's created flokouts
     */
    static getUserCreatedFlokouts(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get flokouts user is attending
     */
    static getUserAttendingFlokouts(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=flokoutsController.d.ts.map