import { Router, Request, Response } from 'express';
import { RolePermissionController } from '../controllers/rolePermissionController';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation';
import { authenticateJWT, authorizeRoles } from '../middleware/jwt';

const router = Router();
const rolePermissionController = new RolePermissionController();

// Todas las rutas requieren autenticación
router.use(authenticateJWT);

// =====================================================
// PERMISOS
// =====================================================

// GET /api/roles/permissions - Obtener todos los permisos
router.get(
  '/permissions',
  authorizeRoles('admin', 'gerencia'),
  query('module').optional().isString(),
  query('is_active').optional().isBoolean(),
  validate([]),
  (req, res) => rolePermissionController.getAllPermissions(req as any, res)
);

// GET /api/roles/permissions/modules - Obtener lista de módulos
router.get(
  '/permissions/modules',
  authorizeRoles('admin', 'gerencia'),
  (req, res) => rolePermissionController.getModulesList(req as any, res)
);

// GET /api/roles/permissions/:id - Obtener permiso por ID
router.get(
  '/permissions/:id',
  authorizeRoles('admin', 'gerencia'),
  param('id').isInt({ min: 1 }),
  validate([param('id').isInt({ min: 1 })]),
  (req, res) => rolePermissionController.getPermissionById(req as any, res)
);

// POST /api/roles/permissions - Crear nuevo permiso
router.post(
  '/permissions',
  authorizeRoles('admin'),
  [
    body('name').notEmpty().withMessage('name es requerido'),
    body('code').notEmpty().withMessage('code es requerido'),
    body('module').notEmpty().withMessage('module es requerido'),
    body('description').optional().isString(),
    body('is_active').optional().isBoolean()
  ],
  validate([]),
  (req: Request, res: Response) => rolePermissionController.createPermission(req as any, res)
);

// PUT /api/roles/permissions/:id - Actualizar permiso
router.put(
  '/permissions/:id',
  authorizeRoles('admin'),
  [
    param('id').isInt({ min: 1 }),
    body('name').optional().notEmpty(),
    body('code').optional().notEmpty(),
    body('module').optional().notEmpty(),
    body('description').optional().isString(),
    body('is_active').optional().isBoolean()
  ],
  validate([]),
  (req: Request, res: Response) => rolePermissionController.updatePermission(req as any, res)
);

// DELETE /api/roles/permissions/:id - Eliminar permiso
router.delete(
  '/permissions/:id',
  authorizeRoles('admin'),
  param('id').isInt({ min: 1 }),
  validate([param('id').isInt({ min: 1 })]),
  (req, res) => rolePermissionController.deletePermission(req as any, res)
);

// =====================================================
// ROLES Y PERMISOS
// =====================================================

// GET /api/roles - Obtener lista de todos los roles disponibles
router.get(
  '/',
  authorizeRoles('admin', 'gerencia'),
  (req, res) => rolePermissionController.getAllRoles(req as any, res)
);

// GET /api/roles/summary - Obtener resumen de permisos por rol
router.get(
  '/summary',
  authorizeRoles('admin', 'gerencia'),
  (req, res) => rolePermissionController.getRolePermissionsSummary(req as any, res)
);

// GET /api/roles/:role/permissions - Obtener permisos de un rol
router.get(
  '/:role/permissions',
  authorizeRoles('admin', 'gerencia'),
  param('role').isIn(['admin', 'manager', 'employee', 'viewer', 'gerencia', 'ventas', 'logistica', 'finanzas']),
  validate([param('role').isIn(['admin', 'manager', 'employee', 'viewer', 'gerencia', 'ventas', 'logistica', 'finanzas'])]),
  (req, res) => rolePermissionController.getPermissionsByRole(req as any, res)
);

// POST /api/roles/:role/permissions - Asignar permiso a rol
router.post(
  '/:role/permissions',
  authorizeRoles('admin', 'gerencia'),
  [
    param('role').isIn(['admin', 'manager', 'employee', 'viewer', 'gerencia', 'ventas', 'logistica', 'finanzas']),
    body('permission_id').isInt({ min: 1 }).withMessage('permission_id es requerido y debe ser un entero positivo')
  ],
  validate([]),
  (req: Request, res: Response) => rolePermissionController.assignPermissionToRole(req as any, res)
);

// DELETE /api/roles/:role/permissions/:permissionId - Remover permiso de rol
router.delete(
  '/:role/permissions/:permissionId',
  authorizeRoles('admin', 'gerencia'),
  [
    param('role').isIn(['admin', 'manager', 'employee', 'viewer', 'gerencia', 'ventas', 'logistica', 'finanzas']),
    param('permissionId').isInt({ min: 1 })
  ],
  validate([]),
  (req: Request, res: Response) => rolePermissionController.removePermissionFromRole(req as any, res)
);

// =====================================================
// USUARIOS Y PERMISOS
// =====================================================

// GET /api/roles/users/:userId/permissions - Obtener permisos de un usuario
router.get(
  '/users/:userId/permissions',
  authorizeRoles('admin', 'gerencia'),
  param('userId').isInt({ min: 1 }),
  validate([param('userId').isInt({ min: 1 })]),
  (req, res) => rolePermissionController.getPermissionsByUser(req as any, res)
);

// POST /api/roles/assign - Asignar permiso a rol o usuario
router.post(
  '/assign',
  authorizeRoles('admin', 'gerencia'),
  [
    body('permission_id').isInt({ min: 1 }).withMessage('permission_id es requerido'),
    body('role').optional().isIn(['admin', 'manager', 'employee', 'viewer', 'gerencia', 'ventas', 'logistica', 'finanzas']),
    body('user_id').optional().isInt({ min: 1 }),
    body('expires_at').optional().isISO8601()
  ],
  validate([]),
  (req: Request, res: Response) => rolePermissionController.assignPermissionToUser(req as any, res)
);

// DELETE /api/roles/users/:userId/permissions/:permissionId - Remover permiso de usuario
router.delete(
  '/users/:userId/permissions/:permissionId',
  authorizeRoles('admin', 'gerencia'),
  [
    param('userId').isInt({ min: 1 }),
    param('permissionId').isInt({ min: 1 })
  ],
  validate([]),
  (req: Request, res: Response) => rolePermissionController.removePermissionFromUser(req as any, res)
);

export default router;

