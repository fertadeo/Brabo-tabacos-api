import { SupplierDeliveryNoteRepository } from '../repositories/SupplierDeliveryNoteRepository';
import { PurchaseRepository } from '../repositories/PurchaseRepository';
import { SupplierInvoiceRepository } from '../repositories/SupplierInvoiceRepository';
import { ProductRepository } from '../repositories/ProductRepository';
import { executeQuery } from '../config/database';
import {
  SupplierDeliveryNote,
  CreateSupplierDeliveryNoteData,
  UpdateSupplierDeliveryNoteData,
  SupplierDeliveryNoteItem,
  CreateSupplierDeliveryNoteItemData
} from '../entities/SupplierDeliveryNote';

export class SupplierDeliveryNoteService {
  private deliveryNoteRepository: SupplierDeliveryNoteRepository;
  private purchaseRepository: PurchaseRepository;
  private invoiceRepository: SupplierInvoiceRepository;
  private productRepository: ProductRepository;

  constructor() {
    this.deliveryNoteRepository = new SupplierDeliveryNoteRepository();
    this.purchaseRepository = new PurchaseRepository();
    this.invoiceRepository = new SupplierInvoiceRepository();
    this.productRepository = new ProductRepository();
  }

  // ========== DELIVERY NOTE METHODS ==========

  async getAllDeliveryNotes(filters: {
    page?: number;
    limit?: number;
    search?: string;
    supplier_id?: number;
    purchase_id?: number;
    invoice_id?: number;
    status?: string;
  } = {}) {
    return await this.deliveryNoteRepository.getAllDeliveryNotes(filters);
  }

  async getDeliveryNoteById(id: number): Promise<SupplierDeliveryNote | null> {
    return await this.deliveryNoteRepository.getDeliveryNoteById(id);
  }

  async createDeliveryNote(data: CreateSupplierDeliveryNoteData, userId?: number): Promise<SupplierDeliveryNote> {
    // Validate supplier exists
    const supplierQuery = `SELECT id, name FROM suppliers WHERE id = ?`;
    const [supplier] = await executeQuery(supplierQuery, [data.supplier_id]);

    if (!supplier) {
      throw new Error('Proveedor no encontrado');
    }

    // Validate purchase exists if purchase_id is provided
    if (data.purchase_id) {
      const purchase = await this.purchaseRepository.getPurchaseById(data.purchase_id);
      if (!purchase) {
        throw new Error('Orden de compra no encontrada');
      }

      // Validate supplier matches purchase
      if (purchase.supplier_id !== data.supplier_id) {
        throw new Error('El proveedor del remito no coincide con el proveedor de la orden de compra');
      }

      // Validate purchase allows partial delivery
      if (!purchase.allows_partial_delivery) {
        // Check if all items can be received
        for (const item of data.items) {
          if (item.purchase_item_id) {
            const purchaseItemQuery = `
              SELECT 
                pi.quantity,
                pi.received_quantity,
                (pi.quantity - pi.received_quantity) as pending_quantity
              FROM purchase_items pi
              WHERE pi.id = ?
            `;
            const [purchaseItem] = await executeQuery(purchaseItemQuery, [item.purchase_item_id]);

            if (purchaseItem && item.quantity > purchaseItem.pending_quantity) {
              throw new Error(
                `La cantidad del item excede la cantidad pendiente. Pendiente: ${purchaseItem.pending_quantity}, Solicitado: ${item.quantity}`
              );
            }
          }
        }
      }
    }

    // Validate invoice exists if invoice_id is provided
    if (data.invoice_id) {
      const invoice = await this.invoiceRepository.getInvoiceById(data.invoice_id);
      if (!invoice) {
        throw new Error('Factura no encontrada');
      }

      // Validate supplier matches
      if (invoice.supplier_id !== data.supplier_id) {
        throw new Error('El proveedor del remito no coincide con el proveedor de la factura');
      }
    }

    // Validate items
    for (const item of data.items) {
      // Validate product exists if product_id is provided
      if (item.product_id) {
        const product = await this.productRepository.findById(item.product_id);
        if (!product) {
          throw new Error(`Producto con ID ${item.product_id} no encontrado`);
        }
      }

      // Validate purchase_item exists if purchase_item_id is provided
      if (item.purchase_item_id) {
        const purchaseItemQuery = `SELECT id, purchase_id, quantity FROM purchase_items WHERE id = ?`;
        const [purchaseItem] = await executeQuery(purchaseItemQuery, [item.purchase_item_id]);

        if (!purchaseItem) {
          throw new Error(`Item de orden de compra con ID ${item.purchase_item_id} no encontrado`);
        }

        // Validate purchase matches
        if (data.purchase_id && purchaseItem.purchase_id !== data.purchase_id) {
          throw new Error('El item de orden de compra no pertenece a la orden de compra especificada');
        }
      }
    }

    // Generate delivery note number if not provided
    if (!data.delivery_note_number) {
      data.delivery_note_number = await this.deliveryNoteRepository.generateDeliveryNoteNumber();
    }

    return await this.deliveryNoteRepository.createDeliveryNote(data, userId);
  }

