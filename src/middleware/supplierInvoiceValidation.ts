import { body, param, query } from 'express-validator';
import { InvoiceStatus, PaymentStatus } from '../entities/SupplierInvoice';

// Valores válidos para validación en tiempo de ejecución
const INVOICE_STATUS_VALUES: InvoiceStatus[] = ['draft', 'received', 'partial_paid', 'paid', 'cancelled'];
const PAYMENT_STATUS_VALUES: PaymentStatus[] = ['pending', 'partial', 'paid', 'overdue'];

// Validación para crear factura de proveedor
export const createSupplierInvoiceValidation = [
  body('invoice_number')
    .notEmpty()
    .withMessage('invoice_number es requerido')
    .isString()
    .withMessage('invoice_number debe ser una cadena de texto'),
  
  body('supplier_id')
    .isInt({ min: 1 })
    .withMessage('supplier_id debe ser un número entero positivo'),
  
  body('purchase_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('purchase_id debe ser un número entero positivo'),
  
  body('invoice_date')
    .notEmpty()
    .withMessage('invoice_date es requerido')
    .isISO8601()
    .withMessage('invoice_date debe ser una fecha válida en formato ISO 8601'),
  
  body('due_date')
    .optional()
    .isISO8601()
    .withMessage('due_date debe ser una fecha válida en formato ISO 8601'),
  
  body('subtotal')
    .isFloat({ min: 0 })
    .withMessage('subtotal debe ser un número positivo'),
  
  body('tax_amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('tax_amount debe ser un número positivo'),
  
  body('total_amount')
    .isFloat({ min: 0 })
    .withMessage('total_amount debe ser un número positivo'),
  
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('notes no puede exceder 1000 caracteres'),
  
  body('file_url')
    .optional()
    .isString()
    .isURL()
    .withMessage('file_url debe ser una URL válida'),
  
  body('items')
    .isArray({ min: 1 })
    .withMessage('items debe ser un array con al menos un elemento'),
  
  body('items.*.description')
    .notEmpty()
    .withMessage('La descripción del item es requerida')
    .isString()
    .withMessage('La descripción debe ser una cadena de texto'),
  
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('La cantidad debe ser un número entero positivo'),
  
  body('items.*.unit_price')
    .isFloat({ min: 0 })
    .withMessage('El precio unitario debe ser un número positivo'),
  
  body('items.*.material_code')
    .optional()
    .isString()
    .withMessage('material_code debe ser una cadena de texto'),
  
  body('items.*.product_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('product_id debe ser un número entero positivo'),
  
  body('items.*.unit_cost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('unit_cost debe ser un número positivo'),
  
  body('items.*.affects_production_cost')
    .optional()
    .isBoolean()
    .withMessage('affects_production_cost debe ser un valor booleano'),
  
  body('items.*.purchase_item_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('purchase_item_id debe ser un número entero positivo')
];

// Validación para actualizar factura de proveedor
export const updateSupplierInvoiceValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID debe ser un número entero positivo'),
  
  body('invoice_number')
    .optional()
    .notEmpty()
    .withMessage('invoice_number no puede estar vacío')
    .isString()
    .withMessage('invoice_number debe ser una cadena de texto'),
  
  body('supplier_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('supplier_id debe ser un número entero positivo'),
  
  body('purchase_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('purchase_id debe ser un número entero positivo'),
  
  body('invoice_date')
    .optional()
    .isISO8601()
    .withMessage('invoice_date debe ser una fecha válida en formato ISO 8601'),
  
  body('due_date')
    .optional()
    .isISO8601()
    .withMessage('due_date debe ser una fecha válida en formato ISO 8601'),
  
  body('subtotal')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('subtotal debe ser un número positivo'),
  
  body('tax_amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('tax_amount debe ser un número positivo'),
  
  body('total_amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('total_amount debe ser un número positivo'),
  
  body('status')
    .optional()
    .isIn(INVOICE_STATUS_VALUES)
    .withMessage(`status debe ser uno de: ${INVOICE_STATUS_VALUES.join(', ')}`),
  
  body('payment_status')
    .optional()
    .isIn(PAYMENT_STATUS_VALUES)
    .withMessage(`payment_status debe ser uno de: ${PAYMENT_STATUS_VALUES.join(', ')}`),
  
  body('delivery_note_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('delivery_note_id debe ser un número entero positivo'),
  
  body('notes')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('notes no puede exceder 1000 caracteres'),
  
  body('file_url')
    .optional()
    .isString()
    .isURL()
    .withMessage('file_url debe ser una URL válida')
];

// Validación para crear item de factura
export const createSupplierInvoiceItemValidation = [
  param('invoiceId')
    .isInt({ min: 1 })
    .withMessage('invoiceId debe ser un número entero positivo'),
  
  body('description')
    .notEmpty()
    .withMessage('description es requerido')
    .isString()
    .withMessage('description debe ser una cadena de texto'),
  
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('quantity debe ser un número entero positivo'),
  
  body('unit_price')
    .isFloat({ min: 0 })
    .withMessage('unit_price debe ser un número positivo'),
  
  body('material_code')
    .optional()
    .isString()
    .withMessage('material_code debe ser una cadena de texto'),
  
  body('product_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('product_id debe ser un número entero positivo'),
  
  body('unit_cost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('unit_cost debe ser un número positivo'),
  
  body('affects_production_cost')
    .optional()
    .isBoolean()
    .withMessage('affects_production_cost debe ser un valor booleano'),
  
  body('purchase_item_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('purchase_item_id debe ser un número entero positivo')
];

// Validación para actualizar item de factura
export const updateSupplierInvoiceItemValidation = [
  param('invoiceId')
    .isInt({ min: 1 })
    .withMessage('invoiceId debe ser un número entero positivo'),
  
  param('itemId')
    .isInt({ min: 1 })
    .withMessage('itemId debe ser un número entero positivo'),
  
  body('description')
    .optional()
    .notEmpty()
    .withMessage('description no puede estar vacío')
    .isString()
    .withMessage('description debe ser una cadena de texto'),
  
  body('quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('quantity debe ser un número entero positivo'),
  
  body('unit_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('unit_price debe ser un número positivo'),
  
  body('material_code')
    .optional()
    .isString()
    .withMessage('material_code debe ser una cadena de texto'),
  
  body('product_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('product_id debe ser un número entero positivo'),
  
  body('unit_cost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('unit_cost debe ser un número positivo'),
  
  body('affects_production_cost')
    .optional()
    .isBoolean()
    .withMessage('affects_production_cost debe ser un valor booleano'),
  
  body('purchase_item_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('purchase_item_id debe ser un número entero positivo'),
  
  body('total_price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('total_price debe ser un número positivo')
];

// Validación para vincular remito a factura
export const linkDeliveryNoteValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID debe ser un número entero positivo'),
  
  body('delivery_note_id')
    .isInt({ min: 1 })
    .withMessage('delivery_note_id debe ser un número entero positivo')
];

