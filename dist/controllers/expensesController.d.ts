import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
/**
 * Expenses Controller - Complete Expense Management with Sharing and Settle Up
 */
export declare class ExpensesController {
    /**
     * Get expenses with optional filters
     */
    static getExpenses(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Create new expense with automatic share calculation
     */
    static createExpense(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get expense by ID with shares
     */
    static getExpenseById(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Update expense
     */
    static updateExpense(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Delete expense
     */
    static deleteExpense(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get settle up calculations for user
     */
    static getSettleUp(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Mark settlement as sent (changes status to verifying)
     */
    static markAsSent(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Mark settlement as received (changes status to settled)
     */
    static markAsReceived(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get expense shares for a specific expense
     */
    static getExpenseShares(req: AuthenticatedRequest, res: Response): Promise<void>;
}
//# sourceMappingURL=expensesController.d.ts.map