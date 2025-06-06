"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDatabaseConnection = exports.supabaseClient = exports.supabaseAdmin = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
/**
 * Database Configuration - Uses existing Supabase setup
 *
 * ⚠️  IMPORTANT: This does NOT modify the existing database
 * It only creates API connections to the existing Supabase instance
 */
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    throw new Error('Missing required Supabase environment variables');
}
// Service role client for admin operations (bypasses RLS)
exports.supabaseAdmin = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
// Public client for user operations (respects RLS)
exports.supabaseClient = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true
    }
});
// Health check function
const checkDatabaseConnection = async () => {
    try {
        const { data, error } = await exports.supabaseClient
            .from('profiles')
            .select('count')
            .limit(1);
        return !error;
    }
    catch (error) {
        console.error('Database connection failed:', error);
        return false;
    }
};
exports.checkDatabaseConnection = checkDatabaseConnection;
//# sourceMappingURL=database.js.map