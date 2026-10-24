import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pdf from 'pdf-parse';
import { executeQuery, getConnection } from '../../config/database';
import { ProductRepository } from '../../repositories/ProductRepository';
import { SaleRepository } from '../../repositories/SaleRepository';
import {
  ConfirmSalesInvoiceInput,
  ConfirmSalesInvoiceResult,
  LinkableSaleSummary,
  MatchedSalesInvoiceItem,
  ParseSalesInvoiceResult,
  ParsedSalesInvoice,
  UnlinkSalesInvoiceResult,
  UpdateSalesInvoiceLinkInput,
} from '../../entities/SalesImportDocument';
import { detectArcaInvoiceDocument, parseArcaInvoicePdfText } from './ArcaInvoicePdfParser';
import { readStoredPdf, savePdfDocument } from '../../utils/compressedPdfStorage';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'sales-documents');

export class SalesDocumentService {
  private productRepository = new ProductRepository();
  private saleRepository = new SaleRepository();

  private ensureUploadDir(): void {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  }

  private normalizeTaxId(taxId?: string): string | undefined {
    if (!taxId) return undefined;
    return taxId.replace(/[^\d]/g, '');
  }

  private parsePdfText(text: string): ParsedSalesInvoice {
    if (detectArcaInvoiceDocument(text)) {
      return parseArcaInvoicePdfText(text);
    }
    return parseArcaInvoicePdfText(text);
  }

  private comprobanteLabel(tipo: number, puntoVenta: number, numero: number): string {
    const pv = String(puntoVenta).padStart(4, '0');
    const nro = String(numero).padStart(8, '0');
    return `${pv}-${nro} (tipo ${tipo})`;
  }

