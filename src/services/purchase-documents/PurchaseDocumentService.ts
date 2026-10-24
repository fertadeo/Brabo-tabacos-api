import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import pdf from 'pdf-parse';
import { executeQuery, getConnection } from '../../config/database';
import { ProductRepository } from '../../repositories/ProductRepository';
import { PurchaseRepository } from '../../repositories/PurchaseRepository';
import { SupplierDeliveryNoteRepository } from '../../repositories/SupplierDeliveryNoteRepository';
import {
  ConfirmPurchaseDocumentInput,
  ConfirmPurchaseDocumentResult,
  MatchedPurchaseDocumentItem,
  ParsePurchaseDocumentResult,
  ParsedPurchaseDocument,
} from '../../entities/PurchaseDocument';
import { PurchaseStatus } from '../../types';
import { detectInvidDocument, parseInvidRemitoPdfText } from './InvidRemitoParser';
import { savePdfDocument, readStoredPdf } from '../../utils/compressedPdfStorage';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'purchase-documents');

export class PurchaseDocumentService {
  private productRepository = new ProductRepository();
  private purchaseRepository = new PurchaseRepository();
  private deliveryNoteRepository = new SupplierDeliveryNoteRepository();

  private ensureUploadDir(): void {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
  }

  private normalizeTaxId(taxId?: string): string | undefined {
    if (!taxId) return undefined;
    return taxId.replace(/[^\d]/g, '');
  }

  private parsePdfText(text: string): ParsedPurchaseDocument {
    if (detectInvidDocument(text)) {
      return parseInvidRemitoPdfText(text);
    }

    const invidAttempt = parseInvidRemitoPdfText(text);
    if (invidAttempt.items.length > 0) {
      return invidAttempt;
    }

    return {
      provider: 'generic',
      document_type: 'unknown',
      items: [],
      raw_text_preview: text.slice(0, 500),
    };
  }

