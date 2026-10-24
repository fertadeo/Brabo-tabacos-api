import { Router, Request, Response } from 'express';
import { authenticateJWT, authorizeRoles } from '../middleware/jwt';
import { query } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation';
import { SystemHealthController } from '../controllers/systemHealthController';

const router = Router();
const controller = new SystemHealthController();

router.use(authenticateJWT);
router.use(authorizeRoles('superadmin'));

router.get(
  '/events',
  query('event_type').optional().isIn(['activity', 'error', 'alert']),
  query('severity').optional().isIn(['info', 'warning', 'error', 'critical']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('user_id').optional().isInt({ min: 1 }),
  handleValidationErrors,
  (req: Request, res: Response) => controller.getEvents(req as any, res)
);

router.get('/stats', (req: Request, res: Response) => controller.getStats(req as any, res));
router.get('/status', (req: Request, res: Response) => controller.getStatus(req as any, res));
router.get('/modules', (req: Request, res: Response) => controller.getModules(req as any, res));
router.get('/overview', (req: Request, res: Response) => controller.getOverview(req as any, res));

export default router;
