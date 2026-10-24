import { body } from 'express-validator';

export const rematchSalesDocumentValidation = [
  body('file_token').isString().notEmpty().withMessage('file_token es requerido'),
  body('client_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('client_id inválido'),
  body('link_sale_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('link_sale_id inválido'),
];

export const confirmSalesDocumentValidation = [
  body('file_token').isString().notEmpty().withMessage('file_token es requerido'),
  body('client_id').isInt({ min: 1 }).withMessage('client_id es requerido'),
  body('link_sale_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('link_sale_id inválido'),
  body('punto_venta').isInt({ min: 1 }).withMessage('punto_venta es requerido'),
  body('numero').isInt({ min: 1 }).withMessage('numero es requerido'),
  body('comprobante_tipo')
    .isIn([1, 3, 6, 8, 11, 13])
    .withMessage('comprobante_tipo inválido'),
  body('fecha_emision').isISO8601().withMessage('fecha_emision debe ser YYYY-MM-DD'),
  body('cae')
    .isString()
    .matches(/^\d{14}$/)
    .withMessage('cae debe tener 14 dígitos'),
  body('cae_vto').optional({ values: 'falsy' }).isISO8601(),
  body('cuit_emisor').optional({ values: 'falsy' }).isString().isLength({ min: 11, max: 11 }),
  body('qr_url').optional({ values: 'falsy' }).isString().isLength({ max: 512 }),
  body('total_amount').isFloat({ min: 0 }).withMessage('total_amount inválido'),
  body('payment_method')
    .optional()
    .isIn(['efectivo', 'tarjeta', 'transferencia', 'mixto'])
    .withMessage('payment_method inválido'),
  body('notes').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
  body('items').custom((items, { req }) => {
    if (req.body.link_sale_id) return true;
    if (!Array.isArray(items) || items.length < 1) {
      throw new Error('items debe tener al menos un elemento si no vincula una venta POS');
    }
    return true;
  }),
  body('items.*.description').optional().isString().notEmpty(),
  body('items.*.quantity').optional().isFloat({ min: 0.0001 }),
  body('items.*.unit_price').optional().isFloat({ min: 0 }),
  body('items.*.product_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('items.*.product_code').optional({ values: 'falsy' }).isString(),
  body('items.*.iva_rate').optional({ nullable: true }).isFloat({ min: 0 }),
];

export const updateSalesDocumentLinkValidation = [
  body('sale_id').isInt({ min: 1 }).withMessage('sale_id es requerido'),
  body('file_token').optional({ values: 'falsy' }).isString().notEmpty(),
  body('punto_venta').isInt({ min: 1 }).withMessage('punto_venta es requerido'),
  body('numero').isInt({ min: 1 }).withMessage('numero es requerido'),
  body('comprobante_tipo')
    .isIn([1, 3, 6, 8, 11, 13])
    .withMessage('comprobante_tipo inválido'),
  body('fecha_emision').isISO8601().withMessage('fecha_emision debe ser YYYY-MM-DD'),
  body('cae')
    .isString()
    .matches(/^\d{14}$/)
    .withMessage('cae debe tener 14 dígitos'),
  body('cae_vto').optional({ values: 'falsy' }).isISO8601(),
  body('cuit_emisor').optional({ values: 'falsy' }).isString().isLength({ min: 11, max: 11 }),
  body('qr_url').optional({ values: 'falsy' }).isString().isLength({ max: 512 }),
  body('total_amount').isFloat({ min: 0 }).withMessage('total_amount inválido'),
  body('notes').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
];
