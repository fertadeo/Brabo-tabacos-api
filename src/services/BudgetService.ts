import { BudgetRepository } from '../repositories/BudgetRepository';
import { ProductService } from './ProductService';
import { SaleService } from './SaleService';
import { executeQuery } from '../config/database';
import {
  CreateBudgetData,
  UpdateBudgetData,
  BudgetFilters,
  BudgetWithDetails,
  ConvertBudgetToSaleData
} from '../entities/Budget';
import { CreateSaleData } from '../entities/Sale';
import { ApiResponse } from '../types';
import { isCatalogSaleLine } from '../utils/saleItems';
import { assertHomogeneousBudgetCurrency } from '../utils/budgetItems';
import type { BudgetLineInput } from '../entities/Budget';

export class BudgetService {
  private repo: BudgetRepository;
  private productService: ProductService;
  private saleService: SaleService;

  constructor() {
    this.repo = new BudgetRepository();
    this.productService = new ProductService();
    this.saleService = new SaleService();
  }

  private async assertClientExists(clientId: number): Promise<void> {
    const rows = (await executeQuery(
      `SELECT id, is_active FROM clients WHERE id = ?`,
      [clientId]
    )) as any[];
    if (!rows?.length) {
      throw new Error(`Cliente con ID ${clientId} no encontrado`);
    }
    if (!rows[0].is_active) {
      throw new Error('El cliente está inactivo');
    }
  }

  private async validateProductLines(
    items: BudgetLineInput[],
    allowInactive: boolean
  ): Promise<void> {
    const catalogItems = items.filter(isCatalogSaleLine);
    for (const item of catalogItems) {
      const product = await this.productService.getProductById(item.product_id);
      if (!product) {
        throw new Error(`Producto con ID ${item.product_id} no encontrado`);
      }
      if (!allowInactive && !product.is_active) {
        throw new Error(
          `El producto ${product.name} (${product.code}) está inactivo. ` +
            `Actívalo o envía allow_inactive: true en el body.`
        );
      }
    }
  }

  /**
   * Si hay orden de reparación, debe existir y tener el mismo cliente que el presupuesto.
   */
  private async validateRepairOrderForClient(
    repairOrderId: number | null | undefined,
    clientId: number
  ): Promise<void> {
    if (repairOrderId == null) return;
    const rows = (await executeQuery(`SELECT id, client_id FROM repair_orders WHERE id = ?`, [
      repairOrderId
    ])) as any[];
    if (!rows?.length) {
      throw new Error(`Orden de reparación con ID ${repairOrderId} no encontrada`);
    }
    if (Number(rows[0].client_id) !== Number(clientId)) {
      throw new Error(
        'El cliente del presupuesto debe coincidir con el cliente de la orden de reparación vinculada'
      );
    }
  }

