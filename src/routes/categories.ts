import { Router } from 'express';
import { CategoryController } from '../controllers/categoryController';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validation';
import { authenticateApiKey } from '../middleware/auth';
import { authenticateJWT, authorizeRoles } from '../middleware/jwt';

const router = Router();
const categoryController = new CategoryController();

const CATEGORY_VIEW_ROLES = ['admin', 'gerencia', 'ventas', 'logistica', 'finanzas'] as const;
const CATEGORY_MANAGE_ROLES = ['admin', 'gerencia'] as const;

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

// CRUD ERP: JWT (sin API key)
router.get(
  '/',
  authenticateJWT,
  authorizeRoles(...CATEGORY_VIEW_ROLES),
  categoryController.getAllCategories.bind(categoryController)
);

router.get(
  '/:id',
  authenticateJWT,
  authorizeRoles(...CATEGORY_VIEW_ROLES),
  param('id').isInt(),
  validate([param('id')]),
  categoryController.getCategoryById.bind(categoryController)
);

router.post(
  '/',
  authenticateJWT,
  authorizeRoles(...CATEGORY_MANAGE_ROLES),
  validate(createCategoryValidation),
  categoryController.createCategory.bind(categoryController)
);

router.put(
  '/:id',
  authenticateJWT,
  authorizeRoles(...CATEGORY_MANAGE_ROLES),
  validate(updateCategoryValidation),
  categoryController.updateCategory.bind(categoryController)
);

router.delete(
  '/:id',
  authenticateJWT,
  authorizeRoles(...CATEGORY_MANAGE_ROLES),
  param('id').isInt().withMessage('ID debe ser un número'),
  validate([param('id')]),
  categoryController.deleteCategory.bind(categoryController)
);

// Integraciones WooCommerce / n8n: siguen con API Key
router.post(
  '/sync/woocommerce',
  authenticateApiKey,
  validate(syncCategoriesValidation),
  categoryController.syncFromWooCommerce.bind(categoryController)
);

router.post(
  '/webhook',
  authenticateApiKey,
  categoryController.webhookCategoryChange.bind(categoryController)
);

export default router;