  async parseUploadedDocument(
    file: Express.Multer.File,
    userId?: number,
    preferredClientId?: number,
    preferredLinkSaleId?: number
  ): Promise<ParseSalesInvoiceResult> {
    this.ensureUploadDir();

    const pdfData = await pdf(file.buffer);
    const parsed = this.parsePdfText(pdfData.text);
    const warnings: string[] = [];

    if (!parsed.cae) {
      warnings.push('No se detectó el CAE. Verifique el PDF o ingréselo manualmente.');
    }
    if (!parsed.punto_venta || !parsed.numero) {
      warnings.push('No se detectó punto de venta o número de comprobante.');
    }
    if (!parsed.fecha_emision) {
      warnings.push('No se detectó la fecha de emisión.');
    }
    if (parsed.items.length === 0) {
      warnings.push('No se detectaron ítems. Se creará una línea con el importe total.');
    }
    if (parsed.document_type === 'nota_credito') {
      warnings.push('El documento parece ser una nota de crédito. Revise los datos antes de confirmar.');
    }

    const fileToken = crypto.randomUUID();
    const safeName = file.originalname.replace(/[^\w.\-() ]+/g, '_');
    const stored = savePdfDocument(UPLOAD_DIR, fileToken, file.buffer);

    await executeQuery(
      `INSERT INTO sales_import_documents
        (file_token, original_filename, stored_path, mime_type, source_provider, parsed_payload, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        fileToken,
        safeName,
        stored.storedPath,
        stored.mimeType,
        parsed.provider,
        JSON.stringify(parsed),
        userId ?? null,
      ]
    );

    const clientSuggestion = await this.suggestClient(parsed, preferredClientId);
    const clientIdForSort = clientSuggestion.client_id ?? preferredClientId;
    const linkableSales = await this.findLinkableSales(clientIdForSort, preferredLinkSaleId);
    const suggestedLinkSaleId =
      preferredLinkSaleId && linkableSales.some((s) => s.id === preferredLinkSaleId)
        ? preferredLinkSaleId
        : this.suggestLinkSaleId(linkableSales, parsed);
    const matchedItems = await this.matchItems(parsed);
    const duplicate = await this.findDuplicateInvoice(parsed);

    if (duplicate.duplicate) {
      warnings.push(
        `Ya existe una factura registrada con PV ${parsed.punto_venta} — N° ${parsed.numero}.`
      );
    }

    return {
      file_token: fileToken,
      original_filename: safeName,
      parsed,
      items: matchedItems,
      suggested_client_id: clientSuggestion.client_id,
      suggested_client_name: clientSuggestion.client_name,
      linkable_sales: linkableSales,
      suggested_link_sale_id: suggestedLinkSaleId,
      duplicate_invoice: duplicate.duplicate,
      existing_sale_id: duplicate.sale_id,
      warnings,
    };
  }

  private async suggestClient(
    parsed: ParsedSalesInvoice,
    preferredClientId?: number
  ): Promise<{ client_id?: number; client_name?: string }> {
    if (preferredClientId) {
      const rows = await executeQuery(
        `SELECT id, name FROM clients WHERE id = ? AND is_active = 1 LIMIT 1`,
        [preferredClientId]
      );
      if (rows[0]) {
        return { client_id: rows[0].id, client_name: rows[0].name };
      }
    }

    const normalizedTaxId = this.normalizeTaxId(parsed.cuit_receptor);
    if (normalizedTaxId) {
      const rows = await executeQuery(
        `SELECT id, name FROM clients
         WHERE REPLACE(REPLACE(REPLACE(cuil_cuit, '-', ''), '.', ''), ' ', '') = ?
           AND is_active = 1
         LIMIT 1`,
        [normalizedTaxId]
      );
      if (rows[0]) {
        return { client_id: rows[0].id, client_name: rows[0].name };
      }
    }

    if (parsed.receptor_razon_social) {
      const rows = await executeQuery(
        `SELECT id, name FROM clients
         WHERE name LIKE ? AND is_active = 1
         LIMIT 1`,
        [`%${parsed.receptor_razon_social.slice(0, 40)}%`]
      );
      if (rows[0]) {
        return { client_id: rows[0].id, client_name: rows[0].name };
      }
    }

    return {};
  }

  private async findLinkableSales(
    preferredClientId?: number,
    ensureSaleId?: number
  ): Promise<LinkableSaleSummary[]> {
    const rows = await executeQuery(
      `SELECT s.id, s.sale_number, s.sale_date, s.total_amount, s.arca_status,
              s.client_id, c.name AS client_name
       FROM sales s
       LEFT JOIN clients c ON c.id = s.client_id
       WHERE COALESCE(s.sale_source, 'pos') = 'pos'
         AND (s.source_file_path IS NULL OR TRIM(s.source_file_path) = '')
         AND (s.arca_cae IS NULL OR TRIM(s.arca_cae) = '')
         AND (
           s.arca_status IS NULL
           OR s.arca_status IN ('pending', 'error')
         )
       ORDER BY
         CASE WHEN ? IS NOT NULL AND s.client_id = ? THEN 0 ELSE 1 END,
         s.sale_date DESC,
         s.id DESC
       LIMIT 80`,
      [preferredClientId ?? null, preferredClientId ?? null]
    );

    const mapped = rows.map(
      (row: LinkableSaleSummary & { client_id?: number; client_name?: string }) => ({
        id: row.id,
        sale_number: row.sale_number,
        sale_date: row.sale_date,
        total_amount: Number(row.total_amount) || 0,
        client_id: row.client_id ?? null,
        client_name: row.client_name ?? null,
        arca_status: row.arca_status ?? null,
      })
    );

    if (ensureSaleId && !mapped.some((s: LinkableSaleSummary) => s.id === ensureSaleId)) {
      const extra = await this.getLinkableSaleById(ensureSaleId);
      if (extra) {
        return [extra, ...mapped];
      }
    }

    return mapped;
  }

  private async getLinkableSaleById(saleId: number): Promise<LinkableSaleSummary | null> {
    const rows = await executeQuery(
      `SELECT s.id, s.sale_number, s.sale_date, s.total_amount, s.arca_status,
              s.client_id, c.name AS client_name,
              s.sale_source, s.source_file_path, s.arca_cae, s.arca_factura_id
       FROM sales s
       LEFT JOIN clients c ON c.id = s.client_id
       WHERE s.id = ?
       LIMIT 1`,
      [saleId]
    );
    const row = rows[0];
    if (!row) return null;

    const saleSource = row.sale_source ?? 'pos';
    if (saleSource !== 'pos') return null;
    if (row.source_file_path) return null;
    if (row.arca_cae && String(row.arca_cae).trim()) return null;
    if (row.arca_factura_id && String(row.arca_factura_id).trim()) return null;
    if (row.arca_status === 'success') return null;

    return {
      id: row.id,
      sale_number: row.sale_number,
      sale_date: row.sale_date,
      total_amount: Number(row.total_amount) || 0,
      client_id: row.client_id ?? null,
      client_name: row.client_name ?? null,
      arca_status: row.arca_status ?? null,
    };
  }

  private suggestLinkSaleId(
    sales: LinkableSaleSummary[],
    parsed: ParsedSalesInvoice
  ): number | undefined {
    if (!sales.length || parsed.total_amount == null) return sales[0]?.id;

    const invoiceTotal = parsed.total_amount;
    const invoiceDate = parsed.fecha_emision;

    let best: { id: number; score: number } | undefined;
    for (const sale of sales) {
      let score = 0;
      const diff = Math.abs(sale.total_amount - invoiceTotal);
      if (diff < 0.02) score += 100;
      else if (diff <= invoiceTotal * 0.02) score += 60;
      else if (diff <= invoiceTotal * 0.1) score += 20;

      if (invoiceDate && sale.sale_date) {
        const saleDay = String(sale.sale_date).slice(0, 10);
        if (saleDay === invoiceDate) score += 40;
        else if (Math.abs(new Date(saleDay).getTime() - new Date(invoiceDate).getTime()) <= 7 * 86400000) {
          score += 15;
        }
      }

      if (!best || score > best.score) {
        best = { id: sale.id, score };
      }
    }

    return best && best.score >= 20 ? best.id : sales[0]?.id;
  }

  private async validateLinkableSale(
    saleId: number
  ): Promise<{ sale_number: string; total_amount: number; client_id: number; client_name: string }> {
    const sale = await this.saleRepository.getSaleById(saleId);
    if (!sale) {
      throw new Error('La venta seleccionada no existe');
    }
    if (sale.sale_source === 'imported') {
      throw new Error('No se puede vincular a un registro importado sin venta POS');
    }
    if (sale.sale_source === 'pos_external' || sale.source_file_path) {
      throw new Error('La venta ya tiene una factura externa vinculada');
    }
    if (sale.arca_status === 'success' && sale.arca_factura_id) {
      throw new Error('La venta ya fue facturada por el sistema; no se puede vincular un PDF externo');
    }
    if (sale.arca_cae && String(sale.arca_cae).trim()) {
      throw new Error('La venta ya tiene un comprobante fiscal registrado');
    }
    if (!sale.client_id) {
      throw new Error('La venta no tiene cliente asignado');
    }
    return {
      sale_number: sale.sale_number,
      total_amount: Number(sale.total_amount) || 0,
      client_id: sale.client_id,
      client_name: sale.client_name?.trim() || `Cliente #${sale.client_id}`,
    };
  }

