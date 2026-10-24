import { PurchaseRepository } from '../repositories/PurchaseRepository';
import { Purchase, CreatePurchaseData, UpdatePurchaseData, PurchaseItem, CreatePurchaseItemData, UpdatePurchaseItemData, Supplier, CreateSupplierData } from '../types';

export class PurchaseService {
  private purchaseRepository: PurchaseRepository;

  constructor() {
    this.purchaseRepository = new PurchaseRepository();
  }

  // ========== PURCHASE METHODS ==========

  async getAllPurchases(filters: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    supplier_id?: number;
    date_from?: string;
    date_to?: string;
  } = {}) {
    return await this.purchaseRepository.getAllPurchases(filters);
  }

  async getPurchaseById(id: number): Promise<Purchase | null> {
    return await this.purchaseRepository.getPurchaseById(id);
  }

  async createPurchase(data: CreatePurchaseData): Promise<Purchase> {
    // Validate supplier exists
    const supplier = await this.purchaseRepository.getSupplierById(data.supplier_id);
    if (!supplier) {
      throw new Error('Proveedor no encontrado');
    }

    return await this.purchaseRepository.createPurchase(data);
  }

  async updatePurchase(id: number, data: UpdatePurchaseData): Promise<Purchase | null> {
    // Check if purchase exists
    const existingPurchase = await this.purchaseRepository.getPurchaseById(id);
    if (!existingPurchase) {
      throw new Error('Compra no encontrada');
    }

    // If changing supplier, validate it exists
    if (data.supplier_id) {
      const supplier = await this.purchaseRepository.getSupplierById(data.supplier_id);
      if (!supplier) {
        throw new Error('Proveedor no encontrado');
      }
    }

    return await this.purchaseRepository.updatePurchase(id, data);
  }

  async deletePurchase(id: number): Promise<boolean> {
    const existingPurchase = await this.purchaseRepository.getPurchaseById(id);
    if (!existingPurchase) {
      throw new Error('Compra no encontrada');
    }

    return await this.purchaseRepository.deletePurchase(id);
  }

  // ========== PURCHASE ITEMS METHODS ==========

  async getPurchaseItems(purchaseId: number): Promise<PurchaseItem[]> {
    // Validate purchase exists
    const purchase = await this.purchaseRepository.getPurchaseById(purchaseId);
    if (!purchase) {
      throw new Error('Compra no encontrada');
    }

    return await this.purchaseRepository.getPurchaseItems(purchaseId);
  }

  async createPurchaseItem(purchaseId: number, data: CreatePurchaseItemData): Promise<PurchaseItem> {
    // Validate purchase exists
    const purchase = await this.purchaseRepository.getPurchaseById(purchaseId);
    if (!purchase) {
      throw new Error('Compra no encontrada');
    }

    // Validate product exists (this would need to be implemented in ProductRepository)
    // For now, we'll assume the product exists

    const item = await this.purchaseRepository.createPurchaseItem(purchaseId, data);
    
    // Update purchase total amount
    await this.updatePurchaseTotal(purchaseId);
    
    return item;
  }

  async updatePurchaseItem(purchaseId: number, itemId: number, data: UpdatePurchaseItemData): Promise<PurchaseItem | null> {
    // Validate purchase exists
    const purchase = await this.purchaseRepository.getPurchaseById(purchaseId);
    if (!purchase) {
      throw new Error('Compra no encontrada');
    }

    const item = await this.purchaseRepository.updatePurchaseItem(purchaseId, itemId, data);
    
    // Update purchase total amount
    await this.updatePurchaseTotal(purchaseId);
    
    return item;
  }

  async deletePurchaseItem(purchaseId: number, itemId: number): Promise<boolean> {
    // Validate purchase exists
    const purchase = await this.purchaseRepository.getPurchaseById(purchaseId);
    if (!purchase) {
      throw new Error('Compra no encontrada');
    }

    const deleted = await this.purchaseRepository.deletePurchaseItem(purchaseId, itemId);
    
    if (deleted) {
      // Update purchase total amount
      await this.updatePurchaseTotal(purchaseId);
    }
    
    return deleted;
  }

  // Helper method to update purchase total amount
  private async updatePurchaseTotal(purchaseId: number): Promise<void> {
    const items = await this.purchaseRepository.getPurchaseItems(purchaseId);
    const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);
    
    await this.purchaseRepository.updatePurchase(purchaseId, { total_amount: totalAmount });
  }

  // ========== SUPPLIER METHODS ==========

  async getAllSuppliers(filters: {
    page?: number;
    limit?: number;
    search?: string;
    city?: string;
    is_active?: boolean;
  } = {}) {
    return await this.purchaseRepository.getAllSuppliers(filters);
  }

  async getSupplierById(id: number): Promise<Supplier | null> {
    return await this.purchaseRepository.getSupplierById(id);
  }

  async createSupplier(data: CreateSupplierData): Promise<Supplier> {
    // Check if supplier code already exists (exact match)
    const existingSupplier = await this.purchaseRepository.getSupplierByCode(data.code);
    if (existingSupplier) {
      throw new Error('El código de proveedor ya existe');
    }

    return await this.purchaseRepository.createSupplier(data);
  }

  async updateSupplier(id: number, data: Partial<CreateSupplierData & { is_active?: boolean }>): Promise<Supplier | null> {
    // Check if supplier exists
    const existingSupplier = await this.purchaseRepository.getSupplierById(id);
    if (!existingSupplier) {
      throw new Error('Proveedor no encontrado');
    }

    // If changing code, check if new code already exists (exact match)
    if (data.code && data.code !== existingSupplier.code) {
      const supplierWithCode = await this.purchaseRepository.getSupplierByCode(data.code);
      if (supplierWithCode) {
        throw new Error('El código de proveedor ya existe');
      }
    }

    return await this.purchaseRepository.updateSupplier(id, data);
  }

  async deleteSupplier(id: number): Promise<boolean> {
    // Check if supplier exists
    const existingSupplier = await this.purchaseRepository.getSupplierById(id);
    if (!existingSupplier) {
      throw new Error('Proveedor no encontrado');
    }

    return await this.purchaseRepository.deleteSupplier(id);
  }

  // ========== STATISTICS METHODS ==========

  async getPurchaseStats(): Promise<any> {
    // This would need to be implemented in the repository
    // For now, return basic stats
    const allPurchases = await this.purchaseRepository.getAllPurchases({ limit: 1000 });
    
    const stats = {
      total_purchases: allPurchases.total,
      pending_purchases: allPurchases.purchases.filter(p => p.status === 'pending').length,
      received_purchases: allPurchases.purchases.filter(p => p.status === 'received').length,
      cancelled_purchases: allPurchases.purchases.filter(p => p.status === 'cancelled').length,
      total_amount: allPurchases.purchases.reduce((sum, p) => sum + p.total_amount, 0),
      average_amount: allPurchases.purchases.length > 0 
        ? allPurchases.purchases.reduce((sum, p) => sum + p.total_amount, 0) / allPurchases.purchases.length 
        : 0
    };

    return stats;
  }

  async getSupplierStats(): Promise<any> {
    const allSuppliers = await this.purchaseRepository.getAllSuppliers({ limit: 1000 });
    
    const stats = {
      total_suppliers: allSuppliers.total,
      active_suppliers: allSuppliers.suppliers.filter(s => s.is_active).length,
      inactive_suppliers: allSuppliers.suppliers.filter(s => !s.is_active).length,
      cities_count: new Set(allSuppliers.suppliers.map(s => s.city).filter(Boolean)).size
    };

    return stats;
  }
}