  async updateDeliveryNote(id: number, data: UpdateSupplierDeliveryNoteData): Promise<SupplierDeliveryNote | null> {
    const existingDeliveryNote = await this.deliveryNoteRepository.getDeliveryNoteById(id);
    if (!existingDeliveryNote) {
      throw new Error('Remito no encontrado');
    }

    // Validate purchase exists if purchase_id is being changed
    if (data.purchase_id !== undefined && data.purchase_id !== existingDeliveryNote.purchase_id) {
      if (data.purchase_id) {
        const purchase = await this.purchaseRepository.getPurchaseById(data.purchase_id);
        if (!purchase) {
          throw new Error('Orden de compra no encontrada');
        }

        // Validate supplier matches
        if (purchase.supplier_id !== existingDeliveryNote.supplier_id) {
          throw new Error('El proveedor de la orden de compra no coincide con el proveedor del remito');
        }
      }
    }

    // Validate invoice exists if invoice_id is being changed
    if (data.invoice_id !== undefined && data.invoice_id !== existingDeliveryNote.invoice_id) {
      if (data.invoice_id) {
        const invoice = await this.invoiceRepository.getInvoiceById(data.invoice_id);
        if (!invoice) {
          throw new Error('Factura no encontrada');
        }

        // Validate supplier matches
        if (invoice.supplier_id !== existingDeliveryNote.supplier_id) {
          throw new Error('El proveedor de la factura no coincide con el proveedor del remito');
        }
      }
    }

    return await this.deliveryNoteRepository.updateDeliveryNote(id, data);
  }

  async deleteDeliveryNote(id: number): Promise<boolean> {
    const deliveryNote = await this.deliveryNoteRepository.getDeliveryNoteById(id);
    if (!deliveryNote) {
      throw new Error('Remito no encontrado');
    }

    return await this.deliveryNoteRepository.deleteDeliveryNote(id);
  }

  async linkInvoice(deliveryNoteId: number, invoiceId: number): Promise<SupplierDeliveryNote | null> {
    const deliveryNote = await this.deliveryNoteRepository.getDeliveryNoteById(deliveryNoteId);
    if (!deliveryNote) {
      throw new Error('Remito no encontrado');
    }

    const invoice = await this.invoiceRepository.getInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error('Factura no encontrada');
    }

    // Validate supplier matches
    if (deliveryNote.supplier_id !== invoice.supplier_id) {
      throw new Error('El proveedor del remito no coincide con el proveedor de la factura');
    }

    // Validate purchase matches (if both have purchase_id)
    if (deliveryNote.purchase_id && invoice.purchase_id && deliveryNote.purchase_id !== invoice.purchase_id) {
      throw new Error('El remito y la factura pertenecen a órdenes de compra diferentes');
    }

