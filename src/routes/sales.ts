import { Router, Response, NextFunction, Request } from 'express';
import multer from 'multer';
import { SaleController } from '../controllers/saleController';
import { SalesDocumentController } from '../controllers/salesDocumentController';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation';
import { authenticateApiKey } from '../middleware/auth';
import { optionalAuthenticateJWT, authenticateJWT, authorizeRoles } from '../middleware/jwt';
import { AuthenticatedRequest } from '../middleware/jwt';
import { ApiResponse } from '../types';
import { normalizeCreateSaleLine } from '../utils/saleItems';
import {
  confirmSalesDocumentValidation,
  rematchSalesDocumentValidation,
  updateSalesDocumentLinkValidation,
} from '../middleware/salesDocumentValidation';

/** Roles que pueden ver listado de ventas POS y estadísticas (flexible para producción). */
const SALES_VIEW_ROLES = ['admin', 'gerencia', 'ventas', 'logistica', 'finanzas', 'manager', 'employee', 'viewer'] as const;
/** Roles que pueden corregir ventas (cliente, notas). */
const SALES_EDIT_ROLES = ['admin', 'gerencia', 'ventas'] as const;

const router = Router();
const saleController = new SaleController();
const salesDocumentController = new SalesDocumentController();

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb) => {
    const allowed =
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf');
    if (allowed) cb(null, true);
    else cb(new Error('Solo se permiten archivos PDF'));
  },
});

/**
 * Acepta JWT (Bearer) o API Key (x-api-key).
 * El POS desde el frontend usa JWT; integraciones externas pueden usar x-api-key.
 */
const authenticateSales = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  optionalAuthenticateJWT(req, res, () => {
    if (req.user) {
      return next();
    }
    if (req.headers['x-api-key']) {
      return authenticateApiKey(req as any, res, next);
    }
    const response: ApiResponse = {
      success: false,
      message: 'Se requiere autenticación',
      error: 'Envía Authorization: Bearer <token> (JWT) o el header x-api-key',
      timestamp: new Date().toISOString()
    };
    res.status(401).json(response);
  });
};

/**
 * Normaliza el body de crear venta: acepta camelCase del frontend y lo convierte al formato esperado por la API.
 * Así se evitan 400 por diferencias de nombre (productId → product_id, unitPrice → unit_price, etc.).
 */
const normalizeSaleBody = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  if (!req.body || (req.method !== 'POST' && req.method !== 'PUT')) {
    return next();
  }
  const b = req.body;

  // payment_method (acepta paymentMethod o "Efectivo" → "efectivo")
  const rawPaymentMethod = b.payment_method ?? b.paymentMethod;
  if (rawPaymentMethod !== undefined) {
    req.body.payment_method = String(rawPaymentMethod).toLowerCase();
  }

  // client_id (acepta clientId)
  if (b.clientId !== undefined && b.client_id === undefined) {
    req.body.client_id = b.clientId;
  }

  // payment_details (acepta paymentDetails)
  if (b.paymentDetails !== undefined && b.payment_details === undefined) {
    req.body.payment_details = b.paymentDetails;
  }

  // notes, sync_to_woocommerce, allow_inactive
  if (b.notes !== undefined) req.body.notes = b.notes;
  if (b.syncToWooCommerce !== undefined) req.body.sync_to_woocommerce = b.syncToWooCommerce;
  if (b.allowInactive !== undefined) req.body.allow_inactive = b.allowInactive;

  if (b.currency !== undefined) {
    req.body.currency = String(b.currency).toUpperCase();
  }
  if (b.exchangeRate !== undefined && b.exchange_rate === undefined) {
    req.body.exchange_rate = b.exchangeRate;
  }

  // items: catálogo (product_id) o manual (description); XOR validado en normalizeCreateSaleLine
  if (Array.isArray(b.items)) {
    try {
      req.body.items = b.items.map((item: Record<string, unknown>) =>
        normalizeCreateSaleLine(item)
      );
    } catch (err) {
      (req as any).saleItemsNormalizeError =
        err instanceof Error ? err.message : 'Ítems de venta inválidos';
    }
  }

  next();
};

/**
 * El frontend suele enviar docNro como número (JSON). express-validator con isString() falla.
 * Normalizamos a string de dígitos antes de facturarVentaValidation.
 */
