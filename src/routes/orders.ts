import { Router } from 'express';
import { OrderController } from '../controllers/orderController';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation';
import { authenticateApiKey } from '../middleware/auth';

const router = Router();
const orderController = new OrderController();

// =====================================================
// VALIDACIONES
// =====================================================

// Validación para crear pedido
const createOrderValidation = [
  body('client_id').isInt({ min: 1 }).withMessage('client_id debe ser un entero positivo'),
  body('status').optional().isIn(['pendiente_preparacion', 'listo_despacho', 'pagado', 'aprobado']).withMessage('Estado inválido'),
  body('delivery_date').optional().isISO8601().withMessage('Fecha de entrega inválida'),
  body('delivery_address').optional().isString().isLength({ max: 500 }).withMessage('Dirección de entrega inválida'),
  body('delivery_city').optional().isString().isLength({ max: 100 }).withMessage('Ciudad inválida'),
  body('delivery_contact').optional().isString().isLength({ max: 100 }).withMessage('Contacto inválido'),
  body('delivery_phone').optional().isString().isLength({ max: 20 }).withMessage('Teléfono inválido'),
  body('transport_company').optional().isString().isLength({ max: 100 }).withMessage('Empresa de transporte inválida'),
  body('transport_cost').optional().isFloat({ min: 0 }).withMessage('Costo de transporte debe ser un número positivo'),
  body('notes').optional().isString().isLength({ max: 1000 }).withMessage('Notas inválidas'),
  body('items').isArray({ min: 1 }).withMessage('Debe incluir al menos un item'),
  body('items.*.product_id').isInt({ min: 1 }).withMessage('product_id debe ser un entero positivo'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('quantity debe ser un entero positivo'),
  body('items.*.unit_price').isFloat({ min: 0 }).withMessage('unit_price debe ser un número positivo'),
  body('items.*.batch_number').optional().isString().isLength({ max: 50 }).withMessage('Número de lote inválido'),
  body('items.*.notes').optional().isString().isLength({ max: 500 }).withMessage('Notas del item inválidas')
];

// Validación para actualizar pedido
const updateOrderValidation = [
  param('id').isInt({ min: 1 }).withMessage('ID de pedido inválido'),
  body('status').optional().isIn(['pendiente_preparacion', 'listo_despacho', 'pagado', 'aprobado', 'en_proceso', 'completado', 'cancelado']).withMessage('Estado inválido'),
  body('delivery_date').optional().isISO8601().withMessage('Fecha de entrega inválida'),
  body('delivery_address').optional().isString().isLength({ max: 500 }).withMessage('Dirección de entrega inválida'),
  body('delivery_city').optional().isString().isLength({ max: 100 }).withMessage('Ciudad inválida'),
  body('delivery_contact').optional().isString().isLength({ max: 100 }).withMessage('Contacto inválido'),
  body('delivery_phone').optional().isString().isLength({ max: 20 }).withMessage('Teléfono inválido'),
  body('transport_company').optional().isString().isLength({ max: 100 }).withMessage('Empresa de transporte inválida'),
  body('transport_cost').optional().isFloat({ min: 0 }).withMessage('Costo de transporte debe ser un número positivo'),
  body('notes').optional().isString().isLength({ max: 1000 }).withMessage('Notas inválidas'),
  body('remito_status').optional().isIn(['sin_remito', 'remito_generado', 'remito_despachado', 'remito_entregado']).withMessage('Estado de remito inválido'),
  body('stock_reserved').optional().isBoolean().withMessage('stock_reserved debe ser booleano')
];

// Validación para parámetros de ID
const idParamValidation = [
  param('id').isInt({ min: 1 }).withMessage('ID debe ser un entero positivo')
];

// Validación para filtros de pedidos
const orderFiltersValidation = [
  query('status').optional().isIn(['pendiente_preparacion', 'listo_despacho', 'pagado', 'aprobado', 'en_proceso', 'completado', 'cancelado']).withMessage('Estado inválido'),
  query('client_id').optional().isInt({ min: 1 }).withMessage('client_id debe ser un entero positivo'),
  query('remito_status').optional().isIn(['sin_remito', 'remito_generado', 'remito_despachado', 'remito_entregado']).withMessage('Estado de remito inválido'),
  query('date_from').optional().isISO8601().withMessage('Fecha desde inválida'),
  query('date_to').optional().isISO8601().withMessage('Fecha hasta inválida'),
  query('stock_reserved').optional().isBoolean().withMessage('stock_reserved debe ser booleano'),
  query('has_remito').optional().isBoolean().withMessage('has_remito debe ser booleano'),
  query('page').optional().isInt({ min: 1 }).withMessage('Página debe ser un entero positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Límite debe ser entre 1 y 100')
];

// =====================================================
// RUTAS DE PEDIDOS
// =====================================================

// POST /api/orders - Crear nuevo pedido
router.post('/',
  authenticateApiKey,
  validate(createOrderValidation),
  orderController.createOrder.bind(orderController)
);

// GET /api/orders - Obtener todos los pedidos con filtros (sin autenticación)
router.get('/',
  validate(orderFiltersValidation),
  orderController.getAllOrders.bind(orderController)
);

// GET /api/orders/stats - Obtener estadísticas del módulo (sin autenticación)
router.get('/stats',
  orderController.getOrderStats.bind(orderController)
);

// GET /api/orders/config - Obtener configuración del módulo (sin autenticación)
router.get('/config',
  orderController.getOrdersConfig.bind(orderController)
);

// GET /api/orders/ready-for-remito - Obtener pedidos listos para remito (sin autenticación)
router.get('/ready-for-remito',
  orderController.getOrdersReadyForRemito.bind(orderController)
);

// GET /api/orders/:id - Obtener pedido por ID (sin autenticación)
router.get('/:id',
  validate(idParamValidation),
  orderController.getOrderById.bind(orderController)
);

// GET /api/orders/number/:number - Obtener pedido por número (sin autenticación)
router.get('/number/:number',
  orderController.getOrderByNumber.bind(orderController)
);

// PUT /api/orders/:id - Actualizar pedido
router.put('/:id',
  authenticateApiKey,
  validate(updateOrderValidation),
  orderController.updateOrder.bind(orderController)
);

// DELETE /api/orders/:id - Eliminar pedido
router.delete('/:id',
  authenticateApiKey,
  validate(idParamValidation),
  orderController.deleteOrder.bind(orderController)
);

// =====================================================
// RUTAS DE OPERACIONES ESPECIALES
// =====================================================

// POST /api/orders/:id/reserve-stock - Reservar stock para pedido
router.post('/:id/reserve-stock',
  authenticateApiKey,
  validate(idParamValidation),
  orderController.reserveStock.bind(orderController)
);

// PUT /api/orders/:id/remito-status - Actualizar estado de remito
router.put('/:id/remito-status',
  authenticateApiKey,
  validate([
    ...idParamValidation,
    body('remitoStatus').isIn(['sin_remito', 'remito_generado', 'remito_despachado', 'remito_entregado']).withMessage('Estado de remito inválido')
  ]),
  orderController.updateRemitoStatus.bind(orderController)
);

// =====================================================
// RUTAS DE SINCRONIZACIÓN CON WOOCOMMERCE
// =====================================================

// POST /api/orders/:id/sync-to-woocommerce - Sincronizar pedido a WooCommerce manualmente
router.post('/:id/sync-to-woocommerce',
  authenticateApiKey,
  validate(idParamValidation),
  orderController.syncOrderToWooCommerce.bind(orderController)
);

export default router;

