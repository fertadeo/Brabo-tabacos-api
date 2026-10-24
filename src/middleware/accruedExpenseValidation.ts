import { body, param, query } from 'express-validator';
import { ExpenseType, ExpenseCategory, ExpenseStatus } from '../entities/AccruedExpense';

// Valores válidos para validación en tiempo de ejecución
const EXPENSE_TYPE_VALUES: ExpenseType[] = ['compromise', 'accrual'];
const EXPENSE_CATEGORY_VALUES: ExpenseCategory[] = ['seguro', 'impuesto', 'alquiler', 'servicio', 'otro'];
const EXPENSE_STATUS_VALUES: ExpenseStatus[] = ['pending', 'paid', 'cancelled'];

// Validación para crear egreso devengado
export const createAccruedExpenseValidation = [
  body('expense_number')
    .optional()
    .isString()
    .withMessage('expense_number debe ser una cadena de texto'),
  
  body('supplier_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('supplier_id debe ser un número entero positivo'),
  
  body('expense_type')
    .isIn(EXPENSE_TYPE_VALUES)
    .withMessage(`expense_type debe ser uno de: ${EXPENSE_TYPE_VALUES.join(', ')}`),
  
  body('concept')
    .notEmpty()
    .withMessage('concept es requerido')
    .isString()
    .withMessage('concept debe ser una cadena de texto')
    .isLength({ min: 1, max: 255 })
    .withMessage('concept debe tener entre 1 y 255 caracteres'),
  
  body('category')
    .optional()
    .isIn(EXPENSE_CATEGORY_VALUES)
    .withMessage(`category debe ser uno de: ${EXPENSE_CATEGORY_VALUES.join(', ')}`),
  
  body('description')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('description no puede exceder 1000 caracteres'),
  
  body('amount')
    .isFloat({ min: 0.01 })
    .withMessage('amount debe ser un número positivo mayor a 0'),
  
  body('accrual_date')
    .notEmpty()
    .withMessage('accrual_date es requerido')
    .isISO8601()
    .withMessage('accrual_date debe ser una fecha válida en formato ISO 8601'),
  
  body('due_date')
    .optional()
    .isISO8601()
    .withMessage('due_date debe ser una fecha válida en formato ISO 8601'),
  
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('notes no puede exceder 1000 caracteres')
];

// Validación para actualizar egreso devengado
export const updateAccruedExpenseValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID debe ser un número entero positivo'),
  
  body('expense_number')
    .optional()
    .notEmpty()
    .withMessage('expense_number no puede estar vacío')
    .isString()
    .withMessage('expense_number debe ser una cadena de texto'),
  
  body('supplier_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('supplier_id debe ser un número entero positivo'),
  
  body('expense_type')
    .optional()
    .isIn(EXPENSE_TYPE_VALUES)
    .withMessage(`expense_type debe ser uno de: ${EXPENSE_TYPE_VALUES.join(', ')}`),
  
  body('concept')
    .optional()
    .notEmpty()
    .withMessage('concept no puede estar vacío')
    .isString()
    .withMessage('concept debe ser una cadena de texto')
    .isLength({ min: 1, max: 255 })
    .withMessage('concept debe tener entre 1 y 255 caracteres'),
  
  body('category')
    .optional()
    .isIn(EXPENSE_CATEGORY_VALUES)
    .withMessage(`category debe ser uno de: ${EXPENSE_CATEGORY_VALUES.join(', ')}`),
  
  body('description')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('description no puede exceder 1000 caracteres'),
  
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
    .isIn(EXPENSE_STATUS_VALUES)
    .withMessage(`status debe ser uno de: ${EXPENSE_STATUS_VALUES.join(', ')}`),
  
  body('invoice_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('invoice_id debe ser un número entero positivo'),
  
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('notes no puede exceder 1000 caracteres')
];

// Validación para vincular factura a egreso devengado
export const linkInvoiceToExpenseValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID debe ser un número entero positivo'),
  
  body('invoice_id')
    .isInt({ min: 1 })
    .withMessage('invoice_id debe ser un número entero positivo')
];