const normalizeFacturarBody = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  const b = req.body;
  if (!b || typeof b !== 'object') {
    return next();
  }
  if (b.docNro !== undefined && b.docNro !== null && b.docNro !== '') {
    const docDigits = String(b.docNro).replace(/\D/g, '');
    // docTipo 99 (consumidor final): no enviar "0" a ARCA — omitir docNro
    if (docDigits === '' || docDigits === '0') {
      delete b.docNro;
    } else {
      b.docNro = docDigits;
    }
  }
  if (b.cuitEmisor !== undefined && b.cuitEmisor !== null && b.cuitEmisor !== '') {
    const n = typeof b.cuitEmisor === 'string' ? parseInt(b.cuitEmisor.replace(/\D/g, ''), 10) : Number(b.cuitEmisor);
    if (Number.isFinite(n)) b.cuitEmisor = n;
  }
  if (b.puntoVenta !== undefined && b.puntoVenta !== null && b.puntoVenta !== '') {
    const n = typeof b.puntoVenta === 'string' ? parseInt(b.puntoVenta, 10) : Number(b.puntoVenta);
    if (Number.isFinite(n)) b.puntoVenta = n;
  }
  next();
};

// =====================================================
// VALIDACIONES
// =====================================================

const rejectSaleItemsNormalizeError = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const msg = (req as any).saleItemsNormalizeError as string | undefined;
  if (msg) {
    const response: ApiResponse = {
      success: false,
      message: msg,
      timestamp: new Date().toISOString()
    };
    res.status(400).json(response);
    return;
  }
  next();
};

// Validación para crear venta (ítems ya normalizados: XOR product_id / description)
const updateSaleValidation = [
  body('client_id').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('client_id debe ser un entero positivo'),
  body('items').optional().isArray({ min: 1 }).withMessage('items debe ser un array con al menos un ítem'),
  body('payment_method')
    .optional({ values: 'falsy' })
    .isIn(['efectivo', 'tarjeta', 'transferencia', 'mixto'])
    .withMessage('Método de pago inválido'),
  body('payment_details').optional({ values: 'falsy' }).isObject().withMessage('payment_details debe ser un objeto'),
  body('payment_details.efectivo').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('efectivo debe ser un número positivo'),
  body('payment_details.tarjeta').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('tarjeta debe ser un número positivo'),
  body('payment_details.transferencia').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('transferencia debe ser un número positivo'),
  body('notes').optional({ values: 'falsy' }).isString().isLength({ max: 1000 }).withMessage('Notas inválidas'),
  body('allow_inactive').optional({ values: 'falsy' }).isBoolean().withMessage('allow_inactive debe ser booleano'),
  body('sync_to_woocommerce').optional({ values: 'falsy' }).isBoolean().withMessage('sync_to_woocommerce debe ser booleano'),
  body('currency').optional().isIn(['ARS', 'USD']).withMessage('currency debe ser ARS o USD'),
  body('exchange_rate').optional({ values: 'falsy' }).isFloat({ gt: 0 }).withMessage('exchange_rate debe ser mayor a 0')
];

const createSaleValidation = [
  body('items').isArray({ min: 1 }).withMessage('Debe incluir al menos un item'),
  body('payment_method').isIn(['efectivo', 'tarjeta', 'transferencia', 'mixto']).withMessage('Método de pago inválido'),
  body('client_id').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('client_id debe ser un entero positivo'),
  body('payment_details').optional({ values: 'falsy' }).isObject().withMessage('payment_details debe ser un objeto'),
  body('payment_details.efectivo').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('efectivo debe ser un número positivo'),
  body('payment_details.tarjeta').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('tarjeta debe ser un número positivo'),
  body('payment_details.transferencia').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('transferencia debe ser un número positivo'),
  body('notes').optional({ values: 'falsy' }).isString().isLength({ max: 1000 }).withMessage('Notas inválidas'),
  body('sync_to_woocommerce').optional({ values: 'falsy' }).isBoolean().withMessage('sync_to_woocommerce debe ser booleano'),
  body('allow_inactive').optional({ values: 'falsy' }).isBoolean().withMessage('allow_inactive debe ser booleano'),
  body('currency').optional().isIn(['ARS', 'USD']).withMessage('currency debe ser ARS o USD'),
  body('exchange_rate').optional({ values: 'falsy' }).isFloat({ gt: 0 }).withMessage('exchange_rate debe ser mayor a 0')
];

// Validación para parámetros de ID
const idParamValidation = [
  param('id').isInt({ min: 1 }).withMessage('ID debe ser un entero positivo')
];

// Validación para filtros de ventas
const saleFiltersValidation = [
  query('client_id').optional().isInt({ min: 1 }).withMessage('client_id debe ser un entero positivo'),
  query('payment_method').optional().isIn(['efectivo', 'tarjeta', 'transferencia', 'mixto']).withMessage('Método de pago inválido'),
  query('sync_status').optional().isIn(['pending', 'synced', 'error']).withMessage('Estado de sincronización inválido'),
  query('date_from').optional().isISO8601().withMessage('Fecha desde inválida'),
  query('date_to').optional().isISO8601().withMessage('Fecha hasta inválida'),
  query('page').optional().isInt({ min: 1 }).withMessage('Página debe ser un entero positivo'),
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Límite debe ser entre 1 y 500'),
  query('include_items')
    .optional()
    .isIn(['true', 'false', '1', '0'])
    .withMessage('include_items debe ser true o false'),
  query('include_facturacion_archived')
    .optional()
    .isIn(['true', 'false', '1', '0'])
    .withMessage('include_facturacion_archived debe ser true o false')
];

