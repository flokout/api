"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.authenticate = void 0;
const database_1 = require("../config/database");
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ error: 'No token provided' });
            return;
        }
        const token = authHeader.substring(7);
        // Verify token with Supabase (no database changes)
        const { data: { user }, error } = await database_1.supabaseClient.auth.getUser(token);
        if (error || !user) {
            res.status(401).json({ error: 'Invalid token' });
            return;
        }
        // Get user profile from existing profiles table
        const { data: profile, error: profileError } = await database_1.supabaseClient
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
    }
    catch (error) {
        console.error('Authentication error:', error);
        res.status(401).json({ error: 'Authentication failed' });
    }
};
exports.authenticate = authenticate;
const requireAdmin = async (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    // Check if user is superadmin using existing table
    const { data: superadmin, error } = await database_1.supabaseClient
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
exports.requireAdmin = requireAdmin;
//# sourceMappingURL=auth.js.map