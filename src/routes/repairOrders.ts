import { Router, Response, NextFunction } from 'express';
import { RepairOrderController } from '../controllers/repairOrderController';
import { validate } from '../middleware/validation';
import { authenticateApiKey } from '../middleware/auth';
import { authenticateJWT, authorizeRoles } from '../middleware/jwt';
import { AuthenticatedRequest } from '../middleware/jwt';
import { ApiResponse } from '../types';
import {
  createRepairOrderValidation,
  updateRepairOrderValidation,
  idParamValidation,
  itemIdParamValidation,
  repairOrderFiltersValidation,
  addItemValidation,
  updateItemValidation,
  acceptBodyValidation,
  updateStatusBodyValidation,
  addPaymentBodyValidation
} from '../middleware/repairOrderValidation';

const REPAIR_VIEW_ROLES = ['admin', 'gerencia', 'ventas', 'logistica', 'finanzas', 'manager', 'employee', 'viewer'] as const;

const router = Router();
const controller = new RepairOrderController();

/**
 * Usuario logueado: si viene `Authorization: Bearer <JWT>`, validación estricta (token inválido/vencido → 401 claro).
 * Integraciones: sin Bearer pero con `x-api-key` válida.
 * Evita el fallo silencioso de optional JWT que dejaba sin usuario y respondía solo "Se requiere autenticación".
 */
const authenticateRepair = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    authenticateJWT(req, res, next);
    return;
  }
  if (req.headers['x-api-key']) {
    void authenticateApiKey(req as any, res, next);
    return;
  }
  res.status(401).json({
    success: false,
    message: 'Se requiere autenticación',
    error: 'Envía Authorization: Bearer <token> (JWT) o el header x-api-key',
    timestamp: new Date().toISOString()
  } as ApiResponse);
};

const normalizeRepairBody = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  if (!req.body || (req.method !== 'POST' && req.method !== 'PUT')) return next();
  const b = req.body;
  if (b.clientId !== undefined && b.client_id === undefined) req.body.client_id = b.clientId;
  if (b.equipmentDescription !== undefined && b.equipment_description === undefined) req.body.equipment_description = b.equipmentDescription;
  if (b.customerDeclaredFault !== undefined && b.customer_declared_fault === undefined) req.body.customer_declared_fault = b.customerDeclaredFault;
  if (b.workDescription !== undefined && b.work_description === undefined) req.body.work_description = b.workDescription;
  if (b.receptionDate !== undefined && b.reception_date === undefined) req.body.reception_date = b.receptionDate;
  if (b.deliveryDateEstimated !== undefined && b.delivery_date_estimated === undefined) req.body.delivery_date_estimated = b.deliveryDateEstimated;
  if (b.laborAmount !== undefined && b.labor_amount === undefined) req.body.labor_amount = b.laborAmount;
  if (b.daysToClaim !== undefined && b.days_to_claim === undefined) req.body.days_to_claim = b.daysToClaim;
  if (b.paymentDate !== undefined && b.payment_date === undefined) req.body.payment_date = b.paymentDate;
  if (b.movementType !== undefined && b.movement_type === undefined) req.body.movement_type = b.movementType;
  if (b.productId !== undefined && b.product_id === undefined) req.body.product_id = b.productId;
  if (b.unitPrice !== undefined && b.unit_price === undefined) req.body.unit_price = b.unitPrice;
  next();
};

// GET /api/repair-orders (list) y GET /api/repair-orders/stats deben ir antes de /:id
router.get('/',
  authenticateJWT,
  authorizeRoles(...REPAIR_VIEW_ROLES),
  validate(repairOrderFiltersValidation),
  controller.list.bind(controller)
);

router.get('/stats',
  authenticateJWT,
  authorizeRoles(...REPAIR_VIEW_ROLES),
  controller.getStats.bind(controller)
);

// POST crear orden (requiere auth)
router.post('/',
  authenticateRepair,
  normalizeRepairBody,
  validate(createRepairOrderValidation),
  controller.create.bind(controller)
);

// Rutas con :id
router.get('/:id',
  authenticateRepair,
  validate(idParamValidation),
  controller.getById.bind(controller)
);

router.put('/:id',
  authenticateRepair,
  normalizeRepairBody,
  validate(idParamValidation),
  validate(updateRepairOrderValidation),
  controller.update.bind(controller)
);

router.get('/:id/items',
  authenticateRepair,
  validate(idParamValidation),
  controller.getItems.bind(controller)
);

router.post('/:id/items',
  authenticateRepair,
  normalizeRepairBody,
  validate(idParamValidation),
  validate(addItemValidation),
  controller.addItem.bind(controller)
);

router.put('/:id/items/:itemId',
  authenticateRepair,
  normalizeRepairBody,
  validate(idParamValidation),
  validate(itemIdParamValidation),
  validate(updateItemValidation),
  controller.updateItem.bind(controller)
);

router.delete('/:id/items/:itemId',
  authenticateRepair,
  validate(idParamValidation),
  validate(itemIdParamValidation),
  controller.deleteItem.bind(controller)
);

router.post('/:id/send-budget',
  authenticateRepair,
  validate(idParamValidation),
  controller.sendBudget.bind(controller)
);

router.post('/:id/accept',
  authenticateRepair,
  normalizeRepairBody,
  validate(idParamValidation),
  validate(acceptBodyValidation),
  controller.accept.bind(controller)
);

router.post('/:id/cancel',
  authenticateRepair,
  validate(idParamValidation),
  controller.cancel.bind(controller)
);

router.put('/:id/status',
  authenticateRepair,
  validate(idParamValidation),
  validate(updateStatusBodyValidation),
  controller.updateStatus.bind(controller)
);

router.get('/:id/acceptance-document',
  authenticateRepair,
  validate(idParamValidation),
  controller.getAcceptanceDocument.bind(controller)
);

router.get('/:id/payments',
  authenticateRepair,
  validate(idParamValidation),
  controller.getPayments.bind(controller)
);

router.post('/:id/payments',
  authenticateRepair,
  validate(idParamValidation),
  validate(addPaymentBodyValidation),
  controller.addPayment.bind(controller)
);

export default router;
