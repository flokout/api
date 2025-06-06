import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
/**
 * Authentication Controller - Works with existing Supabase Auth
 *
 * ⚠️  IMPORTANT: This does NOT change the authentication system
 * It provides API endpoints that work with existing Supabase auth
 */
export declare class AuthController {
    /**
     * Login with email and password
     * Uses existing Supabase auth - no database changes
     */
    static login(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Register new user
     * Uses existing Supabase auth - no database changes
     */
    static register(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get current user profile
     * Uses existing profiles table - no database changes
     */
    static me(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Update user profile
     * Uses existing profiles table - no database changes
     */
    static updateProfile(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Logout user
     * Uses existing Supabase auth - no database changes
     */
    static logout(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Refresh access token
     * Uses existing Supabase auth - no database changes
     */
    static refresh(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=authController.d.ts.map