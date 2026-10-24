import { ProductProvider, ProductResult, BarcodeSearchOptions } from './types';
import { upcProvider } from './providers/upc.provider';
import { discogsProvider } from './providers/discogs.provider';
import { tiendaProvider } from './providers/tienda.provider';
import { googleProvider } from './providers/google.provider';
import { serpapiProvider } from './providers/serpapi.provider';
import { logger } from '../../utils/logger';

/**
 * Lista de providers disponibles, ordenados por prioridad
 *
 * 1. upcProvider - UPCItemDB (rápido, sin API key)
 * 2. discogsProvider - Música (requiere API key)
 * 3. serpapiProvider - SerpApi Google Search (SERPAPI_KEY, principal)
 * 4. googleProvider - Google Custom Search (GOOGLE_API_KEY + GOOGLE_SEARCH_ENGINE_ID, fallback)
 * 5. tiendaProvider - Placeholder
 */
const providers: ProductProvider[] = [
  upcProvider,
  discogsProvider,
  serpapiProvider,
  googleProvider,
  tiendaProvider
];

/**
 * Resuelve un producto por código de barras consultando múltiples providers en paralelo
 *
 * @param barcode Código de barras a buscar
 * @param options Opciones (ej. prefer_site para restringir a mercadolibre, fravega, garbarino)
 * @returns ProductResult si se encuentra, null si no se encuentra en ningún provider
 */
export async function resolveProduct(barcode: string, options?: BarcodeSearchOptions): Promise<ProductResult | null> {
  const startTime = Date.now();

  logger.barcode.provider(`Iniciando ${providers.length} providers en paralelo: ${providers.map(p => p.name).join(', ')}${options?.prefer_site ? ` (prefer_site=${options.prefer_site})` : ''}`);

  try {
    const results = await Promise.allSettled(
      providers.map(provider => provider.search(barcode, options))
    );

    // Log resultado de cada provider
    for (let i = 0; i < results.length; i++) {
      const name = providers[i].name;
      const result = results[i];
      if (result.status === 'fulfilled') {
        if (result.value) {
          logger.barcode.provider(`${name}: OK → "${result.value.title}"`);
        } else {
          logger.barcode.provider(`${name}: sin resultados`);
        }
      } else {
        logger.barcode.provider(`${name}: error → ${(result.reason as Error)?.message || result.reason}`);
      }
    }

    // Tomar el primer resultado exitoso (prioridad por orden del array)
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled' && result.value) {
        const responseTime = Date.now() - startTime;
        logger.barcode.provider(`Usando resultado de ${providers[i].name} (${responseTime}ms total)`);
        logger.product.info(`Producto resuelto por ${providers[i].name} en ${responseTime}ms`);
        return {
          ...result.value,
          provider_response_time: responseTime
        };
      }
    }

    const totalTime = Date.now() - startTime;
    logger.barcode.provider(`Todos los providers terminaron sin resultado (${totalTime}ms)`);
    logger.product.info(`No se encontró producto para barcode ${barcode} después de ${totalTime}ms`);
    return null;
  } catch (error: any) {
    logger.barcode.error(`resolveProduct barcode=${barcode}:`, error?.message || error);
    logger.product.error(`Error crítico en resolveProduct para barcode ${barcode}:`, error);
    return null;
  }
}

/**
 * Valida el formato de un código de barras
 * 
 * @param barcode Código de barras a validar
 * @returns true si el formato es válido
 */
export function validateBarcode(barcode: string): boolean {
  if (!barcode || typeof barcode !== 'string') {
    return false;
  }

  // Remover espacios y guiones
  const cleaned = barcode.replace(/[\s-]/g, '');
  
  // Validar que sea numérico y tenga longitud válida
  if (!/^\d+$/.test(cleaned)) {
    return false;
  }
  
  const length = cleaned.length;
  // EAN-8, UPC-A (12), EAN-13 (13), GTIN-14 (14)
  return length === 8 || length === 12 || length === 13 || length === 14;
}
