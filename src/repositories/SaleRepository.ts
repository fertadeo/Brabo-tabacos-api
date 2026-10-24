import Database from '../config/database';
import { executeQuery } from '../config/database';
import { 
  Sale, 
  SaleWithDetails, 
  CreateSaleData, 
  UpdateSaleData,
  UpdateSaleFacturacionData,
  UpdateSaleNotaCreditoData,
  SaleFilters,
  SaleStats,
  SaleItem
} from '../entities/Sale';
import { attachArcaComprobanteToSale } from '../utils/arcaComprobante';
import { mergeSaleComprobanteHistorial } from '../utils/saleComprobantes';
import { CreateSaleLineInput, isCatalogSaleLine } from '../utils/saleItems';
import { normalizeIvaRate } from '../utils/ivaAlicuota';
import { SaleComprobanteRepository } from './SaleComprobanteRepository';

export interface CreateImportedSaleData {
  client_id: number;
  total_amount: number;
  payment_method?: 'efectivo' | 'tarjeta' | 'transferencia' | 'mixto';
  sale_date?: string;
  notes?: string;
  source_file_path?: string | null;
  arca_cae: string;
  arca_punto_venta: number;
  arca_tipo: number;
  arca_numero: number;
  arca_cuit_emisor?: string | null;
  arca_fecha_emision?: string;
  arca_cae_vto?: string | null;
  arca_qr_url?: string | null;
  arca_response_json?: Record<string, unknown>;
  items: Array<{
    product_id?: number;
    description: string;
    quantity: number;
    unit_price: number;
    iva_rate?: number;
  }>;
}

export interface LinkExternalInvoiceData {
  source_file_path?: string | null;
  arca_cae: string;
  arca_punto_venta: number;
  arca_tipo: number;
  arca_numero: number;
  arca_cuit_emisor?: string | null;
  arca_fecha_emision?: string;
  arca_cae_vto?: string | null;
  arca_qr_url?: string | null;
  arca_response_json?: Record<string, unknown>;
  notes_append?: string;
}

export class SaleRepository {
  private db: typeof Database;
  private comprobanteRepository: SaleComprobanteRepository;

  constructor() {
    this.db = Database;
    this.comprobanteRepository = new SaleComprobanteRepository();
  }

  // Helper para convertir undefined y strings vacíos a null
  private toNull(value: any): any {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    return value;
  }

  // =====================================================
  // GENERACIÓN DE NÚMEROS DE VENTA
  // =====================================================

  /**
   * Genera un número único de venta en formato: SALE-YYYYMM-XXXX
   */
  private async generateSaleNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `SALE-${year}${month}`;

    // Buscar el último número de venta del mes
    const lastSaleResult = await executeQuery(
      `SELECT sale_number FROM sales 
       WHERE sale_number LIKE ? 
       ORDER BY sale_number DESC 
       LIMIT 1`,
      [`${prefix}-%`]
    ) as any[];
    const lastSale = lastSaleResult[0];

    let sequence = 1;
    if (lastSale && lastSale.sale_number) {
      const lastSequence = parseInt(lastSale.sale_number.split('-')[2] || '0', 10);
      sequence = lastSequence + 1;
    }

