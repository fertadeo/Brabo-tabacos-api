import { Router } from 'express';
import { CategoryController } from '../controllers/categoryController';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validation';
import { authenticateApiKey } from '../middleware/auth';

const router = Router();
const categoryController = new CategoryController();

const createCategoryValidation = [
  body('name').notEmpty().withMessage('name es requerido'),
  body('description').optional().isString(),
  body('woocommerce_id').optional().isInt(),
  body('woocommerce_slug').optional().isString(),
  body('parent_id').optional({ nullable: true }).isInt().withMessage('parent_id debe ser un número entero o null')
];

const updateCategoryValidation = [
  param('id').isInt().withMessage('ID debe ser un número'),
  body('name').optional().notEmpty(),
  body('description').optional().isString(),
  body('woocommerce_id').optional().isInt(),
  body('woocommerce_slug').optional().isString(),
  body('parent_id').optional({ nullable: true }).isInt().withMessage('parent_id debe ser un número entero o null'),
  body('is_active').optional().isBoolean()
];

const syncCategoriesValidation = [
  body('categories').isArray().withMessage('categories debe ser un array'),
  body('categories.*.id').isInt().withMessage('Cada categoría debe tener un id numérico'),
  body('categories.*.name').notEmpty().withMessage('Cada categoría debe tener un name'),
  body('categories.*.slug').notEmpty().withMessage('Cada categoría debe tener un slug')
];

// Rutas públicas (con autenticación API Key)
router.get('/', 
  authenticateApiKey,
  categoryController.getAllCategories.bind(categoryController)
);

router.get('/:id',
  authenticateApiKey,
  param('id').isInt(),
  validate([param('id')]),
  categoryController.getCategoryById.bind(categoryController)
);

router.post('/',
  authenticateApiKey,
  validate(createCategoryValidation),
  categoryController.createCategory.bind(categoryController)
);

router.put('/:id',
  authenticateApiKey,
  validate(updateCategoryValidation),
  categoryController.updateCategory.bind(categoryController)
);

router.delete('/:id',
  authenticateApiKey,
  param('id').isInt().withMessage('ID debe ser un número'),
  validate([param('id')]),
  categoryController.deleteCategory.bind(categoryController)
);

// Ruta para sincronización desde WooCommerce
router.post('/sync/woocommerce',
  authenticateApiKey,
  validate(syncCategoriesValidation),
  categoryController.syncFromWooCommerce.bind(categoryController)
);

// Webhook para cambios (puede ser llamado por n8n)
router.post('/webhook',
  authenticateApiKey,
  categoryController.webhookCategoryChange.bind(categoryController)
);

export default router;