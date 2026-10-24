import { body } from 'express-validator';

export const rematchPurchaseDocumentValidation = [
  body('file_token').notEmpty().withMessage('file_token es requerido'),
  body('supplier_id').isInt({ min: 1 }).withMessage('supplier_id debe ser un entero positivo'),
];

export const confirmPurchaseDocumentValidation = [
  body('file_token').notEmpty().withMessage('file_token es requerido'),
  body('supplier_id').isInt({ min: 1 }).withMessage('supplier_id es requerido'),
  body('purchase_id').optional().isInt({ min: 1 }).withMessage('purchase_id inválido'),
  body('create_purchase_if_missing').optional().isBoolean(),
  body('delivery_note_number').notEmpty().withMessage('delivery_note_number es requerido'),
  body('delivery_date').isISO8601().withMessage('delivery_date debe ser una fecha válida'),
  body('source_invoice_number').optional().isString(),
  body('insured_value').optional().isFloat({ min: 0 }),
  body('notes').optional().isString().isLength({ max: 1000 }),
  body('apply_stock').isBoolean().withMessage('apply_stock debe ser booleano'),
  body('items').isArray({ min: 1 }).withMessage('items debe tener al menos un elemento'),
  body('items.*.material_code').notEmpty().withMessage('material_code es requerido en cada ítem'),
  body('items.*.description').notEmpty().withMessage('description es requerida en cada ítem'),
  body('items.*.quantity').isFloat({ min: 0.01 }).withMessage('quantity inválida'),
  body('items.*.product_id').optional().isInt({ min: 1 }),
  body('items.*.purchase_item_id').optional().isInt({ min: 1 }),
  body('items.*.unit_cost').optional().isFloat({ min: 0 }),
  body('items.*.update_stock').optional().isBoolean(),
  body('items.*.update_cost').optional().isBoolean(),
];
