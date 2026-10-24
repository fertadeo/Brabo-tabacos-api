import { Request, Response } from 'express';
import { executeQuery } from '../config/database';
import { DashboardStats, ApiResponse } from '../types';
import { DashboardInsightsService } from '../services/DashboardInsightsService';

export class DashboardController {
  private insightsService = new DashboardInsightsService();

  // GET /api/dashboard/insights — destacados, alertas y pipeline de reparaciones
  public async getInsights(req: Request, res: Response): Promise<void> {
    try {
      const dateFrom = typeof req.query.date_from === 'string' ? req.query.date_from : undefined;
      const dateTo = typeof req.query.date_to === 'string' ? req.query.date_to : undefined;
      const timezone =
        typeof req.query.timezone === 'string' && req.query.timezone.trim()
          ? req.query.timezone.trim()
          : undefined;

      const data = await this.insightsService.getInsights(dateFrom, dateTo, timezone);

      const response: ApiResponse = {
        success: true,
        message: 'OK',
        data,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const isValidation =
        message.includes('YYYY-MM-DD') || message.includes('date_from');
      res.status(isValidation ? 400 : 500).json({
        success: false,
        message: isValidation ? message : 'Error al obtener insights del dashboard',
        error: message,
        timestamp: new Date().toISOString()
      });
    }
  }
  // Get dashboard statistics
  public async getDashboardStats(req: Request, res: Response): Promise<void> {
    try {
      // Ventas del día: pedidos (WooCommerce / local) + ventas POS
      const dailySalesFromOrdersQuery = `
        SELECT COALESCE(SUM(total_amount), 0) as daily_sales 
        FROM orders 
        WHERE DATE(order_date) = CURDATE() AND status != 'cancelled'
      `;
      const dailySalesFromPosQuery = `
        SELECT COALESCE(SUM(total_amount), 0) as daily_sales 
        FROM sales 
        WHERE DATE(sale_date) = CURDATE()
      `;

      // Get active orders
      const activeOrdersQuery = `
        SELECT COUNT(*) as active_orders 
        FROM orders 
        WHERE status IN ('pending', 'in_process')
      `;
      
      // Get active clients
      const activeClientsQuery = `
        SELECT COUNT(*) as active_clients 
        FROM clients 
        WHERE is_active = 1
      `;
      
      // Get critical products (low stock)
      const criticalProductsQuery = `
        SELECT COUNT(*) as critical_products 
        FROM products 
        WHERE stock <= min_stock AND is_active = 1
      `;
      
      // Get stock minority (products with low stock)
      const stockMinorityQuery = `
        SELECT COUNT(*) as stock_minority 
        FROM products 
        WHERE stock < (max_stock * 0.3) AND is_active = 1
      `;
      
      // Get stock majority (products with high stock)
      const stockMajorityQuery = `
        SELECT COUNT(*) as stock_majority 
        FROM products 
        WHERE stock > (max_stock * 0.7) AND is_active = 1
      `;
      
      // Get custom orders (pending personalized orders)
      const customOrdersQuery = `
        SELECT COUNT(*) as custom_orders 
        FROM orders 
        WHERE status = 'pending' AND notes LIKE '%personalizado%'
      `;

      // Execute all queries
      const [dailySalesFromOrders] = await executeQuery(dailySalesFromOrdersQuery);
      const [dailySalesFromPos] = await executeQuery(dailySalesFromPosQuery);
      const activeOrders = await executeQuery(activeOrdersQuery);
      const [activeClients] = await executeQuery(activeClientsQuery);
      const [criticalProducts] = await executeQuery(criticalProductsQuery);
      const [stockMinority] = await executeQuery(stockMinorityQuery);
      const [stockMajority] = await executeQuery(stockMajorityQuery);
      const [customOrders] = await executeQuery(customOrdersQuery);

      const fromOrders = Number((dailySalesFromOrders as any)?.daily_sales ?? 0);
      const fromPos = Number((dailySalesFromPos as any)?.daily_sales ?? 0);
      const activeOrdersCount = (activeOrders as any[])?.[0]?.active_orders ?? 0;

      const stats: DashboardStats = {
        dailySales: fromOrders + fromPos,
        dailySalesFromOrders: fromOrders,
        dailySalesFromPos: fromPos,
        activeOrders: activeOrdersCount,
        activeClients: activeClients?.active_clients || 0,
        criticalProducts: criticalProducts?.critical_products || 0,
        stockMinority: stockMinority?.stock_minority || 0,
        stockMajority: stockMajority?.stock_majority || 0,
        customOrders: customOrders?.custom_orders || 0
      };

      const response: ApiResponse<DashboardStats> = {
        success: true,
        message: 'Dashboard statistics retrieved successfully',
        data: stats,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Dashboard stats error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error retrieving dashboard statistics',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // Get recent activities
  public async getRecentActivities(req: Request, res: Response): Promise<void> {
    try {
      const query = `
        SELECT 
          'order' as type,
          id,
          order_number as reference,
          total_amount as amount,
          status,
          created_at
        FROM orders
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        
        UNION ALL
        
        SELECT 
          'production' as type,
          id,
          order_number as reference,
          0 as amount,
          status,
          created_at
        FROM production_orders
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        
        ORDER BY created_at DESC
        LIMIT 10
      `;

      const activities = await executeQuery(query);

      const response: ApiResponse = {
        success: true,
        message: 'Recent activities retrieved successfully',
        data: activities,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Recent activities error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error retrieving recent activities',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }
}
