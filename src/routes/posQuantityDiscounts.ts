import { Router } from 'express';
import { PosQuantityDiscountController } from '../controllers/posQuantityDiscountController';
import { authenticateJWT, authorizeRoles } from '../middleware/jwt';

const router = Router();
const controller = new PosQuantityDiscountController();

const VIEW_ROLES = ['admin', 'gerencia', 'ventas', 'finanzas'] as const;
const MANAGE_ROLES = ['admin', 'gerencia'] as const;

router.use(authenticateJWT);

router.get('/', authorizeRoles(...VIEW_ROLES), controller.list.bind(controller));
router.post('/', authorizeRoles(...MANAGE_ROLES), controller.create.bind(controller));
router.put('/:id', authorizeRoles(...MANAGE_ROLES), controller.update.bind(controller));
router.delete('/:id', authorizeRoles(...MANAGE_ROLES), controller.remove.bind(controller));

export default router;
