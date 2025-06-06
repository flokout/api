import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
export const supabaseAdmin: SupabaseClient = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Public client for user operations (respects RLS)
export const supabaseClient: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true
    }
  }
);

// Health check function
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('count')
      .limit(1);
    
    return !error;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}; 