  private async validateSaleForLinkUpdate(
    saleId: number
  ): Promise<{
    sale_number: string;
    total_amount: number;
    client_id: number;
    client_name: string;
    source_file_path?: string | null;
    arca_response_json?: Record<string, unknown> | null;
  }> {
    const sale = await this.saleRepository.getSaleById(saleId);
    if (!sale) {
      throw new Error('La venta no existe');
    }
    if (sale.sale_source !== 'pos_external') {
      throw new Error('Solo se puede modificar la vinculación en ventas POS con factura externa');
    }
    if (!sale.client_id) {
      throw new Error('La venta no tiene cliente asignado');
    }
    return {
      sale_number: sale.sale_number,
      total_amount: Number(sale.total_amount) || 0,
      client_id: sale.client_id,
      client_name: sale.client_name?.trim() || `Cliente #${sale.client_id}`,
      source_file_path: sale.source_file_path ?? null,
      arca_response_json:
        sale.arca_response_json && typeof sale.arca_response_json === 'object'
          ? (sale.arca_response_json as Record<string, unknown>)
          : null,
    };
  }

  private async findDuplicateByComprobante(
    puntoVenta: number,
    comprobanteTipo: number,
    numero: number,
    cuitEmisor?: string,
    excludeSaleId?: number
  ): Promise<{ duplicate: boolean; sale_id?: number }> {
    const params: Array<string | number> = [puntoVenta, comprobanteTipo, numero];
    let sql = `
      SELECT id FROM sales
      WHERE arca_punto_venta = ? AND arca_tipo = ? AND arca_numero = ?
        AND arca_status = 'success'
    `;

    if (cuitEmisor) {
      sql += ' AND arca_cuit_emisor = ?';
      params.push(cuitEmisor);
    }

    if (excludeSaleId) {
      sql += ' AND id <> ?';
      params.push(excludeSaleId);
    }

    sql += ' LIMIT 1';

    const rows = await executeQuery(sql, params);
    if (rows[0]) {
      return { duplicate: true, sale_id: rows[0].id };
    }
    return { duplicate: false };
  }

