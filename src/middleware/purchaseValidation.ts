import { body, param, query } from 'express-validator';
import { PurchaseStatus, SupplierType, IdentificationType, VatCondition } from '../types';

// Valores válidos para validación en tiempo de ejecución
const SUPPLIER_TYPE_VALUES: SupplierType[] = ['productivo', 'no_productivo', 'otro_pasivo'];
const IDENTIFICATION_TYPE_VALUES: IdentificationType[] = ['CUIT', 'CUIL', 'DNI', 'PASAPORTE', 'OTRO'];
const VAT_CONDITION_VALUES: VatCondition[] = ['Responsable Inscripto', 'Monotributista', 'Exento', 'Iva Exento', 'No Responsable', 'Consumidor Final'];

// Validación para crear compra
export const createPurchaseValidation = [
  body('supplier_id')
    .isInt({ min: 1 })
    .withMessage('supplier_id debe ser un número entero positivo'),
  
  body('status')
    .optional()
    .isIn(Object.values(PurchaseStatus))
    .withMessage('status debe ser uno de: pending, received, cancelled'),
  
  body('total_amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('total_amount debe ser un número positivo'),
  
  body('purchase_date')
    .optional()
    .isISO8601()
    .withMessage('purchase_date debe ser una fecha válida en formato ISO 8601'),
  
  body('received_date')
    .optional()
    .isISO8601()
    .withMessage('received_date debe ser una fecha válida en formato ISO 8601'),
  
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('notes no puede exceder 1000 caracteres')
];

// Validación para actualizar compra
export const updatePurchaseValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID debe ser un número entero positivo'),
  
  body('supplier_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('supplier_id debe ser un número entero positivo'),
  
  body('status')
    .optional()
    .isIn(Object.values(PurchaseStatus))
    .withMessage('status debe ser uno de: pending, received, cancelled'),
  
  body('total_amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('total_amount debe ser un número positivo'),
  
  body('purchase_date')
    .optional()
    .isISO8601()
    .withMessage('purchase_date debe ser una fecha válida en formato ISO 8601'),
  
  body('received_date')
    .optional()
    .isISO8601()
    .withMessage('received_date debe ser una fecha válida en formato ISO 8601'),
  
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('notes no puede exceder 1000 caracteres')
];

// Validación para crear item de compra
export const createPurchaseItemValidation = [
  param('purchaseId')
    .isInt({ min: 1 })
    .withMessage('purchaseId debe ser un número entero positivo'),
  
  body('product_id')
    .isInt({ min: 1 })
    .withMessage('product_id debe ser un número entero positivo'),
  
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('quantity debe ser un número entero positivo'),
  
  body('unit_price')
    .isFloat({ min: 0 })
    .withMessage('unit_price debe ser un número positivo'),
  
  body('total_price')
    .isFloat({ min: 0 })
    .withMessage('total_price debe ser un número positivo')
];

// Validación para actualizar item de compra
export const updatePurchaseItemValidation = [
  param('purchaseId')
    .isInt({ min: 1 })
    .withMessage('purchaseId debe ser un número entero positivo'),
  
  param('itemId')
    .isInt({ min: 1 })
    .withMessage('itemId debe ser un número entero positivo'),
  
  body('product_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('product_id debe ser un número entero positivo'),
  
  body('quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('quantity debe ser un número entero positivo'),
  
  body('unit_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('unit_price debe ser un número positivo'),
  
  body('total_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('total_price debe ser un número positivo')
];

// Validación para crear proveedor
export const createSupplierValidation = [
  body('code')
    .notEmpty()
    .withMessage('code es requerido')
    .isString()
    .isLength({ min: 1, max: 20 })
    .withMessage('code debe tener entre 1 y 20 caracteres'),
  
  body('name')
    .notEmpty()
    .withMessage('name es requerido')
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('name debe tener entre 1 y 100 caracteres'),
  
  body('supplier_type')
    .optional()
    .isIn(SUPPLIER_TYPE_VALUES)
    .withMessage(`supplier_type debe ser uno de: ${SUPPLIER_TYPE_VALUES.join(', ')}`),
  
  body('legal_name')
    .optional()
    .isString()
    .isLength({ max: 255 })
    .withMessage('legal_name no puede exceder 255 caracteres'),
  
  body('trade_name')
    .optional()
    .isString()
    .isLength({ max: 255 })
    .withMessage('trade_name no puede exceder 255 caracteres'),
  
  body('purchase_frequency')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('purchase_frequency no puede exceder 50 caracteres'),
  
  body('id_type')
    .optional()
    .isIn(IDENTIFICATION_TYPE_VALUES)
    .withMessage(`id_type debe ser uno de: ${IDENTIFICATION_TYPE_VALUES.join(', ')}`),
  
  body('tax_id')
    .optional()
    .isString()
    .isLength({ max: 20 })
    .withMessage('tax_id no puede exceder 20 caracteres'),
  
  body('gross_income')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('gross_income no puede exceder 50 caracteres'),
  
  body('vat_condition')
    .optional()
    .isIn(VAT_CONDITION_VALUES)
    .withMessage(`vat_condition debe ser uno de: ${VAT_CONDITION_VALUES.join(', ')}`),
  
  body('account_description')
    .optional()
    .isString()
    .withMessage('account_description debe ser una cadena de texto'),
  
  body('product_service')
    .optional()
    .isString()
    .withMessage('product_service debe ser una cadena de texto'),
  
  body('integral_summary_account')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('integral_summary_account no puede exceder 100 caracteres'),
  
  body('cost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('cost debe ser un número positivo'),
  
  body('contact_name')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('contact_name no puede exceder 100 caracteres'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('email debe ser un email válido'),
  
  body('phone')
    .optional()
    .isString()
    .isLength({ max: 20 })
    .withMessage('phone no puede exceder 20 caracteres'),
  
  body('address')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('address no puede exceder 500 caracteres'),
  
  body('city')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('city no puede exceder 50 caracteres'),
  
  body('country')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('country no puede exceder 50 caracteres'),
  
  body('has_account')
    .optional()
    .custom((value) => {
      // Aceptar booleanos o números (1/0)
      if (typeof value === 'boolean') return true;
      if (typeof value === 'number' && (value === 0 || value === 1)) return true;
      if (typeof value === 'string' && (value === 'true' || value === 'false' || value === '0' || value === '1')) return true;
      return false;
    })
    .withMessage('has_account debe ser un valor booleano (true/false) o número (1/0)'),
  
  body('payment_terms')
    .optional()
    .isInt({ min: 0 })
    .withMessage('payment_terms debe ser un número entero positivo')
];

// Validación para actualizar proveedor
export const updateSupplierValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID debe ser un número entero positivo'),
  
  body('code')
    .optional()
    .isString()
    .isLength({ min: 1, max: 20 })
    .withMessage('code debe tener entre 1 y 20 caracteres'),
  
  body('name')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('name debe tener entre 1 y 100 caracteres'),
  
  body('supplier_type')
    .optional()
    .isIn(SUPPLIER_TYPE_VALUES)
    .withMessage(`supplier_type debe ser uno de: ${SUPPLIER_TYPE_VALUES.join(', ')}`),
  
  body('legal_name')
    .optional()
    .isString()
    .isLength({ max: 255 })
    .withMessage('legal_name no puede exceder 255 caracteres'),
  
  body('trade_name')
    .optional()
    .isString()
    .isLength({ max: 255 })
    .withMessage('trade_name no puede exceder 255 caracteres'),
  
  body('purchase_frequency')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('purchase_frequency no puede exceder 50 caracteres'),
  
  body('id_type')
    .optional()
    .isIn(IDENTIFICATION_TYPE_VALUES)
    .withMessage(`id_type debe ser uno de: ${IDENTIFICATION_TYPE_VALUES.join(', ')}`),
  
  body('tax_id')
    .optional()
    .isString()
    .isLength({ max: 20 })
    .withMessage('tax_id no puede exceder 20 caracteres'),
  
  body('gross_income')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('gross_income no puede exceder 50 caracteres'),
  
  body('vat_condition')
    .optional()
    .isIn(VAT_CONDITION_VALUES)
    .withMessage(`vat_condition debe ser uno de: ${VAT_CONDITION_VALUES.join(', ')}`),
  
  body('account_description')
    .optional()
    .isString()
    .withMessage('account_description debe ser una cadena de texto'),
  
  body('product_service')
    .optional()
    .isString()
    .withMessage('product_service debe ser una cadena de texto'),
  
  body('integral_summary_account')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('integral_summary_account no puede exceder 100 caracteres'),
  
  body('cost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('cost debe ser un número positivo'),
  
  body('contact_name')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .withMessage('contact_name no puede exceder 100 caracteres'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('email debe ser un email válido'),
  
  body('phone')
    .optional()
    .isString()
    .isLength({ max: 20 })
    .withMessage('phone no puede exceder 20 caracteres'),
  
  body('address')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('address no puede exceder 500 caracteres'),
  
  body('city')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('city no puede exceder 50 caracteres'),
  
  body('country')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('country no puede exceder 50 caracteres'),
  
  body('has_account')
    .optional()
    .custom((value) => {
      // Aceptar booleanos o números (1/0)
      if (typeof value === 'boolean') return true;
      if (typeof value === 'number' && (value === 0 || value === 1)) return true;
      if (typeof value === 'string' && (value === 'true' || value === 'false' || value === '0' || value === '1')) return true;
      return false;
    })
    .withMessage('has_account debe ser un valor booleano (true/false) o número (1/0)'),
  
  body('payment_terms')
    .optional()
    .isInt({ min: 0 })
    .withMessage('payment_terms debe ser un número entero positivo'),
  
  body('is_active')
    .optional()
    .custom((value) => {
      // Aceptar booleanos o números (1/0)
      if (typeof value === 'boolean') return true;
      if (typeof value === 'number' && (value === 0 || value === 1)) return true;
      if (typeof value === 'string' && (value === 'true' || value === 'false' || value === '0' || value === '1')) return true;
      return false;
    })
    .withMessage('is_active debe ser un valor booleano (true/false) o número (1/0)')
];
