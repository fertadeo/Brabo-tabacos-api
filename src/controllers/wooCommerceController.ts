import { Request, Response } from 'express';
import { ProductService } from '../services/ProductService';
import { WooCommerceService } from '../services/WooCommerceService';
import { ApiResponse } from '../types';

export class WooCommerceController {
  private productService: ProductService;
  private wooCommerceService: WooCommerceService;

  constructor() {
    this.productService = new ProductService();
    this.wooCommerceService = new WooCommerceService();
  }

  // GET /api/woocommerce/products - Obtener productos para WooCommerce
  public async getProducts(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, per_page = 10, search, category } = req.query;
      
      const pageNum = parseInt(String(page), 10) || 1;
      const perPageNum = parseInt(String(per_page), 10) || 10;
      
      const { products, total } = await this.productService.getAllProducts({
        page: pageNum,
        limit: perPageNum,
        search: search as string,
        category_id: category ? parseInt(String(category), 10) : undefined,
        active_only: true
      });
      
      // Formatear para WooCommerce
      const wooProducts = products.map(product => ({
        id: product.id,
        name: product.name,
        slug: product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        permalink: `https://tu-tienda.com/producto/${product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        sku: product.code,
        price: product.price.toString(),
        regular_price: product.price.toString(),
        sale_price: '',
        on_sale: false,
        status: product.is_active ? 'publish' : 'draft',
        purchasable: product.stock > 0,
        stock_quantity: product.stock,
        stock_status: product.stock > 0 ? 'instock' : 'outofstock',
        manage_stock: true,
        backorders: 'no',
        categories: product.category_name ? [{ name: product.category_name }] : [],
        description: product.description || '',
        short_description: product.description ? product.description.substring(0, 160) + '...' : '',
        date_created: product.created_at,
        date_modified: product.updated_at,
        meta_data: [
          { key: '_brabo_erp_id', value: product.id.toString() },
          { key: '_brabo_erp_code', value: product.code }
        ]
      }));
      
      const response: ApiResponse = {
        success: true,
        message: 'Productos obtenidos exitosamente',
        data: {
          products: wooProducts,
          pagination: {
            page: pageNum,
            per_page: perPageNum,
            total,
            total_pages: Math.ceil(total / perPageNum)
          }
        },
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Get WooCommerce products error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error obteniendo productos',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // POST /api/woocommerce/products/sync - Sincronizar productos desde WooCommerce
  public async syncProducts(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = `WC-PROD-SYNC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    try {
      const { products } = req.body;

      console.log(`[${requestId}] ========== INICIANDO SYNC DE PRODUCTOS (WooCommerce → ERP) ==========`);
      console.log(`[${requestId}] IP: ${req.ip || req.socket.remoteAddress || 'unknown'}`);
      console.log(`[${requestId}] User-Agent: ${req.get('user-agent') || 'unknown'}`);
      console.log(`[${requestId}] Content-Type: ${req.get('content-type') || 'not set'}`);
      console.log(`[${requestId}] Headers:`, {
        'x-api-key': req.headers['x-api-key'] ? '***presente***' : 'no presente',
        'x-webhook-secret': req.headers['x-webhook-secret'] ? '***presente***' : 'no presente'
      });
      
      if (!Array.isArray(products)) {
        console.error(`[${requestId}] ❌ Formato inválido. products no es array.`);
        const response: ApiResponse = {
          success: false,
          message: 'Formato inválido. Se espera un array de productos.',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      console.log(`[${requestId}] Total productos recibidos: ${products.length}`);
      if (products.length > 0) {
        const sample = products[0];
        console.log(`[${requestId}] Sample producto[0]:`, {
          id: sample?.id,
          sku: sample?.sku,
          name: sample?.name,
          status: sample?.status
        });
      }
      
      const results = [];
      let createdCount = 0;
      let updatedCount = 0;
      let errorCount = 0;
      
      for (const product of products) {
        const { id: woocommerceIdRaw, sku, stock_quantity, price, name, status, description, images } = product;
        const incomingSlug =
          status === 'publish' && typeof product?.slug === 'string'
            ? product.slug.trim().replace(/^\/+|\/+$/g, '').replace(/\s+/g, '-').toLowerCase()
            : null;
        const incomingPermalink =
          status === 'publish' && typeof product?.permalink === 'string' && /^https?:\/\//i.test(product.permalink.trim())
            ? product.permalink.trim()
            : null;


        const woocommerce_id =
          typeof woocommerceIdRaw === 'number'
            ? woocommerceIdRaw
            : (woocommerceIdRaw ? parseInt(String(woocommerceIdRaw), 10) : undefined);

        // Normalizar tipos numéricos (WooCommerce suele enviar strings)
        const normalizedPrice =
          price !== undefined && price !== null && String(price).trim() !== ''
            ? Number(price)
            : undefined;

        const normalizedStock =
          stock_quantity !== null && stock_quantity !== undefined && String(stock_quantity).trim() !== ''
            ? Number(stock_quantity)
            : undefined;
        
        // Extraer solo las URLs de las imágenes
        let imageUrls: string[] | undefined;
        if (images) {
          if (Array.isArray(images)) {
            const urls = images
              .map((img: any) => {
                if (typeof img === 'string') return img;
                if (img && typeof img === 'object' && img.src) return img.src;
                return null;
              })
              .filter((url: any): url is string => typeof url === 'string' && url.length > 0);

            imageUrls = urls.length > 0 ? urls : undefined;
          } else if (typeof images === 'string') {
            // Si es un string (URL única), convertir a array
            imageUrls = [images];
          }
        }
        
        try {
          // Buscar producto existente
          const existingProduct = await this.productService.getProductByCode(sku);
          
          if (existingProduct) {
            // Actualizar producto existente
            await this.productService.updateProduct(existingProduct.id, {
              name: name || existingProduct.name,
              description: description !== undefined ? description : existingProduct.description,
              price: normalizedPrice !== undefined && !Number.isNaN(normalizedPrice) ? normalizedPrice : existingProduct.price,
              stock: normalizedStock !== undefined && !Number.isNaN(normalizedStock) ? normalizedStock : existingProduct.stock,
              is_active: status === 'publish',
              images: imageUrls !== undefined ? imageUrls : existingProduct.images,
              woocommerce_id: woocommerce_id ?? (existingProduct as any).woocommerce_id ?? null,
              woocommerce_slug: incomingSlug,
              woocommerce_permalink: incomingPermalink,
              woocommerce_json: product // ⭐ guardar JSON completo
            });
            
            results.push({
              sku,
              action: 'updated',
              success: true,
              message: 'Producto actualizado exitosamente'
            });
            updatedCount++;
          } else {
            // Crear nuevo producto
            await this.productService.createProduct({
              code: sku,
              name: name || `Producto ${sku}`,
              description: description || undefined,
              price: normalizedPrice !== undefined && !Number.isNaN(normalizedPrice) ? normalizedPrice : 0,
              stock: normalizedStock !== undefined && !Number.isNaN(normalizedStock) ? normalizedStock : 0,
              images: imageUrls,
              woocommerce_id: woocommerce_id ?? null,
              woocommerce_slug: incomingSlug,
              woocommerce_permalink: incomingPermalink,
              woocommerce_json: product // ⭐ guardar JSON completo
            });
            
            results.push({
              sku,
              action: 'created',
              success: true,
              message: 'Producto creado exitosamente'
            });
            createdCount++;
          }
        } catch (error) {
          errorCount++;
          console.error(`[${requestId}] ❌ Error procesando producto`, {
            sku,
            woocommerce_id,
            error: error instanceof Error ? error.message : String(error)
          });
          results.push({
            sku,
            action: 'error',
            success: false,
            error: error instanceof Error ? error.message : 'Error desconocido'
          });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      const computedErrorCount = results.filter(r => !r.success).length;
      const durationMs = Date.now() - startTime;

      console.log(`[${requestId}] ✅ Sync finalizado en ${durationMs}ms`, {
        received: products.length,
        created: createdCount,
        updated: updatedCount,
        errors: errorCount,
        errors_computed: computedErrorCount
      });
      
      const response: ApiResponse = {
        success: true,
        message: `Sincronización completada. ${successCount} exitosos, ${computedErrorCount} errores.`,
        data: { results },
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      const durationMs = Date.now() - startTime;
      console.error(`[${requestId}] ❌ Error sincronizando productos después de ${durationMs}ms:`, error);
      const response: ApiResponse = {
        success: false,
        message: 'Error sincronizando productos',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  /**
   * POST /api/woocommerce/media - Subir archivo(s) a la galería multimedia de WordPress.
   * Requiere WP_APPLICATION_USER y WP_APPLICATION_PASSWORD en .env.
   * Devuelve [{ id, source_url }, ...] para usar en producto (images por id o por URL).
   */
  public async uploadMedia(req: Request, res: Response): Promise<void> {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        const response: ApiResponse = {
          success: false,
          message: 'No se enviaron archivos. Usa el campo "files" (múltiple) o "file" (único).',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const uploads: Array<{ id: number; source_url: string }> = [];
      for (const file of files) {
        const result = await this.wooCommerceService.uploadMediaToWordPress(
          file.buffer,
          file.originalname || 'image',
          file.mimetype || 'image/jpeg'
        );
        uploads.push(result);
      }

      const response: ApiResponse = {
        success: true,
        message: `${uploads.length} archivo(s) subido(s) a la galería de WordPress`,
        data: { uploads },
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (error) {
      console.error('WooCommerce uploadMedia error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error subiendo archivo(s) a WordPress',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // PUT /api/woocommerce/products/:sku/stock - Actualizar stock específico
  public async updateStock(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const requestId = `WC-PROD-STOCK-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    try {
      const { sku } = req.params;
      const { stock_quantity, operation = 'set' } = req.body;

      console.log(`[${requestId}] ========== UPDATE STOCK (Woo → ERP) ==========`);
      console.log(`[${requestId}] SKU: ${sku} | operation=${operation} | stock_quantity=${stock_quantity}`);
      
      if (typeof stock_quantity !== 'number' || stock_quantity < 0) {
        console.warn(`[${requestId}] ⚠️ stock_quantity inválido: ${stock_quantity}`);
        const response: ApiResponse = {
          success: false,
          message: 'stock_quantity debe ser un número positivo',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }
      
      const product = await this.productService.getProductByCode(sku);
      
      if (!product) {
        console.warn(`[${requestId}] ⚠️ Producto no encontrado por SKU: ${sku}`);
        const response: ApiResponse = {
          success: false,
          message: 'Producto no encontrado',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }
      
      const updatedProduct = await this.productService.updateStock(
        product.id, 
        stock_quantity, 
        operation as 'set' | 'add' | 'subtract'
      );

      console.log(`[${requestId}] ✅ Stock actualizado en ${Date.now() - startTime}ms`, {
        sku: updatedProduct.code,
        old_stock: product.stock,
        new_stock: updatedProduct.stock
      });
      
      const response: ApiResponse = {
        success: true,
        message: 'Stock actualizado exitosamente',
        data: {
          sku: updatedProduct.code,
          old_stock: product.stock,
          new_stock: updatedProduct.stock,
          operation
        },
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error(`[${requestId}] ❌ Error updateStock:`, error);
      const response: ApiResponse = {
        success: false,
        message: 'Error actualizando stock',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }
}
