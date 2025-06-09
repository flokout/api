"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpensesController = void 0;
const database_1 = require("../config/database");
const pushNotificationService_1 = require("../services/pushNotificationService");
/**
 * Expenses Controller - Complete Expense Management with Global Tracking
 */
class ExpensesController {
    /**
     * Get expenses with optional filters - supports global view across all floks
     */
    static async getExpenses(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            console.log('📊 Getting expenses for user:', req.user.id);
            const { flok_id, flokout_id, limit = 50, offset = 0, category, global = false } = req.query;
            // Get user's floks to filter expenses
            const { data: userFloks, error: floksError } = await database_1.supabaseClient
                .from('flokmates')
                .select('flok_id')
                .eq('user_id', req.user.id);
            if (floksError) {
                console.error('Error fetching user floks:', floksError);
                res.status(500).json({ error: 'Failed to fetch user floks' });
                return;
            }
            const userFlokIds = userFloks?.map(f => f.flok_id) || [];
            console.log('📊 User flok IDs:', userFlokIds);
            if (userFlokIds.length === 0) {
                res.json({ expenses: [] });
                return;
            }
            // Get flokouts from user's floks
            let flokoutsQuery = database_1.supabaseClient
                .from('flokouts')
                .select('id')
                .in('flok_id', userFlokIds);
            // Filter by specific flok if requested
            if (flok_id) {
                flokoutsQuery = flokoutsQuery.eq('flok_id', flok_id);
            }
            const { data: userFlokouts, error: flokoutsError } = await flokoutsQuery;
            if (flokoutsError) {
                console.error('Error fetching flokouts:', flokoutsError);
                res.status(500).json({ error: 'Failed to fetch flokouts' });
                return;
            }
            const flokoutIds = userFlokouts?.map(f => f.id) || [];
            console.log('📊 Flokout IDs:', flokoutIds.length);
            if (flokoutIds.length === 0) {
                res.json({ expenses: [] });
                return;
            }
            // Build the expenses query using proper flokout_id field
            let expensesQuery = database_1.supabaseClient
                .from('expenses')
                .select('*')
                .in('flokout_id', flokoutIds) // Fixed: use flokout_id instead of flok_id
                .order('created_at', { ascending: false })
                .range(Number(offset), Number(offset) + Number(limit) - 1);
            if (flokout_id) {
                expensesQuery = expensesQuery.eq('flokout_id', flokout_id);
            }
            if (category) {
                expensesQuery = expensesQuery.eq('category', category);
            }
            const { data: expenses, error: expensesError } = await expensesQuery;
            if (expensesError) {
                console.error('Error fetching expenses:', expensesError);
                res.status(500).json({ error: 'Failed to fetch expenses' });
                return;
            }
            console.log('📊 Found expenses:', expenses?.length || 0);
            // If no expenses, return empty
            if (!expenses || expenses.length === 0) {
                res.json({ expenses: [] });
                return;
            }
            // Fetch related data separately to avoid complex joins
            const userIds = Array.from(new Set([
                ...expenses.map(e => e.paid_by),
                ...expenses.map(e => e.created_by)
            ]));
            const flokoutIdsForDetails = Array.from(new Set(expenses.map(e => e.flokout_id)));
            // Fetch users
            const { data: users } = await database_1.supabaseClient
                .from('profiles')
                .select('id, email, full_name, avatar_url')
                .in('id', userIds);
            // Fetch flokouts with floks
            const { data: flokoutsWithFloks } = await database_1.supabaseClient
                .from('flokouts')
                .select(`
          id, title, date, flok_id,
          floks!inner(id, name),
          spots(id, name, address)
        `)
                .in('id', flokoutIdsForDetails);
            // Fetch expense shares
            const expenseIds = expenses.map(e => e.id);
            const { data: expenseShares } = await database_1.supabaseClient
                .from('expense_shares')
                .select(`
          *,
          user:user_id(id, email, full_name, avatar_url)
        `)
                .in('expense_id', expenseIds);
            // Combine the data
            const expensesWithDetails = expenses.map(expense => {
                const payer = users?.find(u => u.id === expense.paid_by);
                const creator = users?.find(u => u.id === expense.created_by);
                const flokout = flokoutsWithFloks?.find(f => f.id === expense.flokout_id);
                const shares = expenseShares?.filter(s => s.expense_id === expense.id) || [];
                return {
                    ...expense,
                    payer: payer ? {
                        id: payer.id,
                        full_name: payer.full_name,
                        email: payer.email,
                        avatar_url: payer.avatar_url
                    } : null,
                    creator: creator ? {
                        id: creator.id,
                        full_name: creator.full_name,
                        email: creator.email,
                        avatar_url: creator.avatar_url
                    } : null,
                    flokout: flokout ? {
                        id: flokout.id,
                        title: flokout.title,
                        date: flokout.date,
                        floks: {
                            id: flokout.floks[0]?.id,
                            name: flokout.floks[0]?.name
                        },
                        spots: flokout.spots && flokout.spots[0] ? {
                            id: flokout.spots[0].id,
                            name: flokout.spots[0].name,
                            address: flokout.spots[0].address
                        } : null
                    } : null,
                    expense_shares: shares
                };
            });
            res.json({
                expenses: expensesWithDetails,
                total: expensesWithDetails.length,
                global: global === 'true'
            });
        }
        catch (error) {
            console.error('Error in getExpenses:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Create expense with proper flokout_id relationship
     */
    static async createExpense(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            console.log('📊 Creating expense for user:', req.user.id);
            console.log('📊 Request body:', req.body);
            const { flokout_id, amount, description, category, paid_by } = req.body;
            // Validate required fields
            if (!flokout_id) {
                res.status(400).json({ error: 'flokout_id is required' });
                return;
            }
            if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
                res.status(400).json({ error: 'Valid amount is required' });
                return;
            }
            if (!paid_by) {
                res.status(400).json({ error: 'paid_by is required' });
                return;
            }
            const amountNum = Number(amount);
            // Verify flokout exists and user has access
            const { data: flokout, error: flokoutError } = await database_1.supabaseClient
                .from('flokouts')
                .select(`
          id,
          title,
          flok_id,
          floks!inner(id, name)
        `)
                .eq('id', flokout_id)
                .single();
            if (flokoutError || !flokout) {
                console.error('Flokout access error:', flokoutError);
                res.status(404).json({
                    error: 'Flokout not found.'
                });
                return;
            }
            // Check if user is a member of the flok
            const { data: userMembership, error: membershipError } = await database_1.supabaseClient
                .from('flokmates')
                .select('user_id, role')
                .eq('flok_id', flokout.flok_id)
                .eq('user_id', req.user.id)
                .single();
            if (membershipError || !userMembership) {
                console.error('User membership check error:', membershipError);
                res.status(403).json({
                    error: 'Access denied. You must be a member of this flok to add expenses.'
                });
                return;
            }
            // Validate paid_by user is a member of the flok
            const { data: payerMembership } = await database_1.supabaseClient
                .from('flokmates')
                .select('user_id')
                .eq('flok_id', flokout.flok_id)
                .eq('user_id', paid_by)
                .single();
            if (!payerMembership) {
                res.status(400).json({
                    error: 'The person paying must be a member of this flok'
                });
                return;
            }
            // Validate category if provided
            if (category) {
                const validCategories = [
                    'court', 'equipment', 'supplies', 'food', 'refreshments',
                    'transportation', 'accommodation', 'booking_fee', 'software',
                    'decorations', 'gifts', 'donation', 'entry_fee', 'other'
                ];
                if (!validCategories.includes(category)) {
                    res.status(400).json({
                        error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
                    });
                    return;
                }
            }
            // Create the expense with proper flokout_id
            const { data: expense, error: expenseError } = await database_1.supabaseClient
                .from('expenses')
                .insert({
                flokout_id: flokout_id, // Correct field name
                amount: amountNum,
                description: description || 'Expense',
                category: category || 'other',
                paid_by,
                created_by: req.user.id
            })
                .select(`
          id,
          flokout_id,
          amount,
          description,
          category,
          paid_by,
          created_by,
          created_at,
          updated_at
        `)
                .single();
            if (expenseError) {
                console.error('Error creating expense:', expenseError);
                res.status(500).json({ error: 'Failed to create expense' });
                return;
            }
            // Get confirmed attendees for this specific flokout
            const { data: attendees } = await database_1.supabaseClient
                .from('attendances')
                .select('user_id')
                .eq('flokout_id', flokout_id)
                .eq('attended', true);
            const uniqueAttendees = attendees ? attendees.map(a => a.user_id) : [];
            if (uniqueAttendees.length > 0) {
                // Calculate share per person
                const shareAmount = Math.round((amountNum / uniqueAttendees.length) * 100) / 100;
                const totalShares = shareAmount * uniqueAttendees.length;
                const remainder = Math.round((amountNum - totalShares) * 100) / 100;
                // Create expense shares
                const shares = uniqueAttendees.map((userId, index) => ({
                    expense_id: expense.id,
                    user_id: userId,
                    amount: index === 0 ? shareAmount + remainder : shareAmount,
                    status: userId === paid_by ? 'settled' : 'pending'
                }));
                const { error: sharesError } = await database_1.supabaseClient
                    .from('expense_shares')
                    .insert(shares);
                if (sharesError) {
                    console.error('Error creating expense shares:', sharesError);
                    // Don't fail the whole operation, just log the error
                }
            }
            res.status(201).json({
                success: true,
                expense
            });
        }
        catch (error) {
            console.error('Error in createExpense:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Get global settle up data across all floks - simplified approach matching web app
     */
    static async getSettleUp(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            console.log('📊 Getting settle up data for user:', req.user.id);
            // Get full user profile for settle up
            const { data: userProfile, error: profileError } = await database_1.supabaseClient
                .from('profiles')
                .select('id, full_name, email, venmo_id, zelle_id')
                .eq('id', req.user.id)
                .single();
            if (profileError) {
                console.error('Error fetching user profile:', profileError);
                res.status(500).json({ error: 'Failed to fetch user profile' });
                return;
            }
            // Get user's floks to filter expenses
            const { data: userFloks, error: floksError } = await database_1.supabaseClient
                .from('flokmates')
                .select('flok_id')
                .eq('user_id', req.user.id);
            if (floksError) {
                console.error('Error fetching user floks:', floksError);
                res.status(500).json({ error: 'Failed to fetch user floks' });
                return;
            }
            const userFlokIds = userFloks?.map(f => f.flok_id) || [];
            if (userFlokIds.length === 0) {
                res.json({ settle_up_items: [], total_items: 0 });
                return;
            }
            // Get flokouts from user's floks
            const { data: userFlokouts, error: flokoutsError } = await database_1.supabaseClient
                .from('flokouts')
                .select('id')
                .in('flok_id', userFlokIds);
            if (flokoutsError) {
                console.error('Error fetching flokouts:', flokoutsError);
                res.status(500).json({ error: 'Failed to fetch flokouts' });
                return;
            }
            const flokoutIds = userFlokouts?.map(f => f.id) || [];
            if (flokoutIds.length === 0) {
                res.json({ settle_up_items: [], total_items: 0 });
                return;
            }
            // Step 1: Fetch expenses for these flokouts (matching web app pattern)
            const { data: expenses, error: expensesError } = await database_1.supabaseClient
                .from('expenses')
                .select(`
          *,
          payer:profiles!expenses_paid_by_fkey(id, full_name, email, venmo_id, zelle_id)
        `)
                .in('flokout_id', flokoutIds);
            if (expensesError) {
                console.error('Error fetching expenses:', expensesError);
                res.status(500).json({ error: 'Failed to fetch expenses' });
                return;
            }
            if (!expenses || expenses.length === 0) {
                res.json({ settle_up_items: [], total_items: 0 });
                return;
            }
            // Step 2: Fetch expense shares for these expenses
            const expenseIds = expenses.map(e => e.id);
            const { data: expenseShares, error: sharesError } = await database_1.supabaseClient
                .from('expense_shares')
                .select(`
          *,
          user:profiles!expense_shares_user_id_fkey(id, full_name, email, venmo_id, zelle_id)
        `)
                .in('expense_id', expenseIds)
                .neq('status', 'settled');
            if (sharesError) {
                console.error('Error fetching expense shares:', sharesError);
                res.status(500).json({ error: 'Failed to fetch expense shares' });
                return;
            }
            // Step 3: Calculate settle up (matching web app logic)
            const balanceMap = new Map();
            expenses?.forEach(expense => {
                // When current user paid for others
                if (expense.paid_by === req.user.id) {
                    expenseShares?.forEach(share => {
                        if (share.expense_id === expense.id && share.user_id !== req.user.id && share.status !== 'settled') {
                            const key = share.user_id;
                            const existing = balanceMap.get(key) || {
                                user: share.user,
                                netAmount: 0,
                                shareIds: [],
                                status: 'pending'
                            };
                            existing.netAmount += share.amount; // They owe current user (positive)
                            existing.shareIds.push(share.id);
                            if (share.status === 'verifying')
                                existing.status = 'verifying';
                            balanceMap.set(key, existing);
                        }
                    });
                }
                // When others paid for current user
                if (expense.paid_by !== req.user.id) {
                    expenseShares?.forEach(share => {
                        if (share.expense_id === expense.id && share.user_id === req.user.id && share.status !== 'settled') {
                            const key = expense.paid_by;
                            const existing = balanceMap.get(key) || {
                                user: expense.payer,
                                netAmount: 0,
                                shareIds: [],
                                status: 'pending'
                            };
                            existing.netAmount -= share.amount; // Current user owes them (negative)
                            existing.shareIds.push(share.id);
                            if (share.status === 'verifying')
                                existing.status = 'verifying';
                            balanceMap.set(key, existing);
                        }
                    });
                }
            });
            // Step 4: Convert to settle up items format
            const settleUpItems = [];
            balanceMap.forEach((balance, userId) => {
                if (balance.netAmount !== 0) { // Remove zero balances
                    if (balance.netAmount > 0) {
                        // Others owe current user
                        settleUpItems.push({
                            from: balance.user,
                            to: userProfile,
                            amount: balance.netAmount,
                            status: balance.status,
                            expense_share_ids: balance.shareIds
                        });
                    }
                    else {
                        // Current user owes others
                        settleUpItems.push({
                            from: userProfile,
                            to: balance.user,
                            amount: Math.abs(balance.netAmount),
                            status: balance.status,
                            expense_share_ids: balance.shareIds
                        });
                    }
                }
            });
            console.log('📊 Calculated settle up items:', settleUpItems.length);
            res.json({
                settle_up_items: settleUpItems,
                total_items: settleUpItems.length
            });
        }
        catch (error) {
            console.error('Error in getSettleUp:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Get expense by ID with shares
     */
    static async getExpenseById(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id } = req.params;
            const { data: expense, error: expenseError } = await database_1.supabaseClient
                .from('expenses')
                .select(`
          *,
          payer:paid_by(
            id,
            email,
            full_name,
            avatar_url
          ),
          creator:created_by(
            id,
            email,
            full_name,
            avatar_url
          ),
          flokout:flokout_id(
            id,
            title,
            date,
            flok_id,
            floks!inner(
              id,
              name
            ),
            spots(
              id,
              name,
              address
            )
          ),
          expense_shares(
            id,
            user_id,
            amount,
            status,
            settled_at,
            settled_by,
            payment_method,
            created_at,
            updated_at,
            user:user_id(
              id,
              email,
              full_name,
              avatar_url
            )
          )
        `)
                .eq('id', id)
                .single();
            if (expenseError) {
                res.status(404).json({ error: 'Expense not found' });
                return;
            }
            // Check if user has access to this expense
            const { data: membership } = await database_1.supabaseClient
                .from('flokmates')
                .select('role')
                .eq('flok_id', expense.flokout.flok_id)
                .eq('user_id', req.user.id)
                .single();
            if (!membership) {
                res.status(403).json({ error: 'Access denied. You are not a member of this flok.' });
                return;
            }
            res.json({ expense });
        }
        catch (error) {
            console.error('Get expense error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Update expense
     */
    static async updateExpense(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id } = req.params;
            const { description, amount, category } = req.body;
            // Get current expense to check permissions
            const { data: currentExpense, error: getError } = await database_1.supabaseClient
                .from('expenses')
                .select(`
          created_by,
          paid_by,
          flokout_id,
          flokouts!inner(flok_id)
        `)
                .eq('id', id)
                .single();
            if (getError) {
                res.status(404).json({ error: 'Expense not found' });
                return;
            }
            // Check if user can update this expense (creator or payer)
            const canUpdate = currentExpense.created_by === req.user.id ||
                currentExpense.paid_by === req.user.id;
            if (!canUpdate) {
                res.status(403).json({
                    error: 'Access denied. You can only update expenses you created or paid for.'
                });
                return;
            }
            const updateData = {
                updated_at: new Date().toISOString()
            };
            if (description !== undefined)
                updateData.description = description;
            if (category !== undefined) {
                const validCategories = [
                    'court', 'equipment', 'supplies', 'food', 'refreshments',
                    'transportation', 'accommodation', 'booking_fee', 'software',
                    'decorations', 'gifts', 'donation', 'entry_fee', 'other'
                ];
                if (!validCategories.includes(category)) {
                    res.status(400).json({
                        error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
                    });
                    return;
                }
                updateData.category = category;
            }
            // If amount is being updated, we need to recalculate shares
            if (amount !== undefined) {
                const amountNum = parseFloat(amount);
                if (isNaN(amountNum) || amountNum <= 0) {
                    res.status(400).json({ error: 'Amount must be a positive number' });
                    return;
                }
                updateData.amount = amountNum;
                // Recalculate shares if amount changed
                const { data: shares } = await database_1.supabaseClient
                    .from('expense_shares')
                    .select('user_id, status')
                    .eq('expense_id', id);
                if (shares && shares.length > 0) {
                    const shareAmount = Number((amountNum / shares.length).toFixed(2));
                    const totalShares = shareAmount * shares.length;
                    let remainder = Number((amountNum - totalShares).toFixed(2));
                    const updatedShares = shares.map((share, index) => {
                        let adjustedShare = shareAmount;
                        if (index === 0 && remainder !== 0) {
                            adjustedShare = Number((adjustedShare + remainder).toFixed(2));
                        }
                        return {
                            user_id: share.user_id,
                            amount: adjustedShare
                        };
                    });
                    // Update all shares
                    for (const updatedShare of updatedShares) {
                        await database_1.supabaseClient
                            .from('expense_shares')
                            .update({
                            amount: updatedShare.amount,
                            updated_at: new Date().toISOString()
                        })
                            .eq('expense_id', id)
                            .eq('user_id', updatedShare.user_id);
                    }
                }
            }
            const { data: expense, error: updateError } = await database_1.supabaseClient
                .from('expenses')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();
            if (updateError) {
                res.status(400).json({ error: updateError.message });
                return;
            }
            res.json({
                message: 'Expense updated successfully',
                expense
            });
        }
        catch (error) {
            console.error('Update expense error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Delete expense
     */
    static async deleteExpense(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { id } = req.params;
            // Get current expense to check permissions
            const { data: currentExpense, error: getError } = await database_1.supabaseClient
                .from('expenses')
                .select('created_by, paid_by')
                .eq('id', id)
                .single();
            if (getError) {
                res.status(404).json({ error: 'Expense not found' });
                return;
            }
            // Check if user can delete this expense (creator or payer)
            const canDelete = currentExpense.created_by === req.user.id ||
                currentExpense.paid_by === req.user.id;
            if (!canDelete) {
                res.status(403).json({
                    error: 'Access denied. You can only delete expenses you created or paid for.'
                });
                return;
            }
            // Delete expense (shares will be cascade deleted)
            const { error: deleteError } = await database_1.supabaseClient
                .from('expenses')
                .delete()
                .eq('id', id);
            if (deleteError) {
                res.status(400).json({ error: deleteError.message });
                return;
            }
            res.json({ message: 'Expense deleted successfully' });
        }
        catch (error) {
            console.error('Delete expense error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Mark settlement as sent (changes status to verifying)
     */
    static async markAsSent(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { expense_share_ids, payment_method = 'other' } = req.body;
            if (!expense_share_ids || !Array.isArray(expense_share_ids)) {
                res.status(400).json({ error: 'expense_share_ids array is required' });
                return;
            }
            const validPaymentMethods = ['venmo', 'zelle', 'cash', 'other'];
            if (!validPaymentMethods.includes(payment_method)) {
                res.status(400).json({
                    error: 'Invalid payment method. Must be one of: venmo, zelle, cash, other'
                });
                return;
            }
            // Get expense details for notifications before updating
            const { data: expenseShares, error: fetchError } = await database_1.supabaseClient
                .from('expense_shares')
                .select(`
          id,
          user_id,
          amount,
          expense_id,
          expenses!inner(
            id,
            description,
            amount,
            paid_by,
            flokout_id,
                       flokouts!inner(
             id,
             title,
             attendances!inner(user_id, rsvp_status)
           )
          )
        `)
                .in('id', expense_share_ids)
                .eq('user_id', req.user.id);
            if (fetchError || !expenseShares) {
                res.status(400).json({ error: 'Invalid expense share IDs' });
                return;
            }
            // Update expense shares to "verifying" status
            const { data: updatedShares, error: updateError } = await database_1.supabaseClient
                .from('expense_shares')
                .update({
                status: 'verifying',
                payment_method,
                updated_at: new Date().toISOString()
            })
                .in('id', expense_share_ids)
                .eq('user_id', req.user.id) // Only update shares for current user
                .select();
            if (updateError) {
                res.status(400).json({ error: updateError.message });
                return;
            }
            // Send payment notifications to recipients
            try {
                console.log('💰 Processing payment notifications for markAsSent...');
                console.log('💰 Expense shares to process:', expenseShares?.length || 0);
                // Group by expense payer (recipient) and calculate total amounts
                const paymentsByRecipient = expenseShares.reduce((acc, share) => {
                    const expense = share.expenses;
                    const recipientId = expense.paid_by;
                    // Skip if same user
                    if (recipientId === req.user.id)
                        return acc;
                    // Check if recipient has rsvp_status = 'yes' for this flokout
                    const recipientRsvp = expense.flokouts.attendances.find((attendance) => attendance.user_id === recipientId && attendance.rsvp_status === 'yes');
                    if (!recipientRsvp)
                        return acc; // Don't notify if not attending
                    if (!acc[recipientId]) {
                        acc[recipientId] = {
                            recipientId,
                            totalAmount: 0,
                            expenseCount: 0,
                            flokoutTitle: expense.flokouts.title,
                            paymentMethod: payment_method
                        };
                    }
                    acc[recipientId].totalAmount += share.amount;
                    acc[recipientId].expenseCount += 1;
                    return acc;
                }, {});
                // Send notifications to each recipient
                console.log('💰 Payment recipients to notify:', Object.keys(paymentsByRecipient).length);
                for (const payment of Object.values(paymentsByRecipient)) {
                    const { recipientId, totalAmount, expenseCount, flokoutTitle, paymentMethod } = payment;
                    console.log(`💰 Sending notification to ${recipientId} for $${totalAmount} via ${paymentMethod}`);
                    // Only send if amount > 0
                    if (totalAmount > 0) {
                        const notificationSent = await pushNotificationService_1.PushNotificationService.sendToUser(recipientId, '💰 Payment Sent!', `Payment of $${totalAmount.toFixed(2)} sent via ${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)} for ${flokoutTitle}`, {
                            type: 'payment_sent',
                            route: '/(tabs)/expenses',
                            amount: totalAmount,
                            payment_method: paymentMethod,
                            expense_count: expenseCount
                        });
                        console.log(`💰 Notification sent result: ${notificationSent}`);
                    }
                }
            }
            catch (notificationError) {
                console.error('Error sending payment notifications:', notificationError);
                // Don't fail the request if notifications fail
            }
            res.json({
                message: 'Payment marked as sent successfully',
                updated_shares: updatedShares?.length || 0
            });
        }
        catch (error) {
            console.error('Mark as sent error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Mark settlement as received (changes status to settled)
     */
    static async markAsReceived(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { expense_share_ids } = req.body;
            if (!expense_share_ids || !Array.isArray(expense_share_ids)) {
                res.status(400).json({ error: 'expense_share_ids array is required' });
                return;
            }
            // Get the expense shares to validate user can mark as received
            const { data: shares, error: getError } = await database_1.supabaseClient
                .from('expense_shares')
                .select(`
          id,
          user_id,
          expense_id,
          expenses!inner(paid_by)
        `)
                .in('id', expense_share_ids);
            if (getError || !shares) {
                res.status(400).json({ error: 'Invalid expense share IDs' });
                return;
            }
            // Validate that current user is the one who paid for these expenses
            const invalidShares = shares.filter((share) => share.expenses.paid_by !== req.user?.id);
            if (invalidShares.length > 0) {
                res.status(403).json({
                    error: 'You can only mark payments as received for expenses you paid for'
                });
                return;
            }
            // Update expense shares to "settled" status
            const { data: updatedShares, error: updateError } = await database_1.supabaseClient
                .from('expense_shares')
                .update({
                status: 'settled',
                settled_at: new Date().toISOString(),
                settled_by: req.user.id,
                updated_at: new Date().toISOString()
            })
                .in('id', expense_share_ids)
                .select(`
          id,
          user_id,
          amount,
          expense_id,
          expenses!inner(
            id,
            description,
            amount,
            paid_by,
            flokout_id,
            flokouts!inner(
              id,
              title,
              attendances!inner(user_id, rsvp_status)
            )
          )
        `);
            if (updateError) {
                res.status(400).json({ error: updateError.message });
                return;
            }
            // Send payment confirmation notifications to payers (users who paid us)
            try {
                // Group by payer and calculate total amounts
                const confirmationsByPayer = updatedShares?.reduce((acc, share) => {
                    const payerId = share.user_id;
                    const expense = share.expenses;
                    // Skip if same user
                    if (payerId === req.user.id)
                        return acc;
                    // Check if payer has rsvp_status = 'yes' for this flokout
                    const payerRsvp = expense.flokouts.attendances.find((attendance) => attendance.user_id === payerId && attendance.rsvp_status === 'yes');
                    if (!payerRsvp)
                        return acc; // Don't notify if not attending
                    if (!acc[payerId]) {
                        acc[payerId] = {
                            payerId,
                            totalAmount: 0,
                            expenseCount: 0,
                            flokoutTitle: expense.flokouts.title
                        };
                    }
                    acc[payerId].totalAmount += share.amount;
                    acc[payerId].expenseCount += 1;
                    return acc;
                }, {}) || {};
                // Send notifications to each payer
                for (const confirmation of Object.values(confirmationsByPayer)) {
                    const { payerId, totalAmount, expenseCount, flokoutTitle } = confirmation;
                    // Only send if amount > 0
                    if (totalAmount > 0) {
                        await pushNotificationService_1.PushNotificationService.sendToUser(payerId, '✅ Payment Confirmed!', `Payment of $${totalAmount.toFixed(2)} confirmed as received for ${flokoutTitle}`, {
                            type: 'payment_received',
                            route: '/(tabs)/expenses',
                            amount: totalAmount,
                            expense_count: expenseCount
                        });
                    }
                }
            }
            catch (notificationError) {
                console.error('Error sending payment confirmation notifications:', notificationError);
                // Don't fail the request if notifications fail
            }
            res.json({
                message: 'Payment marked as received successfully',
                updated_shares: updatedShares?.length || 0
            });
        }
        catch (error) {
            console.error('Mark as received error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Get expense shares for a specific expense
     */
    static async getExpenseShares(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { expenseId } = req.params;
            // First check if user has access to this expense
            const { data: expense, error: expenseError } = await database_1.supabaseClient
                .from('expenses')
                .select(`
          id,
          flokout_id,
          flokouts!inner(
            flok_id
          )
        `)
                .eq('id', expenseId)
                .single();
            if (expenseError) {
                res.status(404).json({ error: 'Expense not found' });
                return;
            }
            // Check if user is a member of the flok
            const { data: membership } = await database_1.supabaseClient
                .from('flokmates')
                .select('role')
                .eq('flok_id', expense.flokouts.flok_id)
                .eq('user_id', req.user.id)
                .single();
            if (!membership) {
                res.status(403).json({ error: 'Access denied. You are not a member of this flok.' });
                return;
            }
            const { data: shares, error: sharesError } = await database_1.supabaseClient
                .from('expense_shares')
                .select(`
          id,
          user_id,
          amount,
          status,
          settled_at,
          settled_by,
          payment_method,
          created_at,
          updated_at,
          user:user_id(
            id,
            email,
            full_name,
            avatar_url
          )
        `)
                .eq('expense_id', expenseId)
                .order('created_at', { ascending: true });
            if (sharesError) {
                res.status(500).json({ error: 'Failed to fetch expense shares' });
                return;
            }
            res.json({ shares });
        }
        catch (error) {
            console.error('Get expense shares error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
exports.ExpensesController = ExpensesController;
//# sourceMappingURL=expensesController.js.map