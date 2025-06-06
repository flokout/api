-- =============================================
-- METADATA TABLE FOR FLOKOUT APP
-- =============================================

-- Create metadata table for extensible data types
CREATE TABLE IF NOT EXISTS metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('expense_category', 'activity_type', 'sport_type', 'payment_method')),
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  is_system BOOLEAN DEFAULT FALSE, -- System entries cannot be deleted
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(type, key)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_metadata_type ON metadata(type);
CREATE INDEX IF NOT EXISTS idx_metadata_active ON metadata(is_active);
CREATE INDEX IF NOT EXISTS idx_metadata_sort ON metadata(type, sort_order);

-- Enable Row Level Security (RLS)
ALTER TABLE metadata ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Everyone can read active metadata
CREATE POLICY "Everyone can read active metadata" ON metadata
  FOR SELECT USING (is_active = TRUE);

-- Only authenticated users can suggest new metadata (non-system)
CREATE POLICY "Authenticated users can insert non-system metadata" ON metadata
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND 
    is_system = FALSE
  );

-- Users can update their own non-system metadata
CREATE POLICY "Users can update their own non-system metadata" ON metadata
  FOR UPDATE USING (
    auth.uid() = created_by AND 
    is_system = FALSE
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_metadata_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update the updated_at column
CREATE TRIGGER trigger_update_metadata_updated_at
  BEFORE UPDATE ON metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_metadata_updated_at();

-- Insert default expense categories (system entries)
INSERT INTO metadata (type, key, label, icon, description, sort_order, is_system) VALUES
  -- Sports & Activity Venues
  ('expense_category', 'court', 'Court/Venue', '🏟️', 'Court rental, venue or studio booking fees', 1, TRUE),
  
  -- Equipment & Supplies
  ('expense_category', 'equipment', 'Equipment', '🎒', 'Shared sports gear, props, or tools for the activity', 2, TRUE),
  ('expense_category', 'supplies', 'Supplies', '📦', 'Consumables, printouts, or items needed for meetups', 3, TRUE),
  
  -- Food & Drink
  ('expense_category', 'food', 'Food & Drinks', '🍕', 'Snacks, meals, beverages during or after events', 4, TRUE),
  ('expense_category', 'refreshments', 'Refreshments', '☕', 'Tea, coffee, or light snacks during gatherings', 5, TRUE),

  -- Travel & Transport
  ('expense_category', 'transportation', 'Transportation', '🚗', 'Fuel, shared rides, rental vans, or public transport', 6, TRUE),
  ('expense_category', 'accommodation', 'Accommodation', '🏨', 'Hotel, homestay, or overnight lodging for trips', 7, TRUE),

  -- Admin & Digital Tools
  ('expense_category', 'booking_fee', 'Booking Fee', '💸', 'Service fees or app charges for reservations', 8, TRUE),
  ('expense_category', 'software', 'Digital Tools/Apps', '🧰', 'Tools, subscriptions, or collaboration apps', 9, TRUE),

  -- Decorations & Event Items
  ('expense_category', 'decorations', 'Decorations', '🎈', 'Party decor, lighting, table setup, etc.', 10, TRUE),
  ('expense_category', 'gifts', 'Gifts & Rewards', '🎁', 'Prizes, birthday gifts, thank-you tokens', 11, TRUE),

  -- Group Contributions
  ('expense_category', 'donation', 'Donation/Pitch-In', '🤝', 'Voluntary contributions, charity collections', 12, TRUE),
  ('expense_category', 'entry_fee', 'Entry/Participation Fee', '🎟️', 'Per person entry or participation charges', 13, TRUE),

  -- Other/Misc
  ('expense_category', 'other', 'Other', '💳', 'Uncategorized or one-off expenses', 99, TRUE)
ON CONFLICT (type, key) DO UPDATE SET
  label = EXCLUDED.label,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- Insert common activity types (system entries)
INSERT INTO metadata (type, key, label, icon, description, sort_order, is_system) VALUES
  -- Sports & Fitness
  ('activity_type', 'badminton', 'Badminton', '🏸', 'Badminton games and tournaments', 1, TRUE),
  ('activity_type', 'tennis', 'Tennis', '🎾', 'Tennis matches and practice sessions', 2, TRUE),
  ('activity_type', 'basketball', 'Basketball', '🏀', 'Basketball games and pick-up matches', 3, TRUE),
  ('activity_type', 'soccer', 'Soccer', '⚽', 'Soccer matches and training', 4, TRUE),
  ('activity_type', 'volleyball', 'Volleyball', '🏐', 'Volleyball games and tournaments', 5, TRUE),
  ('activity_type', 'table_tennis', 'Table Tennis', '🏓', 'Ping pong matches and meetups', 6, TRUE),
  ('activity_type', 'hiking', 'Hiking', '🥾', 'Nature trails, treks, and group hikes', 7, TRUE),
  ('activity_type', 'cycling', 'Cycling', '🚴', 'Group biking or motorcycle rides', 8, TRUE),
  ('activity_type', 'yoga', 'Yoga & Meditation', '🧘', 'Yoga sessions, guided meditations, and wellness meetups', 9, TRUE),

  -- Food & Social
  ('activity_type', 'dinner', 'Dinner Out', '🍽️', 'Group dinners, weekend eat-outs, or food crawls', 10, TRUE),
  ('activity_type', 'potluck', 'Potluck', '🍲', 'Potluck-style meals and food-sharing hangouts', 11, TRUE),
  ('activity_type', 'coffee_meet', 'Coffee Meet', '☕', 'Casual coffee or tea meetups', 12, TRUE),
  ('activity_type', 'bar_night', 'Bar Night', '🍻', 'Pub nights, happy hours, or drinks with friends', 13, TRUE),
  ('activity_type', 'movie_night', 'Movie Night', '🎬', 'Movie screenings at home or theaters', 14, TRUE),

  -- Learning & Collaboration
  ('activity_type', 'study_group', 'Study Group', '📚', 'Exam prep, college study sessions, or shared learning', 15, TRUE),
  ('activity_type', 'coworking', 'Co-Working', '💻', 'Remote work or shared workspace sessions', 16, TRUE),
  ('activity_type', 'jam_session', 'Creative Jam', '🎸', 'Music, art, or content creation collabs', 17, TRUE),

  -- Outdoor & Events
  ('activity_type', 'picnic', 'Picnic', '🧺', 'Parks, outdoor meals, and relaxing group picnics', 18, TRUE),
  ('activity_type', 'camping', 'Camping', '🏕️', 'Overnight camps or nature retreats', 19, TRUE),
  ('activity_type', 'festival', 'Festival/Community Event', '🎉', 'Group visits to local fests, parades, or public events', 20, TRUE),

  -- Miscellaneous
  ('activity_type', 'board_games', 'Board Games', '🎲', 'Game nights with cards or board games', 21, TRUE),
  ('activity_type', 'shopping', 'Group Shopping', '🛍️', 'Outings to malls, thrift stores, or markets', 22, TRUE),
  ('activity_type', 'other', 'Other Activity', '⚡', 'Other kinds of meetups or hangouts not listed above', 99, TRUE)
ON CONFLICT (type, key) DO UPDATE SET
  label = EXCLUDED.label,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- Insert default payment methods (system entries)
INSERT INTO metadata (type, key, label, icon, description, sort_order, is_system) VALUES
  ('payment_method', 'venmo', 'Venmo', '💜', 'Venmo payments', 1, TRUE),
  ('payment_method', 'zelle', 'Zelle', '🏦', 'Zelle bank transfers', 2, TRUE),
  ('payment_method', 'cash', 'Cash', '💵', 'Cash payments', 3, TRUE),
  ('payment_method', 'other', 'Other', '💳', 'Other payment methods', 4, TRUE)
ON CONFLICT (type, key) DO UPDATE SET
  label = EXCLUDED.label,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order; 