import { Router } from 'express';
import { ExpensesController } from '../controllers/expensesController';
import { authenticate } from '../middleware/auth';

/**
 * Expenses Routes - Complete Expense Management with Sharing and Settle Up
 * 
 * All routes require authentication
 */

const router = Router();

// All routes require authentication
router.use(authenticate);

// Expense CRUD operations
router.get('/', ExpensesController.getExpenses);                           // Get expenses (with filters)
router.post('/', ExpensesController.createExpense);                        // Create new expense
router.get('/:id', ExpensesController.getExpenseById);                     // Get expense details
router.put('/:id', ExpensesController.updateExpense);                      // Update expense
router.delete('/:id', ExpensesController.deleteExpense);                   // Delete expense

// Expense shares
router.get('/:expenseId/shares', ExpensesController.getExpenseShares);     // Get shares for expense

// Settle up functionality
router.get('/settle-up/calculate', ExpensesController.getSettleUp);        // Get settle up calculations
router.post('/settle-up/mark-sent', ExpensesController.markAsSent);        // Mark payment as sent
router.post('/settle-up/mark-received', ExpensesController.markAsReceived); // Mark payment as received

export default router; 