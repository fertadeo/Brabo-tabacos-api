import axios from 'axios';
import { ProductProvider, ProductResult, BarcodeSearchOptions, PREFER_SITE_DOMAINS } from '../types';
import { logger } from '../../../utils/logger';

/**
 * Helper: Extrae precio de un texto (formato: $1.500,00 o $1500.00)
 */
function extractPriceFromText(text: string): number | null {
  const pricePatterns = [
    /\$\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/,
    /ARS\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/,
    /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*pesos/i,
  ];
  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (match) {
      const priceStr = match[1].replace(/\./g, '').replace(',', '.');
      const price = parseFloat(priceStr);
      if (!isNaN(price) && price > 0) return price;
    }
  }
  return null;
}

function extractBrandFromText(text: string): string | null {
  const brands = [
    'Logitech', 'Sony', 'Samsung', 'LG', 'Philips', 'Panasonic',
    'HP', 'Dell', 'Lenovo', 'Asus', 'Acer', 'Microsoft', 'Apple',
    'Xiaomi', 'Huawei', 'Canon', 'Nikon', 'Epson', 'Brother', 'Ricoh', 'Kodak', 'Fujifilm'
  ];
  const lower = text.toLowerCase();
  for (const brand of brands) {
    if (lower.includes(brand.toLowerCase())) return brand;
  }
  return null;
}

function cleanTitle(title: string): string {
  return title
    .replace(/\s*-\s*Google\s+Shopping.*/i, '')
    .replace(/\s*-\s*Mercado\s+Libre.*/i, '')
    .replace(/\s*-\s*Amazon.*/i, '')
    .trim();
}

function extractCategoryFromLink(link: string): string | null {
  const map: Record<string, string> = {
    'electronica': 'Electrónica', 'computacion': 'Computación', 'hogar': 'Hogar',
    'decoracion': 'Decoración', 'iluminacion': 'Iluminación', 'limpieza': 'Limpieza',
    'carga': 'Electrónica', 'cable': 'Electrónica', 'audio': 'Audio', 'video': 'Video',
  };
  const lower = link.toLowerCase();
  for (const [keyword, category] of Object.entries(map)) {
    if (lower.includes(keyword)) return category;
  }
  return null;
}

/**
 * Resultado orgánico SerpApi (Google Search)
 * https://serpapi.com/search-api
 */
interface SerpApiOrganicResult {
  position?: number;
  title?: string;
  link?: string;
  snippet?: string;
  thumbnail?: string;
  source?: string;
  price?: string;
}

interface SerpApiResponse {
  organic_results?: SerpApiOrganicResult[];
  shopping_results?: SerpApiOrganicResult[];
  error?: string;
  search_metadata?: { status?: string };
  search_information?: { total_results?: number };
}

/**
 * Resultado Google Shopping (SerpApi) - mejores imágenes para productos
 * https://serpapi.com/google-shopping-new-layout
 */
interface SerpApiShoppingResult {
  position?: number;
  title?: string;
  link?: string;
  product_link?: string;
  snippet?: string;
  source?: string;
  price?: string;
  extracted_price?: number;
  thumbnail?: string;
  serpapi_thumbnail?: string;
  thumbnails?: string[];
  serpapi_thumbnails?: string[];
}

interface SerpApiShoppingResponse {
  shopping_results?: SerpApiShoppingResult[];
  inline_shopping_results?: SerpApiShoppingResult[];
  error?: string;
}

/**
 * Resultado Google Images (SerpApi) - fallback para obtener al menos una imagen
 * https://serpapi.com/google-images-api
 */
interface SerpApiImagesResult {
  position?: number;
  title?: string;
  image?: string;
  thumbnail?: string;
  link?: string;
}

interface SerpApiImagesResponse {
  images_results?: SerpApiImagesResult[];
  error?: string;
}

/** Añade URLs de imagen sin duplicados; prioriza serpapi_* (mejor calidad). */
function collectImageUrls(images: string[], ...candidates: (string | string[] | undefined)[]): void {
  const seen = new Set(images);
  for (const c of candidates) {
    if (!c) continue;
    const urls = Array.isArray(c) ? c : [c];
    for (const url of urls) {
      if (url && url.startsWith('http') && !seen.has(url)) {
        seen.add(url);
        images.push(url);
      }
    }
  }
}

/**
 * Provider para SerpApi: Google Shopping (prioridad) y Google Search (fallback).
 * Prioriza imágenes de calidad (serpapi_thumbnail, thumbnails). Si no hay imagen,
 * intenta Google Images con el título del producto.
 * Variables de entorno: SERPAPI_KEY
 */
