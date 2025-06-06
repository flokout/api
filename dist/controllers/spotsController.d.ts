import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
/**
 * Spots Controller - Locations/Venues Management
 */
export declare class SpotsController {
    /**
     * Get spots with optional flok filter
     */
    static getSpots(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Create new spot
     */
    static createSpot(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get spot by ID
     */
    static getSpotById(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Update spot
     */
    static updateSpot(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Delete spot
     */
    static deleteSpot(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Search spots by name or address
     */
    static searchSpots(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get spots for specific flok
     */
    static getSpotsByFlok(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=spotsController.d.ts.map