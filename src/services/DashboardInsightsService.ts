import { executeQuery } from '../config/database';

const DEFAULT_TZ = 'America/Argentina/Buenos_Aires';
const OPEN_REPAIR_STATUSES = [
  'consulta_recibida',
  'presupuestado',
  'aceptado',
  'en_proceso_reparacion',
  'listo_entrega'
] as const;

export interface DashboardInsightsPeriod {
  date_from: string;
  date_to: string;
}

export interface DashboardTopProductByUnitPrice {
  product_id: number | null;
  product_name: string;
  unit_price: number;
  source: 'pos' | 'woocommerce';
  reference_type: string;
  reference_id: number;
  reference_label: string;
}

export interface DashboardTopRepairOrder {
  id: number;
  repair_number: string;
  client_id: number;
  client_name: string;
  total_amount: number;
  status: string;
  reception_date: string;
}

export interface DashboardTopClient {
  client_id: number | null;
  client_name: string;
  total_amount: number;
  from_pos: number;
  from_orders: number;
  from_repairs: number;
}

export interface DashboardInsightAlert {
  id: string;
  severity: 'info' | 'warning' | 'danger';
  title: string;
  count: number;
  href: string;
}

export interface DashboardRepairPipeline {
  by_status: Record<string, number>;
  open_count: number;
  month_average_ticket: number;
  amount_in_workshop: number;
}

export interface DashboardInsightsData {
  period: DashboardInsightsPeriod;
  highlights: {
    top_product_by_unit_price: DashboardTopProductByUnitPrice | null;
    top_repair_order: DashboardTopRepairOrder | null;
    top_client: DashboardTopClient | null;
  };
  alerts: DashboardInsightAlert[];
  repair_pipeline: DashboardRepairPipeline;
}

function ymdInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function parseYmd(ymd: string): { year: number; month: number; day: number } {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10));
  return { year: y, month: m, day: d };
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function resolveInsightsPeriod(
  dateFrom?: string,
  dateTo?: string,
  timezone = DEFAULT_TZ
): DashboardInsightsPeriod {
  const todayYmd = ymdInTimezone(new Date(), timezone);
  const { year, month } = parseYmd(todayYmd);
  const defaultFrom = `${year}-${String(month).padStart(2, '0')}-01`;
  const defaultTo = `${year}-${String(month).padStart(2, '0')}-${String(lastDayOfMonth(year, month)).padStart(2, '0')}`;

  const from = (dateFrom || defaultFrom).trim();
  const to = (dateTo || defaultTo).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error('date_from y date_to deben tener formato YYYY-MM-DD');
  }
  if (from > to) {
    throw new Error('date_from no puede ser posterior a date_to');
  }

  return { date_from: from, date_to: to };
}

function mapRow<T>(rows: unknown): T | null {
  if (!rows) return null;
  if (Array.isArray(rows)) return (rows[0] as T) ?? null;
  return rows as T;
}

export class DashboardInsightsService {
  async getInsights(
    dateFrom?: string,
    dateTo?: string,
    timezone?: string
  ): Promise<DashboardInsightsData> {
    const period = resolveInsightsPeriod(dateFrom, dateTo, timezone || DEFAULT_TZ);
    const { date_from, date_to } = period;

    const [
      topProduct,
      topRepair,
      topClient,
      alerts,
      repairPipeline
    ] = await Promise.all([
      this.fetchTopProductByUnitPrice(date_from, date_to),
      this.fetchTopRepairOrder(date_from, date_to),
      this.fetchTopClient(date_from, date_to),
      this.fetchAlerts(),
      this.fetchRepairPipeline(date_from, date_to)
    ]);

    return {
      period,
      highlights: {
        top_product_by_unit_price: topProduct,
        top_repair_order: topRepair,
        top_client: topClient
      },
      alerts,
      repair_pipeline: repairPipeline
    };
  }

