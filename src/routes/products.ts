import { Router } from 'express';
import { ProductController } from '../controllers/productController';
import { ProductPricingController } from '../controllers/productPricingController';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation';
import { authenticateJWT, authorizeRoles } from '../middleware/jwt';

const router = Router();
const productController = new ProductController();
const productPricingController = new ProductPricingController();

/** Lectura de catálogo / stock / barcode */
const PRODUCT_VIEW_ROLES = ['admin', 'gerencia', 'ventas', 'logistica', 'finanzas'] as const;
/** Alta, edición, sync WooCommerce y ajustes de precio */
const PRODUCT_MANAGE_ROLES = ['admin', 'gerencia'] as const;
/** Ajuste de stock */
const PRODUCT_STOCK_ROLES = ['admin', 'gerencia', 'logistica'] as const;

// Validation rules
const createProductValidation = [
  body('code').notEmpty().withMessage('Código es requerido'),
  body('name').notEmpty().withMessage('Nombre es requerido'),
  body('price')
    .optional()
    .isNumeric()
    .withMessage('Precio debe ser numérico'),
  body('prices').optional().isObject().withMessage('prices debe ser un objeto'),
  body('prices.venta_local').optional().isNumeric().withMessage('prices.venta_local debe ser numérico'),
  body('prices.mayorista').optional().isNumeric().withMessage('prices.mayorista debe ser numérico'),
  body('prices.revendedor').optional().isNumeric().withMessage('prices.revendedor debe ser numérico'),
  body().custom((_, { req }) => {
    const hasPrice = req.body?.price !== undefined && req.body?.price !== null && req.body?.price !== '';
    const hasLocal =
      req.body?.prices?.venta_local !== undefined &&
      req.body?.prices?.venta_local !== null &&
      req.body?.prices?.venta_local !== '';
    if (!hasPrice && !hasLocal) {
      throw new Error('Se requiere price o prices.venta_local');
    }
    return true;
  }),
  body('iva_rate')
    .optional()
    .custom((value) => {
      if (value === undefined || value === null || value === '') return true;
      const n = Number(value);
      return n === 0 || Math.abs(n - 10.5) < 0.01 || Math.abs(n - 21) < 0.01;
    })
    .withMessage('iva_rate debe ser 0, 10.5 o 21'),
  body('description').optional({ nullable: true }).isString().withMessage('Descripción debe ser texto'),
  body('category_id').optional({ nullable: true }).isInt().withMessage('Categoría debe ser un número entero'),
  body('images').optional({ nullable: true }).isArray().withMessage('Imágenes debe ser un array'),
  body('woocommerce_image_ids').optional({ nullable: true }).isArray().withMessage('woocommerce_image_ids debe ser un array de IDs'),
  body('woocommerce_image_ids.*').optional().isInt().withMessage('Cada ID debe ser un número entero'),
  body('barcode').optional({ nullable: true }).isString().withMessage('Barcode debe ser texto'),
  body('qr_code').optional({ nullable: true }).isString().withMessage('QR debe ser texto'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock debe ser un número entero positivo'),
  body('min_stock').optional().isInt({ min: 0 }).withMessage('Stock mínimo debe ser un número entero positivo'),
  body('max_stock').optional().isInt({ min: 0 }).withMessage('Stock máximo debe ser un número entero positivo'),
  body('weight').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Peso debe ser un número positivo (kg)'),
  body('length').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Longitud debe ser un número positivo (cm)'),
  body('width').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Ancho debe ser un número positivo (cm)'),
  body('height').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Alto debe ser un número positivo (cm)'),
  body('allow_backorders').optional().isBoolean().withMessage('allow_backorders debe ser booleano (venta por encargo)'),
  body('is_active').optional().isBoolean().withMessage('is_active debe ser booleano'),
  body('sync_to_woocommerce').optional().isBoolean().withMessage('sync_to_woocommerce debe ser booleano')
];

const updateProductValidation = [
  param('id').isInt().withMessage('ID debe ser un número entero'),
  body('code').optional().notEmpty().withMessage('Código no puede estar vacío'),
  body('name').optional().notEmpty().withMessage('Nombre no puede estar vacío'),
  body('price').optional().isNumeric().withMessage('Precio debe ser numérico'),
  body('prices').optional().isObject().withMessage('prices debe ser un objeto'),
  body('prices.venta_local').optional().isNumeric().withMessage('prices.venta_local debe ser numérico'),
  body('prices.mayorista').optional().isNumeric().withMessage('prices.mayorista debe ser numérico'),
  body('prices.revendedor').optional().isNumeric().withMessage('prices.revendedor debe ser numérico'),
  body('iva_rate')
    .optional()
    .custom((value) => {
      if (value === undefined || value === null || value === '') return true;
      const n = Number(value);
      return n === 0 || Math.abs(n - 10.5) < 0.01 || Math.abs(n - 21) < 0.01;
    })
    .withMessage('iva_rate debe ser 0, 10.5 o 21'),
  body('description').optional({ nullable: true }).isString().withMessage('Descripción debe ser texto'),
  body('category_id').optional({ nullable: true }).isInt().withMessage('Categoría debe ser un número entero'),
  body('images').optional({ nullable: true }).isArray().withMessage('Imágenes debe ser un array'),
  body('woocommerce_image_ids').optional({ nullable: true }).isArray().withMessage('woocommerce_image_ids debe ser un array de IDs'),
  body('woocommerce_image_ids.*').optional().isInt().withMessage('Cada ID debe ser un número entero'),
  body('barcode').optional({ nullable: true }).isString().withMessage('Barcode debe ser texto'),
  body('qr_code').optional({ nullable: true }).isString().withMessage('QR debe ser texto'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock debe ser un número entero positivo'),
  body('min_stock').optional().isInt({ min: 0 }).withMessage('Stock mínimo debe ser un número entero positivo'),
  body('max_stock').optional().isInt({ min: 0 }).withMessage('Stock máximo debe ser un número entero positivo'),
  body('weight').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Peso debe ser un número positivo (kg)'),
  body('length').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Longitud debe ser un número positivo (cm)'),
  body('width').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Ancho debe ser un número positivo (cm)'),
  body('height').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Alto debe ser un número positivo (cm)'),
  body('allow_backorders').optional().isBoolean().withMessage('allow_backorders debe ser booleano (venta por encargo)'),
  body('sync_to_woocommerce').optional().isBoolean().withMessage('sync_to_woocommerce debe ser booleano')
];

const updateStockValidation = [
  param('id').isInt().withMessage('ID debe ser un número entero'),
  body('stock').isNumeric().withMessage('Stock debe ser numérico'),
  body('operation').optional().isIn(['set', 'add', 'subtract']).withMessage('Operación debe ser set, add o subtract')
];

const linkWooCommerceValidation = [
  param('id').isInt().withMessage('ID debe ser un número entero'),
  body('woocommerce_id').isInt({ min: 1 }).withMessage('woocommerce_id debe ser un número entero positivo')
];

const backfillWooCommerceValidation = [
  body('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('limit debe ser un entero entre 1 y 1000'),
  body('dry_run').optional().isBoolean().withMessage('dry_run debe ser booleano')
];

const categoryAdjustmentValidation = [
  body('category_ids').isArray().withMessage('category_ids debe ser un array de IDs'),
  body('category_ids.*').optional().isInt({ min: 1 }).withMessage('Cada category_id debe ser un entero positivo'),
  body('percentage').isFloat().withMessage('percentage debe ser numérico (ej: 10 o -5)'),
  body('include_uncategorized').optional().isBoolean().withMessage('include_uncategorized debe ser booleano'),
  body('active_only').optional().isBoolean().withMessage('active_only debe ser booleano'),
  body('dry_run').optional().isBoolean().withMessage('dry_run debe ser booleano'),
  body('sync_to_woocommerce').optional().isBoolean().withMessage('sync_to_woocommerce debe ser booleano'),
  body('preview_limit').optional().isInt({ min: 1, max: 50 }).withMessage('preview_limit entre 1 y 50')
];

const dollarAdjustmentValidation = [
  body('active_only').optional().isBoolean().withMessage('active_only debe ser booleano'),
  body('dry_run').optional().isBoolean().withMessage('dry_run debe ser booleano'),
  body('sync_to_woocommerce').optional().isBoolean().withMessage('sync_to_woocommerce debe ser booleano'),
  body('preview_limit').optional().isInt({ min: 1, max: 50 }).withMessage('preview_limit entre 1 y 50')
];

// Routes
// Autenticación requerida para todos los endpoints de productos
router.use(authenticateJWT);

// Lecturas: admin, gerencia, ventas, logistica, finanzas
router.get('/', authorizeRoles(...PRODUCT_VIEW_ROLES), productController.getAllProducts.bind(productController));
router.get('/stats', authorizeRoles(...PRODUCT_VIEW_ROLES), productController.getProductStats.bind(productController));
router.get('/stock/low', authorizeRoles(...PRODUCT_VIEW_ROLES), productController.getLowStockProducts.bind(productController));
router.post('/woocommerce/backfill-slugs',
  authorizeRoles(...PRODUCT_MANAGE_ROLES),
  validate(backfillWooCommerceValidation),
  productController.backfillWooCommerceSlugs.bind(productController)
);

// Actualización de precios por lote (admin / gerencia)
router.get('/pricing/categories',
  authorizeRoles(...PRODUCT_MANAGE_ROLES),
  productPricingController.getCategoriesForPricing.bind(productPricingController)
);
router.get('/pricing/dollar-rate',
  authorizeRoles(...PRODUCT_MANAGE_ROLES),
  productPricingController.getDollarRate.bind(productPricingController)
);
router.post('/pricing/category-adjustment/preview',
  authorizeRoles(...PRODUCT_MANAGE_ROLES),
  validate(categoryAdjustmentValidation),
  productPricingController.previewCategoryAdjustment.bind(productPricingController)
);
router.post('/pricing/category-adjustment',
  authorizeRoles(...PRODUCT_MANAGE_ROLES),
  validate(categoryAdjustmentValidation),
  productPricingController.applyCategoryAdjustment.bind(productPricingController)
);
router.post('/pricing/dollar-adjustment/preview',
  authorizeRoles(...PRODUCT_MANAGE_ROLES),
  validate(dollarAdjustmentValidation),
  productPricingController.previewDollarAdjustment.bind(productPricingController)
);
router.post('/pricing/dollar-adjustment',
  authorizeRoles(...PRODUCT_MANAGE_ROLES),
  validate(dollarAdjustmentValidation),
  productPricingController.applyDollarAdjustment.bind(productPricingController)
);
router.get('/:id/woocommerce-json',
  authorizeRoles(...PRODUCT_VIEW_ROLES),
  param('id').isInt().withMessage('ID debe ser un número entero'),
  validate([param('id').isInt().withMessage('ID debe ser un número entero')]),
  productController.getWooCommerceJson.bind(productController)
);
router.get('/:id', 
  authorizeRoles(...PRODUCT_VIEW_ROLES),
  param('id').isInt().withMessage('ID debe ser un número entero'),
  validate([param('id').isInt().withMessage('ID debe ser un número entero')]),
  productController.getProductById.bind(productController)
);

// Importación masiva (tolerante a datos faltantes): admin y gerencia
// Debe ir antes de /:id
router.post('/import',
  authorizeRoles(...PRODUCT_MANAGE_ROLES),
  productController.importProducts.bind(productController)
);

// Crear/Actualizar/Eliminar productos: admin y gerencia
router.post('/', 
  authorizeRoles(...PRODUCT_MANAGE_ROLES),
  createProductValidation,
  validate(createProductValidation),
  productController.createProduct.bind(productController)
);
router.put('/:id', 
  authorizeRoles(...PRODUCT_MANAGE_ROLES),
  updateProductValidation,
  validate(updateProductValidation),
  productController.updateProduct.bind(productController)
);
router.post('/link-woocommerce-ids',
  authorizeRoles(...PRODUCT_MANAGE_ROLES),
  productController.bulkLinkProductsFromWooCommerce.bind(productController)
);
router.post('/:id/link-woocommerce',
  authorizeRoles(...PRODUCT_MANAGE_ROLES),
  validate(linkWooCommerceValidation),
  productController.linkProductToWooCommerce.bind(productController)
);
router.post('/:id/sync-to-woocommerce',
  authorizeRoles(...PRODUCT_MANAGE_ROLES),
  param('id').isInt().withMessage('ID debe ser un número entero'),
  validate([param('id').isInt().withMessage('ID debe ser un número entero')]),
  productController.syncProductToWooCommerce.bind(productController)
);
router.delete('/:id', 
  authorizeRoles(...PRODUCT_MANAGE_ROLES),
  param('id').isInt().withMessage('ID debe ser un número entero'),
  validate([param('id').isInt().withMessage('ID debe ser un número entero')]),
  productController.deleteProduct.bind(productController)
);
router.delete('/:id/permanent', 
  authorizeRoles(...PRODUCT_MANAGE_ROLES),
  param('id').isInt().withMessage('ID debe ser un número entero'),
  validate([param('id').isInt().withMessage('ID debe ser un número entero')]),
  productController.permanentDeleteProduct.bind(productController)
);

// Actualización de stock: gerencia y logistica
router.put('/:id/stock', 
  authorizeRoles(...PRODUCT_STOCK_ROLES),
  updateStockValidation,
  validate(updateStockValidation),
  productController.updateStock.bind(productController)
);

// Barcode lookup endpoints
const barcodeValidation = [
  param('code').notEmpty().withMessage('Código de barras es requerido'),
  query('prefer_site').optional().isIn(['mercadolibre', 'fravega', 'garbarino']).withMessage('prefer_site debe ser mercadolibre, fravega o garbarino')
];

const acceptBarcodeValidation = [
  param('code').notEmpty().withMessage('Código de barras es requerido'),
  body('category_id').optional().isInt().withMessage('category_id debe ser un número entero'),
  body('price').optional().isNumeric().withMessage('price debe ser numérico'),
  body('stock').optional().isInt({ min: 0 }).withMessage('stock debe ser un número entero positivo'),
  body('code').optional().isString().withMessage('code debe ser texto')
];

const createFromBarcodeValidation = [
  param('code').notEmpty().withMessage('Código de barras es requerido'),
  body('code').notEmpty().withMessage('Código interno es requerido'),
  body('name').notEmpty().withMessage('Nombre es requerido'),
  body('price').isNumeric().withMessage('Precio debe ser numérico'),
  body('barcode').optional().isString().withMessage('Barcode debe ser texto'),
  body('description').optional({ nullable: true }).isString().withMessage('Descripción debe ser texto'),
  body('category_id').optional({ nullable: true }).isInt().withMessage('Categoría debe ser un número entero'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock debe ser un número entero positivo'),
  body('images').optional({ nullable: true }).isArray().withMessage('Imágenes debe ser un array')
];

// GET /api/products/barcode/:code - Buscar por código de barras
router.get('/barcode/:code',
  authorizeRoles(...PRODUCT_VIEW_ROLES),
  validate(barcodeValidation),
  productController.getProductByBarcode.bind(productController)
);

// POST /api/products/barcode/:code/accept - Aceptar datos y crear producto
router.post('/barcode/:code/accept',
  authorizeRoles(...PRODUCT_MANAGE_ROLES),
  validate(acceptBarcodeValidation),
  productController.acceptBarcodeData.bind(productController)
);

// POST /api/products/barcode/:code/create - Modificar datos y crear producto
router.post('/barcode/:code/create',
  authorizeRoles(...PRODUCT_MANAGE_ROLES),
  validate(createFromBarcodeValidation),
  productController.createProductFromBarcode.bind(productController)
);

// POST /api/products/barcode/:code/ignore - Ignorar datos encontrados
router.post('/barcode/:code/ignore',
  authorizeRoles(...PRODUCT_VIEW_ROLES),
  validate(barcodeValidation),
  productController.ignoreBarcodeData.bind(productController)
);

export default router;