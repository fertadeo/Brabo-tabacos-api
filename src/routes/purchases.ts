import { Router, Request } from 'express';
import multer from 'multer';
import { PurchaseController } from '../controllers/purchaseController';
import { PurchaseDocumentController } from '../controllers/purchaseDocumentController';
import { 
  createPurchaseValidation, 
  updatePurchaseValidation,
  createPurchaseItemValidation,
  updatePurchaseItemValidation,
  createSupplierValidation,
  updateSupplierValidation
} from '../middleware/purchaseValidation';
import {
  confirmPurchaseDocumentValidation,
  rematchPurchaseDocumentValidation,
} from '../middleware/purchaseDocumentValidation';
import { padronCuitParam } from '../middleware/padronValidation';
import { validate } from '../middleware/validation';
import { authenticateJWT, authorizeRoles } from '../middleware/jwt';

const router = Router();
const purchaseController = new PurchaseController();
const purchaseDocumentController = new PurchaseDocumentController();

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

// Apply JWT authentication to all purchase routes
router.use(authenticateJWT);

/**
 * @route GET /api/purchases
 * @desc Get all purchases with pagination and filters
 * @access Private (gerencia, finanzas, logistica)
 * @queryParams page, limit, search, status, supplier_id, date_from, date_to, all
 * @example 
 *   - GET /api/purchases (paginado, 10 por página)
 *   - GET /api/purchases?all=true (todas las compras sin paginación)
 *   - GET /api/purchases?page=2&limit=20 (página 2, 20 por página)
 *   - GET /api/purchases?search=COMP001 (buscar por número de compra)
 *   - GET /api/purchases?status=pending (solo compras pendientes)
 *   - GET /api/purchases?supplier_id=1 (filtrar por proveedor)
 *   - GET /api/purchases?date_from=2024-01-01&date_to=2024-12-31 (filtrar por rango de fechas)
 */
router.get('/', authorizeRoles('gerencia', 'finanzas', 'logistica'), purchaseController.getAllPurchases.bind(purchaseController));

/**
 * @route GET /api/purchases/stats
 * @desc Get purchase statistics
 * @access Private (gerencia, finanzas)
 */
router.get('/stats', authorizeRoles('gerencia', 'finanzas'), purchaseController.getPurchaseStats.bind(purchaseController));

// ========== SUPPLIER ROUTES (deben ir ANTES de /:id para evitar conflictos) ==========

/**
 * @route GET /api/purchases/suppliers
 * @desc Get all suppliers with pagination and filters
 * @access Private (gerencia, finanzas, logistica)
 * @queryParams page, limit, search, city, is_active, all
 * @example 
 *   - GET /api/purchases/suppliers (paginado, 10 por página)
 *   - GET /api/purchases/suppliers?all=true (todos los proveedores sin paginación)
 *   - GET /api/purchases/suppliers?search=proveedor (buscar por nombre)
 *   - GET /api/purchases/suppliers?city=Buenos Aires (filtrar por ciudad)
 *   - GET /api/purchases/suppliers?is_active=true (solo proveedores activos)
 */
router.get('/suppliers', authorizeRoles('gerencia', 'finanzas', 'logistica'), purchaseController.getAllSuppliers.bind(purchaseController));

/**
 * @route GET /api/purchases/suppliers/stats
 * @desc Get supplier statistics
 * @access Private (gerencia, finanzas)
 */
router.get('/suppliers/stats', authorizeRoles('gerencia', 'finanzas'), purchaseController.getSupplierStats.bind(purchaseController));

/**
 * @route GET /api/purchases/suppliers/padron/:cuit
 * @desc Consultar padrón ARCA por CUIT (MultiCUIT) para autocompletar alta de proveedor
 * @query cuitEmisor (opcional), incluirCondicionIva, skipCache
 */
router.get(
  '/suppliers/padron/:cuit',
  authorizeRoles('gerencia', 'finanzas'),
  validate(padronCuitParam),
  purchaseController.lookupSupplierPadron.bind(purchaseController)
);

/**
 * @route GET /api/purchases/suppliers/:id
 * @desc Get supplier by ID
 * @access Private (gerencia, finanzas, logistica)
 */
router.get('/suppliers/:id', authorizeRoles('gerencia', 'finanzas', 'logistica'), purchaseController.getSupplierById.bind(purchaseController));

/**
 * @route POST /api/purchases/suppliers
 * @desc Create new supplier
 * @access Private (gerencia, finanzas)
 * @body { code, name, contact_name?, email?, phone?, address?, city?, country? }
 */
router.post('/suppliers', authorizeRoles('gerencia', 'finanzas'), createSupplierValidation, purchaseController.createSupplier.bind(purchaseController));

