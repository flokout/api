-- Fix Expenses Table Schema for Production
-- This ensures the expenses table matches what the API expects

-- Check if expenses table exists and fix schema
DO $$
BEGIN
    -- Create expenses table if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
        CREATE TABLE expenses (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            flok_id UUID NOT NULL, -- This field actually stores flokout_id (confusing naming)
            amount DECIMAL(10,2) NOT NULL,
            description TEXT,
            category TEXT DEFAULT 'other',
            paid_by UUID NOT NULL REFERENCES profiles(id),
            created_by UUID NOT NULL REFERENCES profiles(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Add indexes
        CREATE INDEX IF NOT EXISTS idx_expenses_flok_id ON expenses(flok_id);
        CREATE INDEX IF NOT EXISTS idx_expenses_paid_by ON expenses(paid_by);
        CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);
        CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);
        
        RAISE NOTICE 'Created expenses table';
    END IF;

    -- Add missing columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'flok_id') THEN
        ALTER TABLE expenses ADD COLUMN flok_id UUID;
        RAISE NOTICE 'Added flok_id column to expenses table';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'category') THEN
        ALTER TABLE expenses ADD COLUMN category TEXT DEFAULT 'other';
        RAISE NOTICE 'Added category column to expenses table';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'paid_by') THEN
        ALTER TABLE expenses ADD COLUMN paid_by UUID REFERENCES profiles(id);
        RAISE NOTICE 'Added paid_by column to expenses table';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'created_by') THEN
        ALTER TABLE expenses ADD COLUMN created_by UUID REFERENCES profiles(id);
        RAISE NOTICE 'Added created_by column to expenses table';
    END IF;
END
$$;

-- Create expense_shares table if it doesn't exist
CREATE TABLE IF NOT EXISTS expense_shares (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),
    amount DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verifying', 'settled')),
    settled_at TIMESTAMP WITH TIME ZONE,
    settled_by UUID REFERENCES profiles(id),
    payment_method TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(expense_id, user_id)
);

-- Add indexes for expense_shares
CREATE INDEX IF NOT EXISTS idx_expense_shares_expense_id ON expense_shares(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_shares_user_id ON expense_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_expense_shares_status ON expense_shares(status);

-- Add Row Level Security (RLS) policies
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_shares ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view expenses from their floks" ON expenses;
DROP POLICY IF EXISTS "Users can create expenses for their floks" ON expenses;
DROP POLICY IF EXISTS "Users can update their own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can view their expense shares" ON expense_shares;
DROP POLICY IF EXISTS "Users can create expense shares" ON expense_shares;
DROP POLICY IF EXISTS "Users can update their own expense shares" ON expense_shares;

-- Create RLS policies for expenses
CREATE POLICY "Users can view expenses from their floks" ON expenses
    FOR SELECT USING (
        flok_id IN (
            SELECT flokouts.id FROM flokouts
            JOIN flokmates ON flokouts.flok_id = flokmates.flok_id
            WHERE flokmates.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create expenses for their floks" ON expenses
    FOR INSERT WITH CHECK (
        flok_id IN (
            SELECT flokouts.id FROM flokouts
            JOIN flokmates ON flokouts.flok_id = flokmates.flok_id
            WHERE flokmates.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own expenses" ON expenses
    FOR UPDATE USING (created_by = auth.uid() OR paid_by = auth.uid());

-- Create RLS policies for expense_shares
CREATE POLICY "Users can view their expense shares" ON expense_shares
    FOR SELECT USING (
        user_id = auth.uid() OR 
        expense_id IN (
            SELECT id FROM expenses WHERE created_by = auth.uid() OR paid_by = auth.uid()
        )
    );

CREATE POLICY "Users can create expense shares" ON expense_shares
    FOR INSERT WITH CHECK (
        expense_id IN (
            SELECT id FROM expenses WHERE created_by = auth.uid()
        )
    );

CREATE POLICY "Users can update their own expense shares" ON expense_shares
    FOR UPDATE USING (
        user_id = auth.uid() OR 
        expense_id IN (
            SELECT id FROM expenses WHERE created_by = auth.uid() OR paid_by = auth.uid()
        )
    );

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_expenses_updated_at ON expenses;
CREATE TRIGGER update_expenses_updated_at 
    BEFORE UPDATE ON expenses 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_expense_shares_updated_at ON expense_shares;
CREATE TRIGGER update_expense_shares_updated_at 
    BEFORE UPDATE ON expense_shares 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Refresh schema cache
NOTIFY pgrst, 'reload schema'; 