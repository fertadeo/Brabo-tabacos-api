import { body, param, query } from 'express-validator';
import { MovementType, MovementDirection, MovementReferenceType, MovementStatus } from '../entities/SupplierAccount';

// Valores válidos para validación en tiempo de ejecución
const MOVEMENT_TYPE_VALUES: MovementType[] = ['commitment', 'debt', 'payment', 'adjustment'];
const MOVEMENT_DIRECTION_VALUES: MovementDirection[] = ['debit', 'credit'];
const MOVEMENT_REFERENCE_TYPE_VALUES: MovementReferenceType[] = ['purchase', 'invoice', 'payment', 'delivery_note', 'adjustment'];
const MOVEMENT_STATUS_VALUES: MovementStatus[] = ['pending', 'paid', 'overdue', 'cancelled'];

// Validación para obtener cuenta de proveedor
export const getSupplierAccountValidation = [
  param('supplierId')
    .isInt({ min: 1 })
    .withMessage('supplierId debe ser un número entero positivo')
];

// Validación para actualizar límite de crédito
export const updateCreditLimitValidation = [
  param('supplierId')
    .isInt({ min: 1 })
    .withMessage('supplierId debe ser un número entero positivo'),
  
  body('credit_limit')
    .isFloat({ min: 0 })
    .withMessage('credit_limit debe ser un número positivo')
];

// Validación para obtener movimientos de cuenta
export const getMovementsValidation = [
  param('supplierId')
    .isInt({ min: 1 })
    .withMessage('supplierId debe ser un número entero positivo'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page debe ser un número entero positivo'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit debe ser un número entero entre 1 y 100'),
  
  query('movement_type')
    .optional()
    .isIn(MOVEMENT_TYPE_VALUES)
    .withMessage(`movement_type debe ser uno de: ${MOVEMENT_TYPE_VALUES.join(', ')}`),
  
  query('date_from')
    .optional()
    .isISO8601()
    .withMessage('date_from debe ser una fecha válida en formato ISO 8601'),
  
  query('date_to')
    .optional()
    .isISO8601()
    .withMessage('date_to debe ser una fecha válida en formato ISO 8601')
];

// Validación para crear movimiento de cuenta
export const createMovementValidation = [
  body('supplier_id')
    .isInt({ min: 1 })
    .withMessage('supplier_id debe ser un número entero positivo'),
  
  body('movement_type')
    .isIn(MOVEMENT_TYPE_VALUES)
    .withMessage(`movement_type debe ser uno de: ${MOVEMENT_TYPE_VALUES.join(', ')}`),
  
  body('type')
    .isIn(MOVEMENT_DIRECTION_VALUES)
    .withMessage(`type debe ser uno de: ${MOVEMENT_DIRECTION_VALUES.join(', ')}`),
  
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('amount debe ser un número positivo mayor a 0'),
  
  body('reference_type')
    .optional()
    .isIn(MOVEMENT_REFERENCE_TYPE_VALUES)
    .withMessage(`reference_type debe ser uno de: ${MOVEMENT_REFERENCE_TYPE_VALUES.join(', ')}`),
  
  body('reference_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('reference_id debe ser un número entero positivo'),
  
  body('description')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('description no puede exceder 500 caracteres'),
  
  body('due_date')
    .optional()
    .isISO8601()
    .withMessage('due_date debe ser una fecha válida en formato ISO 8601'),
  
  body('payment_date')
    .optional()
    .isISO8601()
    .withMessage('payment_date debe ser una fecha válida en formato ISO 8601'),
  
  body('status')
    .optional()
    .isIn(MOVEMENT_STATUS_VALUES)
    .withMessage(`status debe ser uno de: ${MOVEMENT_STATUS_VALUES.join(', ')}`)
];

// Validación para actualizar movimiento
export const updateMovementValidation = [
  param('movementId')
    .isInt({ min: 1 })
    .withMessage('movementId debe ser un número entero positivo'),
  
  body('status')
    .optional()
    .isIn(MOVEMENT_STATUS_VALUES)
    .withMessage(`status debe ser uno de: ${MOVEMENT_STATUS_VALUES.join(', ')}`),
  
  body('payment_date')
    .optional()
    .isISO8601()
    .withMessage('payment_date debe ser una fecha válida en formato ISO 8601'),
  
  body('description')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('description no puede exceder 500 caracteres')
];

// Validación para sincronizar balances
export const syncAccountBalancesValidation = [
  param('supplierId')
    .isInt({ min: 1 })
    .withMessage('supplierId debe ser un número entero positivo')
];

