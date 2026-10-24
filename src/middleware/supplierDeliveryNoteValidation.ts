import { body, param, query } from 'express-validator';
import { DeliveryNoteStatus } from '../entities/SupplierDeliveryNote';

// Valores válidos para validación en tiempo de ejecución
const DELIVERY_NOTE_STATUS_VALUES: DeliveryNoteStatus[] = ['pending', 'partial', 'complete', 'cancelled'];

// Validación para crear remito de proveedor
export const createSupplierDeliveryNoteValidation = [
  body('delivery_note_number')
    .optional()
    .isString()
    .withMessage('delivery_note_number debe ser una cadena de texto'),
  
  body('supplier_id')
    .isInt({ min: 1 })
    .withMessage('supplier_id debe ser un número entero positivo'),
  
  body('purchase_id')
    .isInt({ min: 1 })
    .withMessage('purchase_id debe ser un número entero positivo'),
  
  body('invoice_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('invoice_id debe ser un número entero positivo'),
  
  body('delivery_date')
    .notEmpty()
    .withMessage('delivery_date es requerido')
    .isISO8601()
    .withMessage('delivery_date debe ser una fecha válida en formato ISO 8601'),
  
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('notes no puede exceder 1000 caracteres'),
  
  body('items')
    .isArray({ min: 1 })
    .withMessage('items debe ser un array con al menos un elemento'),
  
  body('items.*.material_code')
    .optional()
    .isString()
    .withMessage('material_code debe ser una cadena de texto'),
  
  body('items.*.product_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('product_id debe ser un número entero positivo'),
  
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('La cantidad debe ser un número entero positivo'),
  
  body('items.*.purchase_item_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('purchase_item_id debe ser un número entero positivo'),
  
  body('items.*.invoice_item_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('invoice_item_id debe ser un número entero positivo'),
  
  body('items.*.quality_check')
    .optional()
    .isBoolean()
    .withMessage('quality_check debe ser un valor booleano'),
  
  body('items.*.quality_notes')
    .optional()
    .isString()
    .withMessage('quality_notes debe ser una cadena de texto')
];

// Validación para actualizar remito de proveedor
export const updateSupplierDeliveryNoteValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID debe ser un número entero positivo'),
  
  body('delivery_note_number')
    .optional()
    .notEmpty()
    .withMessage('delivery_note_number no puede estar vacío')
    .isString()
    .withMessage('delivery_note_number debe ser una cadena de texto'),
  
  body('supplier_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('supplier_id debe ser un número entero positivo'),
  
  body('purchase_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('purchase_id debe ser un número entero positivo'),
  
  body('invoice_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('invoice_id debe ser un número entero positivo'),
  
  body('delivery_date')
    .optional()
    .isISO8601()
    .withMessage('delivery_date debe ser una fecha válida en formato ISO 8601'),
  
  body('status')
    .optional()
    .isIn(DELIVERY_NOTE_STATUS_VALUES)
    .withMessage(`status debe ser uno de: ${DELIVERY_NOTE_STATUS_VALUES.join(', ')}`),
  
  body('matches_invoice')
    .optional()
    .isBoolean()
    .withMessage('matches_invoice debe ser un valor booleano'),
  
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('notes no puede exceder 1000 caracteres')
];

// Validación para crear item de remito
export const createSupplierDeliveryNoteItemValidation = [
  param('deliveryNoteId')
    .isInt({ min: 1 })
    .withMessage('deliveryNoteId debe ser un número entero positivo'),
  
  body('material_code')
    .optional()
    .isString()
    .withMessage('material_code debe ser una cadena de texto'),
  
  body('product_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('product_id debe ser un número entero positivo'),
  
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('quantity debe ser un número entero positivo'),
  
  body('purchase_item_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('purchase_item_id debe ser un número entero positivo'),
  
  body('invoice_item_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('invoice_item_id debe ser un número entero positivo'),
  
  body('quality_check')
    .optional()
    .isBoolean()
    .withMessage('quality_check debe ser un valor booleano'),
  
  body('quality_notes')
    .optional()
    .isString()
    .withMessage('quality_notes debe ser una cadena de texto')
];

// Validación para actualizar item de remito
export const updateSupplierDeliveryNoteItemValidation = [
  param('deliveryNoteId')
    .isInt({ min: 1 })
    .withMessage('deliveryNoteId debe ser un número entero positivo'),
  
  param('itemId')
    .isInt({ min: 1 })
    .withMessage('itemId debe ser un número entero positivo'),
  
  body('material_code')
    .optional()
    .isString()
    .withMessage('material_code debe ser una cadena de texto'),
  
  body('product_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('product_id debe ser un número entero positivo'),
  
  body('quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('quantity debe ser un número entero positivo'),
  
  body('purchase_item_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('purchase_item_id debe ser un número entero positivo'),
  
  body('invoice_item_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('invoice_item_id debe ser un número entero positivo'),
  
  body('quality_check')
    .optional()
    .isBoolean()
    .withMessage('quality_check debe ser un valor booleano'),
  
  body('quality_notes')
    .optional()
    .isString()
    .withMessage('quality_notes debe ser una cadena de texto')
];

// Validación para vincular factura a remito
export const linkInvoiceValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID debe ser un número entero positivo'),
  
  body('invoice_id')
    .isInt({ min: 1 })
    .withMessage('invoice_id debe ser un número entero positivo')
];