    return await this.deliveryNoteRepository.linkInvoice(deliveryNoteId, invoiceId);
  }

  // ========== DELIVERY NOTE ITEMS METHODS ==========

  async getDeliveryNoteItems(deliveryNoteId: number): Promise<SupplierDeliveryNoteItem[]> {
    const deliveryNote = await this.deliveryNoteRepository.getDeliveryNoteById(deliveryNoteId);
    if (!deliveryNote) {
      throw new Error('Remito no encontrado');
    }

    return await this.deliveryNoteRepository.getDeliveryNoteItems(deliveryNoteId);
  }

  async createDeliveryNoteItem(
    deliveryNoteId: number,
    data: CreateSupplierDeliveryNoteItemData
  ): Promise<SupplierDeliveryNoteItem> {
    const deliveryNote = await this.deliveryNoteRepository.getDeliveryNoteById(deliveryNoteId);
    if (!deliveryNote) {
      throw new Error('Remito no encontrado');
    }

    // Validate product exists if product_id is provided
    if (data.product_id) {
      const product = await this.productRepository.findById(data.product_id);
      if (!product) {
        throw new Error(`Producto con ID ${data.product_id} no encontrado`);
      }
    }

    // Validate purchase_item exists and quantity is valid
    if (data.purchase_item_id) {
      const purchaseItemQuery = `
        SELECT 
          pi.id,
          pi.purchase_id,
          pi.quantity,
          pi.received_quantity,
          (pi.quantity - pi.received_quantity) as pending_quantity
        FROM purchase_items pi
        WHERE pi.id = ?
      `;
      const [purchaseItem] = await executeQuery(purchaseItemQuery, [data.purchase_item_id]);

      if (!purchaseItem) {
        throw new Error(`Item de orden de compra con ID ${data.purchase_item_id} no encontrado`);
      }

      // Validate purchase matches
      if (deliveryNote.purchase_id && purchaseItem.purchase_id !== deliveryNote.purchase_id) {
        throw new Error('El item de orden de compra no pertenece a la orden de compra del remito');
      }

      // Validate quantity doesn't exceed pending
      if (data.quantity > purchaseItem.pending_quantity) {
        throw new Error(
          `La cantidad (${data.quantity}) excede la cantidad pendiente (${purchaseItem.pending_quantity})`
        );
      }
    }

    return await this.deliveryNoteRepository.createDeliveryNoteItem(deliveryNoteId, data);
  }

  async updateDeliveryNoteItem(
    deliveryNoteId: number,
    itemId: number,
    data: Partial<CreateSupplierDeliveryNoteItemData>
  ): Promise<SupplierDeliveryNoteItem | null> {
    const deliveryNote = await this.deliveryNoteRepository.getDeliveryNoteById(deliveryNoteId);
    if (!deliveryNote) {
      throw new Error('Remito no encontrado');
    }

    // Validate product exists if product_id is being changed
    if (data.product_id) {
      const product = await this.productRepository.findById(data.product_id);
      if (!product) {
        throw new Error(`Producto con ID ${data.product_id} no encontrado`);
      }
    }

    // Validate quantity if being updated
    if (data.quantity !== undefined) {
      const item = await this.deliveryNoteRepository.getDeliveryNoteItemById(itemId);
      if (item && item.purchase_item_id) {
        const purchaseItemQuery = `
          SELECT 
            pi.quantity,
            pi.received_quantity,
            (pi.quantity - pi.received_quantity) as pending_quantity
          FROM purchase_items pi
          WHERE pi.id = ?
        `;
        const [purchaseItem] = await executeQuery(purchaseItemQuery, [item.purchase_item_id]);

        if (purchaseItem) {
          const currentReceived = item.quantity;
          const newReceived = data.quantity;
          const diff = newReceived - currentReceived;

          if (diff > purchaseItem.pending_quantity) {
            throw new Error(
              `El cambio de cantidad excede la cantidad pendiente. Pendiente: ${purchaseItem.pending_quantity}, Diferencia: ${diff}`
            );
          }
        }
      }
    }

    return await this.deliveryNoteRepository.updateDeliveryNoteItem(deliveryNoteId, itemId, data);
  }

  async deleteDeliveryNoteItem(deliveryNoteId: number, itemId: number): Promise<boolean> {
    const deliveryNote = await this.deliveryNoteRepository.getDeliveryNoteById(deliveryNoteId);
    if (!deliveryNote) {
      throw new Error('Remito no encontrado');
    }

    return await this.deliveryNoteRepository.deleteDeliveryNoteItem(deliveryNoteId, itemId);
  }
}

