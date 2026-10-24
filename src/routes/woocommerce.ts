import { Router, Request } from 'express';
import multer from 'multer';
import { WooCommerceController } from '../controllers/wooCommerceController';
import { CategoryController } from '../controllers/categoryController';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validation';
import { authenticateApiKey, authenticateWebhook } from '../middleware/auth';

const router = Router();
const wooCommerceController = new WooCommerceController();
const categoryController = new CategoryController();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile?: boolean) => void) => {
    const allowed = /^image\/(jpeg|png|gif|webp)$/i.test(file.mimetype);
    if (allowed) cb(null, true);
    else cb(new Error('Solo se permiten imágenes (jpeg, png, gif, webp)'));
  }
});

// Validation rules
const updateStockValidation = [
  param('sku').notEmpty().withMessage('SKU es requerido'),
  body('stock_quantity').isNumeric().withMessage('stock_quantity debe ser numérico'),
  body('operation').optional().isIn(['set', 'add', 'subtract']).withMessage('Operación debe ser set, add o subtract')
];

const syncProductsValidation = [
  body('products').isArray().withMessage('Products debe ser un array'),
  body('products.*.id').optional({ nullable: true }).isInt().withMessage('id debe ser numérico para cada producto'),
  body('products.*.sku').notEmpty().withMessage('SKU es requerido para cada producto'),
  body('products.*.stock_quantity').optional({ nullable: true }).isNumeric().withMessage('stock_quantity debe ser numérico para cada producto')
];

const syncCategoriesValidation = [
  body('categories').isArray().withMessage('categories debe ser un array'),
  body('categories.*.id').isInt().withMessage('Cada categoría debe tener un id numérico'),
  body('categories.*.name').notEmpty().withMessage('Cada categoría debe tener un name'),
  body('categories.*.slug').notEmpty().withMessage('Cada categoría debe tener un slug')
];

// Routes
router.get('/products', 
  authenticateApiKey,
  wooCommerceController.getProducts.bind(wooCommerceController)
);
router.post('/media',
  authenticateApiKey,
  (req, res, next) => {
    upload.array('files', 10)(req, res, (err: unknown) => {
      if (err) {
        res.status(400).json({
          success: false,
          message: err instanceof Error ? err.message : 'Error subiendo archivo(s)',
          timestamp: new Date().toISOString()
        });
        return;
      }
      next();
      return;
    });
  },
  wooCommerceController.uploadMedia.bind(wooCommerceController)
);
router.post('/products/sync', 
  authenticateApiKey,
  validate(syncProductsValidation),
  wooCommerceController.syncProducts.bind(wooCommerceController)
);
router.put('/products/:sku/stock', 
  authenticateApiKey,
  validate(updateStockValidation),
  wooCommerceController.updateStock.bind(wooCommerceController)
);

// Categories routes
router.post('/categories/sync', 
  authenticateWebhook, // Cambiado a authenticateWebhook para aceptar X-Webhook-Secret desde WordPress
  validate(syncCategoriesValidation),
  categoryController.syncFromWooCommerce.bind(categoryController)
);

export default router;
