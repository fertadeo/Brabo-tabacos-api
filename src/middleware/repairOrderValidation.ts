import { body, param, query } from 'express-validator';

const STATUS_VALUES = ['consulta_recibida', 'presupuestado', 'aceptado', 'en_proceso_reparacion', 'listo_entrega', 'entregado', 'cancelado'] as const;
const STATUS_TRANSITION_VALUES = ['en_proceso_reparacion', 'listo_entrega', 'entregado'] as const;
const PAYMENT_METHODS = ['efectivo', 'tarjeta', 'transferencia'] as const;

export const createRepairOrderValidation = [
  body('client_id').isInt({ min: 1 }).withMessage('client_id es requerido y debe ser entero positivo'),
  body('equipment_description').notEmpty().trim().withMessage('equipment_description es requerido'),
  body('customer_declared_fault').notEmpty().trim().withMessage('customer_declared_fault es requerido'),
  body('diagnosis').optional().isString().trim(),
  body('work_description').optional().isString().trim(),
  body('reception_date').notEmpty().withMessage('reception_date es requerido').isISO8601().withMessage('reception_date debe ser fecha válida'),
  body('delivery_date_estimated').optional().isISO8601().withMessage('delivery_date_estimated debe ser fecha válida'),
  body('labor_amount').optional().isFloat({ min: 0 }).withMessage('labor_amount debe ser número >= 0'),
  body('notes').optional().isString().trim()
];

export const updateRepairOrderValidation = [
  body('equipment_description').optional().notEmpty().trim(),
  body('customer_declared_fault')
    .optional({ nullable: true })
    .custom((value) => value === null || typeof value === 'string')
    .withMessage('customer_declared_fault debe ser string o null'),
  body('diagnosis').optional().isString().trim(),
  body('work_description').optional().isString().trim(),
  body('reception_date').optional().isISO8601(),
  body('delivery_date_estimated').optional().isISO8601(),
  body('labor_amount').optional().isFloat({ min: 0 }),
  body('notes').optional().isString().trim()
];

export const idParamValidation = [
  param('id').isInt({ min: 1 }).withMessage('ID debe ser entero positivo')
];

export const itemIdParamValidation = [
  param('itemId').isInt({ min: 1 }).withMessage('itemId debe ser entero positivo')
];

export const repairOrderFiltersValidation = [
  query('status').optional().isIn(STATUS_VALUES).withMessage('status inválido'),
  query('client_id').optional().isInt({ min: 1 }).withMessage('client_id debe ser entero positivo'),
  query('date_from').optional().isISO8601().withMessage('date_from debe ser fecha válida'),
  query('date_to').optional().isISO8601().withMessage('date_to debe ser fecha válida'),
  query('page').optional().isInt({ min: 1 }).withMessage('page debe ser entero positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit debe ser entre 1 y 100')
];

export const addItemValidation = [
  body('product_id')
    .optional()
    .custom((val, { req }) => {
      const id = req.body.product_id ?? req.body.productId;
      if (id === undefined || id === null || id === '') return Promise.reject(new Error('product_id o productId es requerido'));
      const n = Number(id);
      if (!Number.isInteger(n) || n < 1) return Promise.reject(new Error('product_id debe ser un entero positivo'));
      return Promise.resolve();
    }),
  body('productId').optional(),
  body('quantity')
    .optional()
    .custom((val, { req }) => {
      const q = req.body.quantity;
      if (q === undefined || q === null || q === '') return Promise.reject(new Error('quantity es requerido'));
      const n = parseInt(String(q), 10);
      if (Number.isNaN(n) || n < 1) return Promise.reject(new Error('quantity debe ser un entero positivo'));
      return Promise.resolve();
    }),
  body('unit_price')
    .optional()
    .custom((val, { req }) => {
      const p = req.body.unit_price ?? req.body.unitPrice;
      if (p === undefined || p === null || p === '') return Promise.reject(new Error('unit_price o unitPrice es requerido'));
      const n = parseFloat(String(p));
      if (Number.isNaN(n) || n < 0) return Promise.reject(new Error('unit_price debe ser un número >= 0'));
      return Promise.resolve();
    }),
  body('unitPrice').optional()
];

export const updateItemValidation = [
  body('quantity').optional().isInt({ min: 0 }).withMessage('quantity debe ser entero >= 0'),
  body('unit_price').optional().isFloat({ min: 0 }).withMessage('unit_price debe ser número >= 0')
];

export const acceptBodyValidation = [
  body('days_to_claim').optional().isInt({ min: 1 }).withMessage('days_to_claim debe ser entero positivo')
];

export const updateStatusBodyValidation = [
  body('status').isIn(STATUS_TRANSITION_VALUES).withMessage('status debe ser en_proceso_reparacion, listo_entrega o entregado')
];

export const addPaymentBodyValidation = [
  body('amount').isFloat({ min: 0.01 }).withMessage('amount es requerido y debe ser mayor a 0'),
  body('method').isIn(PAYMENT_METHODS).withMessage('method debe ser efectivo, tarjeta o transferencia'),
  body('payment_date').optional().isISO8601().withMessage('payment_date debe ser fecha/hora válida'),
  body('movement_type')
    .optional()
    .isIn(['cobro', 'devolucion'])
    .withMessage('movement_type debe ser cobro o devolucion'),
  body('notes').optional().isString().trim()
];