const facturarVentaValidation = [
  body('cuitEmisor').optional().isInt({ min: 10000000000, max: 99999999999 }).withMessage('cuitEmisor debe tener 11 dígitos'),
  body('tipo')
    .optional()
    .isIn([1, 2, 3, 6, 7, 8, 11])
    .withMessage('tipo debe ser 1, 6 u 11 (Factura A, B o C) u notas asociadas'),
  body('puntoVenta').optional().isInt({ min: 1 }).withMessage('puntoVenta debe ser entero positivo'),
  body('docTipo').optional().isInt({ min: 1 }).withMessage('docTipo debe ser entero positivo'),
  body('docNro')
    .optional({ values: 'falsy' })
    .isString()
    .isLength({ min: 1, max: 20 })
    .withMessage('docNro debe ser string de dígitos (o número; se normaliza en el servidor)'),
  body('condicionIvaReceptor').optional().isInt({ min: 1 }).withMessage('condicionIvaReceptor debe ser entero positivo'),
  body('concepto').optional().isIn([1, 2, 3]).withMessage('concepto debe ser 1, 2 o 3'),
  body('fechaServicioDesde').optional({ values: 'falsy' }).isISO8601().withMessage('fechaServicioDesde debe ser YYYY-MM-DD'),
  body('fechaServicioHasta').optional({ values: 'falsy' }).isISO8601().withMessage('fechaServicioHasta debe ser YYYY-MM-DD'),
  body('fechaVencimientoPago').optional({ values: 'falsy' }).isISO8601().withMessage('fechaVencimientoPago debe ser YYYY-MM-DD'),
  body('condicionVenta').optional().isString().isLength({ max: 120 }).withMessage('condicionVenta máximo 120 caracteres'),
  body('condicionVentaCodigo').optional().isString().isLength({ max: 32 }).withMessage('condicionVentaCodigo inválido'),
  body('condicionVentaTexto').optional().isString().isLength({ max: 120 }).withMessage('condicionVentaTexto máximo 120 caracteres'),
  body('receptorRazonSocial').optional().isString().isLength({ max: 500 }).withMessage('receptorRazonSocial máximo 500 caracteres'),
  body('receptorDomicilio').optional().isString().isLength({ max: 500 }).withMessage('receptorDomicilio máximo 500 caracteres'),
  body('force').optional().isBoolean().withMessage('force debe ser booleano'),
  body('skipPadronCondicionCheck')
    .optional()
    .isBoolean()
    .withMessage('skipPadronCondicionCheck debe ser booleano'),
  body('fiscalManualConfig')
    .optional()
    .isBoolean()
    .withMessage('fiscalManualConfig debe ser booleano')
];

// =====================================================
// RUTAS DE VENTAS
// =====================================================

// POST /api/sales - Crear nueva venta (JWT o x-api-key)
router.post('/',
  authenticateSales,
  normalizeSaleBody,
  rejectSaleItemsNormalizeError,
  validate(createSaleValidation),
  saleController.createSale.bind(saleController)
);

// GET /api/sales - Obtener todas las ventas con filtros (requiere JWT + rol permitido para ver tabla en prod)
router.get('/',
  authenticateJWT,
  authorizeRoles(...SALES_VIEW_ROLES),
  validate(saleFiltersValidation),
  saleController.getAllSales.bind(saleController)
);

// GET /api/sales/stats - Obtener estadísticas de ventas
router.get('/stats',
  authenticateJWT,
  authorizeRoles(...SALES_VIEW_ROLES),
  saleController.getSaleStats.bind(saleController)
);

// POST /api/sales/facturacion-archive — archivar / restaurar en facturación (solo superadmin)
router.post(
  '/facturacion-archive',
  authenticateJWT,
  authorizeRoles('superadmin'),
  validate([
    body('saleIds').isArray({ min: 1 }).withMessage('saleIds debe ser un array con al menos un id'),
    body('saleIds.*').isInt({ min: 1 }).withMessage('Cada saleId debe ser entero positivo'),
    body('archived').optional().isBoolean().withMessage('archived debe ser booleano')
  ]),
  saleController.setFacturacionArchived.bind(saleController)
);

// ========== IMPORTACIÓN DE FACTURAS ARCA (PDF) ==========

