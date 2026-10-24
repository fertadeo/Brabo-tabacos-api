import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/jwt';
import { SystemHealthService } from '../services/ActivityLoggerService';
import { ApiResponse } from '../types';
import { SystemEventFilters } from '../entities/SystemEvent';

export class SystemHealthController {
  async getEvents(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const filters: SystemEventFilters = {
        event_type: req.query.event_type as SystemEventFilters['event_type'],
        severity: req.query.severity as SystemEventFilters['severity'],
        module: req.query.module as string | undefined,
        user_id: req.query.user_id ? parseInt(req.query.user_id as string, 10) : undefined,
        search: req.query.search as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      };

      const result = await SystemHealthService.getEvents(filters);

      const response: ApiResponse = {
        success: true,
        message: 'Eventos obtenidos exitosamente',
        data: {
          events: result.events,
          pagination: {
            page: filters.page ?? 1,
            limit: filters.limit ?? 50,
            total: result.total,
            totalPages: Math.ceil(result.total / (filters.limit ?? 50)),
          },
        },
        timestamp: new Date().toISOString(),
      };
      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener eventos',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getStats(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const stats = await SystemHealthService.getStats();
      res.json({
        success: true,
        message: 'Estadísticas obtenidas exitosamente',
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener estadísticas',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getStatus(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const status = await SystemHealthService.getSystemStatus();
      res.json({
        success: true,
        message: 'Estado del sistema obtenido exitosamente',
        data: status,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener estado del sistema',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getModules(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const modules = await SystemHealthService.getModules();
      res.json({
        success: true,
        message: 'Módulos obtenidos exitosamente',
        data: modules,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener módulos',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getOverview(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const filters: SystemEventFilters = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 30,
        event_type: req.query.event_type as SystemEventFilters['event_type'],
        module: req.query.module as string | undefined,
        search: req.query.search as string | undefined,
      };
      const data = await SystemHealthService.getOverview(filters);
      const limit = filters.limit ?? 30;
      const page = filters.page ?? 1;
      res.json({
        success: true,
        message: 'Resumen obtenido exitosamente',
        data: {
          ...data,
          pagination: {
            page,
            limit,
            total: data.total,
            totalPages: Math.ceil(data.total / limit),
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error al obtener resumen del sistema',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
