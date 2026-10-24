import { Request, Response } from 'express';
import { executeQuery } from '../config/database';
import { clampSqlLimit, clampSqlOffset } from '../utils/sqlLimit';

export class CashController {
  public async getDaySummary(req: Request, res: Response): Promise<void> {
    try {
      const date = (req.query.date as string) || null;

      const incomeQuery = `
        SELECT COALESCE(SUM(total_amount), 0) as incomes
        FROM orders
        WHERE status NOT IN ('cancelado','cancelled') AND DATE(order_date) = COALESCE(?, CURDATE())
      `;

      const expenseQuery = `
        SELECT COALESCE(SUM(total_amount), 0) as expenses
        FROM purchases
        WHERE status != 'cancelled' AND DATE(purchase_date) = COALESCE(?, CURDATE())
      `;

      const [incomeRow] = await executeQuery(incomeQuery, [date]);
      const [expenseRow] = await executeQuery(expenseQuery, [date]);

      const incomes = incomeRow?.incomes || 0;
      const expenses = expenseRow?.expenses || 0;

      res.status(200).json({
        success: true,
        message: 'Day cash summary',
        data: {
          date: date || new Date().toISOString().slice(0, 10),
          incomes,
          expenses,
          balance: incomes - expenses
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error retrieving day summary', error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() });
    }
  }

  // ===============================================
  // MÉTODOS DE PAGO: distribución por método
  // GET /api/cash/payment-methods?from=YYYY-MM-DD&to=YYYY-MM-DD
  // Si no se envía, últimos 30 días
  public async getPaymentMethods(req: Request, res: Response): Promise<void> {
    try {
      const from = (req.query.from as string) || null;
      const to = (req.query.to as string) || null;

      const query = `
        SELECT method, COALESCE(SUM(amount),0) as total
        FROM payments
        WHERE type = 'income'
          AND ( ( ? IS NULL AND DATE(payment_date) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) ) OR ( ? IS NOT NULL ) )
          AND ( ? IS NULL OR DATE(payment_date) BETWEEN ? AND ? )
        GROUP BY method
      `;

      const rows = await executeQuery(query, [from, from, from, from, to]);
      const total = rows.reduce((acc: number, r: any) => acc + Number(r.total || 0), 0);
      const distribution = rows.map((r: any) => ({
        method: r.method,
        total: Number(r.total || 0),
        percentage: total > 0 ? Number((Number(r.total || 0) / total * 100).toFixed(2)) : 0
      }));

      res.status(200).json({
        success: true,
        message: 'Payment methods distribution',
        data: { total, distribution },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error retrieving payment methods', error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() });
    }
  }

  // ===============================================
  // EGRESOS OPERATIVOS: listar y crear
  // GET /api/cash/expenses?from&to&category&status&limit&page
  public async listExpenses(req: Request, res: Response): Promise<void> {
    try {
      const from = (req.query.from as string) || null;
      const to = (req.query.to as string) || null;
      const category = (req.query.category as string) || null;
      const status = (req.query.status as string) || 'registrado';
      const limit = clampSqlLimit(req.query.limit, 20, 100);
      const pageRaw = parseInt(String(req.query.page ?? '1'), 10);
      const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
      const offset = (page - 1) * limit;

      const whereParts: string[] = [];
      const params: any[] = [];
      if (from && to) { whereParts.push('DATE(expense_date) BETWEEN ? AND ?'); params.push(from, to); }
      if (category) { whereParts.push('category = ?'); params.push(category); }
      if (status) { whereParts.push('status = ?'); params.push(status); }
      const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

      const countSql = `SELECT COUNT(*) as total FROM expenses ${where}`;
      const [countRow] = await executeQuery(countSql, params);
      const total = countRow?.total || 0;

      const dataSql = `
        SELECT id, concept, category, method, amount, expense_date, status, notes
        FROM expenses
        ${where}
        ORDER BY expense_date DESC
        LIMIT ${limit} OFFSET ${offset}`;

      const items = await executeQuery(dataSql, params);

      res.status(200).json({
        success: true,
        message: 'Expenses list',
        data: items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error retrieving expenses', error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() });
    }
  }

  // POST /api/cash/expenses
  public async createExpense(req: Request, res: Response): Promise<void> {
    try {
      const { concept, category, method, amount, expense_date, notes } = req.body || {};
      if (!concept || !amount) {
        res.status(400).json({ success: false, message: 'concept and amount are required', timestamp: new Date().toISOString() });
        return;
      }

      const sql = `
        INSERT INTO expenses (concept, category, method, amount, expense_date, notes, created_by)
        VALUES (?, ?, ?, ?, COALESCE(?, NOW()), ?, NULL)
      `;
      await executeQuery(sql, [concept, category || 'otros', method || 'efectivo', amount, expense_date || null, notes || null]);

      res.status(201).json({ success: true, message: 'Expense created', timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error creating expense', error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() });
    }
  }

  // ===============================================
  // EXPORTACIONES CSV
  // GET /api/cash/export/movements?from&to
  public async exportMovementsCsv(req: Request, res: Response): Promise<void> {
    try {
      const from = (req.query.from as string) || null;
      const to = (req.query.to as string) || null;

      const query = `
        SELECT * FROM (
          SELECT o.order_number as reference, 'Ingreso' as type, o.total_amount as amount, o.order_date as date
          FROM orders o
          WHERE o.status NOT IN ('cancelado','cancelled')
            AND ( ( ? IS NULL AND DATE(o.order_date) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) ) OR ( ? IS NOT NULL ) )
            AND ( ? IS NULL OR DATE(o.order_date) BETWEEN ? AND ? )
          UNION ALL
          SELECT p.purchase_number as reference, 'Egreso' as type, p.total_amount as amount, p.purchase_date as date
          FROM purchases p
          WHERE p.status != 'cancelled'
            AND ( ( ? IS NULL AND DATE(p.purchase_date) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) ) OR ( ? IS NOT NULL ) )
            AND ( ? IS NULL OR DATE(p.purchase_date) BETWEEN ? AND ? )
        ) t
        ORDER BY t.date DESC`;

      const rows = await executeQuery(query, [from, from, from, from, to, from, from, from, from, to]);
      const header = 'type,reference,amount,date\n';
      const body = rows.map((r: any) => `${r.type},${r.reference},${Number(r.amount).toFixed(2)},${new Date(r.date).toISOString()}`).join('\n');
      const csv = header + body + '\n';

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="cash_movements.csv"');
      res.status(200).send(csv);
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error exporting movements', error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() });
    }
  }

  // GET /api/cash/export/period?from&to
  public async exportPeriodCsv(req: Request, res: Response): Promise<void> {
    try {
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;
      if (!from || !to) {
        res.status(400).json({ success: false, message: 'from and to are required', timestamp: new Date().toISOString() });
        return;
      }

      const incomeSql = `SELECT COALESCE(SUM(total_amount),0) as incomes FROM orders WHERE status NOT IN ('cancelado','cancelled') AND DATE(order_date) BETWEEN ? AND ?`;
      const expenseSql = `SELECT COALESCE(SUM(total_amount),0) as expenses FROM purchases WHERE status != 'cancelled' AND DATE(purchase_date) BETWEEN ? AND ?`;
      const [inc] = await executeQuery(incomeSql, [from, to]);
      const [exp] = await executeQuery(expenseSql, [from, to]);
      const incomes = inc?.incomes || 0;
      const expenses = exp?.expenses || 0;
      const balance = incomes - expenses;

      const header = 'from,to,incomes,expenses,balance\n';
      const csv = `${header}${from},${to},${Number(incomes).toFixed(2)},${Number(expenses).toFixed(2)},${Number(balance).toFixed(2)}\n`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="cash_period.csv"');
      res.status(200).send(csv);
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error exporting period', error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() });
    }
  }

  public async getPeriodSummary(req: Request, res: Response): Promise<void> {
    try {
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;

      if (!from || !to) {
        res.status(400).json({ success: false, message: 'from and to are required in YYYY-MM-DD format', timestamp: new Date().toISOString() });
        return;
      }

      const incomeQuery = `
        SELECT COALESCE(SUM(total_amount), 0) as incomes
        FROM orders
        WHERE status NOT IN ('cancelado','cancelled') AND DATE(order_date) BETWEEN ? AND ?
      `;

      const expenseQuery = `
        SELECT COALESCE(SUM(total_amount), 0) as expenses
        FROM purchases
        WHERE status != 'cancelled' AND DATE(purchase_date) BETWEEN ? AND ?
      `;

      const [incomeRow] = await executeQuery(incomeQuery, [from, to]);
      const [expenseRow] = await executeQuery(expenseQuery, [from, to]);

      const incomes = incomeRow?.incomes || 0;
      const expenses = expenseRow?.expenses || 0;

      res.status(200).json({
        success: true,
        message: 'Period cash summary',
        data: {
          from,
          to,
          incomes,
          expenses,
          balance: incomes - expenses
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error retrieving period summary', error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() });
    }
  }

  public async getMonthlySummary(req: Request, res: Response): Promise<void> {
    try {
      const year = parseInt((req.query.year as string) || new Date().getFullYear().toString(), 10);
      const month = parseInt((req.query.month as string) || (new Date().getMonth() + 1).toString(), 10);

      const currentFrom = `${year}-${String(month).padStart(2, '0')}-01`;
      const currentToExpr = `LAST_DAY('${currentFrom}')`;

      const prevDate = new Date(year, month - 2, 1);
      const prevFrom = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-01`;
      const prevToExpr = `LAST_DAY('${prevFrom}')`;

      const incomeMonthQuery = `
        SELECT COALESCE(SUM(total_amount), 0) as incomes
        FROM orders
        WHERE status NOT IN ('cancelado','cancelled') AND order_date BETWEEN ? AND ${currentToExpr}
      `;
      const expenseMonthQuery = `
        SELECT COALESCE(SUM(total_amount), 0) as expenses
        FROM purchases
        WHERE status != 'cancelled' AND purchase_date BETWEEN ? AND ${currentToExpr}
      `;

      const incomePrevQuery = `
        SELECT COALESCE(SUM(total_amount), 0) as incomes
        FROM orders
        WHERE status NOT IN ('cancelado','cancelled') AND order_date BETWEEN ? AND ${prevToExpr}
      `;
      const expensePrevQuery = `
        SELECT COALESCE(SUM(total_amount), 0) as expenses
        FROM purchases
        WHERE status != 'cancelled' AND purchase_date BETWEEN ? AND ${prevToExpr}
      `;

      const [incMonth] = await executeQuery(incomeMonthQuery, [currentFrom]);
      const [expMonth] = await executeQuery(expenseMonthQuery, [currentFrom]);
      const [incPrev] = await executeQuery(incomePrevQuery, [prevFrom]);
      const [expPrev] = await executeQuery(expensePrevQuery, [prevFrom]);

      const current = {
        incomes: incMonth?.incomes || 0,
        expenses: expMonth?.expenses || 0,
      };
      const previous = {
        incomes: incPrev?.incomes || 0,
        expenses: expPrev?.expenses || 0,
      };

      res.status(200).json({
        success: true,
        message: 'Monthly cash summary',
        data: {
          period: { year, month },
          current: { ...current, balance: current.incomes - current.expenses },
          previous: { ...previous, balance: previous.incomes - previous.expenses },
          delta: {
            incomes: (current.incomes - previous.incomes),
            expenses: (current.expenses - previous.expenses),
            balance: (current.incomes - current.expenses) - (previous.incomes - previous.expenses)
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error retrieving monthly summary', error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() });
    }
  }

  public async getRecentMovements(req: Request, res: Response): Promise<void> {
    try {
      const limit = clampSqlLimit(req.query.limit, 20, 100);
      const from = (req.query.from as string) || null;
      const to = (req.query.to as string) || null;

      const orderDateConds: string[] = [];
      const orderParams: any[] = [];
      if (from && to) {
        orderDateConds.push('DATE(o.order_date) BETWEEN ? AND ?');
        orderParams.push(from, to);
      } else if (from) {
        orderDateConds.push('DATE(o.order_date) >= ?');
        orderParams.push(from);
      } else if (to) {
        orderDateConds.push('DATE(o.order_date) <= ?');
        orderParams.push(to);
      } else {
        orderDateConds.push('DATE(o.order_date) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)');
      }

      const purchaseDateConds: string[] = [];
      const purchaseParams: any[] = [];
      if (from && to) {
        purchaseDateConds.push('DATE(p.purchase_date) BETWEEN ? AND ?');
        purchaseParams.push(from, to);
      } else if (from) {
        purchaseDateConds.push('DATE(p.purchase_date) >= ?');
        purchaseParams.push(from);
      } else if (to) {
        purchaseDateConds.push('DATE(p.purchase_date) <= ?');
        purchaseParams.push(to);
      } else {
        purchaseDateConds.push('DATE(p.purchase_date) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)');
      }

      const orderWhere = `o.status NOT IN ('cancelado','cancelled') AND ${orderDateConds.join(' AND ')}`;
      const purchaseWhere = `p.status != 'cancelled' AND ${purchaseDateConds.join(' AND ')}`;

      const query = `
        SELECT * FROM (
          SELECT
            o.id as id,
            CAST('Ingreso' AS CHAR CHARACTER SET utf8mb4) as type,
            CAST(CONCAT('Venta - ', o.order_number) AS CHAR CHARACTER SET utf8mb4) as concept,
            o.total_amount as amount,
            o.order_date as date,
            CAST('N/A' AS CHAR CHARACTER SET utf8mb4) as method
          FROM orders o
          WHERE ${orderWhere}

          UNION ALL

          SELECT
            p.id as id,
            CAST('Egreso' AS CHAR CHARACTER SET utf8mb4) as type,
            CAST(CONCAT('Compra - ', p.purchase_number) AS CHAR CHARACTER SET utf8mb4) as concept,
            p.total_amount as amount,
            p.purchase_date as date,
            CAST('N/A' AS CHAR CHARACTER SET utf8mb4) as method
          FROM purchases p
          WHERE ${purchaseWhere}
        ) t
        ORDER BY t.date DESC
        LIMIT ${limit}
      `;

      const params = [...orderParams, ...purchaseParams];
      const rows = await executeQuery(query, params);

      res.status(200).json({
        success: true,
        message: 'Recent movements',
        data: rows,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error retrieving movements', error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() });
    }
  }
}

export default new CashController();