router.post(
  '/documents/parse',
  authenticateJWT,
  authorizeRoles('admin', 'gerencia', 'finanzas', 'ventas'),
  pdfUpload.single('file'),
  salesDocumentController.parseDocument.bind(salesDocumentController)
);

router.post(
  '/documents/rematch',
  authenticateJWT,
  authorizeRoles('admin', 'gerencia', 'finanzas', 'ventas'),
  validate(rematchSalesDocumentValidation),
  salesDocumentController.rematchDocument.bind(salesDocumentController)
);

router.post(
  '/documents/confirm',
  authenticateJWT,
  authorizeRoles('admin', 'gerencia', 'finanzas', 'ventas'),
  validate(confirmSalesDocumentValidation),
  salesDocumentController.confirmDocument.bind(salesDocumentController)
);

router.post(
  '/documents/update-link',
  authenticateJWT,
  authorizeRoles('admin', 'gerencia', 'finanzas', 'ventas'),
  validate(updateSalesDocumentLinkValidation),
  salesDocumentController.updateLinkedDocument.bind(salesDocumentController)
);

router.get(
  '/:id/source-pdf',
  authenticateJWT,
  authorizeRoles(...SALES_VIEW_ROLES),
  validate(idParamValidation),
  salesDocumentController.downloadSourcePdf.bind(salesDocumentController)
);

router.delete(
  '/:id/external-invoice-link',
  authenticateJWT,
  authorizeRoles('admin', 'gerencia', 'finanzas', 'ventas'),
  validate(idParamValidation),
  salesDocumentController.unlinkExternalInvoice.bind(salesDocumentController)
);

// GET /api/sales/:id - Obtener venta por ID
router.get('/:id',
  authenticateJWT,
  authorizeRoles(...SALES_VIEW_ROLES),
  validate(idParamValidation),
  saleController.getSaleById.bind(saleController)
);

// PUT /api/sales/:id - Corregir cliente, ítems, IVA, pago o notas
router.put('/:id',
  authenticateJWT,
  authorizeRoles(...SALES_EDIT_ROLES),
  normalizeSaleBody,
  rejectSaleItemsNormalizeError,
  validate([...idParamValidation, ...updateSaleValidation]),
  saleController.updateSale.bind(saleController)
);

// =====================================================
// RUTAS DE SINCRONIZACIÓN CON WOOCOMMERCE
// =====================================================

// POST /api/sales/:id/sync - Sincronizar venta a WooCommerce (JWT o x-api-key)
router.post('/:id/sync',
  authenticateSales,
  validate(idParamValidation),
  saleController.syncSaleToWooCommerce.bind(saleController)
);

// GET /api/sales/:id/comprobante - Comprobante AFIP (local; ?refresh=true consulta MultiCUIT)
router.get('/:id/comprobante',
  authenticateSales,
  validate([
    ...idParamValidation,
    query('refresh').optional().isIn(['true', 'false', '1', '0']).withMessage('refresh debe ser true o false')
  ]),
  saleController.getComprobante.bind(saleController)
);

// GET /api/sales/:id/facturar/sugerencia - Tipo de comprobante y defaults recomendados
router.get('/:id/facturar/sugerencia',
  authenticateSales,
  validate([
    ...idParamValidation,
    query('condicionIvaReceptor').optional().isInt({ min: 1 }).withMessage('condicionIvaReceptor inválida'),
    query('tipo').optional().isIn([1, 2, 3, 6, 7, 8, 11]).withMessage('tipo inválido')
  ]),
  saleController.getFacturarSugerencia.bind(saleController)
);

// POST /api/sales/:id/facturar - Emitir comprobante ARCA para una venta existente
router.post('/:id/facturar',
  authenticateSales,
  normalizeFacturarBody,
  validate([...idParamValidation, ...facturarVentaValidation]),
  saleController.facturarVenta.bind(saleController)
);

const notaCreditoValidation = [
  body('motivo')
    .optional()
    .isIn(['error_emision', 'devolucion', 'descuento', 'otro'])
    .withMessage('motivo inválido'),
  body('observaciones').optional().isString().isLength({ max: 500 }),
  body('importe').optional({ nullable: true }).isFloat({ min: 0 }),
  body('confirmar').isBoolean().withMessage('confirmar debe ser true para emitir la NC'),
  body('cuitEmisor').optional().isInt({ min: 10000000000, max: 99999999999 }),
  body('puntoVenta').optional().isInt({ min: 1 })
];

// POST /api/sales/:id/nota-credito - Nota de crédito ARCA por venta ya facturada
router.post('/:id/nota-credito',
  authenticateSales,
  validate([...idParamValidation, ...notaCreditoValidation]),
  saleController.emitirNotaCredito.bind(saleController)
);

export default router;
