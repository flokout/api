"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_1 = require("../controllers/authController");
const auth_1 = require("../middleware/auth");
/**
 * Authentication Routes - Works with existing Supabase Auth
 *
 * ⚠️  IMPORTANT: These routes use existing authentication system
 * No database schema changes required
 */
const router = (0, express_1.Router)();
// Public routes (no authentication required)
router.post('/login', authController_1.AuthController.login);
router.post('/register', authController_1.AuthController.register);
router.post('/refresh', authController_1.AuthController.refresh);
// Protected routes (authentication required)
router.get('/me', auth_1.authenticate, authController_1.AuthController.me);
router.put('/profile', auth_1.authenticate, authController_1.AuthController.updateProfile);
router.post('/logout', auth_1.authenticate, authController_1.AuthController.logout);
exports.default = router;
//# sourceMappingURL=auth.js.map