/**
 * @route PUT /api/purchases/suppliers/:id
 * @desc Update supplier
 * @access Private (gerencia, finanzas)
 * @body { code?, name?, contact_name?, email?, phone?, address?, city?, country?, is_active? }
 */
router.put('/suppliers/:id', authorizeRoles('gerencia', 'finanzas'), updateSupplierValidation, purchaseController.updateSupplier.bind(purchaseController));

/**
 * @route DELETE /api/purchases/suppliers/:id
 * @desc Delete supplier (soft delete if has purchases, hard delete otherwise)
 * @access Private (gerencia, finanzas)
 */
router.delete('/suppliers/:id', authorizeRoles('gerencia', 'finanzas'), purchaseController.deleteSupplier.bind(purchaseController));

// ========== SUPPLIER DOCUMENT IMPORT (PDF remitos/facturas) ==========

router.post(
  '/documents/parse',
  authorizeRoles('gerencia', 'finanzas', 'logistica'),
  pdfUpload.single('file'),
  purchaseDocumentController.parseDocument.bind(purchaseDocumentController)
);

router.post(
  '/documents/rematch',
  authorizeRoles('gerencia', 'finanzas', 'logistica'),
  rematchPurchaseDocumentValidation,
  purchaseDocumentController.rematchDocument.bind(purchaseDocumentController)
);

router.post(
  '/documents/confirm',
  authorizeRoles('gerencia', 'finanzas'),
  confirmPurchaseDocumentValidation,
  purchaseDocumentController.confirmDocument.bind(purchaseDocumentController)
);

// ========== PURCHASE ROUTES (rutas con parámetros dinámicos al final) ==========

/**
 * @route GET /api/purchases/:id
 * @desc Get purchase by ID
 * @access Private (gerencia, finanzas, logistica)
 */
router.get('/:id', authorizeRoles('gerencia', 'finanzas', 'logistica'), purchaseController.getPurchaseById.bind(purchaseController));

/**
 * @route GET /api/purchases/:id/source-pdf
 * @desc Descargar o previsualizar el PDF del proveedor vinculado a la compra
 * @access Private (gerencia, finanzas, logistica)
 */
router.get(
  '/:id/source-pdf',
  authorizeRoles('gerencia', 'finanzas', 'logistica'),
  purchaseDocumentController.downloadSourcePdf.bind(purchaseDocumentController)
);

/**
 * @route POST /api/purchases
 * @desc Create new purchase
 * @access Private (gerencia, finanzas)
 * @body { supplier_id, status?, total_amount?, purchase_date?, received_date?, notes? }
 */
router.post('/', authorizeRoles('gerencia', 'finanzas'), createPurchaseValidation, purchaseController.createPurchase.bind(purchaseController));

/**
 * @route PUT /api/purchases/:id
 * @desc Update purchase
 * @access Private (gerencia, finanzas)
 * @body { supplier_id?, status?, total_amount?, purchase_date?, received_date?, notes? }
 */
router.put('/:id', authorizeRoles('gerencia', 'finanzas'), updatePurchaseValidation, purchaseController.updatePurchase.bind(purchaseController));

/**
 * @route DELETE /api/purchases/:id
 * @desc Delete purchase
 * @access Private (gerencia, finanzas)
 */
router.delete('/:id', authorizeRoles('gerencia', 'finanzas'), purchaseController.deletePurchase.bind(purchaseController));

/**
 * @route GET /api/purchases/:id/items
 * @desc Get purchase items
 * @access Private (gerencia, finanzas, logistica)
 */
router.get('/:id/items', authorizeRoles('gerencia', 'finanzas', 'logistica'), purchaseController.getPurchaseItems.bind(purchaseController));

/**
 * @route POST /api/purchases/:id/items
 * @desc Create purchase item
 * @access Private (gerencia, finanzas)
 * @body { product_id, quantity, unit_price, total_price }
 */
router.post('/:id/items', authorizeRoles('gerencia', 'finanzas'), createPurchaseItemValidation, purchaseController.createPurchaseItem.bind(purchaseController));

/**
 * @route PUT /api/purchases/:id/items/:itemId
 * @desc Update purchase item
 * @access Private (gerencia, finanzas)
 * @body { product_id?, quantity?, unit_price?, total_price? }
 */
router.put('/:id/items/:itemId', authorizeRoles('gerencia', 'finanzas'), updatePurchaseItemValidation, purchaseController.updatePurchaseItem.bind(purchaseController));

/**
 * @route DELETE /api/purchases/:id/items/:itemId
 * @desc Delete purchase item
 * @access Private (gerencia, finanzas)
 */
router.delete('/:id/items/:itemId', authorizeRoles('gerencia', 'finanzas'), purchaseController.deletePurchaseItem.bind(purchaseController));

export default router;
