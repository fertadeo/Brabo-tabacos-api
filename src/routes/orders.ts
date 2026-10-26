import { Router } from 'express';
import { OrderController } from '../controllers/orderController';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation';
import { authenticateApiKey } from '../middleware/auth';
import { authenticateJWT, authorizeRoles } from '../middleware/jwt';

const router = Router();
const orderController = new OrderController();

const ORDER_VIEW = ['admin', 'gerencia', 'ventas', 'logistica', 'finanzas', 'manager', 'employee', 'viewer'] as const;
const ORDER_MANAGE = ['admin', 'gerencia', 'ventas', 'logistica'] as const;

const createOrderValidation = [
  body('client_id').isInt({ min: 1 }).withMessage('client_id debe ser un entero positivo'),
  body('status')
    .optional()
    .isIn(['pendiente_preparacion', 'listo_despacho', 'pagado', 'aprobado', 'pendiente', 'en_proceso'])
    .withMessage('Estado inválido'),
  body('delivery_date').optional({ nullable: true, checkFalsy: true }).isISO8601().withMessage('Fecha de entrega inválida'),
  body('delivery_address').optional({ checkFalsy: true }).isString().isLength({ max: 500 }),
  body('delivery_city').optional({ checkFalsy: true }).isString().isLength({ max: 100 }),
  body('delivery_contact').optional({ checkFalsy: true }).isString().isLength({ max: 100 }),
  body('delivery_phone').optional({ checkFalsy: true }).isString().isLength({ max: 20 }),
  body('transport_company').optional({ checkFalsy: true }).isString().isLength({ max: 100 }),
  body('transport_cost').optional({ nullable: true }).isFloat({ min: 0 }),
  body('notes').optional({ checkFalsy: true }).isString().isLength({ max: 1000 }),
  body('items').isArray({ min: 1 }).withMessage('Debe incluir al menos un item'),
  body('items.*.product_id').isInt({ min: 1 }).withMessage('product_id debe ser un entero positivo'),
  body('items.*.quantity').isFloat({ min: 0.01 }).withMessage('quantity debe ser positiva'),
  body('items.*.unit_price').isFloat({ min: 0 }).withMessage('unit_price debe ser un número >= 0'),
  body('items.*.iva_rate').optional().isFloat({ min: 0, max: 100 }),
  body('items.*.notes').optional({ checkFalsy: true }).isString().isLength({ max: 500 }),
];

const updateOrderValidation = [
  param('id').isInt({ min: 1 }).withMessage('ID de pedido inválido'),
  body('status')
    .optional()
    .isIn([
      'pendiente_preparacion',
      'listo_despacho',
      'pagado',
      'aprobado',
      'en_proceso',
      'completado',
      'cancelado',
    ])
    .withMessage('Estado inválido'),
  body('delivery_date').optional({ nullable: true, checkFalsy: true }).isISO8601(),
  body('delivery_address').optional({ checkFalsy: true }).isString().isLength({ max: 500 }),
  body('delivery_city').optional({ checkFalsy: true }).isString().isLength({ max: 100 }),
  body('delivery_contact').optional({ checkFalsy: true }).isString().isLength({ max: 100 }),
  body('delivery_phone').optional({ checkFalsy: true }).isString().isLength({ max: 20 }),
  body('transport_company').optional({ checkFalsy: true }).isString().isLength({ max: 100 }),
  body('transport_cost').optional({ nullable: true }).isFloat({ min: 0 }),
  body('notes').optional({ checkFalsy: true }).isString().isLength({ max: 1000 }),
  body('remito_status')
    .optional()
    .isIn(['sin_remito', 'remito_generado', 'remito_despachado', 'remito_entregado']),
  body('stock_reserved').optional().isBoolean(),
];

const idParamValidation = [param('id').isInt({ min: 1 }).withMessage('ID debe ser un entero positivo')];

const orderFiltersValidation = [
  query('status')
    .optional()
    .isIn([
      'pendiente_preparacion',
      'listo_despacho',
      'pagado',
      'aprobado',
      'en_proceso',
      'completado',
      'cancelado',
    ]),
  query('client_id').optional().isInt({ min: 1 }),
  query('remito_status')
    .optional()
    .isIn(['sin_remito', 'remito_generado', 'remito_despachado', 'remito_entregado']),
  query('date_from').optional().isISO8601(),
  query('date_to').optional().isISO8601(),
  query('stock_reserved').optional().isBoolean(),
  query('has_remito').optional().isBoolean(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

// CRUD ERP: JWT
router.post(
  '/',
  authenticateJWT,
  authorizeRoles(...ORDER_MANAGE),
  validate(createOrderValidation),
  orderController.createOrder.bind(orderController)
);

router.get(
  '/',
  authenticateJWT,
  authorizeRoles(...ORDER_VIEW),
  validate(orderFiltersValidation),
  orderController.getAllOrders.bind(orderController)
);

router.get(
  '/stats',
  authenticateJWT,
  authorizeRoles(...ORDER_VIEW),
  orderController.getOrderStats.bind(orderController)
);

router.get(
  '/config',
  authenticateJWT,
  authorizeRoles(...ORDER_VIEW),
  orderController.getOrdersConfig.bind(orderController)
);

router.get(
  '/ready-for-remito',
  authenticateJWT,
  authorizeRoles(...ORDER_VIEW),
  orderController.getOrdersReadyForRemito.bind(orderController)
);

router.get(
  '/:id',
  authenticateJWT,
  authorizeRoles(...ORDER_VIEW),
  validate(idParamValidation),
  orderController.getOrderById.bind(orderController)
);

router.get(
  '/number/:number',
  authenticateJWT,
  authorizeRoles(...ORDER_VIEW),
  orderController.getOrderByNumber.bind(orderController)
);

router.put(
  '/:id',
  authenticateJWT,
  authorizeRoles(...ORDER_MANAGE),
  validate(updateOrderValidation),
  orderController.updateOrder.bind(orderController)
);

router.delete(
  '/:id',
  authenticateJWT,
  authorizeRoles(...ORDER_MANAGE),
  validate(idParamValidation),
  orderController.deleteOrder.bind(orderController)
);

router.post(
  '/:id/reserve-stock',
  authenticateJWT,
  authorizeRoles(...ORDER_MANAGE),
  validate(idParamValidation),
  orderController.reserveStock.bind(orderController)
);

router.put(
  '/:id/remito-status',
  authenticateJWT,
  authorizeRoles(...ORDER_MANAGE),
  validate([
    ...idParamValidation,
    body('remitoStatus')
      .isIn(['sin_remito', 'remito_generado', 'remito_despachado', 'remito_entregado'])
      .withMessage('Estado de remito inválido'),
  ]),
  orderController.updateRemitoStatus.bind(orderController)
);

// Integraciones Woo / n8n: API key
router.post(
  '/:id/sync-to-woocommerce',
  authenticateApiKey,
  validate(idParamValidation),
  orderController.syncOrderToWooCommerce.bind(orderController)
);

export default router;
