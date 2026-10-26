import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation';
import { authenticateJWT, authorizeRoles, AuthenticatedRequest } from '../middleware/jwt';
import { BudgetController } from '../controllers/budgetController';
import { NextFunction, Response } from 'express';
import { ApiResponse } from '../types';
import { normalizeBudgetLine } from '../utils/budgetItems';

const router = Router();
const controller = new BudgetController();

router.use(authenticateJWT);

const BUDGET_VIEW = ['admin', 'gerencia', 'ventas', 'finanzas', 'logistica', 'manager', 'employee', 'viewer'] as const;
const BUDGET_EDIT = ['admin', 'gerencia', 'ventas'] as const;
const BUDGET_DELETE = ['admin', 'gerencia'] as const;

/** Acepta snake_case y camelCase en body (alineado con ventas). */
const normalizeBudgetBody = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  if (!req.body || (req.method !== 'POST' && req.method !== 'PUT')) {
    return next();
  }
  const b = req.body;
  if (b.clientId !== undefined && b.client_id === undefined) {
    req.body.client_id = b.clientId;
  }
  if (b.repairOrderId !== undefined && b.repair_order_id === undefined) {
    req.body.repair_order_id = b.repairOrderId;
  }
  if (b.validUntil !== undefined && b.valid_until === undefined) {
    req.body.valid_until = b.validUntil;
  }
  if (b.allowInactive !== undefined && b.allow_inactive === undefined) {
    req.body.allow_inactive = b.allowInactive;
  }
  if (b.exchangeRate !== undefined && b.exchange_rate === undefined) {
    req.body.exchange_rate = b.exchangeRate;
  }
  if (b.exchange_rate !== undefined && b.exchange_rate !== null && b.exchange_rate !== '') {
    const rate = typeof b.exchange_rate === 'string' ? parseFloat(b.exchange_rate) : Number(b.exchange_rate);
    if (Number.isFinite(rate)) req.body.exchange_rate = rate;
  }
  // items: catálogo (product_id) o manual (description); XOR validado en normalizeBudgetLine
  if (Array.isArray(b.items)) {
    try {
      req.body.items = b.items.map((item: Record<string, unknown>) =>
        normalizeBudgetLine(item)
      );
    } catch (err) {
      (req as any).budgetItemsNormalizeError =
        err instanceof Error ? err.message : 'Ítems de presupuesto inválidos';
    }
  }
  next();
};

const rejectBudgetItemsNormalizeError = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const msg = (req as any).budgetItemsNormalizeError as string | undefined;
  if (msg) {
    const response: ApiResponse = {
      success: false,
      message: msg,
      timestamp: new Date().toISOString()
    };
    res.status(400).json(response);
    return;
  }
  next();
};

const normalizeConvertBody = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  const b = req.body;
  if (!b || typeof b !== 'object') return next();
  if (b.paymentMethod !== undefined && b.payment_method === undefined) {
    req.body.payment_method = String(b.paymentMethod).toLowerCase();
  }
  if (b.clientId !== undefined && b.client_id === undefined) {
    req.body.client_id = b.clientId;
  }
  if (b.paymentDetails !== undefined && b.payment_details === undefined) {
    req.body.payment_details = b.paymentDetails;
  }
  if (b.syncToWooCommerce !== undefined && b.sync_to_woocommerce === undefined) {
    req.body.sync_to_woocommerce = b.syncToWooCommerce;
  }
  if (b.allowInactive !== undefined && b.allow_inactive === undefined) {
    req.body.allow_inactive = b.allowInactive;
  }
  next();
};

const idParam = [param('id').isInt({ min: 1 }).withMessage('ID inválido')];

const createValidation = [
  body('client_id').isInt({ min: 1 }).withMessage('client_id requerido'),
  body('items').isArray({ min: 1 }).withMessage('Debe incluir al menos un ítem'),
  body('valid_until')
    .optional({ values: 'null' })
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value)) return true
      throw new Error('valid_until debe ser fecha ISO (YYYY-MM-DD)')
    }),
  body('notes').optional({ values: 'falsy' }).isString().isLength({ max: 5000 }).withMessage('notes demasiado largo'),
  body('allow_inactive').optional({ values: 'falsy' }).isBoolean().withMessage('allow_inactive booleano'),
  body('exchange_rate')
    .optional({ nullable: true })
    .isFloat({ gt: 0 })
    .withMessage('exchange_rate debe ser un número mayor a 0'),
  body('repair_order_id')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === '') return true;
      const n = typeof value === 'string' ? parseInt(value, 10) : Number(value);
      if (Number.isInteger(n) && n >= 1) return true;
      throw new Error('repair_order_id inválido');
    })
];

