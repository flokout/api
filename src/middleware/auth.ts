import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabaseAdmin, supabaseClient } from '../config/database';

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

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase (no database changes)
    const { data: { user }, error } = await supabaseClient.auth.getUser(token);
    
    if (error || !user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    // Get user profile from existing profiles table
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) {
      res.status(401).json({ error: 'User profile not found' });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email || '',
      role: profile?.role || 'user'
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

export const requireAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Check if user is superadmin using existing table
  const { data: superadmin, error } = await supabaseClient
    .from('superadmin_users')
    .select('*')
    .eq('user_id', req.user.id)
    .single();

  if (error || !superadmin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
};

export type { AuthenticatedRequest }; 