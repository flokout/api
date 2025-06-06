"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const database_1 = require("../config/database");
/**
 * Authentication Controller - Works with existing Supabase Auth
 *
 * ⚠️  IMPORTANT: This does NOT change the authentication system
 * It provides API endpoints that work with existing Supabase auth
 */
class AuthController {
    /**
     * Login with email and password
     * Uses existing Supabase auth - no database changes
     */
    static async login(req, res) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                res.status(400).json({ error: 'Email and password are required' });
                return;
            }
            // Use existing Supabase auth
            const { data, error } = await database_1.supabaseClient.auth.signInWithPassword({
                email,
                password
            });
            if (error) {
                res.status(401).json({ error: error.message });
                return;
            }
            if (!data.user || !data.session) {
                res.status(401).json({ error: 'Login failed' });
                return;
            }
            // Get user profile from existing profiles table
            const { data: profile, error: profileError } = await database_1.supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();
            if (profileError) {
                res.status(500).json({ error: 'Failed to fetch user profile' });
                return;
            }
            res.json({
                user: {
                    id: data.user.id,
                    email: data.user.email,
                    full_name: profile.full_name,
                    avatar_url: profile.avatar_url,
                    venmo_id: profile.venmo_id,
                    zelle_id: profile.zelle_id
                },
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_at: data.session.expires_at
            });
        }
        catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Register new user
     * Uses existing Supabase auth - no database changes
     */
    static async register(req, res) {
        try {
            const { email, password, full_name } = req.body;
            if (!email || !password || !full_name) {
                res.status(400).json({ error: 'Email, password, and full name are required' });
                return;
            }
            // Use existing Supabase auth
            const { data, error } = await database_1.supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name
                    }
                }
            });
            if (error) {
                res.status(400).json({ error: error.message });
                return;
            }
            if (!data.user) {
                res.status(400).json({ error: 'Registration failed' });
                return;
            }
            res.json({
                message: 'Registration successful. Please check your email for verification.',
                user: {
                    id: data.user.id,
                    email: data.user.email
                }
            });
        }
        catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Get current user profile
     * Uses existing profiles table - no database changes
     */
    static async me(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            // Get user profile from existing profiles table
            const { data: profile, error } = await database_1.supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', req.user.id)
                .single();
            if (error) {
                res.status(500).json({ error: 'Failed to fetch user profile' });
                return;
            }
            res.json({
                user: {
                    id: profile.id,
                    email: profile.email,
                    full_name: profile.full_name,
                    avatar_url: profile.avatar_url,
                    venmo_id: profile.venmo_id,
                    zelle_id: profile.zelle_id,
                    created_at: profile.created_at
                }
            });
        }
        catch (error) {
            console.error('Get user error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Update user profile
     * Uses existing profiles table - no database changes
     */
    static async updateProfile(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { full_name, email, venmo_id, zelle_id } = req.body;
            if (!full_name?.trim()) {
                res.status(400).json({ error: 'Full name is required' });
                return;
            }
            // Update user profile in existing profiles table
            const { data: updatedProfile, error } = await database_1.supabaseClient
                .from('profiles')
                .update({
                full_name: full_name.trim(),
                email: email?.trim(),
                venmo_id: venmo_id?.trim() || null,
                zelle_id: zelle_id?.trim() || null,
                updated_at: new Date().toISOString()
            })
                .eq('id', req.user.id)
                .select()
                .single();
            if (error) {
                console.error('Profile update error:', error);
                res.status(500).json({ error: 'Failed to update profile' });
                return;
            }
            res.json({
                user: {
                    id: updatedProfile.id,
                    email: updatedProfile.email,
                    full_name: updatedProfile.full_name,
                    avatar_url: updatedProfile.avatar_url,
                    venmo_id: updatedProfile.venmo_id,
                    zelle_id: updatedProfile.zelle_id,
                    created_at: updatedProfile.created_at
                }
            });
        }
        catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Logout user
     * Uses existing Supabase auth - no database changes
     */
    static async logout(req, res) {
        try {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                // Sign out from Supabase
                await database_1.supabaseClient.auth.signOut();
            }
            res.json({ message: 'Logged out successfully' });
        }
        catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Refresh access token
     * Uses existing Supabase auth - no database changes
     */
    static async refresh(req, res) {
        try {
            const { refresh_token } = req.body;
            if (!refresh_token) {
                res.status(400).json({ error: 'Refresh token is required' });
                return;
            }
            const { data, error } = await database_1.supabaseClient.auth.refreshSession({
                refresh_token
            });
            if (error) {
                res.status(401).json({ error: error.message });
                return;
            }
            if (!data.session) {
                res.status(401).json({ error: 'Token refresh failed' });
                return;
            }
            res.json({
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_at: data.session.expires_at
            });
        }
        catch (error) {
            console.error('Token refresh error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
exports.AuthController = AuthController;
//# sourceMappingURL=authController.js.map