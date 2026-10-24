import { CategoryRepository } from '../repositories/CategoryRepository';
import { Category, CreateCategoryData } from '../entities/Category';
import { WooCommerceService } from './WooCommerceService';

export class CategoryService {
  private categoryRepository: CategoryRepository;
  private wooCommerceService: WooCommerceService;

  constructor() {
    this.categoryRepository = new CategoryRepository();
    this.wooCommerceService = new WooCommerceService();
  }

  async getAllCategories(): Promise<{ categories: Category[] }> {
    const categories = await this.categoryRepository.findAll();
    return { categories };
  }

  async getCategoryById(id: number): Promise<Category | null> {
    return await this.categoryRepository.findById(id);
  }

  async getCategoryByWooCommerceId(woocommerceId: number): Promise<Category | null> {
    return await this.categoryRepository.findByWooCommerceId(woocommerceId);
  }

  async createCategory(data: CreateCategoryData & { woocommerce_id?: number; woocommerce_slug?: string; parent_id?: number | null }, syncToWooCommerce: boolean = true): Promise<Category> {
    // Verificar si ya existe por nombre
    const existingByName = await this.categoryRepository.findByName(data.name);
    if (existingByName) {
      throw new Error('Ya existe una categoría con ese nombre');
    }

    // Verificar si ya existe por woocommerce_id
    if (data.woocommerce_id) {
      const existingByWcId = await this.categoryRepository.findByWooCommerceId(data.woocommerce_id);
      if (existingByWcId) {
        throw new Error('Ya existe una categoría con ese ID de WooCommerce');
      }
    }

    // Crear categoría en el ERP
    const category = await this.categoryRepository.create(data);

    // Sincronizar a WooCommerce si está configurado y no tiene woocommerce_id (si ya tiene, significa que viene de WooCommerce)
    if (syncToWooCommerce && !data.woocommerce_id && this.wooCommerceService.isConfigured()) {
      try {
        console.log(`[CategoryService] Sincronizando categoría "${category.name}" a WooCommerce...`);
        await this.syncToWooCommerce(category.id);
        // Recargar la categoría para obtener el woocommerce_id actualizado
        const updatedCategory = await this.categoryRepository.findById(category.id);
        if (updatedCategory) {
          return updatedCategory;
        }
      } catch (error) {
        console.error(`[CategoryService] Error sincronizando categoría a WooCommerce:`, error);
        // No fallar la creación si la sincronización falla, solo loguear el error
        // La categoría se creó exitosamente en el ERP
      }
    }

    return category;
  }

  async updateCategory(id: number, data: Partial<CreateCategoryData> & { woocommerce_id?: number; woocommerce_slug?: string; parent_id?: number | null; is_active?: boolean }, syncToWooCommerce: boolean = true): Promise<Category> {
    const existing = await this.categoryRepository.findById(id);
    if (!existing) {
      throw new Error('Categoría no encontrada');
    }

    // Verificar nombre único si se está actualizando
    if (data.name && data.name !== existing.name) {
      const existingByName = await this.categoryRepository.findByName(data.name);
      if (existingByName && existingByName.id !== id) {
        throw new Error('Ya existe otra categoría con ese nombre');
      }
    }

    // Actualizar en el ERP
    const updatedCategory = await this.categoryRepository.update(id, data);

    // Sincronizar a WooCommerce si está configurado y la categoría tiene woocommerce_id
    if (syncToWooCommerce && existing.woocommerce_id && this.wooCommerceService.isConfigured()) {
      try {
        console.log(`[CategoryService] Sincronizando actualización de categoría "${updatedCategory.name}" a WooCommerce...`);
        await this.syncToWooCommerce(id);
        // Recargar la categoría para obtener datos actualizados
        const reloadedCategory = await this.categoryRepository.findById(id);
        if (reloadedCategory) {
          return reloadedCategory;
        }
      } catch (error) {
        console.error(`[CategoryService] Error sincronizando categoría a WooCommerce:`, error);
        // No fallar la actualización si la sincronización falla
      }
    }

    return updatedCategory;
  }