    const saleNumber = `${prefix}-${String(sequence).padStart(4, '0')}`;
    return saleNumber;
  }

  // =====================================================
  // SALES - Operaciones principales
  // =====================================================

  /**
   * Crea una nueva venta
   */
  async createSale(data: CreateSaleData, userId: number | null): Promise<Sale> {
    const connection = await this.db.getConnection();
    
    try {
      await connection.beginTransaction();

      // Generar número de venta
      const saleNumber = await this.generateSaleNumber();

      // Calcular total
      const totalAmount = data.items.reduce((sum, item) => 
        sum + (item.quantity * item.unit_price), 0
      );

      // Validar payment_details si el método es mixto
      if (data.payment_method === 'mixto' && data.payment_details) {
        const paymentTotal = (data.payment_details.efectivo || 0) + 
                            (data.payment_details.tarjeta || 0) + 
                            (data.payment_details.transferencia || 0);
        if (Math.abs(paymentTotal - totalAmount) > 0.01) {
          throw new Error(`El total de los métodos de pago (${paymentTotal}) no coincide con el total de la venta (${totalAmount})`);
        }
      }

      // Obtener o crear cliente genérico "Consumidor Final" si no se especifica cliente
      let clientId = data.client_id;
      if (!clientId) {
        const [genericClient] = await connection.execute(
          `SELECT id FROM clients WHERE code = 'CONSUMIDOR_FINAL' LIMIT 1`
        ) as any[];
        
        if (!genericClient || genericClient.length === 0) {
          // Crear cliente genérico
          const [newClient] = await connection.execute(
            `INSERT INTO clients (code, client_type, sales_channel, name, country, personeria, cuil_cuit, tax_condition, condicion_iva_receptor, is_active)
             VALUES ('CONSUMIDOR_FINAL', 'minorista', 'manual', 'Consumidor Final', 'Argentina', 'consumidor_final', NULL, 'consumidor_final', 5, 1)`
          ) as any[];
          clientId = (newClient as any).insertId;
        } else {
          clientId = genericClient[0].id;
        }
      }

      // Insertar venta
      const currency = data.currency === 'USD' ? 'USD' : 'ARS';
      const exchangeRate =
        currency === 'USD' && data.exchange_rate != null && Number(data.exchange_rate) > 0
          ? Number(data.exchange_rate)
          : null;

      const [result] = await connection.execute(
        `INSERT INTO sales (
          sale_number, client_id, total_amount, currency, exchange_rate,
          payment_method, payment_details, sale_date, sync_status, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), 'pending', ?, ?)`,
        [
          saleNumber,
          clientId,
          totalAmount,
          currency,
          exchangeRate,
          data.payment_method,
          data.payment_details ? JSON.stringify(data.payment_details) : null,
          this.toNull(data.notes),
          userId
        ]
      ) as any[];

      const saleId = (result as any).insertId;

      // Insertar items de la venta
      for (const item of data.items) {
        await this.createSaleItem(connection, saleId, item);
      }

      await connection.commit();

      const sale = await this.getSaleById(saleId);
      if (!sale) {
        throw new Error('Error creando la venta');
      }

      return sale;

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Registra una venta importada desde PDF ARCA externo (sin descontar stock).
   */
  async createImportedSale(
    data: CreateImportedSaleData,
    userId: number | null,
    externalConnection?: any
  ): Promise<Sale> {
    const ownsConnection = !externalConnection;
    const connection = externalConnection ?? (await this.db.getConnection());

    try {
      if (ownsConnection) await connection.beginTransaction();

      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const prefix = `IMP-${year}${month}`;

      const [lastSaleRows] = await connection.execute(
        `SELECT sale_number FROM sales WHERE sale_number LIKE ? ORDER BY sale_number DESC LIMIT 1`,
        [`${prefix}-%`]
      ) as any[];
      const lastSale = lastSaleRows?.[0];

      let sequence = 1;
      if (lastSale?.sale_number) {
        sequence = parseInt(lastSale.sale_number.split('-')[2] || '0', 10) + 1;
      }
      const saleNumber = `${prefix}-${String(sequence).padStart(4, '0')}`;

      const [result] = await connection.execute(
        `INSERT INTO sales (
          sale_number, client_id, total_amount, payment_method,
          sale_date, sync_status, notes, sale_source, source_file_path,
          arca_status, arca_cae, arca_punto_venta, arca_tipo, arca_numero,
          arca_cuit_emisor, arca_fecha_emision, arca_cae_vto, arca_qr_url,
          arca_response_json, created_by
        ) VALUES (?, ?, ?, ?, ?, 'synced', ?, 'imported', ?, 'success', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          saleNumber,
          data.client_id,
          data.total_amount,
          data.payment_method ?? 'transferencia',
          data.sale_date ?? new Date().toISOString().slice(0, 10),
          this.toNull(data.notes),
          this.toNull(data.source_file_path),
          data.arca_cae,
          data.arca_punto_venta,
          data.arca_tipo,
          data.arca_numero,
          this.toNull(data.arca_cuit_emisor),
          this.toNull(data.arca_fecha_emision),
          this.toNull(data.arca_cae_vto),
          this.toNull(data.arca_qr_url),
          data.arca_response_json ? JSON.stringify(data.arca_response_json) : null,
          userId,
        ]
      ) as any[];

      const saleId = (result as any).insertId;

      for (const item of data.items) {
        const totalPrice = item.quantity * item.unit_price;
        const ivaRate = normalizeIvaRate(item.iva_rate ?? 21);

        if (item.product_id) {
          await connection.execute(
            `INSERT INTO sale_items (sale_id, product_id, description, quantity, unit_price, total_price, iva_rate)
             VALUES (?, ?, NULL, ?, ?, ?, ?)`,
            [saleId, item.product_id, item.quantity, item.unit_price, totalPrice, ivaRate]
          );
        } else {
          await connection.execute(
            `INSERT INTO sale_items (sale_id, product_id, description, quantity, unit_price, total_price, iva_rate)
             VALUES (?, NULL, ?, ?, ?, ?, ?)`,
            [saleId, item.description, item.quantity, item.unit_price, totalPrice, ivaRate]
          );
        }
      }

      if (ownsConnection) await connection.commit();

      const sale = await this.getSaleById(saleId);
      if (!sale) {
        throw new Error('Error registrando la factura importada');
      }
      return sale;
    } catch (error) {
      if (ownsConnection) await connection.rollback();
      throw error;
    } finally {
      if (ownsConnection) connection.release();
    }
  }

  /**
   * Adjunta datos fiscales de un PDF externo a una venta POS existente (sin modificar ítems ni stock).
   */
  async linkExternalInvoiceToSale(
    saleId: number,
    data: LinkExternalInvoiceData,
    externalConnection?: any
  ): Promise<Sale> {
    const ownsConnection = !externalConnection;
    const connection = externalConnection ?? (await this.db.getConnection());

    try {
      if (ownsConnection) await connection.beginTransaction();

      const noteLine = data.notes_append?.trim() || 'Factura externa vinculada desde PDF ARCA';

      await connection.execute(
        `UPDATE sales
         SET sale_source = 'pos_external',
             source_file_path = ?,
             arca_status = 'success',
             arca_factura_id = NULL,
             arca_cae = ?,
             arca_punto_venta = ?,
             arca_tipo = ?,
             arca_numero = ?,
             arca_cuit_emisor = ?,
             arca_fecha_emision = ?,
             arca_cae_vto = ?,
             arca_qr_url = ?,
             arca_response_json = ?,
             arca_error_code = NULL,
             arca_error_message = NULL,
             notes = CASE
               WHEN notes IS NULL OR TRIM(notes) = '' THEN ?
               ELSE CONCAT(TRIM(notes), '\n', ?)
             END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          this.toNull(data.source_file_path),
          data.arca_cae,
          data.arca_punto_venta,
          data.arca_tipo,
          data.arca_numero,
          this.toNull(data.arca_cuit_emisor),
          this.toNull(data.arca_fecha_emision),
          this.toNull(data.arca_cae_vto),
          this.toNull(data.arca_qr_url),
          data.arca_response_json ? JSON.stringify(data.arca_response_json) : null,
          noteLine,
          noteLine,
          saleId,
        ]
      );

      if (ownsConnection) await connection.commit();

      const sale = await this.getSaleById(saleId);
      if (!sale) {
        throw new Error('No se pudo vincular la factura a la venta');
      }
      return sale;
    } catch (error) {
      if (ownsConnection) await connection.rollback();
      throw error;
    } finally {
      if (ownsConnection) connection.release();
    }
  }

  /**
   * Quita la vinculación PDF externa y deja la venta nuevamente sin comprobante ARCA.
   */
  async unlinkExternalInvoiceFromSale(
    saleId: number,
    externalConnection?: any
  ): Promise<Sale> {
    const ownsConnection = !externalConnection;
    const connection = externalConnection ?? (await this.db.getConnection());

    try {
      if (ownsConnection) await connection.beginTransaction();

      const noteLine = 'Vinculación de factura externa (PDF) removida';

      const [result] = await connection.execute(
        `UPDATE sales
         SET sale_source = 'pos',
             source_file_path = NULL,
             arca_status = NULL,
             arca_factura_id = NULL,
             arca_cae = NULL,
             arca_punto_venta = NULL,
             arca_tipo = NULL,
             arca_numero = NULL,
             arca_cuit_emisor = NULL,
             arca_fecha_emision = NULL,
             arca_cae_vto = NULL,
             arca_qr_url = NULL,
             arca_response_json = NULL,
             arca_error_code = NULL,
             arca_error_message = NULL,
             notes = CASE
               WHEN notes IS NULL OR TRIM(notes) = '' THEN ?
               ELSE CONCAT(TRIM(notes), '\n', ?)
             END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND sale_source = 'pos_external'`,
        [noteLine, noteLine, saleId]
      ) as any[];

      if ((result as { affectedRows?: number }).affectedRows === 0) {
        throw new Error('La venta no tiene una vinculación externa activa');
      }

      if (ownsConnection) await connection.commit();

      const sale = await this.getSaleById(saleId);
      if (!sale) {
        throw new Error('No se pudo desvincular la factura de la venta');
      }
      return sale;
    } catch (error) {
      if (ownsConnection) await connection.rollback();
      throw error;
    } finally {
      if (ownsConnection) connection.release();
    }
  }

  /**
   * Crea un item de venta
   */
  private async createSaleItem(
    connection: any,
    saleId: number,
    item: CreateSaleLineInput
  ): Promise<void> {
    const totalPrice = item.quantity * item.unit_price;
    const ivaRate = await this.resolveIvaRateForLine(connection, item);

    if (isCatalogSaleLine(item)) {
      await connection.execute(
        `INSERT INTO sale_items (sale_id, product_id, description, quantity, unit_price, total_price, iva_rate)
         VALUES (?, ?, NULL, ?, ?, ?, ?)`,
        [saleId, item.product_id, item.quantity, item.unit_price, totalPrice, ivaRate]
      );

      await connection.execute(
        `UPDATE products 
         SET stock = GREATEST(0, stock - ?) 
         WHERE id = ?`,
        [item.quantity, item.product_id]
      );
      return;
    }

    await connection.execute(
      `INSERT INTO sale_items (sale_id, product_id, description, quantity, unit_price, total_price, iva_rate)
       VALUES (?, NULL, ?, ?, ?, ?, ?)`,
      [saleId, item.description, item.quantity, item.unit_price, totalPrice, ivaRate]
    );
  }

  private async resolveIvaRateForLine(
    connection: any,
    item: CreateSaleLineInput
  ): Promise<number> {
    if (item.iva_rate !== undefined && item.iva_rate !== null) {
      return normalizeIvaRate(item.iva_rate);
    }

    if (isCatalogSaleLine(item)) {
      const [rows] = await connection.execute(
        'SELECT iva_rate FROM products WHERE id = ? LIMIT 1',
        [item.product_id]
      ) as any[];
      const productRow = Array.isArray(rows) ? rows[0] : rows;
      return normalizeIvaRate(productRow?.iva_rate);
    }

    return 21;
  }

  /**
   * Obtiene una venta por ID
   */
  async getSaleById(id: number): Promise<SaleWithDetails | null> {
    const sales = await executeQuery(
      `SELECT 
        s.*,
        c.name as client_name,
        c.code as client_code,
        c.email as client_email,
        c.phone as client_phone,
        c.address as client_address,
        c.city as client_city,
        c.cuil_cuit as client_cuil_cuit,
        COALESCE(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), u.username) as created_by_name
       FROM sales s
       LEFT JOIN clients c ON s.client_id = c.id
       LEFT JOIN users u ON s.created_by = u.id
       WHERE s.id = ?`,
      [id]
    ) as any[];

    if (!sales || sales.length === 0) {
      return null;
    }

    const sale = sales[0];
    
    // Parsear payment_details si es string
    if (sale.payment_details && typeof sale.payment_details === 'string') {
      try {
        sale.payment_details = JSON.parse(sale.payment_details);
      } catch (error) {
        sale.payment_details = null;
      }
    }
    if (sale.arca_request_json && typeof sale.arca_request_json === 'string') {
      try {
        sale.arca_request_json = JSON.parse(sale.arca_request_json);
      } catch (error) {
        sale.arca_request_json = null;
      }
    }
    if (sale.arca_response_json && typeof sale.arca_response_json === 'string') {
      try {
        sale.arca_response_json = JSON.parse(sale.arca_response_json);
      } catch (error) {
        sale.arca_response_json = null;
      }
    }
    if (sale.arca_nc_request_json && typeof sale.arca_nc_request_json === 'string') {
      try {
        sale.arca_nc_request_json = JSON.parse(sale.arca_nc_request_json);
      } catch (error) {
        sale.arca_nc_request_json = null;
      }
    }
    if (sale.arca_nc_response_json && typeof sale.arca_nc_response_json === 'string') {
      try {
        sale.arca_nc_response_json = JSON.parse(sale.arca_nc_response_json);
      } catch (error) {
        sale.arca_nc_response_json = null;
      }
    }

    // Obtener items
    sale.items = await this.getSaleItems(id);

    const [withHistorial] = await this.attachHistorial([attachArcaComprobanteToSale(sale)]);
    return withHistorial;
  }

  /**
   * Obtiene los items de una venta
   */
  async getSaleItems(saleId: number): Promise<SaleItem[]> {
    const items = await executeQuery(
      `SELECT 
        si.*,
        COALESCE(p.name, si.description) as product_name,
        p.code as product_code,
        p.iva_rate as product_iva_rate
       FROM sale_items si
       LEFT JOIN products p ON si.product_id = p.id
       WHERE si.sale_id = ?
       ORDER BY si.id`,
      [saleId]
    ) as any[];

    return (items || []).map((row: any) => ({
      ...row,
      product_id: row.product_id ?? null,
      description: row.description ?? null,
      quantity: Number(row.quantity) || 1,
      unit_price: Number(row.unit_price) || 0,
      total_price: Number(row.total_price) || 0,
      iva_rate: normalizeIvaRate(row.iva_rate ?? row.product_iva_rate),
      subtotal: Number(row.total_price)
    }));
  }

  /**
   * Obtiene todas las ventas con filtros
   */
  async getAllSales(filters: SaleFilters = {}): Promise<{
    sales: SaleWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, parseInt(String(filters.page ?? 1), 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(String(filters.limit ?? 20), 10) || 20));
    const includeItems = filters.include_items === true;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (filters.client_id) {
      whereClause += ' AND s.client_id = ?';
      params.push(filters.client_id);
    }

    if (filters.payment_method) {
      whereClause += ' AND s.payment_method = ?';
      params.push(filters.payment_method);
    }

    if (filters.sync_status) {
      whereClause += ' AND s.sync_status = ?';
      params.push(filters.sync_status);
    }

    if (filters.date_from) {
      whereClause += ' AND DATE(s.sale_date) >= ?';
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      whereClause += ' AND DATE(s.sale_date) <= ?';
      params.push(filters.date_to);
    }

    if (!filters.include_facturacion_archived) {
      whereClause += ' AND s.facturacion_archived = 0';
    }
    const countResult = await executeQuery(
      `SELECT COUNT(*) as total FROM sales s ${whereClause}`,
      params
    ) as any[];
    const total = countResult[0]?.total || 0;

    // Obtener ventas (LIMIT/OFFSET como literales: mysql2 puede fallar con placeholders en algunos entornos)
    const limitNum = Number(limit);
    const offsetNum = Number(offset);
    const sales = await executeQuery(
      `SELECT 
        s.*,
        c.name as client_name,
        c.code as client_code,
        c.email as client_email,
        c.phone as client_phone,
        c.address as client_address,
        c.city as client_city,
        c.cuil_cuit as client_cuil_cuit,
        COALESCE(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), u.username) as created_by_name
       FROM sales s
       LEFT JOIN clients c ON s.client_id = c.id
       LEFT JOIN users u ON s.created_by = u.id
       ${whereClause}
       ORDER BY s.sale_date DESC, s.id DESC
       LIMIT ${limitNum} OFFSET ${offsetNum}`,
      params
    ) as any[];

    // Parsear payment_details y obtener items para cada venta
    const salesWithDetails: SaleWithDetails[] = [];
    for (const sale of sales || []) {
      if (sale.payment_details && typeof sale.payment_details === 'string') {
        try {
          sale.payment_details = JSON.parse(sale.payment_details);
        } catch (error) {
          sale.payment_details = null;
        }
      }
      if (sale.arca_request_json && typeof sale.arca_request_json === 'string') {
        try {
          sale.arca_request_json = JSON.parse(sale.arca_request_json);
        } catch (error) {
          sale.arca_request_json = null;
        }
      }
      if (sale.arca_response_json && typeof sale.arca_response_json === 'string') {
        try {
          sale.arca_response_json = JSON.parse(sale.arca_response_json);
        } catch (error) {
          sale.arca_response_json = null;
        }
      }
      if (sale.arca_nc_request_json && typeof sale.arca_nc_request_json === 'string') {
        try {
          sale.arca_nc_request_json = JSON.parse(sale.arca_nc_request_json);
        } catch {
          sale.arca_nc_request_json = null;
        }
      }
      if (sale.arca_nc_response_json && typeof sale.arca_nc_response_json === 'string') {
        try {
          sale.arca_nc_response_json = JSON.parse(sale.arca_nc_response_json);
        } catch {
          sale.arca_nc_response_json = null;
        }
      }
      if (includeItems) {
        sale.items = await this.getSaleItems(sale.id);
      } else {
        sale.items = [];
      }
      salesWithDetails.push(attachArcaComprobanteToSale(sale));
    }

    const withHistorial = await this.attachHistorial(salesWithDetails);

    return {
      sales: withHistorial,
      total,
      page,
      limit
    };
  }

  private parsePaymentDetails(raw: unknown): Sale['payment_details'] {
    if (!raw) return null;
    if (typeof raw === 'object') return raw as Sale['payment_details'];
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Actualiza una venta (cabecera, ítems, pago). Reemplazo de ítems en transacción con ajuste de stock.
   */
  async updateSale(id: number, data: UpdateSaleData): Promise<Sale> {
    const connection = await this.db.getConnection();

    try {
      await connection.beginTransaction();

      const [saleRows] = (await connection.execute(
        `SELECT * FROM sales WHERE id = ? FOR UPDATE`,
        [id]
      )) as any[];
      if (!saleRows?.length) {
        throw new Error('Venta no encontrada');
      }
      const currentSale = saleRows[0];

      const fields: string[] = [];
      const values: any[] = [];
      let itemsChanged = false;
      let newTotal = Number(currentSale.total_amount);

      if (data.client_id !== undefined) {
        fields.push('client_id = ?');
        values.push(data.client_id);
      }

      if (data.notes !== undefined) {
        fields.push('notes = ?');
        values.push(this.toNull(data.notes));
      }

      if (data.items !== undefined) {
        if (!data.items.length) {
          throw new Error('La venta debe tener al menos un ítem');
        }
        itemsChanged = true;

        const [oldItemRows] = (await connection.execute(
          `SELECT product_id, quantity FROM sale_items WHERE sale_id = ?`,
          [id]
        )) as any[];

        for (const old of oldItemRows || []) {
          if (old.product_id != null) {
            await connection.execute(
              `UPDATE products SET stock = stock + ? WHERE id = ?`,
              [old.quantity, old.product_id]
            );
          }
        }

        for (const item of data.items) {
          if (!isCatalogSaleLine(item)) continue;
          const [productRows] = (await connection.execute(
            `SELECT stock, name, code FROM products WHERE id = ?`,
            [item.product_id]
          )) as any[];
          const product = productRows?.[0];
          if (!product) {
            throw new Error(`Producto con ID ${item.product_id} no encontrado`);
          }
          if (Number(product.stock) < item.quantity) {
            throw new Error(
              `Stock insuficiente para el producto ${product.name} (${product.code}). ` +
                `Stock disponible: ${product.stock}, cantidad solicitada: ${item.quantity}`
            );
          }
        }

        await connection.execute(`DELETE FROM sale_items WHERE sale_id = ?`, [id]);
        for (const item of data.items) {
          await this.createSaleItem(connection, id, item);
        }

        newTotal = data.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
        fields.push('total_amount = ?');
        values.push(newTotal);
      }

      const effectivePaymentMethod =
        data.payment_method ?? (currentSale.payment_method as Sale['payment_method']);
      const effectivePaymentDetails =
        data.payment_details !== undefined
          ? data.payment_details
          : this.parsePaymentDetails(currentSale.payment_details);

      if (data.payment_method !== undefined) {
        fields.push('payment_method = ?');
        values.push(data.payment_method);
      }

      if (data.payment_details !== undefined) {
        fields.push('payment_details = ?');
        values.push(
          data.payment_details ? JSON.stringify(data.payment_details) : null
        );
      }

      if (data.currency !== undefined) {
        const currency = data.currency === 'USD' ? 'USD' : 'ARS';
        fields.push('currency = ?');
        values.push(currency);
      }

      const effectiveCurrency =
        data.currency !== undefined
          ? data.currency === 'USD'
            ? 'USD'
            : 'ARS'
          : String(currentSale.currency ?? 'ARS').toUpperCase() === 'USD'
            ? 'USD'
            : 'ARS';

      if (data.exchange_rate !== undefined || data.currency !== undefined) {
        if (effectiveCurrency === 'USD') {
          const rate =
            data.exchange_rate != null && Number(data.exchange_rate) > 0
              ? Number(data.exchange_rate)
              : Number(currentSale.exchange_rate);
          if (!Number.isFinite(rate) || rate <= 0) {
            throw new Error(
              'Para ventas en USD debés indicar exchange_rate (cotización USD/ARS) mayor a 0'
            );
          }
          fields.push('exchange_rate = ?');
          values.push(rate);
        } else {
          fields.push('exchange_rate = ?');
          values.push(null);
        }
      }

      if (itemsChanged || data.payment_method !== undefined || data.payment_details !== undefined) {
        if (effectivePaymentMethod === 'mixto') {
          if (!effectivePaymentDetails) {
            throw new Error(
              'Con método de pago mixto se requiere payment_details que coincida con el total'
            );
          }
          const paymentTotal =
            (effectivePaymentDetails.efectivo || 0) +
            (effectivePaymentDetails.tarjeta || 0) +
            (effectivePaymentDetails.transferencia || 0);
          if (Math.abs(paymentTotal - newTotal) > 0.01) {
            throw new Error(
              `El total de los métodos de pago (${paymentTotal}) no coincide con el total de la venta (${newTotal})`
            );
          }
        }
      }

      if (itemsChanged && currentSale.sync_status === 'synced') {
        fields.push('sync_status = ?');
        values.push('pending');
        fields.push('sync_error = ?');
        values.push('La venta fue modificada; requiere nueva sincronización con WooCommerce.');
      }

      if (fields.length === 0) {
        throw new Error('No hay campos para actualizar');
      }

      // Re-fecha la venta al corregirla (facturación y caja usan sale_date)
      fields.push('sale_date = NOW()');
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      await connection.execute(
        `UPDATE sales SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      await connection.commit();

      const sale = await this.getSaleById(id);
      if (!sale) {
        throw new Error('Venta no encontrada después de actualizar');
      }

      return sale;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Actualiza el estado de sincronización de una venta
   */
  async updateSyncStatus(
    id: number,
    syncStatus: 'pending' | 'synced' | 'error',
    woocommerceOrderId?: number | null,
    syncError?: string | null
  ): Promise<void> {
    const connection = await this.db.getConnection();
    
    try {
      const fields: string[] = ['sync_status = ?'];
      const values: any[] = [syncStatus];

      if (woocommerceOrderId !== undefined) {
        fields.push('woocommerce_order_id = ?');
        values.push(this.toNull(woocommerceOrderId));
      }

      if (syncError !== undefined) {
        fields.push('sync_error = ?');
        values.push(this.toNull(syncError));
      }

      values.push(id);

      await connection.execute(
        `UPDATE sales SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );
    } finally {
      connection.release();
    }
  }

  private async attachHistorial<T extends Sale>(sales: T[]): Promise<T[]> {
    if (!sales.length) return sales;
    try {
      const map = await this.comprobanteRepository.listBySaleIds(sales.map((s) => s.id));
      return sales.map((sale) => ({
        ...sale,
        arca_historial: mergeSaleComprobanteHistorial(map.get(sale.id) ?? [], sale)
      }));
    } catch (error) {
      console.warn(
        '[SaleRepository] No se pudo cargar sale_comprobantes; se sintetiza historial desde sales',
        error
      );
      return sales.map((sale) => ({
        ...sale,
        arca_historial: mergeSaleComprobanteHistorial([], sale)
      }));
    }
  }

  async clearNotaCreditoData(id: number): Promise<void> {
    const connection = await this.db.getConnection();
    try {
      await connection.execute(
        `UPDATE sales
         SET arca_nc_status = NULL,
             arca_nc_cae = NULL,
             arca_nc_cae_vto = NULL,
             arca_nc_factura_id = NULL,
             arca_nc_tipo = NULL,
             arca_nc_punto_venta = NULL,
             arca_nc_numero = NULL,
             arca_nc_motivo = NULL,
             arca_nc_observaciones = NULL,
             arca_nc_idempotency_key = NULL,
             arca_nc_error_code = NULL,
             arca_nc_error_message = NULL,
             arca_nc_request_json = NULL,
             arca_nc_response_json = NULL,
             arca_nc_last_attempt_at = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [id]
      );
    } finally {
      connection.release();
    }
  }

  async updateNotaCreditoData(id: number, data: UpdateSaleNotaCreditoData): Promise<void> {
    const connection = await this.db.getConnection();
    try {
      await connection.execute(
        `UPDATE sales
         SET arca_nc_status = ?,
             arca_nc_cae = ?,
             arca_nc_cae_vto = ?,
             arca_nc_factura_id = ?,
             arca_nc_tipo = ?,
             arca_nc_punto_venta = ?,
             arca_nc_numero = ?,
             arca_nc_motivo = ?,
             arca_nc_observaciones = ?,
             arca_nc_idempotency_key = ?,
             arca_nc_error_code = ?,
             arca_nc_error_message = ?,
             arca_nc_request_json = ?,
             arca_nc_response_json = ?,
             arca_nc_last_attempt_at = NOW(),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          data.arca_nc_status,
          this.toNull(data.arca_nc_cae),
          this.toNull(data.arca_nc_cae_vto),
          this.toNull(data.arca_nc_factura_id),
          this.toNull(data.arca_nc_tipo),
          this.toNull(data.arca_nc_punto_venta),
          this.toNull(data.arca_nc_numero),
          this.toNull(data.arca_nc_motivo),
          this.toNull(data.arca_nc_observaciones),
          this.toNull(data.arca_nc_idempotency_key),
          this.toNull(data.arca_nc_error_code),
          this.toNull(data.arca_nc_error_message),
          data.arca_nc_request_json ? JSON.stringify(data.arca_nc_request_json) : null,
          data.arca_nc_response_json ? JSON.stringify(data.arca_nc_response_json) : null,
          id
        ]
      );
    } finally {
      connection.release();
    }
  }

  async updateFacturacionData(
    id: number,
    data: UpdateSaleFacturacionData
  ): Promise<void> {
    const connection = await this.db.getConnection();
    try {
      await connection.execute(
        `UPDATE sales
         SET arca_status = ?,
             arca_factura_id = ?,
             arca_cae = ?,
             arca_punto_venta = ?,
             arca_tipo = ?,
             arca_numero = ?,
             arca_cuit_emisor = ?,
             arca_fecha_emision = ?,
             arca_cae_vto = ?,
             arca_qr_url = ?,
             arca_idempotency_key = ?,
             arca_last_attempt_at = NOW(),
             arca_error_code = ?,
             arca_error_message = ?,
             arca_request_json = ?,
             arca_response_json = ?,
             condicion_venta_codigo = COALESCE(?, condicion_venta_codigo),
             condicion_venta_texto = COALESCE(?, condicion_venta_texto),
             fecha_vencimiento_pago = COALESCE(?, fecha_vencimiento_pago),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          data.arca_status,
          this.toNull(data.arca_factura_id),
          this.toNull(data.arca_cae),
          this.toNull(data.arca_punto_venta),
          this.toNull(data.arca_tipo),
          this.toNull(data.arca_numero),
          this.toNull(data.arca_cuit_emisor),
          this.toNull(data.arca_fecha_emision),
          this.toNull(data.arca_cae_vto),
          this.toNull(data.arca_qr_url),
          this.toNull(data.arca_idempotency_key),
          this.toNull(data.arca_error_code),
          this.toNull(data.arca_error_message),
          data.arca_request_json ? JSON.stringify(data.arca_request_json) : null,
          data.arca_response_json ? JSON.stringify(data.arca_response_json) : null,
          data.condicion_venta_codigo !== undefined ? this.toNull(data.condicion_venta_codigo) : null,
          data.condicion_venta_texto !== undefined ? this.toNull(data.condicion_venta_texto) : null,
          data.fecha_vencimiento_pago !== undefined ? this.toNull(data.fecha_vencimiento_pago) : null,
          id
        ]
      );
    } finally {
      connection.release();
    }
  }

  async setFacturacionArchived(
    ids: number[],
    archived: boolean,
    userId: number | null
  ): Promise<number> {
    if (!ids.length) return 0;
    const placeholders = ids.map(() => '?').join(', ');
    const connection = await this.db.getConnection();
    try {
      const [result] = await connection.execute(
        `UPDATE sales
         SET facturacion_archived = ?,
             facturacion_archived_at = IF(?, NOW(), NULL),
             facturacion_archived_by = IF(?, ?, NULL),
             updated_at = CURRENT_TIMESTAMP
         WHERE id IN (${placeholders})`,
        [
          archived ? 1 : 0,
          archived ? 1 : 0,
          archived ? 1 : 0,
          archived ? userId : null,
          ...ids
        ]
      ) as any[];
      return result?.affectedRows ?? 0;
    } finally {
      connection.release();
    }
  }

  /**
   * Obtiene estadísticas de ventas
   */
  async getSaleStats(): Promise<SaleStats> {
    const stats = await executeQuery(
      `SELECT 
        COUNT(*) as total_sales,
        COALESCE(SUM(total_amount), 0) as total_amount,
        COALESCE(AVG(total_amount), 0) as average_sale_amount,
        COUNT(CASE WHEN DATE(sale_date) = CURDATE() THEN 1 END) as sales_today,
        COUNT(CASE WHEN YEAR(sale_date) = YEAR(CURDATE()) AND MONTH(sale_date) = MONTH(CURDATE()) THEN 1 END) as sales_this_month,
        COUNT(CASE WHEN sync_status = 'pending' THEN 1 END) as pending_sync,
        COUNT(CASE WHEN sync_status = 'error' THEN 1 END) as sync_errors
       FROM sales`
    ) as any[];

    const paymentMethods = await executeQuery(
      `SELECT 
        payment_method,
        COUNT(*) as count,
        COALESCE(SUM(total_amount), 0) as total
       FROM sales
       GROUP BY payment_method`
    ) as any[];

    const salesByPaymentMethod: any = {
      efectivo: { count: 0, total: 0 },
      tarjeta: { count: 0, total: 0 },
      transferencia: { count: 0, total: 0 },
      mixto: { count: 0, total: 0 }
    };

    (paymentMethods || []).forEach((pm: any) => {
      if (salesByPaymentMethod[pm.payment_method]) {
        salesByPaymentMethod[pm.payment_method] = {
          count: pm.count,
          total: parseFloat(pm.total)
        };
      }
    });

    return {
      total_sales: stats[0]?.total_sales || 0,
      total_amount: parseFloat(stats[0]?.total_amount || 0),
      average_sale_amount: parseFloat(stats[0]?.average_sale_amount || 0),
      sales_by_payment_method: salesByPaymentMethod,
      sales_today: stats[0]?.sales_today || 0,
      sales_this_month: stats[0]?.sales_this_month || 0,
      pending_sync: stats[0]?.pending_sync || 0,
      sync_errors: stats[0]?.sync_errors || 0
    };
  }

  /**
   * Obtiene ventas pendientes de sincronización
   */
  async getPendingSyncSales(): Promise<Sale[]> {
    const sales = await executeQuery(
      `SELECT * FROM sales 
       WHERE sync_status = 'pending' OR sync_status = 'error'
       ORDER BY sale_date ASC
       LIMIT 50`
    ) as any[];

    return (sales || []).map((sale: any) => {
      if (sale.payment_details && typeof sale.payment_details === 'string') {
        try {
          sale.payment_details = JSON.parse(sale.payment_details);
        } catch (error) {
          sale.payment_details = null;
        }
      }
      return sale;
    });
  }
}