export const serpapiProvider: ProductProvider = {
  name: 'serpapi',

  async search(barcode: string, options?: BarcodeSearchOptions): Promise<ProductResult | null> {
    const start = Date.now();
    try {
      const apiKey = process.env.SERPAPI_KEY;
      if (!apiKey) {
        logger.barcode.provider(`serpapi: omitido (SERPAPI_KEY no configurada)`);
        return null;
      }

      const cleanedBarcode = barcode.replace(/[\s-]/g, '');
      if (!/^\d+$/.test(cleanedBarcode)) {
        logger.barcode.provider(`serpapi: barcode inválido, skip`);
        return null;
      }

      const preferSite = options?.prefer_site;
      const siteDomain = preferSite ? PREFER_SITE_DOMAINS[preferSite] : null;
      const searchQuery = siteDomain ? `${cleanedBarcode} site:${siteDomain}` : cleanedBarcode;

      const baseParams = { api_key: apiKey };
      const locationParams = { google_domain: 'google.com.ar' as const, gl: 'ar', hl: 'es' };
      let title = 'Producto encontrado';
      let snippet = '';
      let link = '';
      let source_site: string | null = null;
      let price: number | null = null;
      let brand: string | null = null;
      let category: string | null = null;
      const images: string[] = [];

      // 1) Con prefer_site solo usamos Google Search con site:; sin prefer_site intentamos Google Shopping primero
      if (!siteDomain) {
        try {
          logger.barcode.provider(`serpapi: intentando Google Shopping q="${cleanedBarcode}"`);
          const shopRes = await axios.get<SerpApiShoppingResponse>('https://serpapi.com/search', {
            params: { ...baseParams, ...locationParams, engine: 'google_shopping', q: cleanedBarcode },
            timeout: 8000,
          });
          const shop = shopRes.data;
          if (!shop.error && (shop.shopping_results?.length || shop.inline_shopping_results?.length)) {
            const items = (shop.shopping_results?.length ? shop.shopping_results : shop.inline_shopping_results) || [];
            const best = items[0];
            title = best.title || title;
            snippet = best.snippet || '';
            link = best.link || best.product_link || '';
            source_site = best.source || null;
            price = best.extracted_price ?? extractPriceFromText(`${best.price || ''} ${snippet}`.trim());
            brand = extractBrandFromText(title + ' ' + snippet);
            category = link ? extractCategoryFromLink(link) : null;
            collectImageUrls(images, best.serpapi_thumbnail, best.thumbnail, best.serpapi_thumbnails, best.thumbnails);
            logger.barcode.provider(`serpapi: Google Shopping → "${cleanTitle(title)}" imágenes=${images.length}`);
          }
        } catch (_) {
          // seguir a Google Search
        }
      }

      // 2) Si no hubo resultado de Shopping (o hay prefer_site), usar Google Search
      if (!snippet && !link && title === 'Producto encontrado') {
        logger.barcode.provider(`serpapi: Google Search q="${searchQuery}"`);
        const response = await axios.get<SerpApiResponse>('https://serpapi.com/search', {
          params: { ...baseParams, ...locationParams, engine: 'google', q: searchQuery },
          timeout: 8000,
        });
        const data = response.data;
        if (data.error) {
          logger.barcode.provider(`serpapi: API error → ${data.error} (${Date.now() - start}ms)`);
          return null;
        }
        const items = (data.shopping_results?.length ? data.shopping_results : data.organic_results) || [];
        if (items.length === 0) {
          logger.barcode.provider(`serpapi: sin resultados (${Date.now() - start}ms)`);
          return null;
        }
        let best = items[0];
        for (const item of items) {
          const linkLower = (item.link || '').toLowerCase();
          if (linkLower.includes('mercadolibre.com') || linkLower.includes('amazon.') || linkLower.includes('.com.ar') || linkLower.includes('tienda')) {
            best = item;
            break;
          }
        }
        title = best.title || title;
        snippet = best.snippet || '';
        link = best.link || '';
        source_site = best.source || null;
        price = extractPriceFromText(`${best.price || ''} ${snippet || title}`.trim());
        brand = extractBrandFromText(title + ' ' + snippet);
        category = link ? extractCategoryFromLink(link) : null;
        collectImageUrls(images, best.thumbnail);
        logger.barcode.provider(`serpapi: Google Search → "${cleanTitle(title)}" imágenes=${images.length}`);
      }

      // 3) Si tenemos producto pero ninguna imagen, intentar Google Images con el título
      if (images.length === 0 && title && title !== 'Producto encontrado') {
        const query = cleanTitle(title).slice(0, 120);
        try {
          const imgRes = await axios.get<SerpApiImagesResponse>('https://serpapi.com/search', {
            params: { ...baseParams, ...locationParams, engine: 'google_images', q: query },
            timeout: 6000,
          });
          const imgData = imgRes.data;
          if (!imgData.error && imgData.images_results?.length) {
            const first = imgData.images_results[0];
            const imgUrl = first.image || first.thumbnail;
            if (imgUrl) {
              images.push(imgUrl);
              logger.barcode.provider(`serpapi: imagen por Google Images (título)`);
            }
          }
        } catch (_) {
          // ignorar fallo de imágenes
        }
      }

      logger.barcode.provider(`serpapi: encontrado → "${cleanTitle(title)}" (${Date.now() - start}ms) imágenes=${images.length}`);
      return {
        title: cleanTitle(title),
        description: snippet || undefined,
        brand: brand || undefined,
        images: images.length > 0 ? images : undefined,
        source: 'serpapi',
        source_site: source_site || undefined,
        suggested_price: price ?? undefined,
        category_suggestion: category || undefined,
      };
    } catch (error: any) {
      const ms = Date.now() - start;
      const status = error.response?.status;
      const body = error.response?.data;
      const msg = body?.error || error.message;

      if (status === 401) {
        logger.barcode.provider(`serpapi: API key inválida (401) ${ms}ms`);
      } else if (status === 403) {
        logger.barcode.provider(`serpapi: API key sin permisos o bloqueada (403) ${ms}ms`);
      } else if (status === 429) {
        logger.barcode.provider(`serpapi: rate limit (429) ${ms}ms`);
      } else {
        logger.barcode.provider(`serpapi: error → ${msg} (${ms}ms)`);
      }
      return null;
    }
  },
};
