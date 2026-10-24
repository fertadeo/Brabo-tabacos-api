import { SaleRepository } from '../repositories/SaleRepository';
import { SaleComprobanteRepository } from '../repositories/SaleComprobanteRepository';
import { WooCommerceService } from './WooCommerceService';
import { ProductService } from './ProductService';
import {
  FacturadorArcaService,
  FacturadorApiError,
  FacturadorEmitirPayload
} from './FacturadorArcaService';
import {
  buildNotaCreditoIdempotencyKey,
  buildNotaCreditoPayload,
  facturadorTipoRequiereIva,
  getNotaCreditoTipoForFactura,
  NOTA_CREDITO_MOTIVOS,
  NotaCreditoMotivo,
  resolveFacturaOriginalRef
} from '../utils/facturadorNotaCredito';
import {
  logFacturadorMissingCredentials,
  logFacturadorCuitInvalid,
  logFacturadorPingFailed,
  logFacturadorFacturarContext,
  normalizeCuitDigits
} from '../utils/facturadorEnvDiagnostics';
import {
  resolveFacturadorError
} from '../utils/facturadorErrors';
import {
  ArcaComprobanteSnapshot,
  buildArcaComprobanteSnapshot,
  comprobanteSnapshotIncomplete,
  parseEmisionFromFacturador,
  toPersistArcaComprobanteFields
} from '../utils/arcaComprobante';
import {
  buildRefacturacionIdempotencyKey,
  itemsSnapshotFromSale,
  saleCanRefacturar,
  saleHasFiscalLock,
  snapshotFacturaFromSale,
  snapshotNotaCreditoFromSale
} from '../utils/saleComprobantes';
import {
  formatComprobanteIssuesForUser,
  getDefaultTipoFromEnv,
  getEmisorRegimenFromEnv,
  getTipoLabel,
  inferCondicionIvaReceptor,
  resolveCondicionIvaReceptorForWsfe,
  suggestTipoComprobante,
  validateComprobanteFiscal,
  validateNoConsumidorFinalSiOtraCondicion,
  WSFE_TIPOS
} from '../utils/facturadorComprobante';
import {
  PadronCondicionValidationResult,
  enrichPayloadWithPadronHints,
  extractFacturadorErrorDetails,
  formatFacturadorPreflightDetails,
  shouldConsultarPadronCondicionIva,
  validateCondicionIvaConPadronSugerencia
} from '../utils/facturadorPadronCondicion';
import { executeQuery } from '../config/database';
import { 
  Sale, 
  SaleWithDetails,
  CreateSaleData, 
  UpdateSaleData,
  SaleFilters,
  SaleStats
} from '../entities/Sale';
import {
  CreateSaleCatalogItem,
  isCatalogSaleLine,
  parseSaleItemQuantity,
  resolveFacturadorDetalleForEmision,
  saleItemDisplayName,
  saleItemFiscalCodigo
} from '../utils/saleItems';
import { ApiResponse } from '../types';
import {
  aggregateIvaForFacturador,
  buildIvaArrayFromSaleLines,
  countDistinctIvaAlicuotas,
  ivaRateLabel,
  normalizeIvaRate,
  sanitizeFacturadorIvaPayload,
  splitIvaFromInclusiveTotal,
  validateFacturadorIvaTotals
} from '../utils/ivaAlicuota';
import { docTipoFromClientTaxId, docNroFromClientTaxId } from '../utils/clientTaxId';

export class SaleService {
  private saleRepository: SaleRepository;
  private saleComprobanteRepository: SaleComprobanteRepository;
  private wooCommerceService: WooCommerceService;
  private productService: ProductService;
  private facturadorArcaService: FacturadorArcaService;

  constructor() {
    this.saleRepository = new SaleRepository();
    this.saleComprobanteRepository = new SaleComprobanteRepository();
    this.wooCommerceService = new WooCommerceService();
    this.productService = new ProductService();
    this.facturadorArcaService = new FacturadorArcaService();
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private parseDocTipoByClient(client: any): number {
    return docTipoFromClientTaxId(client?.cuil_cuit);
  }

  private parseDocNroByClient(client: any): string | undefined {
    return docNroFromClientTaxId(client?.cuil_cuit);
  }

  private async validarCondicionIvaConPadron(
    cuitEmisor: number,
    docTipo: number,
    docNro: number | string | null | undefined,
    condicionIvaReceptor: number,
    options: {
      skipPadronCondicionCheck?: boolean;
      facturadorApiKey?: string | null;
      tipoComprobante?: number;
    } = {}
  ): Promise<PadronCondicionValidationResult | null> {
    if (options.skipPadronCondicionCheck) return null;
    if (!shouldConsultarPadronCondicionIva(docTipo, docNro)) return null;

    const receptor = String(docNro ?? '').replace(/\D/g, '');
    try {
      const resp = await this.facturadorArcaService.getSugerenciaCondicionIva(
        cuitEmisor,
        receptor,
        { apiKey: options.facturadorApiKey }
      );
      return validateCondicionIvaConPadronSugerencia(
        condicionIvaReceptor,
        resp.sugerencia,
        resp.advertencias,
        options.tipoComprobante
      );
    } catch (error) {
      console.warn('[SaleService] validarCondicionIvaConPadron — consulta padrón fallida', {
        cuitEmisor,
        receptor,
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        checked: false,
        coincide: false,
        condicionEnviada: condicionIvaReceptor,
        unavailable: true,
        advertencias: ['No se pudo consultar el padrón ARCA para validar la condición IVA del receptor.']
      };
    }
  }

  /** YYYY-MM-DD en horario Argentina (para fecha de comprobante ARCA). */
  private toArgentinaDateString(value: string | Date): string {
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) {
      return new Date().toLocaleDateString('en-CA', {
        timeZone: 'America/Argentina/Buenos_Aires'
      });
    }
    return d.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
  }

  private buildPayloadFromSale(
    sale: SaleWithDetails,
    client: any,
    options: FacturarVentaOptions
  ): FacturadorEmitirPayload {
    const tipo = Number(options.tipo ?? getDefaultTipoFromEnv());
    const concepto = Number(options.concepto ?? 1);
    const lineas = sale.items || [];
    const ivaLines = lineas.map((item) => {
      const cantidad = parseSaleItemQuantity(item.quantity);
      const precioUnitario = this.round2(Number(item.unit_price));
      const lineTotal = this.round2(
        Number(item.total_price ?? cantidad * precioUnitario)
      );
      return {
        lineTotal,
        ivaRate: normalizeIvaRate(item.iva_rate)
      };
    });
    const itemsSum = this.round2(ivaLines.reduce((sum, line) => sum + line.lineTotal, 0));
    const total =
      itemsSum > 0 ? itemsSum : this.round2(Number(sale.total_amount || 0));
    const docTipo = Number(options.docTipo ?? this.parseDocTipoByClient(client));
    const condicionRaw = Number(options.condicionIvaReceptor ?? 5);
    const fiscalManual = options.fiscalManualConfig === true;
    const condicionWsfe = fiscalManual
      ? condicionRaw
      : resolveCondicionIvaReceptorForWsfe(tipo, condicionRaw);
    const payload: FacturadorEmitirPayload = {
      cuitEmisor: Number(options.cuitEmisor),
      tipo,
      puntoVenta: Number(options.puntoVenta ?? 1),
      docTipo,
      condicionIvaReceptor: condicionWsfe,
      concepto,
      importe: total
    };

    if (condicionWsfe !== condicionRaw) {
      console.log('[SaleService] buildPayloadFromSale — condición IVA normalizada para WSFE', {
        saleId: sale.id,
        tipo,
        condicionErp: condicionRaw,
        condicionWsfe
      });
    }

    const docNroFromOptions =
      options.docNro !== undefined && options.docNro !== null
        ? String(options.docNro).replace(/\D/g, '')
        : '';
    const docNroFromClient = this.parseDocNroByClient(client);
    const docNroResolved = docNroFromOptions || docNroFromClient || '';
    if (docNroResolved && docNroResolved !== '0') {
      payload.docNro = docNroResolved;
    }

    if (facturadorTipoRequiereIva(tipo)) {
      payload.iva = buildIvaArrayFromSaleLines(ivaLines);

      const importeCheck = validateFacturadorIvaTotals(total, payload.iva);
      payload.importe = importeCheck.computedImporte;

      const alicuotaCount = countDistinctIvaAlicuotas(payload.iva);
      if (alicuotaCount > 1) {
        console.log('[SaleService] buildPayloadFromSale — venta con múltiples alícuotas IVA', {
          saleId: sale.id,
          sale_number: sale.sale_number,
          alicuotaCount,
          importe: payload.importe,
          netoGravado: importeCheck.netoGravado,
          ivaTotal: importeCheck.ivaTotal,
          iva: payload.iva,
          lineasPorAlicuota: ivaLines.map((line) => ({
            lineTotal: line.lineTotal,
            ivaRate: line.ivaRate
          }))
        });
      }

      if (!importeCheck.valid) {
        console.warn('[SaleService] buildPayloadFromSale — desfase importe vs iva[]', {
          saleId: sale.id,
          saleTotal: total,
          saleTotalCabecera: this.round2(Number(sale.total_amount || 0)),
          computedImporte: importeCheck.computedImporte,
          diff: importeCheck.diff,
          iva: payload.iva
        });
      }

      sanitizeFacturadorIvaPayload(payload);
    }

    if (concepto === 2 || concepto === 3) {
      payload.fechaServicioDesde = options.fechaServicioDesde;
      payload.fechaServicioHasta = options.fechaServicioHasta;
      if (options.fechaVencimientoPago) {
        payload.fechaVencimientoPago = String(options.fechaVencimientoPago).slice(0, 10);
      }
    }

    const currency = this.saleCurrency(sale);
    if (currency === 'USD') {
      const rate = Number(sale.exchange_rate);
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error('La venta en USD no tiene cotización (exchange_rate) válida para facturar');
      }
      payload.monedaId = 'DOL';
      payload.tipoCambio = this.round2(rate);
    } else {
      payload.monedaId = 'PES';
      payload.tipoCambio = 1;
    }

    const condicionVenta = (options.condicionVenta ?? '').trim().slice(0, 120);
    if (condicionVenta) {
      payload.condicionVenta = condicionVenta;
    }

    const razonSocial = (options.receptorRazonSocial ?? client?.name ?? '').trim().slice(0, 500);
    if (razonSocial) {
      payload.receptorRazonSocial = razonSocial;
    }

    const domicilioFromClient = [client?.address, client?.city].filter(Boolean).join(', ');
    const domicilio = (options.receptorDomicilio ?? domicilioFromClient).trim().slice(0, 500);
    if (domicilio) {
      payload.receptorDomicilio = domicilio;
    }

    // Sin fechaCbte: el facturador ARCA usa la fecha de proceso (hoy) al emitir.
    // sale_date se actualiza al editar la venta para trazabilidad interna y caja.
    payload.omitirPdf = true;
    enrichPayloadWithPadronHints(payload);

    if (lineas.length > 0) {
      const detalleResolution = resolveFacturadorDetalleForEmision(
        lineas,
        payload.importe,
        (value) => this.round2(value)
      );
      // Tras editar ítems con distintas alícuotas, importe fiscal (IVA) puede diferir
      // del total de líneas por redondeo; omitir detalle evita rechazos del facturador.
      if (detalleResolution.incluidoEnEmision) {
        payload.detalle = detalleResolution.detalle;
      } else {
        console.warn('[SaleService] buildPayloadFromSale — detalle omitido (desfase importe/IVA)', {
          saleId: sale.id,
          detalleSum: detalleResolution.detalleSum,
          importeFiscal: payload.importe,
          diff: detalleResolution.diff
        });
      }
    }

    return payload;
  }

