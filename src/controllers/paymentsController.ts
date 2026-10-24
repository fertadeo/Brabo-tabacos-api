import { Request, Response } from 'express';
import { executeQuery } from '../config/database';

// CRUD de Pagos (ingresos/egresos)
// Esta implementación asume la existencia de una tabla payments extendida.
// Ver migración: src/database/migration_payments.sql

class PaymentsController {
  public async list(req: Request, res: Response): Promise<void> {
    try {
      const {
        from,
        to,
        method,
        type,
        payee_type,
        related_type,
        min,
        max,
        page = '1',
        limit = '20',
      } = req.query as Record<string, string>;

      const pageNum = parseInt(page || '1', 10);
      const limitNum = parseInt(limit || '20', 10);
      const offset = (pageNum - 1) * limitNum;

      const whereParts: string[] = [];
      const params: any[] = [];

      if (from && to) { whereParts.push('DATE(payment_date) BETWEEN ? AND ?'); params.push(from, to); }
      if (method) { whereParts.push('method = ?'); params.push(method); }
      if (type) { whereParts.push('type = ?'); params.push(type); }
      if (payee_type) { whereParts.push('payee_type = ?'); params.push(payee_type); }
      if (related_type) { whereParts.push('related_type = ?'); params.push(related_type); }
      if (min) { whereParts.push('amount >= ?'); params.push(Number(min)); }
      if (max) { whereParts.push('amount <= ?'); params.push(Number(max)); }

      const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

      const countSql = `SELECT COUNT(*) as total FROM payments ${where}`;
      const [countRow] = await executeQuery(countSql, params);
      const total = countRow?.total || 0;

      const dataSql = `
        SELECT id, type, method, amount, currency, payment_date, status,
               payee_type, payee_id, payee_name,
               related_type, related_id,
               notes, created_by, created_at, updated_at
        FROM payments
        ${where}
        ORDER BY payment_date DESC, id DESC
        LIMIT ? OFFSET ?`;

      const items = await executeQuery(dataSql, [...params, limitNum, offset]);

      res.status(200).json({
        success: true,
        message: 'Payments list',
        data: items,
        pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error retrieving payments', error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() });
    }
  }

  public async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const sql = `
        SELECT id, type, method, amount, currency, payment_date, status,
               payee_type, payee_id, payee_name,
               related_type, related_id,
               notes, created_by, created_at, updated_at
        FROM payments WHERE id = ?`;
      const [row] = await executeQuery(sql, [id]);
      if (!row) {
        res.status(404).json({ success: false, message: 'Payment not found', timestamp: new Date().toISOString() });
        return;
      }
      res.status(200).json({ success: true, message: 'Payment detail', data: row, timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error retrieving payment', error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() });
    }
  }

  public async create(req: Request, res: Response): Promise<void> {
    try {
      const {
        type,                // 'income' | 'outflow'
        method,              // 'efectivo' | 'tarjeta' | 'transferencia'
        amount,
        currency = 'ARS',
        payment_date,        // YYYY-MM-DD HH:MM:SS
        status = 'posted',   // 'draft' | 'posted' | 'void'
        payee_type,          // 'supplier' | 'employee' | 'other'
        payee_id = null,
        payee_name = null,
        related_type = null, // 'order' | 'purchase' | 'expense' | 'payroll' | null
        related_id = null,
        notes = null,
      } = req.body || {};

      if (!type || !method || !amount) {
        res.status(400).json({ success: false, message: 'type, method and amount are required', timestamp: new Date().toISOString() });
        return;
      }

      const sql = `
        INSERT INTO payments (
          type, method, amount, currency, payment_date, status,
          payee_type, payee_id, payee_name,
          related_type, related_id,
          notes, created_by
        ) VALUES (?, ?, ?, ?, COALESCE(?, NOW()), ?, ?, ?, ?, ?, ?, ?, ?)`;

      // Intentar obtener userId del token si middleware lo adjunta
      const userId = (req as any).user?.id || null;

      await executeQuery(sql, [
        type, method, amount, currency, payment_date || null, status,
        payee_type || null, payee_id, payee_name,
        related_type, related_id,
        notes, userId
      ]);

      res.status(201).json({ success: true, message: 'Payment created', timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error creating payment', error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() });
    }
  }

  public async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const fields = [
        'type','method','amount','currency','payment_date','status',
        'payee_type','payee_id','payee_name','related_type','related_id','notes'
      ] as const;

      const setParts: string[] = [];
      const params: any[] = [];
      for (const f of fields) {
        if (f in (req.body || {})) {
          setParts.push(`${f} = ?`);
          params.push((req.body as any)[f]);
        }
      }
      if (!setParts.length) {
        res.status(400).json({ success: false, message: 'No fields to update', timestamp: new Date().toISOString() });
        return;
      }

      const sql = `UPDATE payments SET ${setParts.join(', ')} WHERE id = ?`;
      params.push(id);

      await executeQuery(sql, params);
      res.status(200).json({ success: true, message: 'Payment updated', timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error updating payment', error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() });
    }
  }

  public async remove(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const sql = 'DELETE FROM payments WHERE id = ?';
      await executeQuery(sql, [id]);
      res.status(200).json({ success: true, message: 'Payment deleted', timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error deleting payment', error: error instanceof Error ? error.message : 'Unknown error', timestamp: new Date().toISOString() });
    }
  }
}

export default new PaymentsController();