  async parseUploadedDocument(
    file: Express.Multer.File,
    userId?: number
  ): Promise<ParsePurchaseDocumentResult> {
    this.ensureUploadDir();

    const pdfData = await pdf(file.buffer);
    const parsed = this.parsePdfText(pdfData.text);
    const warnings: string[] = [];

    if (parsed.items.length === 0) {
      warnings.push('No se detectaron ítems en el documento. Revise el formato o cargue los datos manualmente.');
    }

    if (!parsed.delivery_note_number) {
      warnings.push('No se detectó el número de remito. Deberá ingresarlo manualmente.');
    }

    if (!parsed.delivery_date) {
      warnings.push('No se detectó la fecha del remito.');
    }

    const fileToken = crypto.randomUUID();
    const safeName = file.originalname.replace(/[^\w.\-() ]+/g, '_');
    const stored = savePdfDocument(UPLOAD_DIR, fileToken, file.buffer);

    await executeQuery(
      `INSERT INTO purchase_supplier_documents
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

    const matchedItems = await this.matchItems(parsed, undefined);
    const supplierSuggestion = await this.suggestSupplier(parsed);
    const purchaseSuggestion = supplierSuggestion.supplier_id
      ? await this.suggestPurchase(supplierSuggestion.supplier_id, parsed)
      : {};

    let duplicateDeliveryNote = false;
    if (parsed.delivery_note_number) {
      const existing = await this.deliveryNoteRepository.getDeliveryNoteByNumber(parsed.delivery_note_number);
      duplicateDeliveryNote = !!existing;
      if (duplicateDeliveryNote) {
        warnings.push(`Ya existe un remito registrado con el número ${parsed.delivery_note_number}.`);
      }
    }

    return {
      file_token: fileToken,
      original_filename: safeName,
      parsed,
      items: matchedItems,
      suggested_supplier_id: supplierSuggestion.supplier_id,
      suggested_supplier_name: supplierSuggestion.supplier_name,
      supplier_candidates: supplierSuggestion.candidates,
      suggested_purchase_id: purchaseSuggestion.purchase_id,
      suggested_purchase_number: purchaseSuggestion.purchase_number,
      duplicate_delivery_note: duplicateDeliveryNote,
      warnings,
    };
  }

  private async suggestSupplier(parsed: ParsedPurchaseDocument): Promise<{
    supplier_id?: number;
    supplier_name?: string;
    candidates: Array<{ id: number; name: string }>;
  }> {
    const candidates: Array<{ id: number; name: string }> = [];
    const seen = new Set<number>();

    const pushCandidate = (row: { id: number; name: string }) => {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        candidates.push({ id: row.id, name: row.name });
      }
    };

    const normalizedTaxId = this.normalizeTaxId(parsed.supplier_tax_id);
    if (normalizedTaxId) {
      const rows = await executeQuery(
        `SELECT id, name FROM suppliers
         WHERE REPLACE(REPLACE(REPLACE(tax_id, '-', ''), '.', ''), ' ', '') = ?
           AND is_active = 1
         ORDER BY name
         LIMIT 5`,
        [normalizedTaxId]
      );
      rows.forEach(pushCandidate);
    }

    if (parsed.supplier_name) {
      const namePattern = `%${parsed.supplier_name}%`;
      const rows = await executeQuery(
        `SELECT id, name FROM suppliers
         WHERE (name LIKE ? OR legal_name LIKE ? OR trade_name LIKE ?)
           AND is_active = 1
         ORDER BY
           CASE
             WHEN name LIKE ? THEN 0
             WHEN legal_name LIKE ? THEN 1
             ELSE 2
           END,
           name
         LIMIT 8`,
        [namePattern, namePattern, namePattern, namePattern, namePattern]
      );
      rows.forEach(pushCandidate);

      const tokens = parsed.supplier_name
        .split(/[\s./-]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3);
      for (const token of tokens.slice(0, 3)) {
        const tokenRows = await executeQuery(
          `SELECT id, name FROM suppliers
           WHERE (name LIKE ? OR legal_name LIKE ? OR trade_name LIKE ? OR code LIKE ?)
             AND is_active = 1
           ORDER BY name
           LIMIT 5`,
          [`%${token}%`, `%${token}%`, `%${token}%`, `%${token}%`]
        );
        tokenRows.forEach(pushCandidate);
      }
    }

    if (/invid|jukebox/i.test(parsed.supplier_name ?? '')) {
      const rows = await executeQuery(
        `SELECT id, name FROM suppliers
         WHERE (name LIKE '%INVID%' OR name LIKE '%JUKEBOX%' OR code LIKE '%INVID%')
           AND is_active = 1
         ORDER BY name
         LIMIT 5`
      );
      rows.forEach(pushCandidate);
    }

    const top = candidates[0];
    return {
      supplier_id: top?.id,
      supplier_name: top?.name,
      candidates: candidates.slice(0, 8),
    };
  }

  private async suggestPurchase(
    supplierId: number,
    parsed: ParsedPurchaseDocument
  ): Promise<{ purchase_id?: number; purchase_number?: string }> {
    const rows = await executeQuery(
      `SELECT id, purchase_number
       FROM purchases
       WHERE supplier_id = ? AND status IN ('pending', 'received')
       ORDER BY purchase_date DESC
       LIMIT 1`,
      [supplierId]
    );
    if (rows[0]) {
      return { purchase_id: rows[0].id, purchase_number: rows[0].purchase_number };
    }
    return {};
  }

  private async matchItems(
    parsed: ParsedPurchaseDocument,
    supplierId?: number
  ): Promise<MatchedPurchaseDocumentItem[]> {
    const results: MatchedPurchaseDocumentItem[] = [];

    for (const item of parsed.items) {
      const warnings: string[] = [];
      let productId: number | undefined;
      let productName: string | undefined;
      let productCode: string | undefined;
      let currentStock: number | undefined;
      let matchMethod: MatchedPurchaseDocumentItem['match_method'];
      let purchaseItemId: number | undefined;
      let expectedQuantity: number | undefined;
      let pendingQuantity: number | undefined;
      let expectedUnitCost: number | undefined;

      if (item.barcode) {
        const byBarcode = await this.productRepository.findByBarcode(item.barcode);
        if (byBarcode) {
          productId = byBarcode.id;
          productName = byBarcode.name;
          productCode = byBarcode.code;
          currentStock = byBarcode.stock;
          matchMethod = 'barcode';
        }
      }

      if (!productId && item.material_code) {
        const byMaterial = await executeQuery(
          `SELECT p.id, p.name, p.code, p.stock
           FROM products p
           WHERE p.code = ? OR p.barcode = ?
           LIMIT 1`,
          [item.material_code, item.material_code]
        );
        if (byMaterial[0]) {
          productId = byMaterial[0].id;
          productName = byMaterial[0].name;
          productCode = byMaterial[0].code;
          currentStock = byMaterial[0].stock;
          matchMethod = 'material_code';
        }
      }

      if (!productId && item.supplier_product_code) {
        const byCode = await this.productRepository.findByCode(item.supplier_product_code);
        if (byCode) {
          productId = byCode.id;
          productName = byCode.name;
          productCode = byCode.code;
          currentStock = byCode.stock;
          matchMethod = 'product_code';
        }
      }

      if (supplierId && item.material_code) {
        const purchaseItemRows = await executeQuery(
          `SELECT pi.id, pi.quantity, pi.received_quantity, pi.unit_cost, pi.unit_price,
                  (pi.quantity - pi.received_quantity) AS pending_quantity
           FROM purchase_items pi
           JOIN purchases pur ON pur.id = pi.purchase_id
           WHERE pur.supplier_id = ?
             AND pur.status IN ('pending', 'received')
             AND (pi.material_code = ? OR pi.product_id = ?)
           ORDER BY pur.purchase_date DESC
           LIMIT 1`,
          [supplierId, item.material_code, productId ?? 0]
        );
        if (purchaseItemRows[0]) {
          purchaseItemId = purchaseItemRows[0].id;
          expectedQuantity = Number(purchaseItemRows[0].quantity);
          pendingQuantity = Number(purchaseItemRows[0].pending_quantity);
          expectedUnitCost = Number(purchaseItemRows[0].unit_cost ?? purchaseItemRows[0].unit_price ?? 0) || undefined;

          if (item.quantity > (pendingQuantity ?? 0)) {
            warnings.push(
              `Cantidad recibida (${item.quantity}) supera lo pendiente en OC (${pendingQuantity ?? 0}).`
            );
          }
        }
      }

      let matchStatus: MatchedPurchaseDocumentItem['match_status'] = 'unmatched';
      if (productId && purchaseItemId) matchStatus = 'matched';
      else if (productId || purchaseItemId) matchStatus = 'partial';

      if (!productId) {
        warnings.push('Producto no encontrado en el catálogo. Asigne uno manualmente o créelo antes de actualizar stock.');
      }

      const costVariance =
        expectedUnitCost != null && expectedUnitCost > 0
          ? undefined
          : undefined;

      results.push({
        ...item,
        product_id: productId,
        product_name: productName,
        product_code: productCode,
        current_stock: currentStock,
        purchase_item_id: purchaseItemId,
        expected_quantity: expectedQuantity,
        pending_quantity: pendingQuantity,
        expected_unit_cost: expectedUnitCost,
        cost_variance: costVariance,
        match_status: matchStatus,
        match_method: matchMethod,
        warnings,
      });
    }

    return results;
  }

  async rematchItems(
    fileToken: string,
    supplierId: number
  ): Promise<MatchedPurchaseDocumentItem[]> {
    const [docRow] = await executeQuery(
      `SELECT parsed_payload FROM purchase_supplier_documents WHERE file_token = ? LIMIT 1`,
      [fileToken]
    );
    if (!docRow) {
      throw new Error('Documento no encontrado. Vuelva a subir el archivo.');
    }

    const parsed =
      typeof docRow.parsed_payload === 'string'
        ? JSON.parse(docRow.parsed_payload)
        : docRow.parsed_payload;

    return this.matchItems(parsed, supplierId);
  }

  async confirmDocument(
    input: ConfirmPurchaseDocumentInput,
    userId?: number
  ): Promise<ConfirmPurchaseDocumentResult> {
    const [docRow] = await executeQuery(
      `SELECT id, stored_path, parsed_payload, source_provider, delivery_note_id
       FROM purchase_supplier_documents WHERE file_token = ? LIMIT 1`,
      [input.file_token]
    );
    if (!docRow) {
      throw new Error('Documento no encontrado. Vuelva a subir el archivo.');
    }
    if (docRow.delivery_note_id) {
      throw new Error('Este documento ya fue procesado anteriormente.');
    }

    const existingNote = await this.deliveryNoteRepository.getDeliveryNoteByNumber(input.delivery_note_number);
    if (existingNote) {
      throw new Error(`Ya existe un remito con el número ${input.delivery_note_number}`);
    }

    const supplier = await this.purchaseRepository.getSupplierById(input.supplier_id);
    if (!supplier) {
      throw new Error('Proveedor no encontrado');
    }

    const parsedPayload =
      typeof docRow.parsed_payload === 'string'
        ? JSON.parse(docRow.parsed_payload)
        : docRow.parsed_payload;

    const connection = await getConnection();
    const warnings: string[] = [];
    const stockUpdates: ConfirmPurchaseDocumentResult['stock_updates'] = [];
    const costUpdates: ConfirmPurchaseDocumentResult['cost_updates'] = [];

    try {
      await connection.beginTransaction();

      let purchaseId = input.purchase_id;
      let purchaseNumber: string;

      if (!purchaseId && input.create_purchase_if_missing) {
        const purchase = await this.purchaseRepository.createPurchase({
          supplier_id: input.supplier_id,
          status: PurchaseStatus.PENDING,
          purchase_date: input.delivery_date,
          notes: `Generada desde remito ${input.delivery_note_number}`,
          items: [],
        });
        purchaseId = purchase.id;
        purchaseNumber = purchase.purchase_number;

        for (const item of input.items) {
          if (!item.product_id) continue;
          await executeQuery(
            `INSERT INTO purchase_items (purchase_id, product_id, material_code, quantity, received_quantity, unit_price, unit_cost, total_price)
             VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
            [
              purchaseId,
              item.product_id,
              item.material_code,
              item.quantity,
              item.unit_cost ?? 0,
              item.unit_cost ?? null,
              (item.unit_cost ?? 0) * item.quantity,
            ],
            connection
          );
        }

