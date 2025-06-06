"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpensesController = void 0;
const database_1 = require("../config/database");
/**
 * Expenses Controller - Complete Expense Management with Sharing and Settle Up
 */
class ExpensesController {
    /**
     * Get expenses with optional filters
     */
    static async getExpenses(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { flok_id, flokout_id, limit = 50, offset = 0, category } = req.query;
            // Get user's floks to filter expenses
            const { data: userFloks } = await database_1.supabaseClient
                .from('flokmates')
                .select('flok_id')
                .eq('user_id', req.user.id);
            const userFlokIds = userFloks?.map(f => f.flok_id) || [];
            if (userFlokIds.length === 0) {
                res.json({ expenses: [] });
                return;
            }
            // First get flokouts from user's floks
            const { data: userFlokouts } = await database_1.supabaseClient
                .from('flokouts')
                .select('id')
                .in('flok_id', userFlokIds);
            const flokoutIds = userFlokouts?.map(f => f.id) || [];
            if (flokoutIds.length === 0) {
                res.json({ expenses: [] });
                return;
            }
            let query = database_1.supabaseClient
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
                .in('flokout_id', flokoutIds)
                .order('created_at', { ascending: false })
                .range(Number(offset), Number(offset) + Number(limit) - 1);
            if (flok_id) {
                // Filter by specific flok via flokouts
                const { data: flokFlokouts } = await database_1.supabaseClient
                    .from('flokouts')
                    .select('id')
                    .eq('flok_id', flok_id);
                const specificFlokoutIds = flokFlokouts?.map(f => f.id) || [];
                query = query.in('flokout_id', specificFlokoutIds);
            }
            if (flokout_id) {
                query = query.eq('flokout_id', flokout_id);
            }
            if (category) {
                query = query.eq('category', category);
            }
            const { data: expenses, error: expensesError } = await query;
            if (expensesError) {
                res.status(500).json({ error: 'Failed to fetch expenses' });
                return;
            }
            res.json({ expenses });
        }
        catch (error) {
            console.error('Get expenses error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    /**
     * Create new expense with automatic share calculation
     */
    static async createExpense(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { flokout_id, description, amount, category, paid_by } = req.body;
            if (!flokout_id || !description || !amount || !category || !paid_by) {
                res.status(400).json({
                    error: 'flokout_id, description, amount, category, and paid_by are required'
                });
                return;
            }
            // Validate amount
            const amountNum = parseFloat(amount);
            if (isNaN(amountNum) || amountNum <= 0) {
                res.status(400).json({ error: 'Amount must be a positive number' });
                return;
            }
            // Check if user has access to this flokout
            const { data: flokout, error: flokoutError } = await database_1.supabaseClient
                .from('flokouts')
                .select('flok_id, title')
                .eq('id', flokout_id)
                .single();
            if (flokoutError) {
                res.status(404).json({ error: 'Flokout not found' });
                return;
            }
            // Check if user is a member of the flok
            const { data: membership } = await database_1.supabaseClient
                .from('flokmates')
                .select('role')
                .eq('flok_id', flokout.flok_id)
                .eq('user_id', req.user.id)
                .single();
            if (!membership) {
                res.status(403).json({ error: 'Access denied. You are not a member of this flok.' });
                return;
            }
            // Validate category
            const validCategories = ['court', 'equipment', 'food', 'transportation', 'other'];
            if (!validCategories.includes(category)) {
                res.status(400).json({
                    error: 'Invalid category. Must be one of: court, equipment, food, transportation, other'
                });
                return;
            }
            // Create expense
            const { data: expense, error: expenseError } = await database_1.supabaseClient
                .from('expenses')
                .insert({
                flokout_id,
                description,
                amount: amountNum,
                category,
                paid_by,
                created_by: req.user.id
            })
                .select()
                .single();
            if (expenseError) {
                res.status(400).json({ error: expenseError.message });
                return;
            }
            // Get attendees for this flokout to calculate shares
            const { data: attendances } = await database_1.supabaseClient
                .from('attendances')
                .select('user_id')
                .eq('flokout_id', flokout_id)
                .eq('response', 'yes');
            const attendeeIds = attendances?.map(a => a.user_id) || [];
            if (attendeeIds.length > 0) {
                // Calculate exact share amount with proper decimal precision
                const shareAmount = Number((amountNum / attendeeIds.length).toFixed(2));
                // Calculate any remaining cents due to rounding
                const totalShares = shareAmount * attendeeIds.length;
                let remainder = Number((amountNum - totalShares).toFixed(2));
                const shares = attendeeIds.map((userId, index) => {
                    // Add the remainder to the first person's share to account for rounding
                    let adjustedShare = shareAmount;
                    if (index === 0 && remainder !== 0) {
                        adjustedShare = Number((adjustedShare + remainder).toFixed(2));
                    }
                    return {
                        expense_id: expense.id,
                        user_id: userId,
                        amount: adjustedShare,
                        status: userId === paid_by ? 'settled' : 'pending',
                        settled_at: userId === paid_by ? new Date().toISOString() : null,
                        settled_by: userId === paid_by ? paid_by : null
                    };
                });
                const { error: sharesError } = await database_1.supabaseClient
                    .from('expense_shares')
                    .insert(shares);
                if (sharesError) {
                    // Rollback: delete the expense if shares creation fails
                    await database_1.supabaseClient
                        .from('expenses')
                        .delete()
                        .eq('id', expense.id);
                    res.status(400).json({ error: 'Failed to create expense shares' });
                    return;
                }
            }
            res.status(201).json({
                message: 'Expense created successfully',
                expense,
                shares_created: attendeeIds.length
            });
        }
        catch (error) {
            console.error('Create expense error:', error);
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
                const validCategories = ['court', 'equipment', 'food', 'transportation', 'other'];
                if (!validCategories.includes(category)) {
                    res.status(400).json({
                        error: 'Invalid category. Must be one of: court, equipment, food, transportation, other'
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
     * Get settle up calculations for user
     */
    static async getSettleUp(req, res) {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'Not authenticated' });
                return;
            }
            const { flok_id } = req.query;
            // Get user's floks to calculate settle up
            const { data: userFloks } = await database_1.supabaseClient
                .from('flokmates')
                .select('flok_id')
                .eq('user_id', req.user.id);
            let flokIds = userFloks?.map(f => f.flok_id) || [];
            if (flok_id) {
                flokIds = flokIds.filter(id => id === flok_id);
            }
            if (flokIds.length === 0) {
                res.json({ settle_up_items: [] });
                return;
            }
            // Get flokouts from user's floks first
            const { data: flokouts } = await database_1.supabaseClient
                .from('flokouts')
                .select('id')
                .in('flok_id', flokIds);
            const flokoutIds = flokouts?.map(f => f.id) || [];
            if (flokoutIds.length === 0) {
                res.json({ settle_up_items: [] });
                return;
            }
            // Get all expenses for user's floks with pending/verifying shares
            const { data: expenses, error: expensesError } = await database_1.supabaseClient
                .from('expenses')
                .select(`
          id,
          paid_by,
          amount,
          description,
          category,
          flokout_id,
          flokouts!inner(
            id,
            title,
            flok_id,
            floks!inner(
              id,
              name
            )
          ),
          expense_shares!inner(
            id,
            user_id,
            amount,
            status,
            user:user_id(
              id,
              email,
              full_name,
              avatar_url
            )
          ),
          payer:paid_by(
            id,
            email,
            full_name,
            avatar_url
          )
        `)
                .in('flokout_id', flokoutIds)
                .in('expense_shares.status', ['pending', 'verifying']);
            if (expensesError) {
                res.status(500).json({ error: 'Failed to fetch expenses for settle up' });
                return;
            }
            // Calculate net amounts between users
            const userBalances = {};
            const statusTracker = {};
            const expenseTracker = {}; // Track which expense shares contribute to each settlement
            (expenses || []).forEach(expense => {
                expense.expense_shares.forEach((share) => {
                    if (share.status === 'pending' || share.status === 'verifying') {
                        const payerId = expense.paid_by;
                        const owerId = share.user_id;
                        // Skip if same person
                        if (payerId === owerId)
                            return;
                        // Initialize nested objects if they don't exist
                        if (!userBalances[owerId])
                            userBalances[owerId] = {};
                        if (!userBalances[payerId])
                            userBalances[payerId] = {};
                        // owerId owes payerId this amount
                        userBalances[owerId][payerId] = (userBalances[owerId][payerId] || 0) + share.amount;
                        // Track status - if any share is verifying, the whole settlement is verifying
                        const key = `${owerId}|${payerId}`;
                        if (share.status === 'verifying' || statusTracker[key] === 'verifying') {
                            statusTracker[key] = 'verifying';
                        }
                        else {
                            statusTracker[key] = 'pending';
                        }
                        // Track expense share IDs
                        if (!expenseTracker[key])
                            expenseTracker[key] = [];
                        expenseTracker[key].push(share.id);
                    }
                });
            });
            // Calculate net amounts to minimize transactions
            const netAmounts = {};
            Object.keys(userBalances).forEach(fromUserId => {
                Object.keys(userBalances[fromUserId]).forEach(toUserId => {
                    const amountOwed = userBalances[fromUserId][toUserId] || 0;
                    const amountOwedBack = userBalances[toUserId]?.[fromUserId] || 0;
                    const netAmount = amountOwed - amountOwedBack;
                    if (netAmount > 0) {
                        const key = `${fromUserId}|${toUserId}`;
                        netAmounts[key] = netAmount;
                    }
                });
            });
            // Convert to settle up items involving current user
            const settleUpItems = [];
            Object.entries(netAmounts).forEach(([key, amount]) => {
                const [fromUserId, toUserId] = key.split('|');
                // Only include items where current user is involved
                if (fromUserId === req.user?.id || toUserId === req.user?.id) {
                    // Find user profiles
                    let fromUser, toUser;
                    const allUsers = (expenses || []).flatMap(e => [
                        e.payer,
                        ...e.expense_shares.map((s) => s.user)
                    ]);
                    fromUser = allUsers.find(u => u?.id === fromUserId);
                    toUser = allUsers.find(u => u?.id === toUserId);
                    if (fromUser && toUser) {
                        const settlementStatus = statusTracker[key] || 'pending';
                        const expenseShareIds = expenseTracker[key] || [];
                        settleUpItems.push({
                            from: fromUser,
                            to: toUser,
                            amount: Number(amount.toFixed(2)),
                            status: settlementStatus,
                            expense_share_ids: expenseShareIds
                        });
                    }
                }
            });
            res.json({ settle_up_items: settleUpItems });
        }
        catch (error) {
            console.error('Get settle up error:', error);
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
                .select();
            if (updateError) {
                res.status(400).json({ error: updateError.message });
                return;
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