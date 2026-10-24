import { Router } from 'express';
import { LogisticsController } from '../controllers/logisticsController';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation';
import { authenticateApiKey, optionalAuth } from '../middleware/auth';

const router = Router();
const logisticsController = new LogisticsController();

// =====================================================
// VALIDACIONES
// =====================================================

// Validación para crear remito
const createRemitoValidation = [
  body('order_id').isInt({ min: 1 }).withMessage('order_id debe ser un entero positivo'),
  body('client_id').isInt({ min: 1 }).withMessage('client_id debe ser un entero positivo'),
  body('remito_type').optional().isIn(['entrega_cliente', 'traslado_interno', 'devolucion', 'consignacion']).withMessage('Tipo de remito inválido'),
  body('delivery_address').optional().isString().isLength({ max: 500 }).withMessage('Dirección de entrega inválida'),
  body('delivery_city').optional().isString().isLength({ max: 50 }).withMessage('Ciudad inválida'),
  body('delivery_contact').optional().isString().isLength({ max: 100 }).withMessage('Contacto inválido'),
  body('delivery_phone').optional().isString().isLength({ max: 20 }).withMessage('Teléfono inválido'),
  body('transport_company').optional().isString().isLength({ max: 100 }).withMessage('Empresa de transporte inválida'),
  body('transport_cost').optional().isFloat({ min: 0 }).withMessage('Costo de transporte debe ser un número positivo'),
  body('preparation_notes').optional().isString().isLength({ max: 1000 }).withMessage('Notas de preparación inválidas'),
  body('items').isArray({ min: 1 }).withMessage('Debe incluir al menos un item'),
  body('items.*.product_id').isInt({ min: 1 }).withMessage('product_id debe ser un entero positivo'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('quantity debe ser un entero positivo'),
  body('items.*.unit_price').isFloat({ min: 0 }).withMessage('unit_price debe ser un número positivo'),
  body('items.*.batch_number').optional().isString().isLength({ max: 50 }).withMessage('Número de lote inválido'),
  body('items.*.expiration_date').optional().isISO8601().withMessage('Fecha de vencimiento inválida'),
  body('items.*.notes').optional().isString().isLength({ max: 500 }).withMessage('Notas del item inválidas')
];

// Validación para actualizar remito
const updateRemitoValidation = [
  param('id').isInt({ min: 1 }).withMessage('ID de remito inválido'),
  body('status').optional().isIn(['generado', 'preparando', 'listo_despacho', 'en_transito', 'entregado', 'devuelto', 'cancelado']).withMessage('Estado inválido'),
  body('delivery_address').optional().isString().isLength({ max: 500 }).withMessage('Dirección de entrega inválida'),
  body('delivery_city').optional().isString().isLength({ max: 50 }).withMessage('Ciudad inválida'),
  body('delivery_contact').optional().isString().isLength({ max: 100 }).withMessage('Contacto inválido'),
  body('delivery_phone').optional().isString().isLength({ max: 20 }).withMessage('Teléfono inválido'),
  body('transport_company').optional().isString().isLength({ max: 100 }).withMessage('Empresa de transporte inválida'),
  body('tracking_number').optional().isString().isLength({ max: 50 }).withMessage('Número de tracking inválido'),
  body('transport_cost').optional().isFloat({ min: 0 }).withMessage('Costo de transporte debe ser un número positivo'),
  body('preparation_notes').optional().isString().isLength({ max: 1000 }).withMessage('Notas de preparación inválidas'),
  body('delivery_notes').optional().isString().isLength({ max: 1000 }).withMessage('Notas de entrega inválidas'),
  body('signature_data').optional().isString().withMessage('Datos de firma inválidos'),
  body('delivery_photo').optional().isString().isLength({ max: 255 }).withMessage('URL de foto inválida'),
  body('delivered_by').optional().isInt({ min: 1 }).withMessage('ID de usuario inválido')
];

// Validación para crear entrada de trazabilidad
const createTrazabilidadValidation = [
  body('remito_id').isInt({ min: 1 }).withMessage('remito_id debe ser un entero positivo'),
  body('product_id').isInt({ min: 1 }).withMessage('product_id debe ser un entero positivo'),
  body('stage').isIn(['fabricacion', 'control_calidad', 'almacenamiento', 'preparacion', 'despacho', 'transito', 'entrega', 'devuelto']).withMessage('Etapa inválida'),
  body('location').optional().isString().isLength({ max: 100 }).withMessage('Ubicación inválida'),
  body('location_details').optional().isString().isLength({ max: 500 }).withMessage('Detalles de ubicación inválidos'),
  body('responsible_person').optional().isString().isLength({ max: 100 }).withMessage('Persona responsable inválida'),
  body('responsible_user_id').optional().isInt({ min: 1 }).withMessage('ID de usuario responsable inválido'),
  body('stage_end').optional().isISO8601().withMessage('Fecha de fin de etapa inválida'),
  body('temperature').optional().isFloat().withMessage('Temperatura debe ser un número'),
  body('humidity').optional().isFloat().withMessage('Humedad debe ser un número'),
  body('quality_check').optional().isBoolean().withMessage('quality_check debe ser booleano'),
  body('quality_notes').optional().isString().isLength({ max: 500 }).withMessage('Notas de calidad inválidas'),
  body('vehicle_plate').optional().isString().isLength({ max: 20 }).withMessage('Patente inválida'),
  body('driver_name').optional().isString().isLength({ max: 100 }).withMessage('Nombre del conductor inválido'),
  body('driver_phone').optional().isString().isLength({ max: 20 }).withMessage('Teléfono del conductor inválido'),
  body('notes').optional().isString().isLength({ max: 1000 }).withMessage('Notas inválidas'),
  body('photos').optional().isArray().withMessage('photos debe ser un array'),
  body('documents').optional().isArray().withMessage('documents debe ser un array')
];

// Validación para parámetros de ID
const idParamValidation = [
  param('id').isInt({ min: 1 }).withMessage('ID debe ser un entero positivo')
];

// Validación para filtros de remitos
const remitoFiltersValidation = [
  query('status').optional().isIn(['generado', 'preparando', 'listo_despacho', 'en_transito', 'entregado', 'devuelto', 'cancelado']).withMessage('Estado inválido'),
  query('remito_type').optional().isIn(['entrega_cliente', 'traslado_interno', 'devolucion', 'consignacion']).withMessage('Tipo de remito inválido'),
  query('client_id').optional().isInt({ min: 1 }).withMessage('client_id debe ser un entero positivo'),
  query('order_id').optional().isInt({ min: 1 }).withMessage('order_id debe ser un entero positivo'),
  query('date_from').optional().isISO8601().withMessage('Fecha desde inválida'),
  query('date_to').optional().isISO8601().withMessage('Fecha hasta inválida'),
  query('transport_company').optional().isString().isLength({ max: 100 }).withMessage('Empresa de transporte inválida'),
  query('tracking_number').optional().isString().isLength({ max: 50 }).withMessage('Número de tracking inválido'),
  query('page').optional().isInt({ min: 1 }).withMessage('Página debe ser un entero positivo'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Límite debe ser entre 1 y 100')
];

// =====================================================
// RUTAS DE REMITOS
// =====================================================

// POST /api/logistics/remitos - Crear nuevo remito
router.post('/remitos',
  authenticateApiKey,
  validate(createRemitoValidation),
  logisticsController.createRemito.bind(logisticsController)
);

// GET /api/logistics/remitos - Obtener todos los remitos con filtros
router.get('/remitos',
  authenticateApiKey,
  validate(remitoFiltersValidation),
  logisticsController.getAllRemitos.bind(logisticsController)
);

// GET /api/logistics/remitos/:id - Obtener remito por ID
router.get('/remitos/:id',
  authenticateApiKey,
  validate(idParamValidation),
  logisticsController.getRemitoById.bind(logisticsController)
);

// GET /api/logistics/remitos/number/:number - Obtener remito por número
router.get('/remitos/number/:number',
  authenticateApiKey,
  logisticsController.getRemitoByNumber.bind(logisticsController)
);

// PUT /api/logistics/remitos/:id - Actualizar remito
router.put('/remitos/:id',
  authenticateApiKey,
  validate(updateRemitoValidation),
  logisticsController.updateRemito.bind(logisticsController)
);

// DELETE /api/logistics/remitos/:id - Eliminar remito
router.delete('/remitos/:id',
  authenticateApiKey,
  validate(idParamValidation),
  logisticsController.deleteRemito.bind(logisticsController)
);

// =====================================================
// RUTAS DE OPERACIONES ESPECÍFICAS
// =====================================================

// PUT /api/logistics/remitos/:id/prepare - Marcar remito como preparado
router.put('/remitos/:id/prepare',
  authenticateApiKey,
  validate(idParamValidation),
  logisticsController.prepareRemito.bind(logisticsController)
);

// PUT /api/logistics/remitos/:id/dispatch - Marcar remito como despachado
router.put('/remitos/:id/dispatch',
  authenticateApiKey,
  validate([
    ...idParamValidation,
    body('tracking_number').optional().isString().isLength({ max: 50 }).withMessage('Número de tracking inválido'),
    body('transport_company').optional().isString().isLength({ max: 100 }).withMessage('Empresa de transporte inválida')
  ]),
  logisticsController.dispatchRemito.bind(logisticsController)
);

// PUT /api/logistics/remitos/:id/deliver - Marcar remito como entregado
router.put('/remitos/:id/deliver',
  authenticateApiKey,
  validate([
    ...idParamValidation,
    body('signature_data').optional().isString().withMessage('Datos de firma inválidos'),
    body('delivery_photo').optional().isString().isLength({ max: 255 }).withMessage('URL de foto inválida'),
    body('delivery_notes').optional().isString().isLength({ max: 1000 }).withMessage('Notas de entrega inválidas')
  ]),
  logisticsController.deliverRemito.bind(logisticsController)
);

// GET /api/logistics/remitos/:id/tracking - Obtener información de seguimiento
router.get('/remitos/:id/tracking',
  authenticateApiKey,
  validate(idParamValidation),
  logisticsController.getRemitoTracking.bind(logisticsController)
);

// =====================================================
// RUTAS DE TRAZABILIDAD
// =====================================================

// POST /api/logistics/trazabilidad - Crear entrada de trazabilidad
router.post('/trazabilidad',
  authenticateApiKey,
  validate(createTrazabilidadValidation),
  logisticsController.createTrazabilidadEntry.bind(logisticsController)
);

// GET /api/logistics/remitos/:id/trazabilidad - Obtener trazabilidad de un remito
router.get('/remitos/:id/trazabilidad',
  authenticateApiKey,
  validate(idParamValidation),
  logisticsController.getTrazabilidadByRemito.bind(logisticsController)
);

// =====================================================
// RUTAS DE ESTADÍSTICAS Y REPORTES
// =====================================================

// GET /api/logistics/stats - Obtener estadísticas del módulo
router.get('/stats',
  authenticateApiKey,
  logisticsController.getLogisticsStats.bind(logisticsController)
);

// =====================================================
// RUTAS DE CONFIGURACIÓN
// =====================================================

// GET /api/logistics/zones - Obtener zonas de entrega
router.get('/zones',
  authenticateApiKey,
  logisticsController.getDeliveryZones.bind(logisticsController)
);

// GET /api/logistics/transport-companies - Obtener empresas de transporte
router.get('/transport-companies',
  authenticateApiKey,
  logisticsController.getTransportCompanies.bind(logisticsController)
);

// GET /api/logistics/config - Obtener configuración del módulo
router.get('/config',
  authenticateApiKey,
  logisticsController.getLogisticsConfig.bind(logisticsController)
);

// =====================================================
// RUTAS PARA INTEGRACIÓN CON N8N (Con API Key)
// =====================================================

// POST /api/logistics/n8n/generate-from-order - Generar remito desde pedido (N8N)
router.post('/n8n/generate-from-order',
  authenticateApiKey,
  validate([
    body('orderId').isInt({ min: 1 }).withMessage('orderId debe ser un entero positivo')
  ]),
  logisticsController.generateRemitoFromOrder.bind(logisticsController)
);

// PUT /api/logistics/n8n/update-status - Actualizar estado desde N8N
router.put('/n8n/update-status',
  authenticateApiKey,
  validate([
    body('remitoId').isInt({ min: 1 }).withMessage('remitoId debe ser un entero positivo'),
    body('status').isIn(['generado', 'preparando', 'listo_despacho', 'en_transito', 'entregado', 'devuelto', 'cancelado']).withMessage('Estado inválido'),
    body('trackingData').optional().isObject().withMessage('trackingData debe ser un objeto')
  ]),
  logisticsController.updateRemitoStatusFromN8N.bind(logisticsController)
);

// GET /api/logistics/n8n/sync-data - Obtener datos para sincronización N8N
router.get('/n8n/sync-data',
  authenticateApiKey,
  validate(remitoFiltersValidation),
  logisticsController.getRemitosForN8NSync.bind(logisticsController)
);

// =====================================================
// RUTAS PÚBLICAS (Para seguimiento de clientes)
// =====================================================

// GET /api/logistics/public/tracking/:remitoNumber - Seguimiento público por número de remito
router.get('/public/tracking/:remitoNumber',
  logisticsController.getRemitoByNumber.bind(logisticsController)
);

// GET /api/logistics/public/remitos/:id/tracking - Seguimiento público por ID
router.get('/public/remitos/:id/tracking',
  logisticsController.getRemitoTracking.bind(logisticsController)
);

export default router;