  private async findDuplicateInvoice(parsed: ParsedSalesInvoice): Promise<{
    duplicate: boolean;
    sale_id?: number;
  }> {
    if (!parsed.punto_venta || !parsed.numero || !parsed.comprobante_tipo) {
      return { duplicate: false };
    }

    return this.findDuplicateByComprobante(
      parsed.punto_venta,
      parsed.comprobante_tipo,
      parsed.numero,
      parsed.cuit_emisor
    );
  }

  private async matchItems(parsed: ParsedSalesInvoice): Promise<MatchedSalesInvoiceItem[]> {
    const results: MatchedSalesInvoiceItem[] = [];

    for (const item of parsed.items) {
      const warnings: string[] = [];
      let productId: number | undefined;
      let productName: string | undefined;
      let productCode: string | undefined;
      let matchMethod: MatchedSalesInvoiceItem['match_method'];

      if (item.product_code) {
        const byCode = await this.productRepository.findByCode(item.product_code);
        if (byCode) {
          productId = byCode.id;
          productName = byCode.name;
          productCode = byCode.code;
          matchMethod = 'product_code';
        }
      }

      if (!productId && item.description) {
        const byName = await executeQuery(
          `SELECT id, name, code FROM products WHERE name LIKE ? LIMIT 1`,
          [`%${item.description.slice(0, 60)}%`]
        );
        if (byName[0]) {
          productId = byName[0].id;
          productName = byName[0].name;
          productCode = byName[0].code;
          matchMethod = 'description';
        }
      }

      let matchStatus: MatchedSalesInvoiceItem['match_status'] = productId ? 'matched' : 'unmatched';
      if (!productId) {
        warnings.push('Producto no encontrado en catálogo. Se registrará como línea manual.');
        matchStatus = 'unmatched';
      }

      results.push({
        ...item,
        product_id: productId,
        product_name: productName,
        product_code: productCode,
        match_status: matchStatus,
        match_method: matchMethod,
        warnings,
      });
    }

    return results;
  }

  async rematchItems(
    fileToken: string,
    clientId?: number,
    preferredLinkSaleId?: number
  ): Promise<{ items: MatchedSalesInvoiceItem[]; linkable_sales: LinkableSaleSummary[]; suggested_link_sale_id?: number }> {
    const [docRow] = await executeQuery(
      `SELECT parsed_payload FROM sales_import_documents WHERE file_token = ? LIMIT 1`,
      [fileToken]
    );
    if (!docRow) {
      throw new Error('Documento no encontrado. Vuelva a subir el archivo.');
    }

    const parsed =
      typeof docRow.parsed_payload === 'string'
        ? JSON.parse(docRow.parsed_payload)
        : docRow.parsed_payload;

    const linkableSales = await this.findLinkableSales(clientId, preferredLinkSaleId);
    return {
      items: await this.matchItems(parsed),
      linkable_sales: linkableSales,
      suggested_link_sale_id:
        preferredLinkSaleId && linkableSales.some((s) => s.id === preferredLinkSaleId)
          ? preferredLinkSaleId
          : this.suggestLinkSaleId(linkableSales, parsed),
    };
  }

  async getSourcePdfForSale(
    saleId: number
  ): Promise<{ buffer: Buffer; filename: string } | null> {
    const [saleRow] = await executeQuery(
      `SELECT source_file_path FROM sales WHERE id = ? LIMIT 1`,
      [saleId]
    );
    const sourcePath = saleRow?.source_file_path as string | undefined;
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return null;
    }

    const [docRow] = await executeQuery(
      `SELECT original_filename FROM sales_import_documents WHERE sale_id = ? ORDER BY id DESC LIMIT 1`,
      [saleId]
    );
    const filename =
      (docRow?.original_filename as string | undefined) ||
      path.basename(sourcePath).replace(/\.gz$/i, '') ||
      `factura-venta-${saleId}.pdf`;