  // Método específico para sincronización desde WooCommerce
  async syncFromWooCommerce(
    categories: Array<{
      id: number;
      name: string;
      slug: string;
      parent?: number;
    }>,
    requestId?: string
  ): Promise<{ created: number; updated: number; deactivated: number; errors: any[] }> {
    const logPrefix = requestId ? `[${requestId}]` : '[CAT-SYNC]';
    let created = 0;
    let updated = 0;
    let deactivated = 0;
    const errors: any[] = [];

    console.log(`${logPrefix} Procesando ${categories.length} categorías desde WooCommerce...`);

    // Obtener IDs de WooCommerce de las categorías recibidas
    const receivedWcIds = new Set(categories.map(cat => cat.id));
    console.log(`${logPrefix} IDs de WooCommerce recibidos: ${Array.from(receivedWcIds).join(', ')}`);

    // Procesar cada categoría recibida
    for (let i = 0; i < categories.length; i++) {
      const wcCategory = categories[i];
      const categoryLog = `${logPrefix} [${i + 1}/${categories.length}] WC ID: ${wcCategory.id} - "${wcCategory.name}"`;
      
      try {
        console.log(`${categoryLog} Buscando categoría existente...`);
        const existing = await this.categoryRepository.findByWooCommerceId(wcCategory.id);
        
        if (existing) {
          console.log(`${categoryLog} ✅ Categoría existente encontrada (ERP ID: ${existing.id}). Actualizando...`);
          
          // Si estaba inactiva, reactivarla
          const needsReactivation = !existing.is_active;
          
          // Actualizar categoría existente
          await this.categoryRepository.update(existing.id, {
            name: wcCategory.name,
            woocommerce_slug: wcCategory.slug,
            parent_id: wcCategory.parent !== undefined ? (wcCategory.parent === 0 ? null : wcCategory.parent) : undefined,
            is_active: true // Reactivar si estaba inactiva
          });
          updated++;
          
          if (needsReactivation) {
            console.log(`${categoryLog} ✅ Reactivada y actualizada exitosamente`);
          } else {
            console.log(`${categoryLog} ✅ Actualizada exitosamente`);
          }
        } else {
          // Verificar si existe por nombre antes de crear
          const existingByName = await this.categoryRepository.findByName(wcCategory.name);
          if (existingByName) {
            console.log(`${categoryLog} ⚠️ Categoría existe por nombre pero sin woocommerce_id (ERP ID: ${existingByName.id}). Agregando woocommerce_id...`);
            // Si existe por nombre pero no por woocommerce_id, actualizar para agregar el woocommerce_id
            await this.categoryRepository.update(existingByName.id, {
              woocommerce_id: wcCategory.id,
              woocommerce_slug: wcCategory.slug,
              parent_id: wcCategory.parent !== undefined ? (wcCategory.parent === 0 ? null : wcCategory.parent) : undefined,
              is_active: true
            });
            updated++;
            console.log(`${categoryLog} ✅ woocommerce_id agregado exitosamente`);
          } else {
            console.log(`${categoryLog} ➕ Nueva categoría. Creando...`);
            // Crear nueva categoría
            const newCategory = await this.categoryRepository.create({
              name: wcCategory.name,
              woocommerce_id: wcCategory.id,
              woocommerce_slug: wcCategory.slug,
              parent_id: wcCategory.parent !== undefined ? (wcCategory.parent === 0 ? null : wcCategory.parent) : undefined
            });
            created++;
            console.log(`${categoryLog} ✅ Creada exitosamente (ERP ID: ${newCategory.id})`);
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
        console.error(`${categoryLog} ❌ ERROR: ${errorMsg}`);
        if (error instanceof Error && error.stack) {
          console.error(`${categoryLog} Stack:`, error.stack);
        }
        
        errors.push({
          woocommerce_id: wcCategory.id,
          name: wcCategory.name,
          error: errorMsg
        });
      }
    }

    // Desactivar categorías que ya no existen en WooCommerce
    console.log(`${logPrefix} Verificando categorías a desactivar (que no están en WooCommerce)...`);
    // Necesitamos todas las categorías, incluyendo inactivas, para comparar
    const allCategories = await this.categoryRepository.findAllIncludingInactive();
    const categoriesWithWcId = allCategories.filter(cat => cat.woocommerce_id !== undefined);
    
    console.log(`${logPrefix} Categorías en ERP con woocommerce_id: ${categoriesWithWcId.length}`);
    
    for (const erpCategory of categoriesWithWcId) {
      if (erpCategory.woocommerce_id && !receivedWcIds.has(erpCategory.woocommerce_id)) {
        // Esta categoría existe en el ERP pero no en WooCommerce (fue eliminada)
        if (erpCategory.is_active) {
          console.log(`${logPrefix} 🗑️ Desactivando categoría eliminada en WooCommerce: ERP ID ${erpCategory.id}, WC ID ${erpCategory.woocommerce_id} - "${erpCategory.name}"`);
          try {
            await this.categoryRepository.update(erpCategory.id, {
              is_active: false
            });
            deactivated++;
            console.log(`${logPrefix} ✅ Categoría desactivada exitosamente`);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
            console.error(`${logPrefix} ❌ Error desactivando categoría ${erpCategory.id}: ${errorMsg}`);
            errors.push({
              woocommerce_id: erpCategory.woocommerce_id,
              name: erpCategory.name,
              error: `Error al desactivar: ${errorMsg}`
            });
          }
        } else {
          console.log(`${logPrefix} ℹ️ Categoría ya estaba inactiva: WC ID ${erpCategory.woocommerce_id} - "${erpCategory.name}"`);
        }
      }
    }

    console.log(`${logPrefix} Resumen de sincronización:`, {
      total_recibidas: categories.length,
      creadas: created,
      actualizadas: updated,
      desactivadas: deactivated,
      errores: errors.length
    });

    return { created, updated, deactivated, errors };
  }

  /**
   * Sincroniza una categoría del ERP a WooCommerce
   * Si la categoría tiene woocommerce_id, la actualiza; si no, la crea
   */
  async syncToWooCommerce(categoryId: number): Promise<{ woocommerce_id: number; woocommerce_slug: string }> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) {
      throw new Error('Categoría no encontrada');
    }

    if (!this.wooCommerceService.isConfigured()) {
      throw new Error('WooCommerce no está configurado');
    }

    // Si la categoría ya tiene woocommerce_id, actualizar en WooCommerce
    if (category.woocommerce_id) {
      console.log(`[CategoryService] Actualizando categoría ${category.id} (WC ID: ${category.woocommerce_id}) en WooCommerce...`);
      
      // Resolver parent_id: si tiene parent_id en el ERP, necesitamos el woocommerce_id del padre
      let parentWcId: number | undefined = undefined;
      if (category.parent_id) {
        const parentCategory = await this.categoryRepository.findById(category.parent_id);
        if (parentCategory && parentCategory.woocommerce_id) {
          parentWcId = parentCategory.woocommerce_id;
        }
      }

      const wcResult = await this.wooCommerceService.updateCategory(category.woocommerce_id, {
        name: category.name,
        slug: category.woocommerce_slug,
        parent: parentWcId,
        description: category.description
      });

      // Actualizar slug si cambió
      if (wcResult.slug !== category.woocommerce_slug) {
        await this.categoryRepository.update(categoryId, {
          woocommerce_slug: wcResult.slug
        });
      }

      return {
        woocommerce_id: wcResult.id,
        woocommerce_slug: wcResult.slug
      };
    } else {
      // Si no tiene woocommerce_id, crear en WooCommerce
      console.log(`[CategoryService] Creando categoría ${category.id} en WooCommerce...`);
      
      // Resolver parent_id: si tiene parent_id en el ERP, necesitamos el woocommerce_id del padre
      let parentWcId: number | undefined = undefined;
      if (category.parent_id) {
        const parentCategory = await this.categoryRepository.findById(category.parent_id);
        if (parentCategory && parentCategory.woocommerce_id) {
          parentWcId = parentCategory.woocommerce_id;
        }
      }

      // Generar slug si no existe
      const slug = category.woocommerce_slug || category.name.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
        .replace(/[^a-z0-9]+/g, '-') // Reemplazar caracteres especiales
        .replace(/^-+|-+$/g, ''); // Eliminar guiones al inicio/fin

      const wcResult = await this.wooCommerceService.createCategory({
        name: category.name,
        slug: slug,
        parent: parentWcId,
        description: category.description
      });

      // Actualizar la categoría en el ERP con el woocommerce_id
      await this.categoryRepository.update(categoryId, {
        woocommerce_id: wcResult.id,
        woocommerce_slug: wcResult.slug
      });

      return {
        woocommerce_id: wcResult.id,
        woocommerce_slug: wcResult.slug
      };
    }
  }

  /**
   * Elimina una categoría en WooCommerce y limpia el woocommerce_id en el ERP
   */
  async deleteFromWooCommerce(categoryId: number): Promise<void> {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) {
      throw new Error('Categoría no encontrada');
    }

    if (!category.woocommerce_id) {
      console.log(`[CategoryService] Categoría ${categoryId} no tiene woocommerce_id, no hay nada que eliminar en WooCommerce`);
      return;
    }

    if (!this.wooCommerceService.isConfigured()) {
      throw new Error('WooCommerce no está configurado');
    }

    console.log(`[CategoryService] Eliminando categoría ${categoryId} (WC ID: ${category.woocommerce_id}) de WooCommerce...`);
    
    try {
      await this.wooCommerceService.deleteCategory(category.woocommerce_id, true);
      
      // Limpiar woocommerce_id y woocommerce_slug en el ERP
      await this.categoryRepository.update(categoryId, {
        woocommerce_id: undefined,
        woocommerce_slug: undefined
      });
      
      console.log(`[CategoryService] ✅ Categoría eliminada de WooCommerce exitosamente`);
    } catch (error) {
      console.error(`[CategoryService] Error eliminando categoría de WooCommerce:`, error);
      throw error;
    }
  }
}