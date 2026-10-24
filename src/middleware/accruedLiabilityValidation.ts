import { body, param, query } from 'express-validator';
import { LiabilityType, LiabilityStatus } from '../entities/AccruedLiability';

// Valores válidos para validación en tiempo de ejecución
const LIABILITY_TYPE_VALUES: LiabilityType[] = ['impuesto', 'alquiler', 'seguro', 'servicio', 'prestamo', 'otro'];
const LIABILITY_STATUS_VALUES: LiabilityStatus[] = ['pending', 'partial_paid', 'paid', 'overdue', 'cancelled'];

// Validación para crear pasivo devengado
export const createAccruedLiabilityValidation = [
  body('liability_number')
    .optional()
    .isString()
    .withMessage('liability_number debe ser una cadena de texto'),
  
  body('liability_type')
    .isIn(LIABILITY_TYPE_VALUES)
    .withMessage(`liability_type debe ser uno de: ${LIABILITY_TYPE_VALUES.join(', ')}`),
  
  body('description')
    .notEmpty()
    .withMessage('description es requerido')
    .isString()
    .withMessage('description debe ser una cadena de texto')
    .isLength({ min: 1, max: 500 })
    .withMessage('description debe tener entre 1 y 500 caracteres'),
  
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('amount debe ser un número positivo mayor a 0'),
  
  body('accrual_date')
    .notEmpty()
    .withMessage('accrual_date es requerido')
    .isISO8601()
    .withMessage('accrual_date debe ser una fecha válida en formato ISO 8601'),
  
  body('due_date')
    .notEmpty()
    .withMessage('due_date es requerido')
    .isISO8601()
    .withMessage('due_date debe ser una fecha válida en formato ISO 8601'),
  
  body('treasury_account_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('treasury_account_id debe ser un número entero positivo'),
  
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('notes no puede exceder 1000 caracteres')
];

// Validación para actualizar pasivo devengado
export const updateAccruedLiabilityValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID debe ser un número entero positivo'),
  
  body('liability_number')
    .optional()
    .notEmpty()
    .withMessage('liability_number no puede estar vacío')
    .isString()
    .withMessage('liability_number debe ser una cadena de texto'),
  
  body('liability_type')
    .optional()
    .isIn(LIABILITY_TYPE_VALUES)
    .withMessage(`liability_type debe ser uno de: ${LIABILITY_TYPE_VALUES.join(', ')}`),
  
  body('description')
    .optional()
    .notEmpty()
    .withMessage('description no puede estar vacío')
    .isString()
    .withMessage('description debe ser una cadena de texto')
    .isLength({ min: 1, max: 500 })
    .withMessage('description debe tener entre 1 y 500 caracteres'),
  
  body('amount')
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage('amount debe ser un número positivo mayor a 0'),
  
  body('accrual_date')
    .optional()
    .isISO8601()
    .withMessage('accrual_date debe ser una fecha válida en formato ISO 8601'),
  
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
    .isIn(LIABILITY_STATUS_VALUES)
    .withMessage(`status debe ser uno de: ${LIABILITY_STATUS_VALUES.join(', ')}`),
  
  body('treasury_account_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('treasury_account_id debe ser un número entero positivo'),
  
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('notes no puede exceder 1000 caracteres')
];

// Validación para vincular pago a pasivo devengado
export const linkPaymentToLiabilityValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID debe ser un número entero positivo'),
  
  body('payment_id')
    .isInt({ min: 1 })
    .withMessage('payment_id debe ser un número entero positivo'),
  
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('amount debe ser un número positivo mayor a 0')
];

// Validación para desvincular pago de pasivo devengado
export const unlinkPaymentFromLiabilityValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID debe ser un número entero positivo'),
  
  param('paymentId')
    .isInt({ min: 1 })
    .withMessage('paymentId debe ser un número entero positivo')
];