const updateValidation = [
  body('client_id').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('client_id inválido'),
  body('items').optional().isArray({ min: 1 }).withMessage('items debe ser array no vacío'),
  body('valid_until')
    .optional({ values: 'null' })
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value)) return true
      throw new Error('valid_until debe ser fecha ISO (YYYY-MM-DD)')
    }),
  body('notes').optional({ values: 'falsy' }).isString().isLength({ max: 5000 }).withMessage('notes demasiado largo'),
  body('allow_inactive').optional({ values: 'falsy' }).isBoolean().withMessage('allow_inactive booleano'),
  body('exchange_rate')
    .optional({ nullable: true })
    .isFloat({ gt: 0 })
    .withMessage('exchange_rate debe ser un número mayor a 0'),
  body('repair_order_id')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === '') return true;
      const n = typeof value === 'string' ? parseInt(value, 10) : Number(value);
      if (Number.isInteger(n) && n >= 1) return true;
      throw new Error('repair_order_id inválido');
    })
];

const listQuery = [
  query('client_id').optional().isInt({ min: 1 }),
  query('repair_order_id').optional().isInt({ min: 1 }),
  query('status').optional().isIn(['draft', 'sent', 'approved', 'rejected', 'expired']),
  query('date_from').optional().isISO8601(),
  query('date_to').optional().isISO8601(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
];

const convertValidation = [
  body('payment_method').isIn(['efectivo', 'tarjeta', 'transferencia', 'mixto']).withMessage('payment_method inválido'),
  body('payment_details').optional({ values: 'falsy' }).isObject(),
  body('payment_details.efectivo').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('payment_details.tarjeta').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('payment_details.transferencia').optional({ values: 'falsy' }).isFloat({ min: 0 }),
  body('notes').optional({ values: 'falsy' }).isString().isLength({ max: 1000 }),
  body('sync_to_woocommerce').optional({ values: 'falsy' }).isBoolean(),
  body('allow_inactive').optional({ values: 'falsy' }).isBoolean(),
  body('client_id').optional({ values: 'falsy' }).isInt({ min: 1 })
];

router.get('/stats', authorizeRoles(...BUDGET_VIEW), controller.getStats.bind(controller));

router.get('/', authorizeRoles(...BUDGET_VIEW), validate(listQuery), controller.getAll.bind(controller));

router.get('/:id', authorizeRoles(...BUDGET_VIEW), validate(idParam), controller.getById.bind(controller));

router.post(
  '/',
  authorizeRoles(...BUDGET_EDIT),
  normalizeBudgetBody,
  rejectBudgetItemsNormalizeError,
  validate(createValidation),
  controller.create.bind(controller)
);

router.put(
  '/:id',
  authorizeRoles(...BUDGET_EDIT),
  normalizeBudgetBody,
  rejectBudgetItemsNormalizeError,
  validate([...idParam, ...updateValidation]),
  controller.update.bind(controller)
);

router.delete('/:id', authorizeRoles(...BUDGET_DELETE), validate(idParam), controller.remove.bind(controller));

router.post('/:id/send', authorizeRoles(...BUDGET_EDIT), validate(idParam), controller.send.bind(controller));

router.post('/:id/approve', authorizeRoles(...BUDGET_EDIT), validate(idParam), controller.approve.bind(controller));

router.post('/:id/reject', authorizeRoles(...BUDGET_EDIT), validate(idParam), controller.reject.bind(controller));

router.post('/:id/expire', authorizeRoles(...BUDGET_EDIT), validate(idParam), controller.expire.bind(controller));

router.post(
  '/:id/convert-to-sale',
  authorizeRoles(...BUDGET_EDIT),
  normalizeConvertBody,
  validate([...idParam, ...convertValidation]),
  controller.convertToSale.bind(controller)
);

export default router;