        await executeQuery(
          `UPDATE purchases SET total_amount = (
             SELECT COALESCE(SUM(total_price), 0) FROM purchase_items WHERE purchase_id = ?
           ) WHERE id = ?`,
          [purchaseId, purchaseId],
          connection
        );
      } else if (purchaseId) {
        const purchase = await this.purchaseRepository.getPurchaseById(purchaseId);
        if (!purchase) throw new Error('Orden de compra no encontrada');
        purchaseNumber = purchase.purchase_number;
      } else {
        throw new Error('Debe seleccionar una orden de compra o habilitar la creación automática.');
      }

      const insertNoteQuery = `
        INSERT INTO supplier_delivery_notes (
          delivery_note_number, supplier_id, purchase_id, delivery_date, notes,
          source_file_path, source_provider, source_invoice_number, insured_value,
          parsed_payload, received_by, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'complete')
      `;

      const noteResult = await executeQuery(
        insertNoteQuery,
        [
          input.delivery_note_number,
          input.supplier_id,
          purchaseId,
          input.delivery_date,
          input.notes ?? null,
          docRow.stored_path,
          docRow.source_provider ?? parsedPayload?.provider ?? null,
          input.source_invoice_number ?? parsedPayload?.source_invoice_number ?? null,
          input.insured_value ?? parsedPayload?.insured_value ?? null,
          JSON.stringify(parsedPayload),
          userId ?? null,
        ],
        connection
      );

      const deliveryNoteId = noteResult.insertId;

      for (const item of input.items) {
        await executeQuery(
          `INSERT INTO supplier_delivery_note_items (
            delivery_note_id, material_code, product_id, quantity, purchase_item_id
          ) VALUES (?, ?, ?, ?, ?)`,
          [
            deliveryNoteId,
            item.material_code,
            item.product_id ?? null,
            item.quantity,
            item.purchase_item_id ?? null,
          ],
          connection
        );

        if (item.purchase_item_id) {
          await executeQuery(
            `UPDATE purchase_items
             SET received_quantity = received_quantity + ?
             WHERE id = ?`,
            [item.quantity, item.purchase_item_id],
            connection
          );
        }

        if (item.update_cost && item.unit_cost != null && item.purchase_item_id) {
          await executeQuery(
            `UPDATE purchase_items SET unit_cost = ? WHERE id = ?`,
            [item.unit_cost, item.purchase_item_id],
            connection
          );
          if (item.product_id) {
            costUpdates.push({
              product_id: item.product_id,
              purchase_item_id: item.purchase_item_id,
              unit_cost: item.unit_cost,
            });
          }
        }

        const shouldUpdateStock = input.apply_stock && (item.update_stock ?? true) && item.product_id;
        if (shouldUpdateStock) {
          const updatedProduct = await this.productRepository.updateStock(
            item.product_id!,
            item.quantity,
            'add'
          );

          await executeQuery(
            `INSERT INTO stock_movements (
              product_id, movement_type, reference_number, reference_type,
              quantity, unit_cost, total_cost, notes, created_by
            ) VALUES (?, 'entrada_compra', ?, 'delivery_note', ?, ?, ?, ?, ?)`,
            [
              item.product_id,
              input.delivery_note_number,
              item.quantity,
              item.unit_cost ?? null,
              item.unit_cost != null ? item.unit_cost * item.quantity : null,
              `Ingreso por remito proveedor ${input.delivery_note_number}`,
              userId ?? null,
            ],
            connection
          );

          stockUpdates.push({
            product_id: item.product_id!,
            product_name: updatedProduct.name,
            quantity_added: item.quantity,
            new_stock: updatedProduct.stock,
          });
        } else if (input.apply_stock && !item.product_id) {
          warnings.push(`Sin stock actualizado para "${item.description}" (producto no vinculado).`);
        }
      }

      if (input.apply_stock) {
        await executeQuery(
          `UPDATE supplier_delivery_notes SET stock_applied_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [deliveryNoteId],
          connection
        );
      }

      await executeQuery(
        `UPDATE purchases SET status = 'received', received_date = COALESCE(received_date, ?) WHERE id = ?`,
        [input.delivery_date, purchaseId],
        connection
      );

      await executeQuery(
        `UPDATE purchase_supplier_documents SET delivery_note_id = ? WHERE id = ?`,
        [deliveryNoteId, docRow.id],
        connection
      );

      await connection.commit();

      return {
        delivery_note_id: deliveryNoteId,
        delivery_note_number: input.delivery_note_number,
        purchase_id: purchaseId!,
        purchase_number: purchaseNumber!,
        stock_updates: stockUpdates,
        cost_updates: costUpdates,
        warnings,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getSourcePdfForPurchase(
    purchaseId: number
  ): Promise<{ buffer: Buffer; filename: string } | null> {
    const [row] = await executeQuery(
      `SELECT sdn.source_file_path, sdn.delivery_note_number, psd.original_filename
       FROM supplier_delivery_notes sdn
       LEFT JOIN purchase_supplier_documents psd ON psd.delivery_note_id = sdn.id
       WHERE sdn.purchase_id = ?
         AND sdn.source_file_path IS NOT NULL
         AND TRIM(sdn.source_file_path) != ''
       ORDER BY sdn.created_at DESC
       LIMIT 1`,
      [purchaseId]
    );

    const sourcePath = row?.source_file_path as string | undefined;
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      return null;
    }

    const deliveryNoteNumber = row?.delivery_note_number as string | undefined;
    const originalFilename = row?.original_filename as string | undefined;
    const filename =
      originalFilename ||
      (deliveryNoteNumber ? `remito-${deliveryNoteNumber}.pdf` : `documento-compra-${purchaseId}.pdf`);

    return {
      buffer: readStoredPdf(sourcePath),
      filename,
    };
  }
}
