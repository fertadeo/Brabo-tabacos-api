import { customsearch } from '@googleapis/customsearch';
import { ProductProvider, ProductResult, BarcodeSearchOptions, PREFER_SITE_DOMAINS } from '../types';
import { logger } from '../../../utils/logger';

const customsearchClient = customsearch('v1');

/**
 * Helper: Extrae precio de un texto (formato: $1.500,00 o $1500.00)
 */
function extractPriceFromText(text: string): number | null {
  // Buscar patrones de precio: $1.500,00 o $1500.00 o ARS 1500
  const pricePatterns = [
    /\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/, // $1.500,00 o $1500.00
    /ARS\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/, // ARS 1500
    /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*pesos/i, // 1500 pesos
  ];

  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (match) {
      const priceStr = match[1].replace(/\./g, '').replace(',', '.');
      const price = parseFloat(priceStr);
      if (!isNaN(price) && price > 0) {
        return price;
      }
    }
  }

  return null;
}

/**
 * Helper: Extrae marca del texto (busca palabras comunes de marcas)
 */
function extractBrandFromText(text: string): string | null {
  const commonBrands = [
    'Logitech', 'Sony', 'Samsung', 'LG', 'Philips', 'Panasonic',
    'HP', 'Dell', 'Lenovo', 'Asus', 'Acer', 'Microsoft',
    'Apple', 'Xiaomi', 'Huawei', 'Canon', 'Nikon', 'Epson',
    'Brother', 'Ricoh', 'Kodak', 'Fujifilm'
  ];

  const textLower = text.toLowerCase();
  for (const brand of commonBrands) {
    if (textLower.includes(brand.toLowerCase())) {
      return brand;
    }
  }

  return null;
}

/**
 * Helper: Limpia el título removiendo información innecesaria
 */
function cleanTitle(title: string): string {
  // Remover " - Google Shopping" o similares
  return title
    .replace(/\s*-\s*Google\s+Shopping.*/i, '')
    .replace(/\s*-\s*Mercado\s+Libre.*/i, '')
    .replace(/\s*-\s*Amazon.*/i, '')
    .trim();
}

/**
 * Helper: Extrae categoría sugerida del link
 */
function extractCategoryFromLink(link: string): string | null {
  const linkLower = link.toLowerCase();
  
  const categoryMap: { [key: string]: string } = {
    'electronica': 'Electrónica',
    'computacion': 'Computación',
    'hogar': 'Hogar',
    'decoracion': 'Decoración',
    'iluminacion': 'Iluminación',
    'limpieza': 'Limpieza',
    'carga': 'Electrónica',
    'cable': 'Electrónica',
    'audio': 'Audio',
    'video': 'Video'
  };

  for (const [keyword, category] of Object.entries(categoryMap)) {
    if (linkLower.includes(keyword)) {
      return category;
    }
  }

  return null;
}

/**
 * Provider para Google Custom Search JSON API.
 * Usa solo @googleapis/customsearch (submódulo ligero, sin el paquete googleapis completo).
 *
 * Documentación:
 * - npm: https://www.npmjs.com/package/@googleapis/customsearch
 * - API REST: https://developers.google.com/custom-search/v1/introduction
 *
 * Setup:
 * 1. Motor en https://programmablesearchengine.google.com/ → "Buscar en toda la web".
 * 2. Google Cloud: habilitar Custom Search API, crear clave de API.
 * 3. GOOGLE_API_KEY, GOOGLE_SEARCH_ENGINE_ID (cx).
 */
export const googleProvider: ProductProvider = {
  name: 'google',
  
  async search(barcode: string, options?: BarcodeSearchOptions): Promise<ProductResult | null> {
    const start = Date.now();
    try {
      const apiKey = process.env.GOOGLE_API_KEY;
      const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

      if (!apiKey || !searchEngineId) {
        logger.barcode.provider(`google: omitido (GOOGLE_API_KEY o GOOGLE_SEARCH_ENGINE_ID no configurados)`);
        return null;
      }

      const cleanedBarcode = barcode.replace(/[\s-]/g, '');
      if (!/^\d+$/.test(cleanedBarcode)) {
        logger.barcode.provider(`google: barcode inválido, skip`);
        return null;
      }

      const preferSite = options?.prefer_site;
      const siteDomain = preferSite ? PREFER_SITE_DOMAINS[preferSite] : null;
      const searchQuery = siteDomain ? `${cleanedBarcode} site:${siteDomain}` : cleanedBarcode;

      logger.barcode.provider(`google: llamando Custom Search API q="${searchQuery}" cx=${searchEngineId}`);

      const response = await customsearchClient.cse.list({
        auth: apiKey,
        cx: searchEngineId,
        q: searchQuery
      }, { timeout: 5000 });

      const data = response.data;
      if (data?.items && data.items.length > 0) {
        // Buscar el mejor resultado (priorizar Google Shopping o tiendas conocidas)
        let bestResult = data.items[0];
        
        // Priorizar resultados de Google Shopping o tiendas de e-commerce
        for (const item of data.items) {
          const link = item.link?.toLowerCase() || '';
          if (link.includes('google.com/shopping') || 
              link.includes('mercadolibre.com') ||
              link.includes('amazon.com') ||
              link.includes('.com.ar')) {
            bestResult = item;
            break;
          }
        }

        // Extraer precio del snippet si está disponible
        const price = extractPriceFromText(bestResult.snippet || bestResult.title || '');
        
        // Extraer imágenes si están disponibles en pagemap
        const images: string[] = [];
        if (bestResult.pagemap?.cse_image) {
          bestResult.pagemap.cse_image.forEach((img: any) => {
            if (img.src) images.push(img.src);
          });
        }
        if (bestResult.pagemap?.metatags) {
          bestResult.pagemap.metatags.forEach((meta: any) => {
            if (meta['og:image']) images.push(meta['og:image']);
            if (meta['twitter:image']) images.push(meta['twitter:image']);
          });
        }

        // Extraer marca del título o snippet
        const brand = extractBrandFromText(bestResult.title || bestResult.snippet || '');

        const category = extractCategoryFromLink(bestResult.link || '');

        logger.barcode.provider(`google: encontrado → "${cleanTitle(bestResult.title || '')}" (${Date.now() - start}ms)`);
        return {
          title: cleanTitle(bestResult.title || 'Producto encontrado'),
          description: bestResult.snippet || undefined,
          brand: brand || undefined,
          images: images.length > 0 ? images : undefined,
          source: 'google',
          suggested_price: price || undefined,
          category_suggestion: category || undefined
        };
      }

      logger.barcode.provider(`google: sin resultados (${Date.now() - start}ms)`);
      return null;
    } catch (error: any) {
      const ms = Date.now() - start;
      const status = error.response?.status;
      const body = error.response?.data;
      const detail = body?.error?.message || body?.error?.errors?.[0]?.message || error.message;

      if (status === 429) {
        logger.barcode.provider(`google: rate limit (429) barcode=${barcode} ${ms}ms`);
      } else if (status === 403) {
        logger.barcode.provider(`google: API key inválida o sin permisos (403) ${ms}ms`);
      } else if (status === 400) {
        logger.barcode.provider(`google: 400 Bad Request → ${detail} (${ms}ms)`);
        logger.barcode.provider(`google: Revisar: motor en programmablesearchengine.google.com debe ser "Buscar en toda la web"; API key con Custom Search API habilitada.`);
        if (body?.error?.message) {
          logger.barcode.error(`google response: ${JSON.stringify(body.error)}`);
        }
      } else {
        logger.barcode.provider(`google: error → ${detail} (${ms}ms)`);
      }
      return null;
    }
  }
};
