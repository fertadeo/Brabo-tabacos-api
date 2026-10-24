import { Router } from 'express';
import { AccruedExpenseController } from '../controllers/accruedExpenseController';
import {
  createAccruedExpenseValidation,
  updateAccruedExpenseValidation,
  linkInvoiceToExpenseValidation
} from '../middleware/accruedExpenseValidation';
import { authenticateJWT, authorizeRoles } from '../middleware/jwt';

const router = Router();
const expenseController = new AccruedExpenseController();

// Apply JWT authentication to all expense routes
router.use(authenticateJWT);

/**
 * @route GET /api/accrued-expenses
 * @desc Get all accrued expenses with pagination and filters
 * @access Private (gerencia, finanzas)
 */
router.get('/', authorizeRoles('gerencia', 'finanzas'), expenseController.getAllExpenses.bind(expenseController));

/**
 * @route GET /api/accrued-expenses/:id
 * @desc Get expense by ID
 * @access Private (gerencia, finanzas)
 */
router.get('/:id', authorizeRoles('gerencia', 'finanzas'), expenseController.getExpenseById.bind(expenseController));

/**
 * @route POST /api/accrued-expenses
 * @desc Create new expense
 * @access Private (gerencia, finanzas)
 */
router.post('/', authorizeRoles('gerencia', 'finanzas'), createAccruedExpenseValidation, expenseController.createExpense.bind(expenseController));

/**
 * @route PUT /api/accrued-expenses/:id
 * @desc Update expense
 * @access Private (gerencia, finanzas)
 */
router.put('/:id', authorizeRoles('gerencia', 'finanzas'), updateAccruedExpenseValidation, expenseController.updateExpense.bind(expenseController));

/**
 * @route DELETE /api/accrued-expenses/:id
 * @desc Delete expense
 * @access Private (gerencia, finanzas)
 */
router.delete('/:id', authorizeRoles('gerencia', 'finanzas'), expenseController.deleteExpense.bind(expenseController));

/**
 * @route POST /api/accrued-expenses/:id/link-invoice
 * @desc Link invoice to expense
 * @access Private (gerencia, finanzas)
 */
router.post('/:id/link-invoice', authorizeRoles('gerencia', 'finanzas'), linkInvoiceToExpenseValidation, expenseController.linkInvoiceToExpense.bind(expenseController));

/**
 * @route POST /api/accrued-expenses/:id/update-payment-status
 * @desc Update payment status
 * @access Private (gerencia, finanzas)
 */
router.post('/:id/update-payment-status', authorizeRoles('gerencia', 'finanzas'), expenseController.updatePaymentStatus.bind(expenseController));

export default router;

