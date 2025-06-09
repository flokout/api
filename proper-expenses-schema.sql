-- PROPER Expenses Schema for Global Expense Tracking
-- This fixes the confusing schema and enables global expense management

-- First, let's understand the correct relationships:
-- Floks (groups) → Flokouts (events) → Expenses → Expense_Shares (who owes what)

-- 1. Fix the expenses table with proper naming and relationships
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS expense_shares CASCADE;

-- Create expenses table with CORRECT relationships
CREATE TABLE expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    flokout_id UUID NOT NULL REFERENCES flokouts(id) ON DELETE CASCADE, -- Direct flokout reference
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    category TEXT DEFAULT 'other' CHECK (category IN (
        'court', 'equipment', 'supplies', 'food', 'refreshments', 
        'transportation', 'accommodation', 'booking_fee', 'software',
        'decorations', 'gifts', 'donation', 'entry_fee', 'other'
    )),
    paid_by UUID NOT NULL REFERENCES profiles(id),
    created_by UUID NOT NULL REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create expense_shares table for tracking who owes what
CREATE TABLE expense_shares (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verifying', 'settled')),
    settled_at TIMESTAMP WITH TIME ZONE,
    settled_by UUID REFERENCES profiles(id),
    payment_method TEXT CHECK (payment_method IN ('venmo', 'zelle', 'cash', 'other')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(expense_id, user_id)
);

-- Add proper indexes for performance
CREATE INDEX idx_expenses_flokout_id ON expenses(flokout_id);
CREATE INDEX idx_expenses_paid_by ON expenses(paid_by);
CREATE INDEX idx_expenses_created_by ON expenses(created_by);
CREATE INDEX idx_expenses_created_at ON expenses(created_at DESC);
CREATE INDEX idx_expenses_category ON expenses(category);

CREATE INDEX idx_expense_shares_expense_id ON expense_shares(expense_id);
CREATE INDEX idx_expense_shares_user_id ON expense_shares(user_id);
CREATE INDEX idx_expense_shares_status ON expense_shares(status);
CREATE INDEX idx_expense_shares_amount ON expense_shares(amount);

-- Add Row Level Security
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_shares ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Users can view expenses from their floks" ON expenses;
DROP POLICY IF EXISTS "Users can create expenses for their floks" ON expenses;
DROP POLICY IF EXISTS "Users can update their own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can view their expense shares" ON expense_shares;
DROP POLICY IF EXISTS "Users can create expense shares" ON expense_shares;
DROP POLICY IF EXISTS "Users can update their own expense shares" ON expense_shares;

-- Create RLS policies for expenses
CREATE POLICY "Users can view expenses from their floks" ON expenses
    FOR SELECT USING (
        flokout_id IN (
            SELECT flokouts.id FROM flokouts
            JOIN flokmates ON flokouts.flok_id = flokmates.flok_id
            WHERE flokmates.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create expenses for their floks" ON expenses
    FOR INSERT WITH CHECK (
        flokout_id IN (
            SELECT flokouts.id FROM flokouts
            JOIN flokmates ON flokouts.flok_id = flokmates.flok_id
            WHERE flokmates.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own expenses" ON expenses
    FOR UPDATE USING (
        created_by = auth.uid() OR 
        paid_by = auth.uid() OR
        flokout_id IN (
            SELECT flokouts.id FROM flokouts
            JOIN flokmates ON flokouts.flok_id = flokmates.flok_id
            WHERE flokmates.user_id = auth.uid() AND flokmates.role = 'admin'
        )
    );

-- Create RLS policies for expense_shares
CREATE POLICY "Users can view their expense shares" ON expense_shares
    FOR SELECT USING (
        user_id = auth.uid() OR 
        expense_id IN (
            SELECT expenses.id FROM expenses 
            WHERE expenses.created_by = auth.uid() OR expenses.paid_by = auth.uid()
        ) OR
        expense_id IN (
            SELECT expenses.id FROM expenses
            JOIN flokouts ON expenses.flokout_id = flokouts.id
            JOIN flokmates ON flokouts.flok_id = flokmates.flok_id
            WHERE flokmates.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create expense shares" ON expense_shares
    FOR INSERT WITH CHECK (
        expense_id IN (
            SELECT expenses.id FROM expenses 
            WHERE expenses.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can update their own expense shares" ON expense_shares
    FOR UPDATE USING (
        user_id = auth.uid() OR 
        expense_id IN (
            SELECT expenses.id FROM expenses 
            WHERE expenses.created_by = auth.uid() OR expenses.paid_by = auth.uid()
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

CREATE TRIGGER update_expenses_updated_at 
    BEFORE UPDATE ON expenses 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expense_shares_updated_at 
    BEFORE UPDATE ON expense_shares 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for global expense management

-- View: User's global expense summary across all floks
CREATE OR REPLACE VIEW user_expense_summary AS
SELECT 
    u.id as user_id,
    u.full_name,
    u.email,
    COALESCE(SUM(CASE WHEN es.status IN ('pending', 'verifying') THEN es.amount ELSE 0 END), 0) as total_owes,
    COALESCE(SUM(CASE WHEN e.paid_by = u.id AND es.status IN ('pending', 'verifying') AND es.user_id != u.id THEN es.amount ELSE 0 END), 0) as total_owed_to_them,
    COALESCE(SUM(CASE WHEN es.status = 'settled' THEN es.amount ELSE 0 END), 0) as total_settled
FROM profiles u
LEFT JOIN expense_shares es ON u.id = es.user_id
LEFT JOIN expenses e ON es.expense_id = e.id
GROUP BY u.id, u.full_name, u.email;

-- View: Net balances between users (for settle up)
CREATE OR REPLACE VIEW user_net_balances AS
WITH user_debts AS (
    -- What each user owes to others
    SELECT 
        es.user_id as debtor_id,
        e.paid_by as creditor_id,
        SUM(es.amount) as amount_owed
    FROM expense_shares es
    JOIN expenses e ON es.expense_id = e.id
    WHERE es.status IN ('pending', 'verifying')
    AND es.user_id != e.paid_by
    GROUP BY es.user_id, e.paid_by
),
net_amounts AS (
    -- Calculate net amounts between each pair of users
    SELECT 
        LEAST(d1.debtor_id, d1.creditor_id) as user1_id,
        GREATEST(d1.debtor_id, d1.creditor_id) as user2_id,
        COALESCE(d1.amount_owed, 0) - COALESCE(d2.amount_owed, 0) as net_amount
    FROM user_debts d1
    FULL OUTER JOIN user_debts d2 ON d1.debtor_id = d2.creditor_id AND d1.creditor_id = d2.debtor_id
    WHERE d1.debtor_id < d1.creditor_id OR d2.debtor_id IS NULL
)
SELECT 
    user1_id,
    user2_id,
    CASE 
        WHEN net_amount > 0 THEN user1_id
        ELSE user2_id
    END as creditor_id,
    CASE 
        WHEN net_amount > 0 THEN user2_id
        ELSE user1_id
    END as debtor_id,
    ABS(net_amount) as amount
FROM net_amounts
WHERE ABS(net_amount) > 0.01; -- Ignore tiny amounts due to rounding

-- View: Expense details with all related information
CREATE OR REPLACE VIEW expense_details AS
SELECT 
    e.id,
    e.flokout_id,
    e.amount,
    e.description,
    e.category,
    e.created_at,
    e.updated_at,
    -- Payer info
    payer.id as payer_id,
    payer.full_name as payer_name,
    payer.email as payer_email,
    -- Creator info
    creator.id as creator_id,
    creator.full_name as creator_name,
    creator.email as creator_email,
    -- Flokout info
    f.title as flokout_title,
    f.date as flokout_date,
    f.status as flokout_status,
    -- Flok info
    fl.id as flok_id,
    fl.name as flok_name,
    -- Spot info
    s.id as spot_id,
    s.name as spot_name,
    s.address as spot_address
FROM expenses e
JOIN profiles payer ON e.paid_by = payer.id
JOIN profiles creator ON e.created_by = creator.id
JOIN flokouts f ON e.flokout_id = f.id
JOIN floks fl ON f.flok_id = fl.id
LEFT JOIN spots s ON f.spot_id = s.id;

-- Grant permissions
GRANT SELECT ON user_expense_summary TO authenticated;
GRANT SELECT ON user_net_balances TO authenticated;
GRANT SELECT ON expense_details TO authenticated;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema'; 