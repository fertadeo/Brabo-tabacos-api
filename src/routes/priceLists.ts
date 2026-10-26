import { Router } from 'express';
import { PriceListController } from '../controllers/priceListController';
import { authenticateJWT, authorizeRoles } from '../middleware/jwt';

const router = Router();
const controller = new PriceListController();

router.get(
  '/',
  authenticateJWT,
  authorizeRoles('gerencia', 'ventas', 'logistica', 'finanzas'),
  controller.getAll.bind(controller)
);

export default router;