    return { buffer: readStoredPdf(sourcePath), filename };
  }

  async confirmDocument(
    input: ConfirmSalesInvoiceInput,
    userId?: number
  ): Promise<ConfirmSalesInvoiceResult> {
    const [docRow] = await executeQuery(
      `SELECT id, stored_path, parsed_payload, sale_id
       FROM sales_import_documents WHERE file_token = ? LIMIT 1`,
      [input.file_token]
    );
    if (!docRow) {
      throw new Error('Documento no encontrado. Vuelva a subir el archivo.');
    }
    if (docRow.sale_id) {
      throw new Error('Este documento ya fue procesado anteriormente.');
    }

    const duplicate = await this.findDuplicateByComprobante(
      input.punto_venta,
      input.comprobante_tipo,
      input.numero,
      input.cuit_emisor
    );
    if (duplicate.duplicate) {
      throw new Error('Ya existe una factura registrada con el mismo PV, tipo y número.');
    }

    if (!input.items.length && !input.link_sale_id) {
      throw new Error('Debe incluir al menos un ítem o seleccionar una venta POS para vincular.');
    }

    const parsedPayload =
      typeof docRow.parsed_payload === 'string'
        ? JSON.parse(docRow.parsed_payload)
        : docRow.parsed_payload;

    const warnings: string[] = [];
    const connection = await getConnection();
    const linking = Boolean(input.link_sale_id);
    let linkedSaleMeta:
      | { sale_number: string; total_amount: number; client_id: number; client_name: string }
      | undefined;
    let effectiveClientId = input.client_id;

    if (linking) {
      linkedSaleMeta = await this.validateLinkableSale(input.link_sale_id!);
      effectiveClientId = linkedSaleMeta.client_id;
      if (linkedSaleMeta.client_id !== input.client_id) {
        warnings.push(
          `El cliente del formulario difiere de la venta POS; se usará ${linkedSaleMeta.client_name}.`
        );
      }
      const diff = Math.abs(linkedSaleMeta.total_amount - input.total_amount);
      if (diff > 0.02 && input.total_amount > 0) {
        warnings.push(
          `El total del PDF ($${input.total_amount.toLocaleString('es-AR')}) difiere del total de la venta POS ($${linkedSaleMeta.total_amount.toLocaleString('es-AR')}).`
        );
      }
    }

    const [clientRow] = await executeQuery(
      `SELECT id, name FROM clients WHERE id = ? AND is_active = 1 LIMIT 1`,
      [effectiveClientId]
    );
    if (!clientRow) {
      throw new Error('Cliente no encontrado');
    }

    try {
      await connection.beginTransaction();

      let sale;
      if (linking && input.link_sale_id) {
        sale = await this.saleRepository.linkExternalInvoiceToSale(
          input.link_sale_id,
          {
            source_file_path: docRow.stored_path,
            arca_cae: input.cae,
            arca_punto_venta: input.punto_venta,
            arca_tipo: input.comprobante_tipo,
            arca_numero: input.numero,
            arca_cuit_emisor: input.cuit_emisor ?? null,
            arca_fecha_emision: input.fecha_emision,
            arca_cae_vto: input.cae_vto ?? null,
            arca_qr_url: input.qr_url ?? parsedPayload?.qr_url ?? null,
            arca_response_json: {
              source: 'imported_pdf_linked',
              linked_sale_id: input.link_sale_id,
              parsed: parsedPayload,
              pdf_items: input.items,
              imported_at: new Date().toISOString(),
            },
            notes_append: input.notes ?? 'Factura externa vinculada desde PDF ARCA',
          },
          connection
        );
      } else {
        sale = await this.saleRepository.createImportedSale(
          {
            client_id: input.client_id,
            total_amount: input.total_amount,
            payment_method: input.payment_method ?? 'transferencia',
            sale_date: input.fecha_emision,
            notes: input.notes ?? 'Importada desde PDF ARCA externo',
            source_file_path: docRow.stored_path,
            arca_cae: input.cae,
            arca_punto_venta: input.punto_venta,
            arca_tipo: input.comprobante_tipo,
            arca_numero: input.numero,
            arca_cuit_emisor: input.cuit_emisor ?? null,
            arca_fecha_emision: input.fecha_emision,
            arca_cae_vto: input.cae_vto ?? null,
            arca_qr_url: input.qr_url ?? parsedPayload?.qr_url ?? null,
            arca_response_json: {
              source: 'imported_pdf',
              parsed: parsedPayload,
              imported_at: new Date().toISOString(),
            },
            items: input.items.map((item) => ({
              product_id: item.product_id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              iva_rate: item.iva_rate,
            })),
          },
          userId ?? null,
          connection
        );
      }

      await executeQuery(
        `UPDATE sales_import_documents SET sale_id = ? WHERE id = ?`,
        [sale.id, docRow.id],
        connection
      );

      await connection.commit();

      return {
        sale_id: sale.id,
        sale_number: sale.sale_number,
        client_id: clientRow.id,
        client_name: clientRow.name,
        comprobante_label: this.comprobanteLabel(
          input.comprobante_tipo,
          input.punto_venta,
          input.numero
        ),
        linked_to_pos_sale: linking,
        warnings,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async updateLinkedDocument(
    input: UpdateSalesInvoiceLinkInput,
    userId?: number
  ): Promise<ConfirmSalesInvoiceResult> {
    const saleMeta = await this.validateSaleForLinkUpdate(input.sale_id);

    const duplicate = await this.findDuplicateByComprobante(
      input.punto_venta,
      input.comprobante_tipo,
      input.numero,
      input.cuit_emisor,
      input.sale_id
    );
    if (duplicate.duplicate) {
      throw new Error('Ya existe otra factura registrada con el mismo PV, tipo y número.');
    }

    let docRow: { id: number; stored_path: string; parsed_payload: unknown; sale_id?: number } | null =
      null;
    let parsedPayload: Record<string, unknown> | null = null;

    if (input.file_token) {
      const [row] = await executeQuery(
        `SELECT id, stored_path, parsed_payload, sale_id
         FROM sales_import_documents WHERE file_token = ? LIMIT 1`,
        [input.file_token]
      );
      if (!row) {
        throw new Error('Documento no encontrado. Vuelva a subir el archivo.');
      }
      if (row.sale_id && row.sale_id !== input.sale_id) {
        throw new Error('Este PDF ya fue vinculado a otra venta.');
      }
      docRow = row;
      parsedPayload =
        typeof row.parsed_payload === 'string'
          ? JSON.parse(row.parsed_payload)
          : row.parsed_payload;
    }

    const warnings: string[] = [];
    const diff = Math.abs(saleMeta.total_amount - input.total_amount);
    if (diff > 0.02 && input.total_amount > 0) {
      warnings.push(
        `El total del PDF ($${input.total_amount.toLocaleString('es-AR')}) difiere del total de la venta POS ($${saleMeta.total_amount.toLocaleString('es-AR')}).`
      );
    }

    const connection = await getConnection();
    try {
      await connection.beginTransaction();

      const previousHistory = saleMeta.arca_response_json ?? {};
      const sourcePath = docRow?.stored_path ?? saleMeta.source_file_path;

      const sale = await this.saleRepository.linkExternalInvoiceToSale(
        input.sale_id,
        {
          source_file_path: sourcePath,
          arca_cae: input.cae,
          arca_punto_venta: input.punto_venta,
          arca_tipo: input.comprobante_tipo,
          arca_numero: input.numero,
          arca_cuit_emisor: input.cuit_emisor ?? null,
          arca_fecha_emision: input.fecha_emision,
          arca_cae_vto: input.cae_vto ?? null,
          arca_qr_url: input.qr_url ?? (parsedPayload?.qr_url as string | undefined) ?? null,
          arca_response_json: {
            source: 'imported_pdf_linked',
            linked_sale_id: input.sale_id,
            parsed: parsedPayload ?? previousHistory.parsed ?? null,
            previous_link: previousHistory,
            updated_at: new Date().toISOString(),
            updated_by: userId ?? null,
            pdf_replaced: Boolean(docRow),
          },
          notes_append: input.notes ?? 'Vinculación de factura externa actualizada',
        },
        connection
      );

      if (docRow) {
        await executeQuery(
          `UPDATE sales_import_documents SET sale_id = ? WHERE id = ?`,
          [sale.id, docRow.id],
          connection
        );
      }

      await connection.commit();

      return {
        sale_id: sale.id,
        sale_number: sale.sale_number,
        client_id: saleMeta.client_id,
        client_name: saleMeta.client_name,
        comprobante_label: this.comprobanteLabel(
          input.comprobante_tipo,
          input.punto_venta,
          input.numero
        ),
        linked_to_pos_sale: true,
        warnings,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async unlinkExternalInvoice(saleId: number): Promise<UnlinkSalesInvoiceResult> {
    await this.validateSaleForLinkUpdate(saleId);
    const sale = await this.saleRepository.unlinkExternalInvoiceFromSale(saleId);
    return {
      sale_id: sale.id,
      sale_number: sale.sale_number,
    };
  }
}
