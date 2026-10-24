import { Router } from 'express';
import { DashboardController } from '../controllers/dashboardController';
import { authenticateJWT, authorizeRoles } from '../middleware/jwt';
import { query } from 'express-validator';
import { validate } from '../middleware/validation';

const router = Router();
const dashboardController = new DashboardController();

const DASHBOARD_INSIGHTS_ROLES = [
  'admin',
  'gerencia',
  'finanzas',
  'ventas',
  'manager'
] as const;

const insightsQuery = [
  query('date_from').optional().isISO8601({ strict: true }).withMessage('date_from debe ser YYYY-MM-DD'),
  query('date_to').optional().isISO8601({ strict: true }).withMessage('date_to debe ser YYYY-MM-DD'),
  query('timezone').optional().isString().isLength({ max: 64 })
];

// All dashboard routes require JWT auth
router.use(authenticateJWT);

// GET /api/dashboard/insights — agregados del mes (highlights, alertas, taller)
router.get(
  '/insights',
  authorizeRoles(...DASHBOARD_INSIGHTS_ROLES),
  validate(insightsQuery),
  dashboardController.getInsights.bind(dashboardController)
);

// GET /api/dashboard/stats - Get dashboard statistics
router.get('/stats', authorizeRoles('gerencia', 'finanzas'), dashboardController.getDashboardStats.bind(dashboardController));

// GET /api/dashboard/activities - Get recent activities
router.get('/activities', authorizeRoles('gerencia', 'finanzas'), dashboardController.getRecentActivities.bind(dashboardController));

export default router;
