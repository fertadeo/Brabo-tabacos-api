import { executeQuery } from '../config/database';

export interface BarcodeLookupCache {
  id: number;
  barcode: string;
  title: string;
  description?: string | null;
  brand?: string | null;
  images?: string[] | null;
  source: string;
  source_site?: string | null;
  raw_json?: any | null;
  suggested_price?: number | null;
  category_suggestion?: string | null;
  ignored: boolean;
  ignored_at?: string | null;
  ignored_by_user_id?: number | null;
  last_used_at?: string | null;
  hit_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateBarcodeLookupCacheData {
  barcode: string;
  title: string;
  description?: string | null;
  brand?: string | null;
  images?: string[] | null;
  source: string;
  source_site?: string | null;
  raw_json?: any | null;
  suggested_price?: number | null;
  category_suggestion?: string | null;
}

export class BarcodeLookupCacheRepository {
  /**
   * Buscar en cache por código de barras
   */
  async findByBarcode(barcode: string): Promise<BarcodeLookupCache | null> {
    const query = `
      SELECT * FROM barcode_lookup_cache
      WHERE barcode = ?
      LIMIT 1
    `;
    
    const results = await executeQuery(query, [barcode]) as any[];
    
    if (!Array.isArray(results) || results.length === 0) {
      return null;
    }

    const row = results[0];
    return {
      ...row,
      images: row.images ? (typeof row.images === 'string' ? JSON.parse(row.images) : row.images) : null,
      raw_json: row.raw_json ? (typeof row.raw_json === 'string' ? JSON.parse(row.raw_json) : row.raw_json) : null
    };
  }

  /**
   * Crear o actualizar entrada en cache
   */
  async upsert(data: CreateBarcodeLookupCacheData): Promise<BarcodeLookupCache> {
    // Intentar actualizar primero
    const updateQuery = `
      UPDATE barcode_lookup_cache
      SET 
        title = ?,
        description = ?,
        brand = ?,
        images = ?,
        source = ?,
        source_site = ?,
        raw_json = ?,
        suggested_price = ?,
        category_suggestion = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE barcode = ?
    `;

    // Serializar JSON de forma segura, limitando tamaño
    let rawJsonString: string | null = null;
    if (data.raw_json) {
      try {
        const jsonString = JSON.stringify(data.raw_json);
        // Limitar tamaño a 64KB (65535 bytes) para evitar problemas de paquete
        if (jsonString.length > 65535) {
          // Si es muy grande, guardar solo una versión resumida
          rawJsonString = JSON.stringify({
            source: data.source,
            title: data.title,
            note: 'JSON original demasiado grande, datos resumidos'
          });
        } else {
          rawJsonString = jsonString;
        }
      } catch (error) {
        // Si falla la serialización, guardar null
        rawJsonString = null;
      }
    }

    const updateParams = [
      data.title,
      data.description ?? null,
      data.brand ?? null,
      data.images ? JSON.stringify(data.images) : null,
      data.source,
      data.source_site ?? null,
      rawJsonString,
      data.suggested_price ?? null,
      data.category_suggestion ?? null,
      data.barcode
    ];

    const updateResult = await executeQuery(updateQuery, updateParams);

    // Si no se actualizó ninguna fila, insertar
    if ((updateResult as any).affectedRows === 0) {
      const insertQuery = `
        INSERT INTO barcode_lookup_cache (
          barcode, title, description, brand, images, source, source_site,
          raw_json, suggested_price, category_suggestion
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      // Crear parámetros de inserción explícitamente
      const insertParams = [
        data.barcode,
        data.title,
        data.description ?? null,
        data.brand ?? null,
        data.images ? JSON.stringify(data.images) : null,
        data.source,
        data.source_site ?? null,
        rawJsonString, // Ya serializado como string o null
        data.suggested_price ?? null,
        data.category_suggestion ?? null
      ];

      try {
        await executeQuery(insertQuery, insertParams);
      } catch (error: any) {
        // Si falla por el JSON, intentar sin raw_json
        if (error.code === 'ER_MALFORMED_PACKET' || error.errno === 1835) {
          console.warn('Error con raw_json, intentando insertar sin raw_json');
          const insertQueryWithoutJson = `
            INSERT INTO barcode_lookup_cache (
              barcode, title, description, brand, images, source, source_site,
              suggested_price, category_suggestion
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;
          const paramsWithoutJson = [
            data.barcode,
            data.title,
            data.description ?? null,
            data.brand ?? null,
            data.images ? JSON.stringify(data.images) : null,
            data.source,
            data.source_site ?? null,
            data.suggested_price ?? null,
            data.category_suggestion ?? null
          ];
          await executeQuery(insertQueryWithoutJson, paramsWithoutJson);
        } else {
          throw error;
        }
      }
    }

    // Retornar el registro actualizado/creado
    const result = await this.findByBarcode(data.barcode);
    if (!result) {
      throw new Error('Error al crear/actualizar cache de barcode lookup');
    }

    return result;
  }

  /**
   * Actualizar last_used_at y hit_count
   */
  async updateUsage(barcode: string): Promise<void> {
    const query = `
      UPDATE barcode_lookup_cache
      SET 
        last_used_at = CURRENT_TIMESTAMP,
        hit_count = hit_count + 1
      WHERE barcode = ?
    `;

    await executeQuery(query, [barcode]);
  }

  /**
   * Marcar como ignorado
   */
  async markAsIgnored(barcode: string, userId?: number): Promise<void> {
    const query = `
      UPDATE barcode_lookup_cache
      SET 
        ignored = 1,
        ignored_at = CURRENT_TIMESTAMP,
        ignored_by_user_id = ?
      WHERE barcode = ?
    `;

    await executeQuery(query, [userId ?? null, barcode]);
  }

  /**
   * Verificar si está ignorado
   */
  async isIgnored(barcode: string): Promise<boolean> {
    const query = `
      SELECT ignored FROM barcode_lookup_cache
      WHERE barcode = ?
      LIMIT 1
    `;

    const results = await executeQuery(query, [barcode]) as any[];
    return !Array.isArray(results) || results.length === 0 ? false : results[0].ignored === 1;
  }
}
