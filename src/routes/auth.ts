import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

/**
 * Authentication Routes - Works with existing Supabase Auth
 * 
 * ⚠️  IMPORTANT: These routes use existing authentication system
 * No database schema changes required
 */

const router = Router();

// Public routes (no authentication required)
router.post('/login', AuthController.login);
router.post('/register', AuthController.register);
router.post('/refresh', AuthController.refresh);

// Protected routes (authentication required)
router.get('/me', authenticate, AuthController.me);
router.put('/profile', authenticate, AuthController.updateProfile);
router.post('/logout', authenticate, AuthController.logout);

export default router; 