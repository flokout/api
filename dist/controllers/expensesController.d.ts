import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
/**
 * Expenses Controller - Complete Expense Management with Global Tracking
 */
export declare class ExpensesController {
    /**
     * Get expenses with optional filters - supports global view across all floks
     */
    static getExpenses(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Create expense with proper flokout_id relationship
     */
    static createExpense(req: AuthenticatedRequest, res: Response): Promise<void>;
    /**
     * Get global settle up data across all floks - simplified approach matching web app
     */
    static getSettleUp(req: AuthenticatedRequest, res: Response): Promise<void>;
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