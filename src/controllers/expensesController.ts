import { Response } from 'express';
import { supabaseAdmin, supabaseClient } from '../config/database';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Expenses Controller - Complete Expense Management with Sharing and Settle Up
 */

export class ExpensesController {
  /**
   * Get expenses with optional filters
   */
  static async getExpenses(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      console.log('📊 Getting expenses for user:', req.user.id);

      const { flok_id, flokout_id, limit = 50, offset = 0, category } = req.query;

      // Get user's floks to filter expenses
      const { data: userFloks, error: floksError } = await supabaseClient
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
      const { data: userFlokouts, error: flokoutsError } = await supabaseClient
        .from('flokouts')
        .select('id')
        .in('flok_id', userFlokIds);

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

      // Build the expenses query without complex joins
      let expensesQuery = supabaseClient
        .from('expenses')
        .select('*')
        .in('flok_id', flokoutIds)
        .order('created_at', { ascending: false })
        .range(Number(offset), Number(offset) + Number(limit) - 1);

      if (flokout_id) {
        expensesQuery = expensesQuery.eq('flok_id', flokout_id);
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

      const flokoutIdsForDetails = Array.from(new Set(expenses.map(e => e.flok_id)));

      // Fetch users
      const { data: users } = await supabaseClient
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .in('id', userIds);

      // Fetch flokouts with floks
      const { data: flokoutsWithFloks } = await supabaseClient
        .from('flokouts')
        .select(`
          id, title, date, flok_id,
          floks!inner(id, name),
          spots(id, name, address)
        `)
        .in('id', flokoutIdsForDetails);

      // Fetch expense shares
      const expenseIds = expenses.map(e => e.id);
      const { data: expenseShares } = await supabaseClient
        .from('expense_shares')
        .select(`
          id, expense_id, user_id, amount, status, 
          settled_at, settled_by, payment_method,
          created_at, updated_at
        `)
        .in('expense_id', expenseIds);

      // Get users for expense shares
      const shareUserIds = Array.from(new Set(expenseShares?.map(s => s.user_id) || []));
      const { data: shareUsers } = await supabaseClient
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .in('id', shareUserIds);

      // Combine the data
      const enrichedExpenses = expenses.map(expense => {
        const payer = users?.find(u => u.id === expense.paid_by);
        const creator = users?.find(u => u.id === expense.created_by);
        const flokout = flokoutsWithFloks?.find(f => f.id === expense.flok_id);
        const shares = expenseShares?.filter(s => s.expense_id === expense.id).map(share => ({
          ...share,
          user: shareUsers?.find(u => u.id === share.user_id)
        })) || [];

        return {
          ...expense,
          payer,
          creator,
          flokout,
          expense_shares: shares
        };
      });

      res.json({ expenses: enrichedExpenses });
    } catch (error: any) {
      console.error('Get expenses error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Create new expense with automatic share calculation
   */
  static async createExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { 
        flokout_id, 
        description, 
        amount, 
        category, 
        paid_by 
      } = req.body;

      if (!flokout_id || !amount || !paid_by) {
        res.status(400).json({ 
          error: 'flokout_id, amount, and paid_by are required' 
        });
        return;
      }

      // Validate amount
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        res.status(400).json({ error: 'Amount must be a positive number' });
        return;
      }

      // Get the flokout and check permissions
      const { data: flokout, error: flokoutError } = await supabaseClient
        .from('flokouts')
        .select('id, flok_id')
        .eq('id', flokout_id)
        .single();

      if (flokoutError || !flokout) {
        res.status(404).json({ error: 'Flokout not found' });
        return;
      }

      // Check if user is a member of the flok
      const { data: membership } = await supabaseClient
        .from('flokmates')
        .select('role')
        .eq('flok_id', flokout.flok_id)
        .eq('user_id', req.user.id)
        .single();

      if (!membership) {
        res.status(403).json({ error: 'Access denied. You are not a member of this flok.' });
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

      // Create the expense (note: flok_id field actually stores flokout_id due to schema naming)
      const { data: expense, error: expenseError } = await supabaseClient
        .from('expenses')
        .insert({
          flok_id: flokout_id, // This field actually references flokouts.id despite the name
          amount: amountNum,
          description: description || 'Expense',
          category: category || 'other',
          paid_by,
          created_by: req.user.id
        })
        .select(`
          id,
          flok_id,
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
      const { data: attendees } = await supabaseClient
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

        const { error: sharesError } = await supabaseClient
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

    } catch (error) {
      console.error('Error in createExpense:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get expense by ID with shares
   */
  static async getExpenseById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;

      const { data: expense, error: expenseError } = await supabaseClient
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
      const { data: membership } = await supabaseClient
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
    } catch (error: any) {
      console.error('Get expense error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Update expense
   */
  static async updateExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;
      const { description, amount, category } = req.body;

      // Get current expense to check permissions
      const { data: currentExpense, error: getError } = await supabaseClient
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

      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (description !== undefined) updateData.description = description;
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
        const { data: shares } = await supabaseClient
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
            await supabaseClient
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

      const { data: expense, error: updateError } = await supabaseClient
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
    } catch (error: any) {
      console.error('Update expense error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Delete expense
   */
  static async deleteExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { id } = req.params;

      // Get current expense to check permissions
      const { data: currentExpense, error: getError } = await supabaseClient
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
      const { error: deleteError } = await supabaseClient
        .from('expenses')
        .delete()
        .eq('id', id);

      if (deleteError) {
        res.status(400).json({ error: deleteError.message });
        return;
      }

      res.json({ message: 'Expense deleted successfully' });
    } catch (error: any) {
      console.error('Delete expense error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get settle up calculations for user
   */
  static async getSettleUp(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      console.log('💰 Getting settle up for user:', req.user.id);

      const { flok_id } = req.query;

      // Get user's floks to calculate settle up
      const { data: userFloks, error: floksError } = await supabaseClient
        .from('flokmates')
        .select('flok_id')
        .eq('user_id', req.user.id);

      if (floksError) {
        console.error('Error fetching user floks for settle up:', floksError);
        res.status(500).json({ error: 'Failed to fetch user floks' });
        return;
      }

      let flokIds = userFloks?.map(f => f.flok_id) || [];

      if (flok_id) {
        flokIds = flokIds.filter(id => id === flok_id);
      }

      console.log('💰 Checking flok IDs:', flokIds);

      if (flokIds.length === 0) {
        res.json({ settle_up_items: [] });
        return;
      }

      // Get flokouts from user's floks
      const { data: flokouts, error: flokoutsError } = await supabaseClient
        .from('flokouts')
        .select('id')
        .in('flok_id', flokIds);

      if (flokoutsError) {
        console.error('Error fetching flokouts for settle up:', flokoutsError);
        res.status(500).json({ error: 'Failed to fetch flokouts' });
        return;
      }

      const flokoutIds = flokouts?.map(f => f.id) || [];
      console.log('💰 Checking flokout IDs:', flokoutIds.length);

      if (flokoutIds.length === 0) {
        res.json({ settle_up_items: [] });
        return;
      }

      // Get all expense shares where current user is involved
      // We'll get shares in two parts: where user owes money, and where user is owed money
      
      // First, get shares where current user owes money (user_id = current user)
      const { data: owingShares, error: owingError } = await supabaseClient
        .from('expense_shares')
        .select(`
          *,
          expense:expense_id(*),
          user:user_id(*)
        `)
        .eq('user_id', req.user.id)
        .not('status', 'eq', 'settled');

      if (owingError) {
        console.error('Error fetching owing shares:', owingError);
        res.status(500).json({ error: 'Failed to fetch owing shares' });
        return;
      }

      // Second, get expenses where current user is the payer (to find who owes them)
      const { data: paidExpenses, error: paidError } = await supabaseClient
        .from('expenses')
        .select(`
          *,
          expense_shares!inner(
            *,
            user:user_id(*)
          )
        `)
        .eq('paid_by', req.user.id)
        .not('expense_shares.status', 'eq', 'settled')
        .neq('expense_shares.user_id', req.user.id); // Exclude self

      if (paidError) {
        console.error('Error fetching paid expenses:', paidError);
        res.status(500).json({ error: 'Failed to fetch paid expenses' });
        return;
      }

      // Combine and format the data
      const expenseShares: any[] = [];

      // Add owing shares
      if (owingShares) {
        owingShares.forEach(share => {
          if (share.expense && flokoutIds.includes(share.expense.flok_id)) {
            expenseShares.push({
              ...share,
              expense: {
                ...share.expense,
                paid_by: share.expense.paid_by,
                payer: null // Will be fetched separately if needed
              }
            });
          }
        });
      }

      // Add owed shares (from paid expenses)
      if (paidExpenses) {
        paidExpenses.forEach(expense => {
          if (flokoutIds.includes(expense.flok_id)) {
            expense.expense_shares.forEach((share: any) => {
              expenseShares.push({
                ...share,
                expense: {
                  ...expense,
                  payer: null // Will be fetched separately if needed
                }
              });
            });
          }
        });
      }

      console.log('💰 Found expense shares:', expenseShares?.length || 0);

      if (!expenseShares || expenseShares.length === 0) {
        res.json({ settle_up_items: [] });
        return;
      }

      // Process shares to create settle up items
      const balances: Record<string, Record<string, { 
        amount: number, 
        shareIds: string[], 
        status: 'pending' | 'verifying'
      }>> = {};

      // Initialize balance sheet
      expenseShares.forEach((share: any) => {
        const expense = share.expense;
        if (!expense || !flokoutIds.includes(expense.flok_id)) return;

        const payerId = expense.paid_by;
        const debtorId = share.user_id;

        // Skip if this is the same person
        if (payerId === debtorId) return;

        // Initialize objects if they don't exist
        if (!balances[debtorId]) balances[debtorId] = {};
        if (!balances[debtorId][payerId]) {
          balances[debtorId][payerId] = { amount: 0, shareIds: [], status: 'pending' };
        }

        // Add amount and share ID
        balances[debtorId][payerId].amount += share.amount;
        balances[debtorId][payerId].shareIds.push(share.id);

        // Update status - if any share is 'verifying', mark the whole item as verifying
        if (share.status === 'verifying') {
          balances[debtorId][payerId].status = 'verifying';
        }
      });

      // Fetch all profiles for users in the balances
      const userIds = new Set<string>();
      
      Object.keys(balances).forEach(debtorId => {
        userIds.add(debtorId);
        Object.keys(balances[debtorId]).forEach(payerId => {
          userIds.add(payerId);
        });
      });

      const { data: profilesData, error: profilesError } = await supabaseClient
        .from('profiles')
        .select('*')
        .in('id', Array.from(userIds));

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        res.status(500).json({ error: 'Failed to fetch user profiles' });
        return;
      }

      // Create settle up items
      const settleItems: any[] = [];

      Object.keys(balances).forEach(debtorId => {
        Object.keys(balances[debtorId]).forEach(payerId => {
          const fromUser = profilesData?.find(p => p.id === debtorId);
          const toUser = profilesData?.find(p => p.id === payerId);

          if (fromUser && toUser && balances[debtorId][payerId].amount > 0) {
            settleItems.push({
              from: fromUser,
              to: toUser,
              amount: Number(balances[debtorId][payerId].amount.toFixed(2)),
              expense_share_ids: balances[debtorId][payerId].shareIds,
              status: balances[debtorId][payerId].status
            });
          }
        });
      });

      // Filter settleItems to include only those involving the current user
      const relevantItems = settleItems.filter(item => 
        item.from.id === req.user?.id || item.to.id === req.user?.id
      );

      console.log('💰 Found settle up items:', relevantItems.length);

      res.json({ settle_up_items: relevantItems });
    } catch (error: any) {
      console.error('Get settle up error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Mark settlement as sent (changes status to verifying)
   */
  static async markAsSent(req: AuthenticatedRequest, res: Response): Promise<void> {
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
      const { data: updatedShares, error: updateError } = await supabaseClient
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
    } catch (error: any) {
      console.error('Mark as sent error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Mark settlement as received (changes status to settled)
   */
  static async markAsReceived(req: AuthenticatedRequest, res: Response): Promise<void> {
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
      const { data: shares, error: getError } = await supabaseClient
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
      const invalidShares = shares.filter((share: any) => share.expenses.paid_by !== req.user?.id);
      if (invalidShares.length > 0) {
        res.status(403).json({ 
          error: 'You can only mark payments as received for expenses you paid for' 
        });
        return;
      }

      // Update expense shares to "settled" status
      const { data: updatedShares, error: updateError } = await supabaseClient
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
    } catch (error: any) {
      console.error('Mark as received error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get expense shares for a specific expense
   */
  static async getExpenseShares(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { expenseId } = req.params;

      // First check if user has access to this expense
      const { data: expense, error: expenseError } = await supabaseClient
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
      const { data: membership } = await supabaseClient
        .from('flokmates')
        .select('role')
        .eq('flok_id', (expense.flokouts as any).flok_id)
        .eq('user_id', req.user.id)
        .single();

      if (!membership) {
        res.status(403).json({ error: 'Access denied. You are not a member of this flok.' });
        return;
      }

      const { data: shares, error: sharesError } = await supabaseClient
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
    } catch (error: any) {
      console.error('Get expense shares error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
} 