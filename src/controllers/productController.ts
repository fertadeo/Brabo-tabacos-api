import { Request, Response } from 'express';
import { executeQuery } from '../config/database';
import { ApiResponse, Product } from '../types';
import { validationResult } from 'express-validator';
import { ProductService } from '../services/ProductService';
import { BarcodeLookupService } from '../services/BarcodeLookupService';

export class ProductController {
  private productService: ProductService;
  private barcodeLookupService: BarcodeLookupService;

  constructor() {
    this.productService = new ProductService();
    this.barcodeLookupService = new BarcodeLookupService();
  }

  // GET /api/products - Get all products with pagination and filters
  // Query: page, limit (default 10; máx 10000), all=true o limit=0 para traer todos sin paginar
  public async getAllProducts(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 10, all, category_id, search, active_only = 'true' } = req.query;
      const wantAll = all === 'true' || all === '1' || String(limit) === '0';
      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = wantAll ? 10 : Math.max(1, Number(limit) || 10);

      const result = await this.productService.getAllProducts({
        page: wantAll ? 1 : pageNum,
        limit: limitNum,
        all: wantAll,
        category_id: category_id ? Number(category_id) : undefined,
        search: search as string,
        active_only: active_only === 'true'
      });

      const effectiveLimit = wantAll ? result.products.length : limitNum;
      const response: ApiResponse<any> = {
        success: true,
        message: 'Products retrieved successfully',
        data: {
          products: result.products,
          pagination: {
            page: wantAll ? 1 : pageNum,
            limit: effectiveLimit,
            total: result.total,
            totalPages: wantAll ? 1 : Math.ceil(result.total / limitNum)
          }
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Get products error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error retrieving products',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/products/:id - Get product by ID
  public async getProductById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Usar el servicio en lugar de lógica SQL directa
      const product = await this.productService.getProductById(Number(id));
      
      if (!product) {
        const response: ApiResponse = {
          success: false,
          message: 'Product not found',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }
      
      const response: ApiResponse<Product> = {
        success: true,
        message: 'Product retrieved successfully',
        data: product,
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Get product by ID error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error retrieving product',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/products/:id/woocommerce-json - Obtener JSON completo almacenado desde WooCommerce
  public async getWooCommerceJson(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const productId = Number(id);

      // Verificar existencia del producto
      const product = await this.productService.getProductById(productId);
      if (!product) {
        const response: ApiResponse = {
          success: false,
          message: 'Product not found',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const woocommerceJson = await this.productService.getWooCommerceJsonByProductId(productId);

      const response: ApiResponse<any> = {
        success: true,
        message: woocommerceJson ? 'WooCommerce JSON obtenido exitosamente' : 'El producto no tiene WooCommerce JSON almacenado',
        data: {
          id: product.id,
          code: product.code,
          woocommerce_id: (product as any).woocommerce_id ?? null,
          woocommerce_json: woocommerceJson
        },
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Get WooCommerce JSON error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error retrieving WooCommerce JSON',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // POST /api/products - Create new product
  public async createProduct(req: Request, res: Response): Promise<void> {
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

      const { 
        code, 
        name, 
        description, 
        category_id, 
        images,
        woocommerce_image_ids,
        barcode,
        qr_code,
        price,
        iva_rate,
        stock = 0, 
        min_stock = 0, 
        max_stock = 1000,
        weight,
        length,
        width,
        height,
        allow_backorders,
        is_active,
        sync_to_woocommerce = false
      } = req.body;
      
      const newProduct = await this.productService.createProduct({
        code,
        name,
        description: description ?? null,
        category_id: category_id ?? null,
        images: images ?? null,
        woocommerce_image_ids: woocommerce_image_ids ?? null,
        barcode: barcode ?? null,
        qr_code: qr_code ?? null,
        price,
        iva_rate,
        stock,
        min_stock,
        max_stock,
        weight: weight ?? null,
        length: length ?? null,
        width: width ?? null,
        height: height ?? null,
        allow_backorders: allow_backorders === true,
        is_active: is_active === undefined ? undefined : Boolean(is_active)
      }, sync_to_woocommerce === true);
      
      const response: ApiResponse<Product> = {
        success: true,
        message: 'Product created successfully',
        data: newProduct,
        timestamp: new Date().toISOString()
      };
      
      res.status(201).json(response);
    } catch (error) {
      console.error('Create product error:', error);
      const statusCode =
        error instanceof Error && error.message.includes('ya existe') ? 409 : 500;
      const response: ApiResponse = {
        success: false,
        message: statusCode === 409 ? 'Product code already exists' : 'Error creating product',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(statusCode).json(response);
    }
  }

  // PUT /api/products/:id - Update product
  public async updateProduct(req: Request, res: Response): Promise<void> {
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

      const { id } = req.params;
      const { 
        code, 
        name, 
        description, 
        category_id, 
        images,
        woocommerce_image_ids,
        barcode,
        qr_code,
        price,
        iva_rate,
        stock, 
        min_stock, 
        max_stock, 
        is_active,
        weight,
        length,
        width,
        height,
        allow_backorders,
        sync_to_woocommerce = false
      } = req.body;
      
      const updatedProduct = await this.productService.updateProduct(Number(id), {
        code,
        name,
        description: description === undefined ? undefined : (description ?? null),
        category_id: category_id === undefined ? undefined : (category_id ?? null),
        images: images === undefined ? undefined : (images ?? null),
        woocommerce_image_ids: woocommerce_image_ids === undefined ? undefined : (woocommerce_image_ids ?? null),
        barcode: barcode === undefined ? undefined : (barcode ?? null),
        qr_code: qr_code === undefined ? undefined : (qr_code ?? null),
        price,
        iva_rate,
        stock,
        min_stock,
        max_stock,
        is_active,
        weight: weight === undefined ? undefined : (weight ?? null),
        length: length === undefined ? undefined : (length ?? null),
        width: width === undefined ? undefined : (width ?? null),
        height: height === undefined ? undefined : (height ?? null),
        allow_backorders: allow_backorders === undefined ? undefined : (allow_backorders === true)
      }, sync_to_woocommerce === true);
      
      const response: ApiResponse<Product> = {
        success: true,
        message: 'Product updated successfully',
        data: updatedProduct,
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Update product error:', error);
      const statusCode =
        error instanceof Error && error.message.includes('no encontrado') ? 404 :
        error instanceof Error && error.message.includes('ya existe') ? 409 :
        500;
      const response: ApiResponse = {
        success: false,
        message:
          statusCode === 404 ? 'Product not found' :
          statusCode === 409 ? 'Product code already exists' :
          'Error updating product',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(statusCode).json(response);
    }
  }

  // POST /api/products/:id/sync-to-woocommerce - Sincronizar producto a WooCommerce (crear o actualizar)
  public async syncProductToWooCommerce(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const productId = Number(id);

      const result = await this.productService.syncProductToWooCommerce(productId);

      const response: ApiResponse<{ woocommerce_id: number; woocommerce_slug: string | null; woocommerce_permalink: string | null; created: boolean }> = {
        success: true,
        message: result.created ? 'Producto creado en WooCommerce' : 'Producto actualizado en WooCommerce',
        data: result,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Sync product to WooCommerce error:', error);
      const statusCode =
        error instanceof Error && error.message.includes('no encontrado') ? 404 :
        error instanceof Error && error.message.includes('no está configurado') ? 503 : 500;
      const response: ApiResponse = {
        success: false,
        message: error instanceof Error ? error.message : 'Error sincronizando producto a WooCommerce',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(statusCode).json(response);
    }
  }

  // POST /api/products/:id/link-woocommerce - Vincular producto a un ID específico de WooCommerce
  public async linkProductToWooCommerce(req: Request, res: Response): Promise<void> {
    try {
      const productId = Number(req.params.id);
      const woocommerceId = Number(req.body?.woocommerce_id);
      const updatedProduct = await this.productService.linkProductToWooCommerce(productId, woocommerceId);
      const response: ApiResponse<Product> = {
        success: true,
        message: 'Producto vinculado con WooCommerce correctamente',
        data: updatedProduct as any,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (error) {
      const statusCode =
        error instanceof Error && error.message.includes('no encontrado') ? 404 :
        error instanceof Error && error.message.includes('no está configurado') ? 503 : 500;
      const response: ApiResponse = {
        success: false,
        message: 'Error vinculando producto con WooCommerce',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(statusCode).json(response);
    }
  }

  // POST /api/products/link-woocommerce-ids - Vincular woocommerce_id de todos los productos por SKU
  public async bulkLinkProductsFromWooCommerce(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.productService.bulkLinkProductsFromWooCommerce();

      const response: ApiResponse<typeof result> = {
        success: true,
        message: `Vinculación completada: ${result.linked} vinculados, ${result.already_linked} ya vinculados, ${result.not_found_in_erp} sin coincidencia en ERP (${result.missing_sku_in_wc} sin SKU en WC)`,
        data: result,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Bulk link products from WooCommerce error:', error);
      const statusCode =
        error instanceof Error && error.message.includes('no está configurado') ? 503 : 500;
      const response: ApiResponse = {
        success: false,
        message: error instanceof Error ? error.message : 'Error vinculando productos con WooCommerce',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(statusCode).json(response);
    }
  }

  // POST /api/products/woocommerce/backfill-slugs - Backfill de slug/permalink para productos vinculados
  public async backfillWooCommerceSlugs(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.body?.limit != null ? Number(req.body.limit) : undefined;
      const dry_run = req.body?.dry_run === true;
      const result = await this.productService.backfillWooCommerceSlugs({ limit, dry_run });
      const response: ApiResponse<typeof result> = {
        success: true,
        message: 'Backfill de WooCommerce slug/permalink ejecutado',
        data: result,
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (error) {
      const statusCode = error instanceof Error && error.message.includes('no está configurado') ? 503 : 500;
      const response: ApiResponse = {
        success: false,
        message: 'Error ejecutando backfill de WooCommerce slug/permalink',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(statusCode).json(response);
    }
  }

  // PUT /api/products/:id/stock - Update product stock
  public async updateStock(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { stock, operation = 'set' } = req.body; // operation: 'set', 'add', 'subtract'
      
      if (typeof stock !== 'number' || stock < 0) {
        const response: ApiResponse = {
          success: false,
          message: 'Invalid stock value',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }
      
      // Check if product exists
      const existingProductResult = await executeQuery('SELECT id, stock FROM products WHERE id = ?', [id]);
      const existingProduct = existingProductResult[0];
      if (!existingProduct) {
        const response: ApiResponse = {
          success: false,
          message: 'Product not found',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }
      
      let newStock = stock;
      if (operation === 'add') {
        newStock = existingProduct.stock + stock;
      } else if (operation === 'subtract') {
        newStock = Math.max(0, existingProduct.stock - stock);
      }
      
      const updateQuery = 'UPDATE products SET stock = ? WHERE id = ?';
      await executeQuery(updateQuery, [newStock, id]);
      
      // Get the updated product
      const updatedProductResult = await executeQuery('SELECT * FROM products WHERE id = ?', [id]);
      const updatedProduct = updatedProductResult[0];
      
      const response: ApiResponse<Product> = {
        success: true,
        message: `Stock ${operation === 'set' ? 'updated' : operation === 'add' ? 'increased' : 'decreased'} successfully`,
        data: updatedProduct,
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Update stock error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error updating stock',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/products/stock/low - Get products with low stock
  public async getLowStockProducts(req: Request, res: Response): Promise<void> {
    try {
      // Usar el servicio en lugar de lógica SQL directa
      const products = await this.productService.getLowStockProducts();
      
      const response: ApiResponse<any> = {
        success: true,
        message: 'Low stock products retrieved successfully',
        data: { products },
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Get low stock products error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error retrieving low stock products',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // GET /api/products/stats - Get product statistics
  public async getProductStats(req: Request, res: Response): Promise<void> {
    try {
      // Usar el servicio en lugar de lógica SQL directa
      const stats = await this.productService.getProductStats();
      
      const response: ApiResponse = {
        success: true,
        message: 'Product statistics retrieved successfully',
        data: stats,
        timestamp: new Date().toISOString()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Get product stats error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error retrieving product statistics',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }

  // DELETE /api/products/:id - Delete product (soft delete). En el ERP se desactiva; en WooCommerce se mueve a la papelera.
  public async deleteProduct(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await this.productService.deleteProduct(Number(id));
      const response: ApiResponse = {
        success: true,
        message: `Producto "${deleted.name}" eliminado correctamente. En WooCommerce se ha enviado a la papelera si estaba vinculado.`,
        data: { id: deleted.id, name: deleted.name },
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (error) {
      console.error('Delete product error:', error);
      const isNotFound = error instanceof Error && error.message.includes('no encontrado');
      const response: ApiResponse = {
        success: false,
        message: isNotFound ? 'Product not found' : 'Error deleting product',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(isNotFound ? 404 : 500).json(response);
    }
  }

  // DELETE /api/products/:id/permanent - Permanently delete product (ERP y WooCommerce).
  public async permanentDeleteProduct(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await this.productService.deleteProductPermanently(Number(id));
      const response: ApiResponse = {
        success: true,
        message: `Producto "${deleted.name}" eliminado permanentemente (ERP y WooCommerce si estaba vinculado).`,
        data: { id: deleted.id, name: deleted.name },
        timestamp: new Date().toISOString()
      };
      res.status(200).json(response);
    } catch (error) {
      console.error('Permanent delete product error:', error);
      const isNotFound = error instanceof Error && error.message.includes('no encontrado');
      const response: ApiResponse = {
        success: false,
        message: isNotFound ? 'Product not found' : 'Error permanently deleting product',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(isNotFound ? 404 : 500).json(response);
    }
  }

  // GET /api/products/barcode/:code - Buscar producto por código de barras
  public async getProductByBarcode(req: Request, res: Response): Promise<void> {
    try {
      const { code } = req.params;
      
      if (!code) {
        const response: ApiResponse = {
          success: false,
          message: 'Código de barras es requerido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const preferSite = req.query.prefer_site as 'mercadolibre' | 'fravega' | 'garbarino' | undefined;
      const lookupResult = await this.barcodeLookupService.lookupBarcode(code, preferSite ? { prefer_site: preferSite } : undefined);
      
      if (!lookupResult) {
        const response: ApiResponse = {
          success: false,
          message: 'No se encontraron datos para este código de barras',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      const response: ApiResponse<any> = {
        success: true,
        message: 'Datos encontrados exitosamente',
        data: lookupResult,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Get product by barcode error:', error);
      const isInvalidFormat = error instanceof Error && error.message.includes('inválido');
      const response: ApiResponse = {
        success: false,
        message: isInvalidFormat ? 'Formato de código de barras inválido' : 'Error buscando producto por código de barras',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(isInvalidFormat ? 400 : 500).json(response);
    }
  }

  // POST /api/products/barcode/:code/accept - Aceptar datos y crear producto
  public async acceptBarcodeData(req: Request, res: Response): Promise<void> {
    try {
      const { code } = req.params;
      const { category_id, price, stock, code: productCode } = req.body;

      if (!code) {
        const response: ApiResponse = {
          success: false,
          message: 'Código de barras es requerido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      const product = await this.barcodeLookupService.acceptBarcodeData(code, {
        category_id: category_id ? Number(category_id) : undefined,
        price: price ? Number(price) : undefined,
        stock: stock ? Number(stock) : undefined,
        code: productCode
      });

      const response: ApiResponse<Product> = {
        success: true,
        message: 'Producto creado exitosamente',
        data: product,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Accept barcode data error:', error);
      const isNotFound = error instanceof Error && error.message.includes('No se encontraron');
      const isDuplicate = error instanceof Error && error.message.includes('ya existe');
      
      const response: ApiResponse = {
        success: false,
        message: isNotFound 
          ? 'No se encontraron datos para este código de barras' 
          : isDuplicate
          ? 'El código del producto ya existe'
          : 'Error al crear producto',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      
      res.status(isNotFound ? 404 : isDuplicate ? 400 : 500).json(response);
    }
  }

  // POST /api/products/barcode/:code/create - Modificar datos y crear producto
  public async createProductFromBarcode(req: Request, res: Response): Promise<void> {
    try {
      const { code } = req.params;
      const productData = req.body;

      if (!code) {
        const response: ApiResponse = {
          success: false,
          message: 'Código de barras es requerido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Validar que el barcode en el body coincida con el parámetro
      if (productData.barcode && productData.barcode.replace(/[\s-]/g, '') !== code.replace(/[\s-]/g, '')) {
        const response: ApiResponse = {
          success: false,
          message: 'El código de barras en el body no coincide con el parámetro de la URL',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      // Verificar que existan datos en cache para este barcode
      const lookupResult = await this.barcodeLookupService.lookupBarcode(code);
      if (!lookupResult || lookupResult.exists_as_product) {
        const response: ApiResponse = {
          success: false,
          message: 'No se encontraron datos para este código de barras. Debe buscar primero.',
          timestamp: new Date().toISOString()
        };
        res.status(404).json(response);
        return;
      }

      // Crear producto con datos modificados usando ProductService
      const product = await this.productService.createProduct({
        code: productData.code,
        name: productData.name || lookupResult.title,
        description: productData.description || lookupResult.description || null,
        category_id: productData.category_id || null,
        price: productData.price || lookupResult.suggested_price || 0,
        iva_rate: productData.iva_rate,
        stock: productData.stock || 0,
        min_stock: productData.min_stock || 0,
        max_stock: productData.max_stock || 1000,
        barcode: code.replace(/[\s-]/g, ''),
        images: productData.images || lookupResult.images || null
      }, false);

      const response: ApiResponse<Product> = {
        success: true,
        message: 'Producto creado exitosamente',
        data: product,
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Create product from barcode error:', error);
      const isDuplicate = error instanceof Error && error.message.includes('ya existe');
      const isNotFound = error instanceof Error && error.message.includes('no encontrado');
      
      const response: ApiResponse = {
        success: false,
        message: isDuplicate 
          ? 'El código del producto ya existe'
          : isNotFound
          ? 'No se encontraron datos para este código de barras'
          : 'Error al crear producto',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      
      res.status(isDuplicate || isNotFound ? 400 : 500).json(response);
    }
  }

  // POST /api/products/barcode/:code/ignore - Ignorar datos encontrados
  public async ignoreBarcodeData(req: Request, res: Response): Promise<void> {
    try {
      const { code } = req.params;
      const userId = (req as any).user?.id; // Obtener ID del usuario desde JWT

      if (!code) {
        const response: ApiResponse = {
          success: false,
          message: 'Código de barras es requerido',
          timestamp: new Date().toISOString()
        };
        res.status(400).json(response);
        return;
      }

      await this.barcodeLookupService.ignoreBarcodeData(code, userId);

      const response: ApiResponse = {
        success: true,
        message: 'Datos descartados exitosamente',
        timestamp: new Date().toISOString()
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Ignore barcode data error:', error);
      const response: ApiResponse = {
        success: false,
        message: 'Error al descartar datos',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      res.status(500).json(response);
    }
  }
}