  async createBudget(data: CreateBudgetData): Promise<ApiResponse<BudgetWithDetails>> {
    try {
      if (!data.items?.length) {
        return { success: false, message: 'Debe incluir al menos un ítem', timestamp: new Date().toISOString() };
      }
      await this.assertClientExists(data.client_id);
      await this.validateRepairOrderForClient(data.repair_order_id ?? null, data.client_id);
      await this.validateProductLines(data.items, data.allow_inactive === true);

      const budget = await this.repo.createBudget(data);
      return {
        success: true,
        message: 'Presupuesto creado',
        data: budget,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('[BudgetService] createBudget', error);
      return {
        success: false,
        message: 'Error al crear presupuesto',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getBudgetById(id: number): Promise<ApiResponse<BudgetWithDetails>> {
    try {
      const budget = await this.repo.getBudgetById(id);
      if (!budget) {
        return { success: false, message: 'Presupuesto no encontrado', timestamp: new Date().toISOString() };
      }
      return {
        success: true,
        message: 'Presupuesto obtenido',
        data: budget,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al obtener presupuesto',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getAllBudgets(filters: BudgetFilters = {}): Promise<ApiResponse> {
    try {
      const result = await this.repo.getAllBudgets(filters);
      return {
        success: true,
        message: 'Listado de presupuestos',
        data: result,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al listar presupuestos',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async getStats(): Promise<ApiResponse> {
    try {
      const stats = await this.repo.getStats();
      return {
        success: true,
        message: 'Estadísticas de presupuestos',
        data: stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al obtener estadísticas',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async updateBudget(id: number, data: UpdateBudgetData): Promise<ApiResponse<BudgetWithDetails>> {
    try {
      const existing = await this.repo.getBudgetById(id);
      if (!existing) {
        return { success: false, message: 'Presupuesto no encontrado', timestamp: new Date().toISOString() };
      }

      if (existing.status === 'draft') {
        const effectiveClientId = data.client_id ?? existing.client_id;
        const effectiveRepairOrderId =
          data.repair_order_id !== undefined ? data.repair_order_id : existing.repair_order_id;

        await this.assertClientExists(effectiveClientId);
        await this.validateRepairOrderForClient(effectiveRepairOrderId ?? null, effectiveClientId);

        if (data.items !== undefined) {
          await this.validateProductLines(data.items, data.allow_inactive === true);
        }
        const budget = await this.repo.updateBudgetDraft(id, data);
        return {
          success: true,
          message: 'Presupuesto actualizado',
          data: budget,
          timestamp: new Date().toISOString()
        };
      }

      if (existing.status === 'sent' || existing.status === 'approved') {
        if (data.items !== undefined || data.repair_order_id !== undefined) {
          return {
            success: false,
            message:
              `En estado ${existing.status === 'sent' ? 'enviado' : 'aprobado'} solo se pueden corregir ` +
              'client_id, notes y valid_until. Para cambiar ítems, cree un nuevo presupuesto.',
            timestamp: new Date().toISOString()
          };
        }

        const effectiveClientId = data.client_id ?? existing.client_id;
        if (data.client_id !== undefined) {
          await this.assertClientExists(effectiveClientId);
          await this.validateRepairOrderForClient(
            existing.repair_order_id ?? null,
            effectiveClientId
          );
        }

        if (
          data.client_id === undefined &&
          data.notes === undefined &&
          data.valid_until === undefined
        ) {
          return {
            success: false,
            message: 'Debe enviar al menos client_id, notes o valid_until para actualizar',
            timestamp: new Date().toISOString()
          };
        }

        const budget = await this.repo.updateBudgetMetadata(id, {
          client_id: data.client_id,
          notes: data.notes,
          valid_until: data.valid_until
        });
        return {
          success: true,
          message: 'Presupuesto actualizado',
          data: budget,
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: false,
        message: 'No se puede editar un presupuesto en este estado',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al actualizar presupuesto',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async deleteBudget(id: number): Promise<ApiResponse> {
    try {
      await this.repo.deleteBudgetDraft(id);
      return {
        success: true,
        message: 'Presupuesto eliminado',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al eliminar presupuesto',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  private async loadBudgetOrFail(id: number): Promise<BudgetWithDetails> {
    const b = await this.repo.getBudgetById(id);
    if (!b) throw new Error('Presupuesto no encontrado');
    return b;
  }

  async sendBudget(id: number): Promise<ApiResponse<BudgetWithDetails>> {
    try {
      const b = await this.loadBudgetOrFail(id);
      if (b.status !== 'draft') {
        return {
          success: false,
          message: 'Solo se puede enviar un presupuesto en borrador',
          timestamp: new Date().toISOString()
        };
      }
      if (!b.items?.length) {
        return {
          success: false,
          message: 'El presupuesto no tiene ítems',
          timestamp: new Date().toISOString()
        };
      }
      await this.repo.setStatus(id, 'sent');
      const updated = await this.repo.getBudgetById(id);
      return {
        success: true,
        message: 'Presupuesto marcado como enviado',
        data: updated!,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al enviar presupuesto',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async approveBudget(id: number): Promise<ApiResponse<BudgetWithDetails>> {
    try {
      const b = await this.loadBudgetOrFail(id);
      if (b.status !== 'sent') {
        return {
          success: false,
          message: 'Solo se puede aprobar un presupuesto enviado',
          timestamp: new Date().toISOString()
        };
      }
      await this.repo.setStatus(id, 'approved');
      const updated = await this.repo.getBudgetById(id);
      return {
        success: true,
        message: 'Presupuesto aprobado',
        data: updated!,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al aprobar presupuesto',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async rejectBudget(id: number): Promise<ApiResponse<BudgetWithDetails>> {
    try {
      const b = await this.loadBudgetOrFail(id);
      if (b.status !== 'draft' && b.status !== 'sent') {
        return {
          success: false,
          message: 'Solo se puede rechazar desde borrador o enviado',
          timestamp: new Date().toISOString()
        };
      }
      await this.repo.setStatus(id, 'rejected');
      const updated = await this.repo.getBudgetById(id);
      return {
        success: true,
        message: 'Presupuesto rechazado',
        data: updated!,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al rechazar presupuesto',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async expireBudget(id: number): Promise<ApiResponse<BudgetWithDetails>> {
    try {
      const b = await this.loadBudgetOrFail(id);
      if (b.status !== 'draft' && b.status !== 'sent') {
        return {
          success: false,
          message: 'Solo se puede vencer un presupuesto en borrador o enviado',
          timestamp: new Date().toISOString()
        };
      }
      await this.repo.setStatus(id, 'expired');
      const updated = await this.repo.getBudgetById(id);
      return {
        success: true,
        message: 'Presupuesto marcado como vencido',
        data: updated!,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al vencer presupuesto',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }

  async convertToSale(
    id: number,
    body: ConvertBudgetToSaleData,
    userId: number | null
  ): Promise<ApiResponse> {
    try {
      const b = await this.loadBudgetOrFail(id);
      if (b.status !== 'approved') {
        return {
          success: false,
          message: 'Solo se puede convertir a venta un presupuesto aprobado',
          timestamp: new Date().toISOString()
        };
      }
      const items = b.items || [];
      if (!items.length) {
        return {
          success: false,
          message: 'El presupuesto no tiene ítems',
          timestamp: new Date().toISOString()
        };
      }

      const clientId = body.client_id ?? b.client_id;

      const saleCurrency = assertHomogeneousBudgetCurrency(items);
      const exchangeRate =
        saleCurrency === 'USD'
          ? b.exchange_rate != null && Number(b.exchange_rate) > 0
            ? Number(b.exchange_rate)
            : null
          : null;

      if (saleCurrency === 'USD' && !exchangeRate) {
        return {
          success: false,
          message:
            'El presupuesto en USD no tiene cotización guardada. Editá el presupuesto antes de convertir.',
          timestamp: new Date().toISOString()
        };
      }

      const salePayload: CreateSaleData = {
        client_id: clientId,
        items: items.map((it) => {
          if (it.product_id != null && it.product_id >= 1) {
            return {
              product_id: it.product_id,
              quantity: it.quantity,
              unit_price: it.unit_price
            };
          }
          const description = (it.description || it.product_name || '').trim();
          return {
            description: description || 'Ítem manual',
            quantity: it.quantity,
            unit_price: it.unit_price
          };
        }),
        currency: saleCurrency,
        exchange_rate: exchangeRate ?? undefined,
        payment_method: body.payment_method,
        payment_details: body.payment_details,
        notes: body.notes,
        sync_to_woocommerce: body.sync_to_woocommerce,
        allow_inactive: body.allow_inactive
      };

      if (salePayload.payment_method === 'mixto' && !salePayload.payment_details) {
        return {
          success: false,
          message: 'Con método de pago mixto se requiere payment_details',
          timestamp: new Date().toISOString()
        };
      }

      const saleResult = await this.saleService.createSale(salePayload, userId);
      if (!saleResult.success) {
        return saleResult;
      }

      return {
        success: true,
        message: 'Venta creada desde el presupuesto',
        data: {
          budget: b,
          sale: saleResult.data
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error al convertir presupuesto en venta',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  }
}
