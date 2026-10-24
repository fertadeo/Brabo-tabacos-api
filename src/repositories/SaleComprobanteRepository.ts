import Database from '../config/database';
import { executeQuery } from '../config/database';
import type {
  CreateSaleComprobanteData,
  SaleComprobante,
  SaleComprobanteItemSnapshot
} from '../entities/SaleComprobante';

function parseJson<T>(raw: unknown): T | null {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  return null;
}

function mapRow(row: Record<string, unknown>): SaleComprobante {
  return {
    id: Number(row.id),
    sale_id: Number(row.sale_id),
    sequence: Number(row.sequence),
    kind: row.kind as SaleComprobante['kind'],
    status: row.status as SaleComprobante['status'],
    factura_id: (row.factura_id as string | null) ?? null,
    cae: (row.cae as string | null) ?? null,
    cae_vto: row.cae_vto != null ? String(row.cae_vto).slice(0, 10) : null,
    tipo: row.tipo != null ? Number(row.tipo) : null,
    punto_venta: row.punto_venta != null ? Number(row.punto_venta) : null,
    numero: row.numero != null ? Number(row.numero) : null,
    cuit_emisor: (row.cuit_emisor as string | null) ?? null,
    fecha_emision: row.fecha_emision != null ? String(row.fecha_emision).slice(0, 10) : null,
    qr_url: (row.qr_url as string | null) ?? null,
    idempotency_key: (row.idempotency_key as string | null) ?? null,
    motivo: (row.motivo as string | null) ?? null,
    observaciones: (row.observaciones as string | null) ?? null,
    related_comprobante_id: row.related_comprobante_id != null ? Number(row.related_comprobante_id) : null,
    request_json: parseJson<Record<string, unknown>>(row.request_json),
    response_json: parseJson<Record<string, unknown>>(row.response_json),
    items_json: parseJson<SaleComprobanteItemSnapshot[]>(row.items_json),
    error_code: (row.error_code as string | null) ?? null,
    error_message: (row.error_message as string | null) ?? null,
    emitted_at: row.emitted_at != null ? String(row.emitted_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at)
  };
}

export class SaleComprobanteRepository {
  private db: typeof Database;

  constructor() {
    this.db = Database;
  }

  private toNull(value: unknown): unknown {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    return value;
  }

  async listBySaleId(saleId: number): Promise<SaleComprobante[]> {
    const rows = (await executeQuery(
      `SELECT * FROM sale_comprobantes WHERE sale_id = ? ORDER BY sequence ASC, id ASC`,
      [saleId]
    )) as Record<string, unknown>[];
    return (rows || []).map(mapRow);
  }

  async listBySaleIds(saleIds: number[]): Promise<Map<number, SaleComprobante[]>> {
    const map = new Map<number, SaleComprobante[]>();
    const unique = [...new Set(saleIds.filter((id) => Number.isFinite(id) && id > 0))];
    if (!unique.length) return map;

    const placeholders = unique.map(() => '?').join(', ');
    const rows = (await executeQuery(
      `SELECT * FROM sale_comprobantes
       WHERE sale_id IN (${placeholders})
       ORDER BY sale_id ASC, sequence ASC, id ASC`,
      unique
    )) as Record<string, unknown>[];

    for (const raw of rows || []) {
      const row = mapRow(raw);
      const list = map.get(row.sale_id) ?? [];
      list.push(row);
      map.set(row.sale_id, list);
    }
    return map;
  }

  async findBySaleAndCae(saleId: number, cae: string): Promise<SaleComprobante | null> {
    const trimmed = cae.trim();
    if (!trimmed) return null;
    const rows = (await executeQuery(
      `SELECT * FROM sale_comprobantes WHERE sale_id = ? AND cae = ? LIMIT 1`,
      [saleId, trimmed]
    )) as Record<string, unknown>[];
    return rows?.[0] ? mapRow(rows[0]) : null;
  }

  async nextSequence(saleId: number): Promise<number> {
    const rows = (await executeQuery(
      `SELECT COALESCE(MAX(sequence), 0) + 1 AS next_seq FROM sale_comprobantes WHERE sale_id = ?`,
      [saleId]
    )) as Array<{ next_seq: number }>;
    return Number(rows?.[0]?.next_seq) || 1;
  }

  async insertIfNew(data: CreateSaleComprobanteData): Promise<SaleComprobante | null> {
    const cae = typeof data.cae === 'string' ? data.cae.trim() : '';
    if (!cae) return null;

    const existing = await this.findBySaleAndCae(data.sale_id, cae);
    if (existing) return existing;

    const sequence = await this.nextSequence(data.sale_id);
    const connection = await this.db.getConnection();
    try {
      const [result] = (await connection.execute(
        `INSERT INTO sale_comprobantes (
          sale_id, sequence, kind, status,
          factura_id, cae, cae_vto, tipo, punto_venta, numero,
          cuit_emisor, fecha_emision, qr_url, idempotency_key,
          motivo, observaciones, related_comprobante_id,
          request_json, response_json, items_json,
          error_code, error_message, emitted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.sale_id,
          sequence,
          data.kind,
          data.status ?? 'success',
          this.toNull(data.factura_id),
          cae,
          this.toNull(data.cae_vto),
          this.toNull(data.tipo),
          this.toNull(data.punto_venta),
          this.toNull(data.numero),
          this.toNull(data.cuit_emisor),
          this.toNull(data.fecha_emision),
          this.toNull(data.qr_url),
          this.toNull(data.idempotency_key),
          this.toNull(data.motivo),
          this.toNull(data.observaciones),
          this.toNull(data.related_comprobante_id),
          data.request_json ? JSON.stringify(data.request_json) : null,
          data.response_json ? JSON.stringify(data.response_json) : null,
          data.items_json ? JSON.stringify(data.items_json) : null,
          this.toNull(data.error_code),
          this.toNull(data.error_message),
          this.toNull(data.emitted_at) ?? new Date()
        ]
      )) as { insertId: number }[];

      const insertId = (result as { insertId: number })?.insertId;
      if (!insertId) {
        return this.findBySaleAndCae(data.sale_id, cae);
      }
      const rows = (await connection.execute(
        `SELECT * FROM sale_comprobantes WHERE id = ? LIMIT 1`,
        [insertId]
      )) as unknown as [Record<string, unknown>[]];
      return rows[0]?.[0] ? mapRow(rows[0][0]) : this.findBySaleAndCae(data.sale_id, cae);
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === 'ER_DUP_ENTRY') {
        return this.findBySaleAndCae(data.sale_id, cae);
      }
      throw error;
    } finally {
      connection.release();
    }
  }
}
