"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const expensesController_1 = require("../controllers/expensesController");
const auth_1 = require("../middleware/auth");
/**
 * Expenses Routes - Complete Expense Management with Sharing and Settle Up
 *
 * All routes require authentication
 */
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
// Expense CRUD operations
router.get('/', expensesController_1.ExpensesController.getExpenses); // Get expenses (with filters)
router.post('/', expensesController_1.ExpensesController.createExpense); // Create new expense
router.get('/:id', expensesController_1.ExpensesController.getExpenseById); // Get expense details
router.put('/:id', expensesController_1.ExpensesController.updateExpense); // Update expense
router.delete('/:id', expensesController_1.ExpensesController.deleteExpense); // Delete expense
// Expense shares
router.get('/:expenseId/shares', expensesController_1.ExpensesController.getExpenseShares); // Get shares for expense
// Settle up functionality
router.get('/settle-up/calculate', expensesController_1.ExpensesController.getSettleUp); // Get settle up calculations
router.post('/settle-up/mark-sent', expensesController_1.ExpensesController.markAsSent); // Mark payment as sent
router.post('/settle-up/mark-received', expensesController_1.ExpensesController.markAsReceived); // Mark payment as received
exports.default = router;
//# sourceMappingURL=expenses.js.map