  private async fetchTopProductByUnitPrice(
    dateFrom: string,
    dateTo: string
  ): Promise<DashboardTopProductByUnitPrice | null> {
    const rows = (await executeQuery(
      `SELECT * FROM (
        SELECT
          si.product_id,
          COALESCE(p.name, si.description, 'Ítem') AS product_name,
          si.unit_price,
          'pos' AS source,
          'sale' AS reference_type,
          s.id AS reference_id,
          s.sale_number AS reference_label,
          s.sale_date AS sort_date
        FROM sale_items si
        INNER JOIN sales s ON s.id = si.sale_id
        LEFT JOIN products p ON p.id = si.product_id
        WHERE DATE(s.sale_date) >= ? AND DATE(s.sale_date) <= ?

        UNION ALL

        SELECT
          oi.product_id,
          COALESCE(p.name, 'Ítem') AS product_name,
          oi.unit_price,
          'woocommerce' AS source,
          'order' AS reference_type,
          o.id AS reference_id,
          o.order_number AS reference_label,
          o.order_date AS sort_date
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE DATE(o.order_date) >= ? AND DATE(o.order_date) <= ?
          AND o.status NOT IN ('cancelado', 'cancelled')
      ) priced_lines
      ORDER BY unit_price DESC, sort_date DESC
      LIMIT 1`,
      [dateFrom, dateTo, dateFrom, dateTo]
    )) as any[];

    const row = mapRow<any>(rows);
    if (!row) return null;

    const unitPrice = Number(row.unit_price);
    const name = String(row.product_name || '').trim();
    if (!name || !Number.isFinite(unitPrice) || unitPrice <= 0) return null;

    return {
      product_id: row.product_id != null ? Number(row.product_id) : null,
      product_name: name,
      unit_price: unitPrice,
      source: row.source === 'woocommerce' ? 'woocommerce' : 'pos',
      reference_type: String(row.reference_type || ''),
      reference_id: Number(row.reference_id),
      reference_label: String(row.reference_label || '')
    };
  }

  private async fetchTopRepairOrder(
    dateFrom: string,
    dateTo: string
  ): Promise<DashboardTopRepairOrder | null> {
    const rows = (await executeQuery(
      `SELECT
        ro.id,
        ro.repair_number,
        ro.client_id,
        c.name AS client_name,
        ro.total_amount,
        ro.status,
        ro.reception_date
       FROM repair_orders ro
       LEFT JOIN clients c ON c.id = ro.client_id
       WHERE DATE(ro.reception_date) >= ? AND DATE(ro.reception_date) <= ?
         AND ro.status != 'cancelado'
       ORDER BY ro.total_amount DESC, ro.reception_date DESC, ro.id DESC
       LIMIT 1`,
      [dateFrom, dateTo]
    )) as any[];

    const row = mapRow<any>(rows);
    if (!row?.id) return null;

    return {
      id: Number(row.id),
      repair_number: String(row.repair_number),
      client_id: Number(row.client_id),
      client_name: String(row.client_name || `Cliente #${row.client_id}`),
      total_amount: Number(row.total_amount),
      status: String(row.status),
      reception_date:
        row.reception_date instanceof Date
          ? row.reception_date.toISOString().slice(0, 10)
          : String(row.reception_date).slice(0, 10)
    };
  }

  private async fetchTopClient(
    dateFrom: string,
    dateTo: string
  ): Promise<DashboardTopClient | null> {
    const totalsRows = (await executeQuery(
      `SELECT client_id, SUM(amount) AS total_amount
       FROM (
         SELECT client_id, total_amount AS amount
         FROM sales
         WHERE client_id IS NOT NULL
           AND DATE(sale_date) >= ? AND DATE(sale_date) <= ?
         UNION ALL
         SELECT client_id, total_amount AS amount
         FROM orders
         WHERE client_id IS NOT NULL
           AND DATE(order_date) >= ? AND DATE(order_date) <= ?
           AND status NOT IN ('cancelado', 'cancelled')
         UNION ALL
         SELECT client_id, total_amount AS amount
         FROM repair_orders
         WHERE client_id IS NOT NULL
           AND DATE(reception_date) >= ? AND DATE(reception_date) <= ?
           AND status != 'cancelado'
       ) combined
       GROUP BY client_id
       ORDER BY total_amount DESC
       LIMIT 1`,
      [dateFrom, dateTo, dateFrom, dateTo, dateFrom, dateTo]
    )) as any[];

    const winner = mapRow<{ client_id: number; total_amount: number }>(totalsRows);
    if (!winner?.client_id) return null;

    const clientId = Number(winner.client_id);

    const [nameRow] = (await executeQuery(`SELECT name FROM clients WHERE id = ?`, [clientId])) as any[];

    const breakdownRows = (await executeQuery(
      `SELECT
        COALESCE((
          SELECT SUM(total_amount) FROM sales
          WHERE client_id = ? AND DATE(sale_date) >= ? AND DATE(sale_date) <= ?
        ), 0) AS from_pos,
        COALESCE((
          SELECT SUM(total_amount) FROM orders
          WHERE client_id = ? AND DATE(order_date) >= ? AND DATE(order_date) <= ?
            AND status NOT IN ('cancelado', 'cancelled')
        ), 0) AS from_orders,
        COALESCE((
          SELECT SUM(total_amount) FROM repair_orders
          WHERE client_id = ? AND DATE(reception_date) >= ? AND DATE(reception_date) <= ?
            AND status != 'cancelado'
        ), 0) AS from_repairs`,
      [clientId, dateFrom, dateTo, clientId, dateFrom, dateTo, clientId, dateFrom, dateTo]
    )) as any[];

    const b = breakdownRows?.[0] ?? breakdownRows ?? {};
    const fromPos = Number(b.from_pos || 0);
    const fromOrders = Number(b.from_orders || 0);
    const fromRepairs = Number(b.from_repairs || 0);

    return {
      client_id: clientId,
      client_name: String(nameRow?.name || `Cliente #${clientId}`),
      total_amount: fromPos + fromOrders + fromRepairs,
      from_pos: fromPos,
      from_orders: fromOrders,
      from_repairs: fromRepairs
    };
  }