  private saleCurrency(sale: SaleWithDetails): 'ARS' | 'USD' {
    const raw = String(sale.currency ?? 'ARS').toUpperCase();
    return raw === 'USD' ? 'USD' : 'ARS';
  }

  private validateCreateSaleCurrency(data: CreateSaleData): void {
    const currency = data.currency === 'USD' ? 'USD' : 'ARS';
    if (currency === 'USD') {
      const rate = Number(data.exchange_rate);
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error('Para ventas en USD debés indicar exchange_rate (cotización USD/ARS) mayor a 0');
      }
    }
  }

  // =====================================================
  // GESTIÓN DE VENTAS
  // =====================================================

  /**
   * Crea una nueva venta local.
   * Flujo: validar stock → crear venta (descuenta stock en ERP) → registrar pago → sincronizar con WooCommerce (pedido + descuento de stock en WC).
   */
  async createSale(data: CreateSaleData, userId: number | null): Promise<ApiResponse> {
    try {
      this.validateCreateSaleCurrency(data);
      const catalogItems = data.items.filter(isCatalogSaleLine);

      // 1. Validar stock disponible (solo líneas de catálogo)
      await this.validateStockAvailability(catalogItems);

      // 2. Validar productos de catálogo (activos salvo allow_inactive)
      await this.validateProducts(catalogItems, data.allow_inactive === true);

      // 3. Crear venta (en SaleRepository.createSaleItem se descuenta stock en products)
      const sale = await this.saleRepository.createSale(data, userId);

      // 4. Registrar ingreso en módulo de caja (payments)
      await this.registerPayment(sale, userId);

      // 5. Sincronizar con WooCommerce: crea pedido y actualiza stock en WooCommerce
      const isUsdSale = this.saleCurrency(sale) === 'USD';
      const syncToWooCommerce =
        !isUsdSale && data.sync_to_woocommerce !== false; // USD: no sincronizar por defecto
      if (syncToWooCommerce && this.wooCommerceService.isConfigured()) {
        try {
          await this.syncSaleToWooCommerce(sale.id);
        } catch (syncError) {
          console.error('[SaleService] Error sincronizando venta a WooCommerce:', syncError);
          // No fallar la creación de la venta si falla la sincronización
          await this.saleRepository.updateSyncStatus(
            sale.id,
            'error',
            null,
            syncError instanceof Error ? syncError.message : 'Error desconocido'
          );
        }
      }

      return {
        success: true,
        message: 'Venta creada exitosamente',
        data: sale,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error creating sale:', error);
      return {
        success: false,
        message: 'Error al crear venta',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Obtiene una venta por ID
   */
  async getSaleById(id: number): Promise<ApiResponse> {
    try {
      const sale = await this.saleRepository.getSaleById(id);

      if (!sale) {
        return {
          success: false,
          message: 'Venta no encontrada',
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        message: 'Venta obtenida exitosamente',
        data: sale,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting sale:', error);
      return {
        success: false,
        message: 'Error al obtener venta',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Obtiene todas las ventas con filtros
   */
  async getAllSales(filters: SaleFilters = {}): Promise<ApiResponse> {
    try {
      const result = await this.saleRepository.getAllSales(filters);

      return {
        success: true,
        message: 'Ventas obtenidas exitosamente',
        data: result,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting sales:', error);
      return {
        success: false,
        message: 'Error al obtener ventas',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /** Archiva u oculta ventas en facturación (solo superadmin). */
  async setFacturacionArchivedForSales(
    saleIds: number[],
    archived: boolean,
    ctx?: { userId?: number | null; role?: string | null }
  ): Promise<ApiResponse<{ updated: number; saleIds: number[] }>> {
    if (ctx?.role !== 'superadmin') {
      return {
        success: false,
        message: 'Solo superadmin puede archivar comprobantes en facturación',
        data: { status: 403, code: 'FORBIDDEN' } as unknown as { updated: number; saleIds: number[] },
        timestamp: new Date().toISOString()
      };
    }

    const uniqueIds = [...new Set(saleIds.filter((id) => Number.isFinite(id) && id > 0))];
    if (!uniqueIds.length) {
      return {
        success: false,
        message: 'Indicá al menos una venta válida',
        timestamp: new Date().toISOString()
      };
    }

    const allowed: number[] = [];
    const rejected: Array<{ id: number; reason: string }> = [];

    for (const id of uniqueIds) {
      const sale = await this.saleRepository.getSaleById(id);
      if (!sale) {
        rejected.push({ id, reason: 'Venta no encontrada' });
        continue;
      }
      const st = sale.arca_status;
      if (archived && st !== 'error' && st !== 'success') {
        rejected.push({
          id,
          reason: 'Solo se pueden archivar comprobantes con error o emitidos (p. ej. prueba)'
        });
        continue;
      }
      allowed.push(id);
    }

    if (!allowed.length) {
      return {
        success: false,
        message:
          rejected[0]?.reason ??
          'Ninguna venta cumple las condiciones para archivar o restaurar',
        data: { rejected } as unknown as { updated: number; saleIds: number[] },
        timestamp: new Date().toISOString()
      };
    }

    const updated = await this.saleRepository.setFacturacionArchived(
      allowed,
      archived,
      ctx?.userId ?? null
    );

    return {
      success: true,
      message: archived
        ? `${updated} comprobante(s) archivado(s) en facturación`
        : `${updated} comprobante(s) restaurado(s) en facturación`,
      data: {
        updated,
        saleIds: allowed,
        ...(rejected.length ? { rejected } : {})
      } as { updated: number; saleIds: number[] },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Actualiza una venta: cliente, notas, ítems (reemplazo completo), IVA por línea y pago.
   * No permite cambios si ya tiene comprobante ARCA emitido con éxito.
   */
  async updateSale(
    id: number,
    data: UpdateSaleData,
    userId: number | null
  ): Promise<ApiResponse<SaleWithDetails>> {
    try {
      const existing = await this.saleRepository.getSaleById(id);
      if (!existing) {
        return {
          success: false,
          message: 'Venta no encontrada',
          timestamp: new Date().toISOString()
        };
      }

      if (saleHasFiscalLock(existing)) {
        return {
          success: false,
          message:
            'No se puede modificar una venta que ya tiene comprobante fiscal emitido. ' +
            'Emita una nota de crédito y, si corresponde, refacture la venta.',
          timestamp: new Date().toISOString()
        };
      }

      const hasHeaderChange =
        data.client_id !== undefined ||
        data.notes !== undefined ||
        data.payment_method !== undefined ||
        data.payment_details !== undefined ||
        data.currency !== undefined ||
        data.exchange_rate !== undefined;
      const hasItemsChange = data.items !== undefined;

      if (!hasHeaderChange && !hasItemsChange) {
        return {
          success: false,
          message:
            'Debe enviar al menos client_id, notes, items, payment_method, payment_details, currency o exchange_rate para actualizar',
          timestamp: new Date().toISOString()
        };
      }

      const effectiveCurrency =
        data.currency !== undefined
          ? data.currency === 'USD'
            ? 'USD'
            : 'ARS'
          : this.saleCurrency(existing as SaleWithDetails);
      if (effectiveCurrency === 'USD') {
        const rate =
          data.exchange_rate != null
            ? Number(data.exchange_rate)
            : Number(existing.exchange_rate);
        if (!Number.isFinite(rate) || rate <= 0) {
          return {
            success: false,
            message: 'Para ventas en USD debés indicar exchange_rate (cotización USD/ARS) mayor a 0',
            timestamp: new Date().toISOString()
          };
        }
      }

      if (data.client_id !== undefined) {
        const rows = (await executeQuery(
          `SELECT id, is_active FROM clients WHERE id = ?`,
          [data.client_id]
        )) as { id: number; is_active: number | boolean }[];
        if (!rows?.length) {
          return {
            success: false,
            message: `Cliente con ID ${data.client_id} no encontrado`,
            timestamp: new Date().toISOString()
          };
        }
        if (!rows[0].is_active) {
          return {
            success: false,
            message: 'El cliente seleccionado está inactivo',
            timestamp: new Date().toISOString()
          };
        }
      }

      if (data.items !== undefined) {
        if (!data.items.length) {
          return {
            success: false,
            message: 'La venta debe incluir al menos un ítem',
            timestamp: new Date().toISOString()
          };
        }
        const catalogItems = data.items.filter(isCatalogSaleLine);
        await this.validateProducts(catalogItems, data.allow_inactive === true);
      }

      const sale = await this.saleRepository.updateSale(id, data);

      const paymentsNeedUpdate =
        hasItemsChange ||
        data.payment_method !== undefined ||
        data.payment_details !== undefined ||
        data.currency !== undefined ||
        data.exchange_rate !== undefined;
      if (paymentsNeedUpdate) {
        await this.replaceSalePayments(sale, userId);
      }

      if (data.sync_to_woocommerce && this.wooCommerceService.isConfigured()) {
        try {
          await this.syncSaleToWooCommerce(sale.id);
        } catch (syncError) {
          console.error('[SaleService] Error re-sincronizando venta editada:', syncError);
        }
      }

      const withDetails = await this.saleRepository.getSaleById(sale.id);

      return {
        success: true,
        message: 'Venta actualizada',
        data: withDetails ?? sale,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error updating sale:', error);
      return {
        success: false,
        message: 'Error al actualizar venta',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Obtiene estadísticas de ventas
   */
  async getSaleStats(): Promise<ApiResponse> {
    try {
      const stats = await this.saleRepository.getSaleStats();

      return {
        success: true,
        message: 'Estadísticas obtenidas exitosamente',
        data: stats,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting sale stats:', error);
      return {
        success: false,
        message: 'Error al obtener estadísticas',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  // =====================================================
  // SINCRONIZACIÓN CON WOOCOMMERCE
  // =====================================================

  /**
   * Sincroniza una venta a WooCommerce
   * Crea un pedido en WooCommerce y descuenta el stock
   */
  async syncSaleToWooCommerce(saleId: number): Promise<ApiResponse> {
    try {
      if (!this.wooCommerceService.isConfigured()) {
        return {
          success: false,
          message: 'WooCommerce no está configurado',
          timestamp: new Date().toISOString()
        };
      }

      const sale = await this.saleRepository.getSaleById(saleId);
      if (!sale) {
        return {
          success: false,
          message: 'Venta no encontrada',
          timestamp: new Date().toISOString()
        };
      }

      // Si ya está sincronizada, no hacer nada
      if (sale.sync_status === 'synced' && sale.woocommerce_order_id) {
        return {
          success: true,
          message: 'Venta ya está sincronizada con WooCommerce',
          data: { woocommerce_order_id: sale.woocommerce_order_id },
          timestamp: new Date().toISOString()
        };
      }

      // Obtener información del cliente
      const [client] = await executeQuery('SELECT * FROM clients WHERE id = ?', [sale.client_id]);
      if (!client) {
        throw new Error('Cliente no encontrado');
      }

      // Obtener items de la venta
      const items = sale.items || [];
      if (items.length === 0) {
        throw new Error('La venta no tiene items');
      }

      // Preparar line_items para WooCommerce y actualizar stock
      const lineItems = [];
      const stockUpdates: Array<{ productId: number; stockQuantity: number; operation: 'subtract' }> = [];

      for (const item of items) {
        if (item.product_id == null) {
          continue;
        }

        const [productData] = await executeQuery(
          'SELECT woocommerce_id, code FROM products WHERE id = ?',
          [item.product_id]
        );

        if (!productData) {
          console.warn(`[SaleService] Producto ${item.product_id} no encontrado, omitiendo`);
          continue;
        }

        let wcProductId: number | null = null;

        // Si tiene woocommerce_id, usarlo directamente
        if (productData.woocommerce_id) {
          wcProductId = productData.woocommerce_id;
        } else if (productData.code) {
          // Si no tiene woocommerce_id, buscar por SKU
          const wcProduct = await this.wooCommerceService.findProductBySku(productData.code);
          if (wcProduct) {
            wcProductId = wcProduct.id;
            // Actualizar el producto en el ERP con el woocommerce_id encontrado
            await executeQuery(
              'UPDATE products SET woocommerce_id = ? WHERE id = ?',
              [wcProductId, item.product_id]
            );
          }
        }

        if (!wcProductId) {
          console.warn(`[SaleService] No se pudo encontrar el producto ${productData.code} en WooCommerce, omitiendo`);
          continue;
        }

        lineItems.push({
          product_id: wcProductId,
          quantity: item.quantity,
          price: item.unit_price
        });

        // Preparar actualización de stock
        stockUpdates.push({
          productId: wcProductId,
          stockQuantity: item.quantity,
          operation: 'subtract'
        });
      }

      if (lineItems.length === 0) {
        await this.saleRepository.updateSyncStatus(sale.id, 'synced', null, null);
        return {
          success: true,
          message: 'Venta registrada; no hay líneas de catálogo para sincronizar con WooCommerce',
          data: { woocommerce_order_id: null, skipped_manual_only: true },
          timestamp: new Date().toISOString()
        };
      }

      // Preparar datos de billing
      const billing = {
        first_name: client.name?.split(' ')[0] || client.name || 'Consumidor',
        last_name: client.name?.split(' ').slice(1).join(' ') || 'Final',
        email: client.email || 'consumidor@final.local',
        phone: client.phone || '',
        address_1: client.address || 'Local',
        address_2: '',
        city: client.city || '',
        state: '',
        postcode: '',
        country: client.country || 'AR',
        company: ''
      };

      // Buscar o crear cliente en WooCommerce
      let wcCustomerId: number | undefined;
      if (client.email) {
        const wcCustomer = await this.wooCommerceService.findCustomerByEmail(client.email);
        if (wcCustomer) {
          wcCustomerId = wcCustomer.id;
        } else {
          // Crear cliente en WooCommerce
          const newWcCustomer = await this.wooCommerceService.createCustomer({
            email: client.email,
            first_name: billing.first_name,
            last_name: billing.last_name,
            phone: billing.phone,
            billing: billing
          });
          wcCustomerId = newWcCustomer.id;
        }
      }

      // Crear pedido en WooCommerce (estado: completed, porque es una venta ya realizada)
      const wcOrder = await this.wooCommerceService.createOrder({
        customer_id: wcCustomerId,
        billing: billing,
        shipping: billing, // Mismo que billing para ventas locales
        line_items: lineItems,
        status: 'completed', // Venta ya realizada
        currency: 'ARS',
        payment_method: sale.payment_method === 'efectivo' ? 'cash' : 
                       sale.payment_method === 'tarjeta' ? 'card' : 'bacs',
        payment_method_title: sale.payment_method === 'efectivo' ? 'Efectivo' :
                             sale.payment_method === 'tarjeta' ? 'Tarjeta' :
                             sale.payment_method === 'transferencia' ? 'Transferencia' : 'Mixto',
        customer_note: `Venta local - ${sale.sale_number}${sale.notes ? ` - ${sale.notes}` : ''}`,
        meta_data: [
          { key: '_erp_sale_id', value: sale.id.toString() },
          { key: '_erp_sale_number', value: sale.sale_number },
          { key: '_local_sale', value: 'true' }
        ]
      });

      // Actualizar stock en WooCommerce (descontar productos vendidos)
      const stockResults = await this.wooCommerceService.updateMultipleProductsStock(stockUpdates);
      
      // Verificar si hubo errores en la actualización de stock
      const stockErrors = stockResults.filter(r => !r.success);
      if (stockErrors.length > 0) {
        console.warn('[SaleService] Algunos productos no pudieron actualizar stock en WooCommerce:', stockErrors);
        // No fallar la sincronización completa, pero registrar el error
      }

      // Actualizar estado de sincronización
      await this.saleRepository.updateSyncStatus(
        sale.id,
        'synced',
        wcOrder.id,
        stockErrors.length > 0 ? `Algunos productos no actualizaron stock: ${stockErrors.map(e => e.error).join(', ')}` : null
      );

      return {
        success: true,
        message: 'Venta sincronizada a WooCommerce exitosamente',
        data: {
          woocommerce_order_id: wcOrder.id,
          woocommerce_order_number: wcOrder.number,
          stock_updates: stockResults
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('[SaleService] Error sincronizando venta a WooCommerce:', error);
      
      // Actualizar estado de error
      try {
        await this.saleRepository.updateSyncStatus(
          saleId,
          'error',
          null,
          error instanceof Error ? error.message : 'Error desconocido'
        );
      } catch (updateError) {
        console.error('[SaleService] Error actualizando estado de sincronización:', updateError);
      }

      return {
        success: false,
        message: 'Error al sincronizar venta con WooCommerce',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Reintenta la sincronización de una venta
   */
  async retrySync(saleId: number): Promise<ApiResponse> {
    return await this.syncSaleToWooCommerce(saleId);
  }

  /**
   * Sugerencia de tipo de comprobante, condición IVA y defaults para el formulario de facturación.
   */
  async getFacturarSugerencia(
    saleId: number,
    overrides?: Pick<FacturarVentaOptions, 'condicionIvaReceptor' | 'tipo'>
  ): Promise<ApiResponse> {
    const sale = await this.saleRepository.getSaleById(saleId);
    if (!sale) {
      return { success: false, message: 'Venta no encontrada', timestamp: new Date().toISOString() };
    }

    const [client] = await executeQuery(
      'SELECT id, cuil_cuit, personeria, tax_condition, condicion_iva_receptor FROM clients WHERE id = ? LIMIT 1',
      [sale.client_id]
    ) as Array<{ id: number; cuil_cuit?: string | null; personeria?: string }>;

    const emisorRegimen = getEmisorRegimenFromEnv();
    const condicionIvaReceptor = Number(
      overrides?.condicionIvaReceptor ?? inferCondicionIvaReceptor(client)
    );
    const sugerencia = suggestTipoComprobante(condicionIvaReceptor, emisorRegimen);
    const tipoDefault = getDefaultTipoFromEnv();
    const tipoEnviado =
      overrides?.tipo !== undefined && overrides?.tipo !== null
        ? Number(overrides.tipo)
        : tipoDefault;
    const validacion = validateComprobanteFiscal({
      tipo: tipoEnviado,
      condicionIvaReceptor,
      emisorRegimen
    });

    const ivaDesglose = (sale.items || []).map((item) => {
      const cantidad = parseSaleItemQuantity(item.quantity);
      const precioUnitario = this.round2(Number(item.unit_price));
      const lineTotal = this.round2(
        Number(item.total_price ?? cantidad * precioUnitario)
      );
      const rate = normalizeIvaRate(item.iva_rate);
      const { base, cuota } = splitIvaFromInclusiveTotal(lineTotal, rate);
      return {
        itemId: item.id,
        productId: item.product_id,
        codigo: saleItemFiscalCodigo(item),
        descripcion: saleItemDisplayName(item),
        cantidad,
        precioUnitario,
        subtotalLinea: this.round2(cantidad * precioUnitario),
        ivaRate: rate,
        ivaRateLabel: ivaRateLabel(rate),
        lineTotal,
        neto: base,
        iva: cuota
      };
    });
    const saleTotal = this.round2(Number(sale.total_amount || 0));
    const ivaResumen = aggregateIvaForFacturador(
      (sale.items || []).map((item) => ({
        lineTotal: this.round2(Number(item.total_price ?? item.quantity * item.unit_price)),
        ivaRate: normalizeIvaRate(item.iva_rate)
      }))
    );
    const importeFiscal =
      tipoEnviado === 11
        ? saleTotal
        : validateFacturadorIvaTotals(saleTotal, ivaResumen).computedImporte;
    const detalleEmision = resolveFacturadorDetalleForEmision(
      sale.items || [],
      importeFiscal,
      (value) => this.round2(value)
    );

    const docTipoSugerencia = docTipoFromClientTaxId(client?.cuil_cuit);
    const docNroSugerencia = docNroFromClientTaxId(client?.cuil_cuit) ?? '';
    const cuitEmisorNorm = normalizeCuitDigits(process.env.FACTURADOR_CUIT_EMISOR);
    let padronCondicionIva: PadronCondicionValidationResult | null = null;
    if (cuitEmisorNorm.valid11 && shouldConsultarPadronCondicionIva(docTipoSugerencia, docNroSugerencia)) {
      padronCondicionIva = await this.validarCondicionIvaConPadron(
        Number(cuitEmisorNorm.digits),
        docTipoSugerencia,
        docNroSugerencia,
        condicionIvaReceptor
      );
    }

    return {
      success: true,
      message: 'Sugerencia de comprobante fiscal',
      data: {
        saleId,
        totalAmount: sale.total_amount,
        importeFiscal,
        emisorRegimen,
        cliente: client
          ? {
              id: client.id,
              personeria: client.personeria,
              cuil_cuit: client.cuil_cuit,
              docTipo: docTipoFromClientTaxId(client.cuil_cuit)
            }
          : null,
        condicionIvaReceptor,
        sugerencia: {
          tipo: sugerencia.tipo,
          label: sugerencia.label,
          motivo: sugerencia.motivo
        },
        defaults: {
          tipo: tipoDefault,
          tipoLabel: getTipoLabel(tipoDefault),
          condicionIvaReceptor,
          concepto: 1,
          docTipo: docTipoFromClientTaxId(client?.cuil_cuit),
          saleDate: sale.sale_date,
          /** Fecha que ARCA asignará al emitir (fecha de proceso = hoy Argentina). */
          fechaCbte: this.toArgentinaDateString(new Date()),
          fechaComprobanteEsperada: this.toArgentinaDateString(new Date())
        },
        tiposDisponibles: Object.entries(WSFE_TIPOS).map(([k, v]) => ({
          tipo: Number(k),
          label: v.label,
          requiereIva: v.requiereIva
        })),
        validacionTipoEnviado: validacion.issues.length > 0 ? validacion : null,
        ivaDesglose,
        ivaResumen,
        /** Mismo detalle que POST /api/facturas si la coherencia importe/detalle lo permite. */
        detalleEmitir: detalleEmision.incluidoEnEmision ? detalleEmision.detalle : null,
        detalleIncluidoEnEmision: detalleEmision.incluidoEnEmision,
        ...(detalleEmision.detalle.length > 0 && !detalleEmision.incluidoEnEmision
          ? {
              detalleOmitidoMotivo: 'desfase_importe_iva' as const,
              detalleDiff: detalleEmision.diff
            }
          : {}),
        alicuotasPermitidas: [
          { rate: 21, label: '21%', afipId: 5 },
          { rate: 10.5, label: '10,5%', afipId: 4 },
          { rate: 0, label: '0%', afipId: 3 }
        ],
        padronCondicionIva: padronCondicionIva
          ? {
              checked: padronCondicionIva.checked,
              coincide: padronCondicionIva.coincide,
              condicionEnviada: padronCondicionIva.condicionEnviada,
              condicionSugerida: padronCondicionIva.condicionSugerida ?? null,
              condicionSugeridaLabel: padronCondicionIva.condicionSugeridaLabel ?? null,
              unavailable: padronCondicionIva.unavailable ?? false,
              message: padronCondicionIva.issue?.message ?? null,
              advertencias: padronCondicionIva.advertencias ?? []
            }
          : null
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Comprobante fiscal de una venta (BD + opcional refresh desde MultiCUIT).
   */
  async getComprobanteVenta(
    saleId: number,
    options?: { refresh?: boolean; facturadorApiKey?: string | null }
  ): Promise<ApiResponse> {
    const sale = await this.saleRepository.getSaleById(saleId);
    if (!sale) {
      return { success: false, message: 'Venta no encontrada', timestamp: new Date().toISOString() };
    }
    if (sale.arca_status !== 'success' && !sale.arca_cae) {
      return {
        success: false,
        message: 'La venta no tiene comprobante ARCA emitido',
        timestamp: new Date().toISOString()
      };
    }

    let snap: ArcaComprobanteSnapshot | null = buildArcaComprobanteSnapshot(sale);
    let source: 'local' | 'facturador' | 'local+json' = 'local';
    const missingBefore = comprobanteSnapshotIncomplete(snap);
    const shouldRefresh =
      options?.refresh === true ||
      (missingBefore.length > 0 && Boolean(sale.arca_factura_id));

    if (shouldRefresh && sale.arca_factura_id) {
      const cuit =
        sale.arca_cuit_emisor ||
        (snap?.cuitEmisor ?? null) ||
        process.env.FACTURADOR_CUIT_EMISOR;
      const cuitNorm = normalizeCuitDigits(cuit != null ? String(cuit) : undefined);
      if (!cuitNorm.valid11) {
        return {
          success: false,
          message: 'No se puede consultar el facturador: CUIT emisor inválido o ausente',
          timestamp: new Date().toISOString()
        };
      }
      if (!this.facturadorArcaService.hasCredentials(options?.facturadorApiKey)) {
        return {
          success: false,
          message: 'Facturador no configurado para sincronizar comprobante',
          data: { comprobante: snap, missingFields: missingBefore, source: 'local' },
          timestamp: new Date().toISOString()
        };
      }

      try {
        const remote = await this.facturadorArcaService.obtenerFactura(
          sale.arca_factura_id,
          cuitNorm.digits,
          { apiKey: options?.facturadorApiKey }
        );
        const emision = parseEmisionFromFacturador(
          remote.data as Record<string, unknown> | undefined,
          sale.arca_request_json as Record<string, unknown> | null
        );
        if (emision) {
          const persist = toPersistArcaComprobanteFields({
            emision,
            facturaId: sale.arca_factura_id,
            idempotencyKey: sale.arca_idempotency_key
          });
          await this.saleRepository.updateFacturacionData(saleId, {
            arca_status: 'success',
            arca_response_json: {
              ...(sale.arca_response_json as object),
              detalleRemoto: remote
            } as Record<string, unknown>,
            ...persist
          });
          source = 'facturador';
        }
      } catch (error) {
        const apiError = error as FacturadorApiError;
        console.warn('[SaleService] getComprobanteVenta — refresh facturador falló', {
          saleId,
          code: apiError.code,
          message: apiError.message
        });
        if (options?.refresh === true) {
          return {
            success: false,
            message: apiError.message || 'Error al consultar comprobante en facturador',
            data: {
              status: apiError.status || 502,
              code: apiError.code,
              comprobante: snap,
              missingFields: missingBefore
            },
            timestamp: new Date().toISOString()
          };
        }
        source = snap ? 'local+json' : 'local';
      }
    }

    const updatedSale = await this.saleRepository.getSaleById(saleId);
    snap = updatedSale?.arca_comprobante ?? buildArcaComprobanteSnapshot(updatedSale!);
    const missingAfter = comprobanteSnapshotIncomplete(snap);

    return {
      success: true,
      message:
        missingAfter.length === 0
          ? 'Comprobante disponible'
          : 'Comprobante parcial: faltan datos para PDF completo',
      data: {
        sale: updatedSale,
        comprobante: snap,
        complete: missingAfter.length === 0,
        missingFields: missingAfter,
        source,
        pdfReady: missingAfter.length === 0
      },
      timestamp: new Date().toISOString()
    };
  }

  async facturarVenta(
    saleId: number,
    options: FacturarVentaOptions,
    ctx?: FacturarVentaContext
  ): Promise<ApiResponse> {
    try {
      const envApiKey = (process.env.FACTURADOR_API_KEY || '').trim();
      const headerApiKey = (ctx?.facturadorApiKey || '').trim();
      const effectiveApiKey = headerApiKey || envApiKey;
      const apiKeySource: 'header' | 'env' | 'none' = headerApiKey
        ? 'header'
        : envApiKey
          ? 'env'
          : 'none';

      const baseUrlConfigured = Boolean((process.env.FACTURADOR_BASE_URL || '').trim());
      const cuitEmisorSource: 'body' | 'env' =
        options.cuitEmisor !== undefined && options.cuitEmisor !== null ? 'body' : 'env';
      const puntoVentaSource: 'body' | 'env' =
        options.puntoVenta !== undefined && options.puntoVenta !== null ? 'body' : 'env';
      const envCuitRaw = process.env.FACTURADOR_CUIT_EMISOR;
      const envCuitDefined =
        envCuitRaw !== undefined && String(envCuitRaw).trim() !== '';
      const envCuitNorm = normalizeCuitDigits(envCuitRaw);
      const envPuntoVentaDefined =
        process.env.FACTURADOR_PUNTO_VENTA !== undefined &&
        String(process.env.FACTURADOR_PUNTO_VENTA).trim() !== '';

      logFacturadorFacturarContext({
        saleId,
        apiKeySource,
        baseUrlConfigured,
        cuitEmisorSource,
        puntoVentaSource,
        envCuitDefined,
        envCuitValid11: envCuitNorm.valid11,
        envPuntoVentaDefined
      });

      if (!this.facturadorArcaService.hasCredentials(headerApiKey || undefined)) {
        logFacturadorMissingCredentials({
          tieneBaseUrl: baseUrlConfigured,
          tieneApiKeyEnv: Boolean(envApiKey),
          tieneApiKeyHeader: Boolean(headerApiKey)
        });
        const notConfigured = resolveFacturadorError({ code: 'FACTURADOR_NOT_CONFIGURED' });
        return {
          success: false,
          message: notConfigured.message,
          error: notConfigured.action,
          data: {
            status: notConfigured.httpStatus,
            code: notConfigured.code,
            action: notConfigured.action,
            retryable: notConfigured.retryable
          },
          timestamp: new Date().toISOString()
        };
      }

      const sale = await this.saleRepository.getSaleById(saleId);
      if (!sale) {
        return {
          success: false,
          message: 'Venta no encontrada',
          timestamp: new Date().toISOString()
        };
      }

      if (sale.sale_source === 'imported' || sale.sale_source === 'pos_external') {
        return {
          success: false,
          message:
            sale.sale_source === 'pos_external'
              ? 'Esta venta POS ya tiene una factura externa vinculada; no se puede emitir ni reemitir por API'
              : 'Esta venta proviene de una factura importada por PDF; no se puede emitir ni reemitir por API',
          error: 'VENTA_IMPORTADA',
          data: { status: 400, code: 'VENTA_IMPORTADA' },
          timestamp: new Date().toISOString()
        };
      }

      if (!sale.items || sale.items.length === 0) {
        return {
          success: false,
          message: 'La venta no tiene items y no puede facturarse',
          timestamp: new Date().toISOString()
        };
      }

      for (const item of sale.items) {
        const desc = saleItemDisplayName(item).trim();
        if (!desc || desc === 'Ítem') {
          return {
            success: false,
            message: 'Cada línea de la venta debe tener una descripción para facturar',
            error: 'SALE_ITEM_DESCRIPTION_REQUIRED',
            timestamp: new Date().toISOString()
          };
        }
        if (Number(item.quantity) < 1 || Number(item.unit_price) < 0) {
          return {
            success: false,
            message: 'Cantidad o precio inválido en un ítem de la venta',
            timestamp: new Date().toISOString()
          };
        }
      }

      const isRefacturacion = saleCanRefacturar(sale);
      if (sale.arca_status === 'success' && sale.arca_factura_id && !options.force && !isRefacturacion) {
        return {
          success: false,
          message: 'La venta ya fue facturada en ARCA',
          error: 'Usá force=true solo si necesitás reintentar de forma explícita. Si hay nota de crédito, usá refacturación.',
          data: {
            arca_factura_id: sale.arca_factura_id,
            arca_cae: sale.arca_cae
          },
          timestamp: new Date().toISOString()
        };
      }

      if (isRefacturacion || (options.force === true && sale.arca_status === 'success')) {
        await this.persistSaleComprobanteSnapshots(sale);
      }

      const [client] = await executeQuery(
        'SELECT id, name, address, city, cuil_cuit, personeria, tax_condition, condicion_iva_receptor FROM clients WHERE id = ? LIMIT 1',
        [sale.client_id]
      ) as any[];

      const cuitRaw =
        options.cuitEmisor !== undefined && options.cuitEmisor !== null
          ? String(options.cuitEmisor)
          : process.env.FACTURADOR_CUIT_EMISOR;
      const cuitNorm = normalizeCuitDigits(cuitRaw);
      const cuitEmisor = cuitNorm.valid11 ? Number(cuitNorm.digits) : NaN;
      const puntoVenta = Number(options.puntoVenta ?? process.env.FACTURADOR_PUNTO_VENTA ?? 1);
      if (!cuitNorm.valid11 || !Number.isFinite(cuitEmisor)) {
        logFacturadorCuitInvalid({
          source: cuitEmisorSource,
          rawEnvPresent: envCuitDefined,
          parsedNumber: cuitEmisor,
          stringLength: cuitNorm.digits.length,
          digitsAfterNormalize: cuitNorm.digits
        });
        return {
          success: false,
          message: 'CUIT emisor inválido',
          error: 'Enviá cuitEmisor en el body o configurá FACTURADOR_CUIT_EMISOR',
          timestamp: new Date().toISOString()
        };
      }

      if ((options.concepto === 2 || options.concepto === 3) && (!options.fechaServicioDesde || !options.fechaServicioHasta)) {
        return {
          success: false,
          message: 'Fechas de servicio requeridas',
          error: 'Para concepto 2 o 3 enviá fechaServicioDesde y fechaServicioHasta (YYYY-MM-DD)',
          timestamp: new Date().toISOString()
        };
      }

      const condicionIvaReceptor = Number(
        options.condicionIvaReceptor ?? inferCondicionIvaReceptor(client)
      );
      const tipoComprobante = Number(options.tipo ?? getDefaultTipoFromEnv());
      const docTipo = Number(options.docTipo ?? this.parseDocTipoByClient(client));
      const docNro =
        options.docNro !== undefined && options.docNro !== null
          ? options.docNro
          : this.parseDocNroByClient(client);
      const fiscalManual = options.fiscalManualConfig === true;
      const cfIssue = fiscalManual
        ? null
        : validateNoConsumidorFinalSiOtraCondicion(
            condicionIvaReceptor,
            client,
            tipoComprobante
          );
      if (cfIssue) {
        const resolved = resolveFacturadorError({ code: cfIssue.code });
        return {
          success: false,
          message: cfIssue.message,
          error: resolved.action,
          data: {
            status: resolved.httpStatus,
            code: cfIssue.code,
            issues: [cfIssue],
            emisorRegimen: getEmisorRegimenFromEnv(),
            condicionIvaReceptor
          },
          timestamp: new Date().toISOString()
        };
      }
      const validacionComprobante = validateComprobanteFiscal({
        tipo: tipoComprobante,
        condicionIvaReceptor,
        docTipo,
        docNro,
        emisorRegimen: getEmisorRegimenFromEnv()
      });

      if (!validacionComprobante.valid) {
        const bloqueantes = fiscalManual
          ? validacionComprobante.issues.filter(
              (issue) =>
                ![
                  'RECEPTOR_CUIT_CONDICION_INVALIDA',
                  'TIPO_DISTINTO_AL_SUGERIDO'
                ].includes(issue.code)
            )
          : validacionComprobante.issues;
        const blocking = bloqueantes.filter((i) =>
          [
            'FACTURA_C_NO_APLICA_EMISOR_RI',
            'FACTURA_AB_NO_APLICA_EMISOR_MONOTRIBUTO',
            'RECEPTOR_RI_NO_FACTURA_C',
            'RECEPTOR_RI_USAR_FACTURA_A',
            'TIPO_COMPROBANTE_INVALIDO',
            'RECEPTOR_CUIT_CONDICION_INVALIDA',
            'RECEPTOR_CF_CON_CONDICION_ERP'
          ].includes(i.code)
        );
        if (blocking.length > 0) {
          const resolved = resolveFacturadorError({ code: 'COMPROBANTE_TIPO_INVALIDO' });
          const userMsg = formatComprobanteIssuesForUser(blocking);
          const primera = blocking[0];
          return {
            success: false,
            message: userMsg,
            error: resolved.action,
            data: {
              status: resolved.httpStatus,
              code: primera?.code ?? 'COMPROBANTE_TIPO_INVALIDO',
              suggestedTipo: primera?.suggestedTipo ?? validacionComprobante.suggestedTipo,
              suggestedLabel:
                primera?.suggestedLabel ?? validacionComprobante.suggestedLabel,
              issues: blocking,
              emisorRegimen: getEmisorRegimenFromEnv(),
              condicionIvaReceptor
            },
            timestamp: new Date().toISOString()
          };
        }
      }

      const padronCondicion = await this.validarCondicionIvaConPadron(
        cuitEmisor,
        docTipo,
        docNro,
        condicionIvaReceptor,
        {
          skipPadronCondicionCheck:
            options.skipPadronCondicionCheck || options.fiscalManualConfig === true,
          facturadorApiKey: effectiveApiKey || null,
          tipoComprobante
        }
      );
      if (padronCondicion?.issue) {
        const resolved = resolveFacturadorError({ code: padronCondicion.issue.code });
        return {
          success: false,
          message: padronCondicion.issue.message,
          error: resolved.action,
          data: {
            status: resolved.httpStatus,
            code: padronCondicion.issue.code,
            issues: [padronCondicion.issue],
            condicionIvaReceptor,
            condicionIvaSugeridaPadron: padronCondicion.condicionSugerida,
            condicionIvaSugeridaLabel: padronCondicion.condicionSugeridaLabel,
            advertencias: padronCondicion.advertencias
          },
          timestamp: new Date().toISOString()
        };
      }
      if (padronCondicion?.unavailable) {
        const resolved = resolveFacturadorError({ code: 'PADRON_CONDICION_UNAVAILABLE' });
        return {
          success: false,
          message: resolved.message,
          error: resolved.action,
          data: {
            status: resolved.httpStatus,
            code: 'PADRON_CONDICION_UNAVAILABLE',
            advertencias: padronCondicion.advertencias,
            condicionIvaReceptor
          },
          timestamp: new Date().toISOString()
        };
      }

      const condicionParaEmitir =
        padronCondicion?.condicionSugerida != null
          ? Number(padronCondicion.condicionSugerida)
          : condicionIvaReceptor;

      const payload = this.buildPayloadFromSale(sale, client, {
        ...options,
        tipo: tipoComprobante,
        condicionIvaReceptor: condicionParaEmitir,
        cuitEmisor,
        puntoVenta
      });

      if (facturadorTipoRequiereIva(payload.tipo)) {
        const ivaRows = payload.iva ?? [];
        if (!ivaRows.length) {
          const resolved = resolveFacturadorError({ code: 'IVA_PAYLOAD_INVALID' });
          return {
            success: false,
            message:
              'No se pudo armar el desglose IVA del comprobante. Revisá que la venta tenga ítems con alícuota válida (21%, 10,5% o exento).',
            error: resolved.action,
            data: {
              status: resolved.httpStatus,
              code: 'IVA_PAYLOAD_INVALID',
              saleId,
              tipoComprobante: payload.tipo
            },
            timestamp: new Date().toISOString()
          };
        }
        const importeCheck = validateFacturadorIvaTotals(payload.importe, ivaRows);
        if (!importeCheck.valid) {
          const resolved = resolveFacturadorError({ code: 'IVA_PAYLOAD_INVALID' });
          return {
            success: false,
            message: `El importe fiscal (${payload.importe}) no coincide con el desglose IVA (diferencia ${importeCheck.diff}). Editá la venta o revisá precios y alícuotas por ítem.`,
            error: resolved.action,
            data: {
              status: resolved.httpStatus,
              code: 'IVA_PAYLOAD_INVALID',
              saleId,
              importe: payload.importe,
              computedImporte: importeCheck.computedImporte,
              diff: importeCheck.diff,
              iva: ivaRows
            },
            timestamp: new Date().toISOString()
          };
        }
        const saleTotalCabecera = this.round2(Number(sale.total_amount || 0));
        if (Math.abs(saleTotalCabecera - payload.importe) > 0.01) {
          console.warn('[SaleService] facturarVenta — total cabecera difiere del importe fiscal IVA', {
            saleId,
            saleTotalCabecera,
            importeFiscal: payload.importe,
            diff: this.round2(Math.abs(saleTotalCabecera - payload.importe))
          });
        }
      }

      try {
        const preview = await this.facturadorArcaService.previewFactura(payload, {
          apiKey: effectiveApiKey || null
        });
        const sugPreview = preview.sugerenciaCondicionIva?.sugerencia;
        if (sugPreview != null && Number.isFinite(Number(sugPreview))) {
          const sugN = Number(sugPreview);
          const wsfeFromSug = resolveCondicionIvaReceptorForWsfe(payload.tipo, sugN);
          if (wsfeFromSug !== payload.condicionIvaReceptor) {
            console.log('[SaleService] facturarVenta — preview alineó condición IVA', {
              saleId,
              antes: payload.condicionIvaReceptor,
              sugerenciaPadron: sugN,
              despues: wsfeFromSug
            });
            payload.condicionIvaReceptor = wsfeFromSug;
            payload.tipo = suggestTipoComprobante(sugN, getEmisorRegimenFromEnv()).tipo;
          }
        }
      } catch (previewError) {
        const previewRaw = previewError as FacturadorApiError;
        const details = extractFacturadorErrorDetails(
          previewRaw.responseBody,
          previewRaw.details ?? null
        );
        const resolved = resolveFacturadorError({
          code: previewRaw.code || 'WSFE_PREFLIGHT_VALIDATION',
          remoteMessage: previewRaw.remoteMessage || previewRaw.message,
          httpStatus: previewRaw.status,
          details
        });
        const detailText = formatFacturadorPreflightDetails(details);
        return {
          success: false,
          message: previewRaw.message || resolved.message,
          error: resolved.action,
          data: {
            status: previewRaw.status || resolved.httpStatus,
            code: previewRaw.code || resolved.code,
            action: resolved.action,
            retryable: previewRaw.retryable ?? resolved.retryable,
            requestId: previewRaw.requestId ?? null,
            remoteMessage: previewRaw.remoteMessage || resolved.detail || null,
            remoteDetail: detailText ?? undefined,
            details,
            suggestions: previewRaw.suggestions ?? resolved.suggestions ?? null,
            condicionIvaReceptor: payload.condicionIvaReceptor,
            condicionIvaSugeridaPadron: padronCondicion?.condicionSugerida ?? null,
            tipoComprobante: payload.tipo
          },
          timestamp: new Date().toISOString()
        };
      }

      if (isRefacturacion) {
        await this.saleRepository.clearNotaCreditoData(saleId);
      }

      await this.saleRepository.updateFacturacionData(saleId, {
        arca_status: 'pending',
        arca_request_json: payload as unknown as Record<string, unknown>,
        arca_response_json: null,
        arca_error_code: null,
        arca_error_message: null,
        arca_numero: null,
        arca_qr_url: null,
        arca_cae_vto: null,
        arca_idempotency_key: null
      });

      const healthy = await this.facturadorArcaService.ping();
      if (!healthy) {
        logFacturadorPingFailed(this.facturadorArcaService.getBaseUrl());
        const unavailable = resolveFacturadorError({
          code: 'FACTURADOR_UNAVAILABLE',
          remoteMessage: 'El facturador no respondió correctamente en /ping',
          httpStatus: 503
        });
        const pingError = new Error(unavailable.message) as FacturadorApiError;
        pingError.status = unavailable.httpStatus;
        pingError.code = unavailable.code;
        pingError.action = unavailable.action;
        pingError.retryable = unavailable.retryable;
        pingError.remoteMessage = 'GET /ping falló';
        throw pingError;
      }

      console.log('[MultiFacturador] SaleService.facturarVenta — iniciando emisión', {
        saleId,
        sale_number: sale.sale_number,
        sale_date: sale.sale_date,
        total_amount: sale.total_amount,
        item_count: sale.items?.length ?? 0,
        usuario: ctx?.audit
          ? { id: ctx.audit.userId, username: ctx.audit.username, role: ctx.audit.role }
          : undefined,
        cuitEmisor,
        puntoVenta,
        cuitEmisorSource,
        puntoVentaSource,
        apiKeySource
      });

      const refacturacionIdempotencyKey = isRefacturacion
        ? buildRefacturacionIdempotencyKey(
            saleId,
            await this.saleComprobanteRepository.nextSequence(saleId),
            payload
          )
        : undefined;

      const { response, idempotencyKey } = await this.facturadorArcaService.emitirFactura(saleId, payload, {
        apiKey: effectiveApiKey,
        idempotencyKey: refacturacionIdempotencyKey
      });

      console.log('[MultiFacturador] SaleService.facturarVenta — emisión OK', {
        saleId,
        sale_number: sale.sale_number,
        idempotencyKey,
        facturaId: response.persistencia?.facturaId ?? null,
        cae: response.data?.cae ?? null,
        numero: response.data?.numero ?? null,
        requestId: response.requestId ?? null
      });
      const emision = parseEmisionFromFacturador(
        response.data as Record<string, unknown> | undefined,
        payload as unknown as Record<string, unknown>
      );
      if (!emision) {
        const sinCae = resolveFacturadorError({ code: 'CAE_MISSING', httpStatus: 502 });
        const caeError = new Error(sinCae.message) as FacturadorApiError;
        caeError.status = sinCae.httpStatus;
        caeError.code = sinCae.code;
        caeError.action = sinCae.action;
        caeError.retryable = sinCae.retryable;
        caeError.suggestions = sinCae.suggestions;
        caeError.responseBody = response;
        throw caeError;
      }

      const facturaId = response.persistencia?.facturaId || null;

      if (emision.numero == null || emision.puntoVenta == null) {
        console.warn('[SaleService] facturarVenta — emisión sin número o PV en POST; se puede completar con GET comprobante', {
          saleId,
          facturaId,
          numero: emision.numero,
          puntoVenta: emision.puntoVenta
        });
      }

      const persistComprobante = toPersistArcaComprobanteFields({
        emision,
        facturaId,
        idempotencyKey
      });

      await this.saleRepository.updateFacturacionData(saleId, {
        arca_status: 'success',
        arca_error_code: null,
        arca_error_message: null,
        arca_request_json: payload as unknown as Record<string, unknown>,
        arca_response_json: response as Record<string, unknown>,
        condicion_venta_codigo: options.condicionVentaCodigo?.trim().slice(0, 32) ?? null,
        condicion_venta_texto: payload.condicionVenta ?? null,
        fecha_vencimiento_pago: payload.fechaVencimientoPago ?? null,
        ...persistComprobante
      });

      await this.persistHistorialFacturaEmitida(sale, {
        facturaId,
        persist: persistComprobante,
        payload: payload as unknown as Record<string, unknown>,
        response: response as Record<string, unknown>,
        idempotencyKey
      });

      const updatedSale = await this.saleRepository.getSaleById(saleId);
      return {
        success: true,
        message: 'Factura emitida correctamente en ARCA',
        data: {
          sale: updatedSale,
          arca: {
            facturaId,
            cae: emision.cae,
            vencimientoCae: emision.vencimientoCae,
            vencimientoCaeIso: emision.vencimientoCaeIso,
            numero: emision.numero,
            tipo: emision.tipo,
            puntoVenta: emision.puntoVenta,
            cuitEmisor: emision.cuitEmisor,
            fechaEmision: emision.fechaEmision,
            qrUrl: emision.qrUrl,
            idempotencyKey,
            response
          }
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const raw = error as FacturadorApiError;
      console.error('[MultiFacturador] SaleService.facturarVenta — emisión fallida', {
        saleId,
        status: raw.status,
        code: raw.code,
        message: raw.message,
        requestId: raw.requestId,
        remoteMessage: raw.remoteMessage,
        responseBody: raw.responseBody ?? null
      });
      console.error('[SaleService] facturarVenta — error', {
        saleId,
        status: raw.status,
        code: raw.code,
        message: raw.message,
        requestId: raw.requestId,
        remoteMessage: raw.remoteMessage
      });
      const resolved = resolveFacturadorError({
        code: raw.code || 'FACTURACION_ERROR',
        remoteMessage: raw.remoteMessage || raw.message,
        httpStatus: raw.status,
        details: raw.details ?? null
      });
      const userMessage = raw.message || resolved.message;
      const errorCode = raw.code || resolved.code;
      const errorDetails = extractFacturadorErrorDetails(raw.responseBody, raw.details ?? null);
      const preflightDetail = formatFacturadorPreflightDetails(errorDetails);

      const saleAudit = await this.saleRepository.getSaleById(saleId);

      await this.saleRepository.updateFacturacionData(saleId, {
        arca_status: 'error',
        arca_error_code: errorCode,
        arca_error_message: userMessage,
        arca_request_json: (saleAudit?.arca_request_json as Record<string, unknown> | null) ?? null,
        arca_response_json: (raw.responseBody as Record<string, unknown>) || null
      });

      return {
        success: false,
        message: userMessage,
        error: raw.action || resolved.action,
        data: {
          status: raw.status || resolved.httpStatus,
          code: errorCode,
          action: raw.action || resolved.action,
          retryable: raw.retryable ?? resolved.retryable,
          retryAfter: raw.retryAfter ?? null,
          requestId: raw.requestId ?? null,
          remoteMessage: raw.remoteMessage || resolved.detail || null,
          remoteDetail: preflightDetail ?? undefined,
          details: errorDetails ?? undefined,
          suggestions: raw.suggestions ?? resolved.suggestions ?? null
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Completa tipo/PV/número de la factura original consultando MultiCUIT si faltan en BD.
   */
  private async completarFacturaOriginalDesdeFacturador(
    sale: SaleWithDetails,
    apiKey?: string | null
  ): Promise<SaleWithDetails> {
    if (resolveFacturaOriginalRef(sale)) {
      return sale;
    }
    if (!sale.arca_factura_id) {
      return sale;
    }

    const cuit =
      sale.arca_cuit_emisor ||
      (sale.arca_comprobante?.cuitEmisor ?? null) ||
      process.env.FACTURADOR_CUIT_EMISOR;
    const cuitNorm = normalizeCuitDigits(cuit != null ? String(cuit) : undefined);
    if (!cuitNorm.valid11 || !this.facturadorArcaService.hasCredentials(apiKey)) {
      return sale;
    }

    try {
      const remote = await this.facturadorArcaService.obtenerFactura(
        sale.arca_factura_id,
        cuitNorm.digits,
        { apiKey }
      );
      const emision = parseEmisionFromFacturador(
        remote.data as Record<string, unknown> | undefined,
        sale.arca_request_json as Record<string, unknown> | null
      );
      if (!emision?.numero || emision.puntoVenta == null) {
        return sale;
      }

      const persist = toPersistArcaComprobanteFields({
        emision,
        facturaId: sale.arca_factura_id,
        idempotencyKey: sale.arca_idempotency_key
      });
      await this.saleRepository.updateFacturacionData(sale.id, {
        arca_status: 'success',
        arca_response_json: {
          ...(sale.arca_response_json as object),
          detalleRemoto: remote
        } as Record<string, unknown>,
        ...persist
      });
      const refreshed = await this.saleRepository.getSaleById(sale.id);
      return refreshed ?? sale;
    } catch (error) {
      console.warn('[SaleService] completarFacturaOriginalDesdeFacturador — falló', {
        saleId: sale.id,
        message: error instanceof Error ? error.message : String(error)
      });
      return sale;
    }
  }

  /**
   * Emite nota de crédito ARCA por una venta ya facturada (anulación / error de emisión).
   */
  async emitirNotaCredito(
    saleId: number,
    options: EmitirNotaCreditoOptions,
    ctx?: FacturarVentaContext
  ): Promise<ApiResponse> {
    try {
      const motivoRaw = String(options.motivo ?? 'error_emision').trim() as NotaCreditoMotivo;
      const motivo = NOTA_CREDITO_MOTIVOS.includes(motivoRaw) ? motivoRaw : 'error_emision';

      if (options.confirmar !== true) {
        return {
          success: false,
          message: 'Debés confirmar la emisión de la nota de crédito',
          error: 'Enviá confirmar: true en el body',
          data: { status: 400, code: 'CONFIRMACION_REQUERIDA' },
          timestamp: new Date().toISOString()
        };
      }

      const envApiKey = (process.env.FACTURADOR_API_KEY || '').trim();
      const headerApiKey = (ctx?.facturadorApiKey || '').trim();
      const effectiveApiKey = headerApiKey || envApiKey;

      if (!this.facturadorArcaService.hasCredentials(headerApiKey || undefined)) {
        const notConfigured = resolveFacturadorError({ code: 'FACTURADOR_NOT_CONFIGURED' });
        return {
          success: false,
          message: notConfigured.message,
          error: notConfigured.action,
          data: {
            status: notConfigured.httpStatus,
            code: notConfigured.code
          },
          timestamp: new Date().toISOString()
        };
      }

      let sale = await this.saleRepository.getSaleById(saleId);
      if (!sale) {
        return {
          success: false,
          message: 'Venta no encontrada',
          timestamp: new Date().toISOString()
        };
      }

      if (sale.arca_status !== 'success' || !sale.arca_cae) {
        return {
          success: false,
          message: 'La venta no tiene factura ARCA emitida; no se puede generar nota de crédito',
          data: { status: 400, code: 'VENTA_SIN_FACTURA' },
          timestamp: new Date().toISOString()
        };
      }

      if (sale.sale_source === 'imported' || sale.sale_source === 'pos_external') {
        return {
          success: false,
          message:
            sale.sale_source === 'pos_external'
              ? 'No se puede emitir nota de crédito por API en ventas con factura externa vinculada; gestioná la NC en ARCA'
              : 'No se puede emitir nota de crédito por API en facturas importadas desde PDF; gestioná la NC en ARCA',
          error: 'VENTA_IMPORTADA',
          data: { status: 400, code: 'VENTA_IMPORTADA' },
          timestamp: new Date().toISOString()
        };
      }

      if (sale.arca_nc_status === 'success' && sale.arca_nc_cae) {
        return {
          success: false,
          message: 'La venta ya tiene una nota de crédito emitida en ARCA',
          data: {
            status: 409,
            code: 'NOTA_CREDITO_YA_EMITIDA',
            arca_nc_cae: sale.arca_nc_cae,
            arca_nc_factura_id: sale.arca_nc_factura_id
          },
          timestamp: new Date().toISOString()
        };
      }

      sale = await this.completarFacturaOriginalDesdeFacturador(sale, effectiveApiKey);
      const facturaRef = resolveFacturaOriginalRef(sale);
      if (!facturaRef) {
        return {
          success: false,
          message:
            'Faltan datos del comprobante original (tipo, punto de venta o número AFIP). Revisá la factura en ARCA o contactá soporte.',
          data: {
            status: 400,
            code: 'FACTURA_ORIGINAL_INCOMPLETA',
            arca_factura_id: sale.arca_factura_id,
            arca_cae: sale.arca_cae
          },
          timestamp: new Date().toISOString()
        };
      }

      const ncTipo = getNotaCreditoTipoForFactura(facturaRef.tipo);
      if (ncTipo == null) {
        return {
          success: false,
          message: `No se puede inferir el tipo de nota de crédito para la factura tipo ${facturaRef.tipo}`,
          data: { status: 400, code: 'TIPO_NC_NO_SOPORTADO', tipoFactura: facturaRef.tipo },
          timestamp: new Date().toISOString()
        };
      }

      const cuitRaw =
        options.cuitEmisor !== undefined && options.cuitEmisor !== null
          ? String(options.cuitEmisor)
          : sale.arca_cuit_emisor || process.env.FACTURADOR_CUIT_EMISOR;
      const cuitNorm = normalizeCuitDigits(cuitRaw);
      const cuitEmisor = cuitNorm.valid11 ? Number(cuitNorm.digits) : NaN;
      const puntoVenta = Number(
        options.puntoVenta ?? process.env.FACTURADOR_PUNTO_VENTA ?? facturaRef.puntoVenta ?? 1
      );

      if (!cuitNorm.valid11 || !Number.isFinite(cuitEmisor)) {
        return {
          success: false,
          message: 'CUIT emisor inválido',
          data: { status: 400, code: 'CUIT_EMISOR_INVALIDO' },
          timestamp: new Date().toISOString()
        };
      }

      const originalRequest = sale.arca_request_json as FacturadorEmitirPayload | null;
      let payload = buildNotaCreditoPayload(
        originalRequest,
        facturaRef,
        ncTipo,
        puntoVenta,
        options.importe
      );

      if (!payload.cuitEmisor || !Number.isFinite(Number(payload.cuitEmisor))) {
        payload.cuitEmisor = cuitEmisor;
      }

      if (!payload.importe || !Number.isFinite(Number(payload.importe))) {
        const [client] = await executeQuery(
          'SELECT id, cuil_cuit, personeria, tax_condition, condicion_iva_receptor FROM clients WHERE id = ? LIMIT 1',
          [sale.client_id]
        ) as any[];
        payload = this.buildPayloadFromSale(sale, client, {
          cuitEmisor,
          tipo: ncTipo,
          puntoVenta,
          condicionIvaReceptor: payload.condicionIvaReceptor,
          concepto: payload.concepto,
          docTipo: payload.docTipo,
          docNro: payload.docNro
        });
        payload.cbtesAsoc = [{ tipo: facturaRef.tipo, ptoVta: facturaRef.puntoVenta, nro: facturaRef.numero }];
      }

      if (
        options.importe != null &&
        Number.isFinite(Number(options.importe)) &&
        originalRequest?.importe != null &&
        Number(options.importe) > Number(originalRequest.importe) + 0.01
      ) {
        return {
          success: false,
          message: 'El importe de la nota de crédito no puede superar el de la factura original',
          data: { status: 400, code: 'IMPORTE_NC_EXCEDE_FACTURA' },
          timestamp: new Date().toISOString()
        };
      }

      await this.persistSaleComprobanteSnapshots(sale);

      const idempotencyKey = buildNotaCreditoIdempotencyKey(saleId, motivo, facturaRef);

      await this.saleRepository.updateNotaCreditoData(saleId, {
        arca_nc_status: 'pending',
        arca_nc_motivo: motivo,
        arca_nc_observaciones: options.observaciones?.trim() || null,
        arca_nc_request_json: payload as unknown as Record<string, unknown>,
        arca_nc_response_json: null,
        arca_nc_error_code: null,
        arca_nc_error_message: null,
        arca_nc_idempotency_key: idempotencyKey
      });

      const healthy = await this.facturadorArcaService.ping();
      if (!healthy) {
        logFacturadorPingFailed(this.facturadorArcaService.getBaseUrl());
        const unavailable = resolveFacturadorError({
          code: 'FACTURADOR_UNAVAILABLE',
          remoteMessage: 'El facturador no respondió correctamente en /ping',
          httpStatus: 503
        });
        const pingError = new Error(unavailable.message) as FacturadorApiError;
        pingError.status = unavailable.httpStatus;
        pingError.code = unavailable.code;
        throw pingError;
      }

      console.log('[MultiFacturador] SaleService.emitirNotaCredito — iniciando emisión', {
        saleId,
        sale_number: sale.sale_number,
        motivo,
        tipoFactura: facturaRef.tipo,
        ncTipo,
        puntoVenta,
        cbtesAsoc: payload.cbtesAsoc,
        usuario: ctx?.audit
          ? { id: ctx.audit.userId, username: ctx.audit.username, role: ctx.audit.role }
          : undefined
      });

      const { response } = await this.facturadorArcaService.emitirFactura(saleId, payload, {
        apiKey: effectiveApiKey,
        idempotencyKey
      });

      const emision = parseEmisionFromFacturador(
        response.data as Record<string, unknown> | undefined,
        payload as unknown as Record<string, unknown>
      );
      if (!emision) {
        const sinCae = resolveFacturadorError({ code: 'CAE_MISSING', httpStatus: 502 });
        const caeError = new Error(sinCae.message) as FacturadorApiError;
        caeError.status = sinCae.httpStatus;
        caeError.code = sinCae.code;
        caeError.responseBody = response;
        throw caeError;
      }

      const facturaId = response.persistencia?.facturaId || null;

      await this.saleRepository.updateNotaCreditoData(saleId, {
        arca_nc_status: 'success',
        arca_nc_cae: emision.cae,
        arca_nc_cae_vto: emision.vencimientoCaeIso ?? null,
        arca_nc_factura_id: facturaId,
        arca_nc_tipo: emision.tipo ?? ncTipo,
        arca_nc_punto_venta: emision.puntoVenta ?? puntoVenta,
        arca_nc_numero: emision.numero,
        arca_nc_motivo: motivo,
        arca_nc_observaciones: options.observaciones?.trim() || null,
        arca_nc_idempotency_key: idempotencyKey,
        arca_nc_error_code: null,
        arca_nc_error_message: null,
        arca_nc_request_json: payload as unknown as Record<string, unknown>,
        arca_nc_response_json: response as Record<string, unknown>
      });

      await this.persistHistorialNotaCreditoEmitida(sale, {
        cae: emision.cae,
        caeVto: emision.vencimientoCaeIso ?? null,
        facturaId,
        tipo: emision.tipo ?? ncTipo,
        puntoVenta: emision.puntoVenta ?? puntoVenta,
        numero: emision.numero,
        motivo,
        observaciones: options.observaciones?.trim() || null,
        idempotencyKey,
        payload: payload as unknown as Record<string, unknown>,
        response: response as Record<string, unknown>
      });

      const updatedSale = await this.saleRepository.getSaleById(saleId);
      return {
        success: true,
        message: 'Nota de crédito emitida correctamente en ARCA',
        data: {
          sale: updatedSale,
          notaCredito: {
            cae: emision.cae,
            vencimientoCae: emision.vencimientoCae,
            vencimientoCaeIso: emision.vencimientoCaeIso,
            tipo: emision.tipo ?? ncTipo,
            puntoVenta: emision.puntoVenta ?? puntoVenta,
            numero: emision.numero,
            facturaId,
            cbtesAsoc: payload.cbtesAsoc,
            idempotencyKey,
            response
          }
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const raw = error as FacturadorApiError;
      console.error('[MultiFacturador] SaleService.emitirNotaCredito — emisión fallida', {
        saleId,
        status: raw.status,
        code: raw.code,
        message: raw.message,
        requestId: raw.requestId
      });

      const resolved = resolveFacturadorError({
        code: raw.code || 'NOTA_CREDITO_ERROR',
        remoteMessage: raw.remoteMessage || raw.message,
        httpStatus: raw.status,
        details: raw.details ?? null
      });
      const userMessage = raw.message || resolved.message;
      const errorCode = raw.code || resolved.code;

      await this.saleRepository.updateNotaCreditoData(saleId, {
        arca_nc_status: 'error',
        arca_nc_error_code: errorCode,
        arca_nc_error_message: userMessage,
        arca_nc_response_json: (raw.responseBody as Record<string, unknown>) || null
      });

      return {
        success: false,
        message: userMessage,
        error: raw.action || resolved.action,
        data: {
          status: raw.status || resolved.httpStatus,
          code: errorCode,
          retryable: raw.retryable ?? resolved.retryable,
          retryAfter: raw.retryAfter ?? null,
          requestId: raw.requestId ?? null
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  // =====================================================
  // INTEGRACIÓN CON MÓDULO DE CAJA
  // =====================================================

  /**
   * Reemplaza los registros de caja asociados a una venta (tras cambio de total o método de pago).
   */
  private async replaceSalePayments(sale: Sale, userId: number | null): Promise<void> {
    try {
      await executeQuery(
        `DELETE FROM payments WHERE related_type = 'sale' AND related_id = ?`,
        [sale.id]
      );
      await this.registerPayment(sale, userId);
    } catch (error) {
      console.error('[SaleService] Error actualizando pagos de venta:', error);
      throw error;
    }
  }

  /**
   * Registra el ingreso de una venta en el módulo de caja (payments)
   */
  private async registerPayment(sale: Sale, userId: number | null): Promise<void> {
    try {
      const paymentCurrency = this.saleCurrency(sale as SaleWithDetails);
      // Si el método de pago es mixto, crear múltiples registros
      if (sale.payment_method === 'mixto' && sale.payment_details) {
        const details = sale.payment_details;
        
        if (details.efectivo && details.efectivo > 0) {
          await executeQuery(
            `INSERT INTO payments (
              type, method, amount, currency, payment_date, status,
              related_type, related_id, notes, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              'income',
              'efectivo',
              details.efectivo,
              paymentCurrency,
              sale.sale_date,
              'posted',
              'sale',
              sale.id,
              `Venta ${sale.sale_number} - Efectivo`,
              userId
            ]
          );
        }

        if (details.tarjeta && details.tarjeta > 0) {
          await executeQuery(
            `INSERT INTO payments (
              type, method, amount, currency, payment_date, status,
              related_type, related_id, notes, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              'income',
              'tarjeta',
              details.tarjeta,
              paymentCurrency,
              sale.sale_date,
              'posted',
              'sale',
              sale.id,
              `Venta ${sale.sale_number} - Tarjeta`,
              userId
            ]
          );
        }

        if (details.transferencia && details.transferencia > 0) {
          await executeQuery(
            `INSERT INTO payments (
              type, method, amount, currency, payment_date, status,
              related_type, related_id, notes, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              'income',
              'transferencia',
              details.transferencia,
              paymentCurrency,
              sale.sale_date,
              'posted',
              'sale',
              sale.id,
              `Venta ${sale.sale_number} - Transferencia`,
              userId
            ]
          );
        }
      } else {
        // Método de pago único
        await executeQuery(
          `INSERT INTO payments (
            type, method, amount, currency, payment_date, status,
            related_type, related_id, notes, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'income',
            sale.payment_method,
            sale.total_amount,
            paymentCurrency,
            sale.sale_date,
            'posted',
            'sale',
            sale.id,
            `Venta ${sale.sale_number}`,
            userId
          ]
        );
      }
    } catch (error) {
      console.error('[SaleService] Error registrando pago en módulo de caja:', error);
      // No fallar la creación de la venta si falla el registro del pago
    }
  }

  // =====================================================
  // VALIDACIONES
  // =====================================================

  /**
   * Valida que haya stock disponible para los productos
   */
  private async validateStockAvailability(
    items: CreateSaleCatalogItem[]
  ): Promise<void> {
    for (const item of items) {
      const product = await this.productService.getProductById(item.product_id);
      if (!product) {
        throw new Error(`Producto con ID ${item.product_id} no encontrado`);
      }

      if (product.stock < item.quantity) {
        throw new Error(
          `Stock insuficiente para el producto ${product.name} (${product.code}). ` +
          `Stock disponible: ${product.stock}, cantidad solicitada: ${item.quantity}`
        );
      }
    }
  }

  private async persistSaleComprobanteSnapshots(sale: SaleWithDetails): Promise<void> {
    try {
      const factura = snapshotFacturaFromSale(sale);
      let facturaRow = factura ? await this.saleComprobanteRepository.insertIfNew(factura) : null;
      const nc = snapshotNotaCreditoFromSale(sale);
      if (nc) {
        if (!facturaRow && sale.arca_cae) {
          facturaRow = await this.saleComprobanteRepository.findBySaleAndCae(sale.id, sale.arca_cae);
        }
        await this.saleComprobanteRepository.insertIfNew({
          ...nc,
          related_comprobante_id: facturaRow?.id ?? nc.related_comprobante_id ?? null
        });
      }
    } catch (error) {
      console.error('[SaleService] No se pudo persistir historial de comprobantes', {
        saleId: sale.id,
        error
      });
    }
  }

  private async persistHistorialFacturaEmitida(
    sale: SaleWithDetails,
    args: {
      facturaId: string | null;
      persist: ReturnType<typeof toPersistArcaComprobanteFields>;
      payload: Record<string, unknown>;
      response: Record<string, unknown>;
      idempotencyKey: string;
    }
  ): Promise<void> {
    try {
      await this.saleComprobanteRepository.insertIfNew({
        sale_id: sale.id,
        kind: 'factura',
        status: 'success',
        factura_id: args.persist.arca_factura_id ?? args.facturaId,
        cae: args.persist.arca_cae ?? null,
        cae_vto: args.persist.arca_cae_vto ?? null,
        tipo: args.persist.arca_tipo ?? null,
        punto_venta: args.persist.arca_punto_venta ?? null,
        numero: args.persist.arca_numero ?? null,
        cuit_emisor: args.persist.arca_cuit_emisor ?? null,
        fecha_emision: args.persist.arca_fecha_emision ?? null,
        qr_url: args.persist.arca_qr_url ?? null,
        idempotency_key: args.persist.arca_idempotency_key ?? args.idempotencyKey,
        request_json: args.payload,
        response_json: args.response,
        items_json: itemsSnapshotFromSale(sale),
        emitted_at: args.persist.arca_fecha_emision ?? new Date().toISOString()
      });
    } catch (error) {
      console.error('[SaleService] No se pudo guardar factura en historial', {
        saleId: sale.id,
        cae: args.persist.arca_cae,
        error
      });
    }
  }

  private async persistHistorialNotaCreditoEmitida(
    sale: SaleWithDetails,
    args: {
      cae: string;
      caeVto: string | null;
      facturaId: string | null;
      tipo: number | null;
      puntoVenta: number | null;
      numero: number | null;
      motivo: string;
      observaciones: string | null;
      idempotencyKey: string;
      payload: Record<string, unknown>;
      response: Record<string, unknown>;
    }
  ): Promise<void> {
    try {
      let relatedId: number | null = null;
      if (sale.arca_cae) {
        const facturaRow = await this.saleComprobanteRepository.findBySaleAndCae(sale.id, sale.arca_cae);
        relatedId = facturaRow?.id ?? null;
      }
      await this.saleComprobanteRepository.insertIfNew({
        sale_id: sale.id,
        kind: 'nota_credito',
        status: 'success',
        factura_id: args.facturaId,
        cae: args.cae,
        cae_vto: args.caeVto,
        tipo: args.tipo,
        punto_venta: args.puntoVenta,
        numero: args.numero,
        cuit_emisor: sale.arca_cuit_emisor ?? null,
        qr_url: null,
        idempotency_key: args.idempotencyKey,
        motivo: args.motivo,
        observaciones: args.observaciones,
        related_comprobante_id: relatedId,
        request_json: args.payload,
        response_json: args.response,
        items_json: itemsSnapshotFromSale(sale),
        emitted_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('[SaleService] No se pudo guardar nota de crédito en historial', {
        saleId: sale.id,
        cae: args.cae,
        error
      });
    }
  }

  /**
   * Valida que los productos existan y, salvo allowInactive, que estén activos.
   * @param allowInactive Si true, permite incluir productos inactivos (ej. último stock en POS).
   */
  private async validateProducts(
    items: CreateSaleCatalogItem[],
    allowInactive: boolean = false
  ): Promise<void> {
    for (const item of items) {
      const product = await this.productService.getProductById(item.product_id);
      if (!product) {
        throw new Error(`Producto con ID ${item.product_id} no encontrado`);
      }

      if (!allowInactive && !product.is_active) {
        throw new Error(
          `El producto ${product.name} (${product.code}) está inactivo. ` +
          `Actívalo en el listado de productos o envía allow_inactive: true en el body para permitir la venta.`
        );
      }
    }
  }
}

export interface FacturarVentaOptions {
  cuitEmisor?: number;
  tipo?: number;
  puntoVenta?: number;
  docTipo?: number;
  docNro?: string;
  condicionIvaReceptor?: number;
  concepto?: number;
  fechaServicioDesde?: string;
  fechaServicioHasta?: string;
  condicionVenta?: string;
  condicionVentaCodigo?: string;
  receptorRazonSocial?: string;
  receptorDomicilio?: string;
  fechaVencimientoPago?: string;
  force?: boolean;
  /** Omite la validación contra padrón ARCA (solo casos excepcionales). */
  skipPadronCondicionCheck?: boolean;
  /** Tipo/condición elegidos manualmente en el frontend; no normalizar ni bloquear por ERP. */
  fiscalManualConfig?: boolean;
}

/** Contexto por request: cabecera opcional de API key del facturador + auditoría JWT. */
export interface FacturarVentaContext {
  /** API key del facturador ya validada en controller (cabecera + rol). */
  facturadorApiKey?: string | null;
  audit?: {
    userId?: number;
    username?: string;
    role?: string;
  };
}

export interface EmitirNotaCreditoOptions {
  motivo?: NotaCreditoMotivo;
  observaciones?: string;
  /** null/omitido = NC por el total de la factura original */
  importe?: number | null;
  confirmar?: boolean;
  cuitEmisor?: number;
  /** Default: FACTURADOR_PUNTO_VENTA (ej. 5) */
  puntoVenta?: number;
}
