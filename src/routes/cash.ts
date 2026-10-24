import { Router } from 'express';
import CashController from '../controllers/cashController';
import { authenticateJWT, authorizeRoles } from '../middleware/jwt';

const router = Router();

// All cash endpoints require authentication; roles common for financial data
router.use(authenticateJWT);

// Day summary: GET /api/cash/day?date=YYYY-MM-DD
router.get('/day', authorizeRoles('admin', 'manager', 'finanzas', 'gerencia'), (req, res) => CashController.getDaySummary(req, res));

// Period summary: GET /api/cash/period?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/period', authorizeRoles('admin', 'manager', 'finanzas', 'gerencia'), (req, res) => CashController.getPeriodSummary(req, res));

// Monthly summary and comparison: GET /api/cash/monthly?year=YYYY&month=MM
router.get('/monthly', authorizeRoles('admin', 'manager', 'finanzas', 'gerencia'), (req, res) => CashController.getMonthlySummary(req, res));

// Recent movements: GET /api/cash/movements?limit=20&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/movements', authorizeRoles('admin', 'manager', 'finanzas', 'gerencia'), (req, res) => CashController.getRecentMovements(req, res));

// Payment methods distribution: GET /api/cash/payment-methods?from&to
router.get('/payment-methods', authorizeRoles('admin', 'manager', 'finanzas', 'gerencia'), (req, res) => CashController.getPaymentMethods(req, res));

// Expenses: GET list and POST create
router.get('/expenses', authorizeRoles('admin', 'manager', 'finanzas', 'gerencia'), (req, res) => CashController.listExpenses(req, res));
router.post('/expenses', authorizeRoles('admin', 'manager', 'finanzas', 'gerencia'), (req, res) => CashController.createExpense(req, res));

// CSV Exports
router.get('/export/movements', authorizeRoles('admin', 'manager', 'finanzas', 'gerencia'), (req, res) => CashController.exportMovementsCsv(req, res));
router.get('/export/period', authorizeRoles('admin', 'manager', 'finanzas', 'gerencia'), (req, res) => CashController.exportPeriodCsv(req, res));

export default router;

