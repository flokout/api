import { Request, Response, NextFunction } from 'express';
/**
 * Authentication Middleware - Works with existing Supabase Auth
 *
 * ⚠️  IMPORTANT: This does NOT change authentication system
 * It validates tokens from existing Supabase auth
 */
interface AuthenticatedRequest extends Request {
    user?: {
        id: string;
        email: string;
        role?: string;
    };
}
export declare const authenticate: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requireAdmin: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
export type { AuthenticatedRequest };
//# sourceMappingURL=auth.d.ts.map