  private async fetchAlerts(): Promise<DashboardInsightAlert[]> {
    const alerts: DashboardInsightAlert[] = [];

    const [overdueRow] = (await executeQuery(
      `SELECT COUNT(*) AS cnt FROM repair_orders
       WHERE delivery_date_estimated IS NOT NULL
         AND delivery_date_estimated < CURDATE()
         AND status NOT IN ('entregado', 'cancelado')`
    )) as any[];
    const overdueCount = Number(overdueRow?.cnt || 0);
    if (overdueCount > 0) {
      alerts.push({
        id: 'repairs_overdue_delivery',
        severity: 'warning',
        title: 'Reparaciones con retiro vencido',
        count: overdueCount,
        href: '/reparaciones?filter=overdue'
      });
    }

    const [lowStockRow] = (await executeQuery(
      `SELECT COUNT(*) AS cnt FROM products
       WHERE is_active = 1 AND stock > 0 AND stock <= min_stock`
    )) as any[];
    const lowStockCount = Number(lowStockRow?.cnt || 0);
    if (lowStockCount > 0) {
      alerts.push({
        id: 'products_low_stock',
        severity: 'warning',
        title: 'Productos bajo stock mínimo',
        count: lowStockCount,
        href: '/productos?stock=low'
      });
    }

    const [pendingOrdersRow] = (await executeQuery(
      `SELECT COUNT(*) AS cnt FROM orders WHERE status = 'pendiente_preparacion'`
    )) as any[];
    const pendingOrdersCount = Number(pendingOrdersRow?.cnt || 0);
    if (pendingOrdersCount > 0) {
      alerts.push({
        id: 'orders_pending_preparation',
        severity: 'info',
        title: 'Pedidos pendientes de preparación',
        count: pendingOrdersCount,
        href: '/pedidos?status=pendiente_preparacion'
      });
    }

    const [pendingSyncRow] = (await executeQuery(
      `SELECT COUNT(*) AS cnt FROM sales
       WHERE sync_status = 'pending' OR arca_status = 'pending'`
    )) as any[];
    const pendingSyncCount = Number(pendingSyncRow?.cnt || 0);
    if (pendingSyncCount > 0) {
      alerts.push({
        id: 'pos_pending_arca_sync',
        severity: 'info',
        title: 'Ventas POS pendientes de sincronizar con ARCA',
        count: pendingSyncCount,
        href: '/ventas?sync=pending'
      });
    }

    return alerts;
  }

  private async fetchRepairPipeline(
    dateFrom: string,
    dateTo: string
  ): Promise<DashboardRepairPipeline> {
    const statusRows = (await executeQuery(
      `SELECT status, COUNT(*) AS cnt
       FROM repair_orders
       WHERE status NOT IN ('entregado', 'cancelado')
       GROUP BY status`
    )) as any[];

    const by_status: Record<string, number> = {};
    for (const status of OPEN_REPAIR_STATUSES) {
      by_status[status] = 0;
    }
    for (const row of statusRows || []) {
      const st = String(row.status);
      by_status[st] = Number(row.cnt || 0);
    }

    const open_count = Object.values(by_status).reduce((s, n) => s + n, 0);

    const [avgRow] = (await executeQuery(
      `SELECT COALESCE(AVG(total_amount), 0) AS avg_ticket
       FROM repair_orders
       WHERE DATE(reception_date) >= ? AND DATE(reception_date) <= ?
         AND status != 'cancelado'`,
      [dateFrom, dateTo]
    )) as any[];

    const [workshopRow] = (await executeQuery(
      `SELECT COALESCE(SUM(total_amount), 0) AS amount
       FROM repair_orders
       WHERE status NOT IN ('entregado', 'cancelado')`
    )) as any[];

    return {
      by_status,
      open_count,
      month_average_ticket: Math.round(Number(avgRow?.avg_ticket || 0) * 100) / 100,
      amount_in_workshop: Number(workshopRow?.amount || 0)
    };
  }
}
