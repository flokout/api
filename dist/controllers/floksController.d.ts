import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
/**
 * Floks Controller - Groups/Communities Management
 */
export declare class FloksController {
    /**
     * Get user's floks
     */
    static getUserFloks(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Create new flok
     */
    static createFlok(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get flok by ID
     */
    static getFlokById(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Update flok
     */
    static updateFlok(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Delete flok
     */
    static deleteFlok(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get flok members
     */
    static getFlokMembers(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Join flok with invite code
     */
    static joinFlok(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Leave flok
     */
    static leaveFlok(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Remove member (admin only)
     */
    static removeMember(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Update member role (admin only)
     */
    static updateMemberRole(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Create invite code
     */
    static createInvite(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get flok invites
     */
    static getFlokInvites(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Delete invite
     */
    static deleteInvite(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Deactivate invite by code
     */
    static deactivateInvite(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Verify invite code and get flok details (without joining)
     */
    static verifyInvite(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Associate spot with flok
     */
    static associateSpot(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Disassociate spot from flok
     */
    static disassociateSpot(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Reactivate flok
     */
    static reactivateFlok(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Permanently delete flok and associated data (purge)
     * Preserves: spots (reusable), user profiles (owned by users)
     * Deletes: flokouts, flok_spots associations, flokmates, invites, flok record
     */
    static purgeFlok(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=floksController.d.ts.map