import { Request, Response } from 'express';
import { CategoryService } from '../services/CategoryService';
import { ApiResponse } from '../types';
import { validationResult } from 'express-validator';

export class CategoryController {
  private categoryService: CategoryService;

  constructor() {
    this.categoryService = new CategoryService();
  }

  // GET /api/categories
  public async getAllCategories(req: Request, res: Response): Promise<void> {
    try {
      const { categories } = await this.categoryService.getAllCategories();
      
      const response: ApiResponse = {
        success: true,
        message: 'Categorías obtenidas exitosamente',
        data: { categories },
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Error obteniendo categorías',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/categories/:id
  public async getCategoryById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const category = await this.categoryService.getCategoryById(id);
      
      if (!category) {
        const response: ApiResponse = {
          success: false,
          message: 'Categoría no encontrada',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }
      
      const response: ApiResponse = {
        success: true,
        message: 'Categoría obtenida exitosamente',
        data: { category },
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Error obteniendo categoría',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // POST /api/categories
  public async createCategory(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse = {
          success: false,
          message: 'Validation failed',
          error: errors.array().map(err => err.msg).join(', '),
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const { name, description, woocommerce_id, woocommerce_slug, parent_id } = req.body;
      
      // Si se proporciona woocommerce_id, no sincronizar (viene de WooCommerce)
      const syncToWooCommerce = !woocommerce_id;
      
      const category = await this.categoryService.createCategory({
        name,
        description,
        woocommerce_id,
        woocommerce_slug,
        parent_id
      }, syncToWooCommerce);
      
      let message = 'Categoría creada exitosamente';
      if (syncToWooCommerce && category.woocommerce_id) {
        message += ` y sincronizada a WooCommerce (ID: ${category.woocommerce_id})`;
      }
      
      const response: ApiResponse = {
        success: true,
        message: message,
        data: { category },
        timestamp: new Date().toISOString()
      };
      
      res.status(201).json(response);
    } catch (error) {
      const statusCode = error instanceof Error && error.message.includes('Ya existe') ? 409 : 500;
      const response: ApiResponse = {
        success: false,
        message: 'Error creando categoría',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(statusCode).json(response);
    }
  }

  // PUT /api/categories/:id
  public async updateCategory(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const response: ApiResponse = {
          success: false,
          message: 'Validation failed',
          error: errors.array().map(err => err.msg).join(', '),
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const id = parseInt(req.params.id, 10);
      const { name, description, woocommerce_id, woocommerce_slug, parent_id, is_active } = req.body;
      
      // Obtener categoría existente para verificar si tiene woocommerce_id
      const existingCategory = await this.categoryService.getCategoryById(id);
      if (!existingCategory) {
        const response: ApiResponse = {
          success: false,
          message: 'Categoría no encontrada',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }
      
      // Si se está desactivando y tiene woocommerce_id, eliminar de WooCommerce
      if (is_active === false && existingCategory.woocommerce_id) {
        try {
          await this.categoryService.deleteFromWooCommerce(id);
        } catch (error) {
          console.error(`[CategoryController] Error eliminando categoría de WooCommerce:`, error);
          // Continuar con la actualización aunque falle la eliminación en WooCommerce
        }
      }
      
      // Sincronizar solo si tiene woocommerce_id (no si se está desactivando)
      const syncToWooCommerce = existingCategory.woocommerce_id !== undefined && is_active !== false;
      
      const category = await this.categoryService.updateCategory(id, {
        name,
        description,
        woocommerce_id,
        woocommerce_slug,
        parent_id,
        is_active
      }, syncToWooCommerce);
      
      let message = 'Categoría actualizada exitosamente';
      if (syncToWooCommerce && category.woocommerce_id) {
        message += ` y sincronizada a WooCommerce`;
      }
      
      const response: ApiResponse = {
        success: true,
        message: message,
        data: { category },
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      const statusCode = error instanceof Error && error.message.includes('no encontrada') ? 404 : 500;
      const response: ApiResponse = {
        success: false,
        message: 'Error actualizando categoría',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(statusCode).json(response);
    }
  }

  // DELETE /api/categories/:id
  public async deleteCategory(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      
      const category = await this.categoryService.getCategoryById(id);
      if (!category) {
        const response: ApiResponse = {
          success: false,
          message: 'Categoría no encontrada',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Si tiene woocommerce_id, eliminar de WooCommerce primero
      if (category.woocommerce_id) {
        try {
          await this.categoryService.deleteFromWooCommerce(id);
        } catch (error) {
          console.error(`[CategoryController] Error eliminando categoría de WooCommerce:`, error);
          // Continuar con la eliminación en el ERP aunque falle en WooCommerce
        }
      }

      // Desactivar en el ERP (soft delete)
      await this.categoryService.updateCategory(id, { is_active: false }, false);
      
      const response: ApiResponse = {
        success: true,
        message: 'Categoría eliminada exitosamente',
        data: { 
          id: category.id,
          name: category.name,
          woocommerce_id: category.woocommerce_id || null
        },
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Delete category error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error eliminando categoría',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // POST /api/woocommerce/categories/sync - Sincronizar desde WooCommerce
  public async syncFromWooCommerce(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = `WC-CAT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.log(`[${requestId}] ========== INICIANDO SINCRONIZACIÓN DE CATEGORÍAS DESDE WOOCOMMERCE ==========`);
      console.log(`[${requestId}] IP del cliente: ${req.ip || req.socket.remoteAddress || 'unknown'}`);
      console.log(`[${requestId}] User-Agent: ${req.get('user-agent') || 'unknown'}`);
      console.log(`[${requestId}] Headers recibidos:`, {
        'x-webhook-secret': req.headers['x-webhook-secret'] ? '***' : 'no presente',
        'x-api-key': req.headers['x-api-key'] ? '***' : 'no presente',
        'content-type': req.headers['content-type']
      });

      const { categories } = req.body;
      
      if (!Array.isArray(categories)) {
        console.error(`[${requestId}] ERROR: Formato inválido. Se espera un array de categorías.`);
        console.error(`[${requestId}] Body recibido:`, JSON.stringify(req.body, null, 2));
        
        const response: ApiResponse = {
          success: false,
          message: 'Formato inválido. Se espera un array de categorías.',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      console.log(`[${requestId}] Total de categorías recibidas: ${categories.length}`);
      console.log(`[${requestId}] Categorías recibidas:`, categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        parent: cat.parent || 0
      })));

      console.log(`[${requestId}] Iniciando sincronización...`);
      const result = await this.categoryService.syncFromWooCommerce(categories, requestId);
      
      const duration = Date.now() - startTime;
      console.log(`[${requestId}] ✅ Sincronización completada en ${duration}ms`);
      console.log(`[${requestId}] Resultado:`, {
        creadas: result.created,
        actualizadas: result.updated,
        desactivadas: result.deactivated,
        errores: result.errors.length
      });
      
      if (result.errors.length > 0) {
        console.error(`[${requestId}] ⚠️ Errores durante la sincronización:`, result.errors);
      }
      
      let message = `Sincronización completada. ${result.created} creadas, ${result.updated} actualizadas`;
      if (result.deactivated > 0) {
        message += `, ${result.deactivated} desactivadas`;
      }
      message += '.';
      
      const response: ApiResponse = {
        success: true,
        message: message,
        data: result,
        timestamp: new Date().toISOString()
      };
      
      console.log(`[${requestId}] ========== SINCRONIZACIÓN FINALIZADA ==========`);
      res.status(200).json(response);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[${requestId}] ❌ ERROR en sincronización después de ${duration}ms:`, error);
      console.error(`[${requestId}] Stack trace:`, error instanceof Error ? error.stack : 'No stack available');
      
      const response: ApiResponse = {
        success: false,
        message: 'Error sincronizando categorías',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // POST /api/categories/webhook - Webhook para cuando se crea/actualiza en ERP
  public async webhookCategoryChange(req: Request, res: Response): Promise<void> {
    try {
      const { action, category } = req.body;
      
      if (!action || !category) {
        const response: ApiResponse = {
          success: false,
          message: 'Formato inválido. Se esperan action y category.',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Esta ruta está pensada para que n8n llame cuando detecta cambios en WooCommerce
      // o para notificar cambios desde el ERP a otros sistemas
      const response: ApiResponse = {
        success: true,
        message: 'Webhook recibido correctamente',
        data: { action, category },
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: false,
        message: 'Error procesando webhook',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // POST /api/integration/webhook/woocommerce/category - Webhook directo de WooCommerce
  public async wooCommerceCategoryWebhook(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = `WC-WEBHOOK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.log(`[${requestId}] ========== WEBHOOK DE CATEGORÍA RECIBIDO DE WOOCOMMERCE ==========`);
      console.log(`[${requestId}] IP del cliente: ${req.ip || req.socket.remoteAddress || 'unknown'}`);
      console.log(`[${requestId}] User-Agent: ${req.get('user-agent') || 'unknown'}`);
      console.log(`[${requestId}] Headers recibidos:`, {
        'x-webhook-secret': req.headers['x-webhook-secret'] ? '***' : 'no presente',
        'x-api-key': req.headers['x-api-key'] ? '***' : 'no presente',
        'content-type': req.headers['content-type']
      });

      // WooCommerce envía el payload directamente con la categoría completa
      const wcCategory = req.body;
      
      console.log(`[${requestId}] Payload recibido:`, {
        id: wcCategory.id,
        name: wcCategory.name,
        slug: wcCategory.slug,
        parent: wcCategory.parent,
        description: wcCategory.description ? wcCategory.description.substring(0, 50) + '...' : 'sin descripción'
      });

      // Validar que tenga los campos mínimos necesarios
      if (!wcCategory.id || !wcCategory.name) {
        console.error(`[${requestId}] ❌ ERROR: Formato inválido. Campos requeridos: id, name`);
        console.error(`[${requestId}] Body completo:`, JSON.stringify(req.body, null, 2));
        
        const response: ApiResponse = {
          success: false,
          message: 'Formato inválido. La categoría debe tener id y name.',
          error: 'Campos requeridos: id, name',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Formatear para la función de sincronización
      // WooCommerce envía parent como número (0 si no tiene padre)
      const categories = [{
        id: wcCategory.id,
        name: wcCategory.name,
        slug: wcCategory.slug || wcCategory.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        parent: wcCategory.parent || 0
      }];
      
      console.log(`[${requestId}] Iniciando sincronización de categoría individual...`);
      // Sincronizar categoría (crear o actualizar)
      const result = await this.categoryService.syncFromWooCommerce(categories, requestId);
      
      const duration = Date.now() - startTime;
      console.log(`[${requestId}] ✅ Sincronización completada en ${duration}ms`);
      console.log(`[${requestId}] Resultado:`, {
        creadas: result.created,
        actualizadas: result.updated,
        errores: result.errors.length
      });
      
      const response: ApiResponse = {
        success: true,
        message: 'Categoría sincronizada exitosamente desde WooCommerce',
        data: {
          woocommerce_id: wcCategory.id,
          category_name: wcCategory.name,
          sync_result: result
        },
        timestamp: new Date().toISOString()
      };
      
      console.log(`[${requestId}] ========== WEBHOOK PROCESADO EXITOSAMENTE ==========`);
      // Responder rápido a WooCommerce (importante para webhooks)
      res.status(200).json(response);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[${requestId}] ❌ ERROR procesando webhook después de ${duration}ms:`, error);
      console.error(`[${requestId}] Stack trace:`, error instanceof Error ? error.stack : 'No stack available');
      
      const response: ApiResponse = {
        success: false,
        message: 'Error procesando webhook de categoría de WooCommerce',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }
}