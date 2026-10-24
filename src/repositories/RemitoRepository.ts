import Database from '../config/database';
import { 
  Remito, 
  RemitoWithDetails, 
  CreateRemitoData, 
  UpdateRemitoData,
  RemitoFilters,
  RemitoStats,
  RemitoItem,
  CreateRemitoItemData,
  UpdateRemitoItemData,
  TrazabilidadEntry,
  CreateTrazabilidadData,
  TrazabilidadFilters,
  StockMovement,
  DeliveryZone,
  TransportCompany,
  LogisticsConfig
} from '../entities/Remito';

export class RemitoRepository {
  private db: typeof Database;

  constructor() {
    this.db = Database;
  }

  // =====================================================
  // REMITOS - Operaciones principales
  // =====================================================

  async createRemito(data: CreateRemitoData, userId: number): Promise<Remito> {
    const connection = await this.db.getConnection();
    
    try {
      await connection.beginTransaction();

      // Generar número de remito único
      const remitoNumber = await this.generateRemitoNumber(data.remito_type || 'entrega_cliente');
      
      // Crear remito
      const [result] = await connection.execute(
        `INSERT INTO remitos (
          remito_number, order_id, client_id, remito_type, 
          delivery_address, delivery_city, delivery_contact, delivery_phone,
          transport_company, transport_cost, preparation_notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          remitoNumber,
          data.order_id,
          data.client_id,
          data.remito_type || 'entrega_cliente',
          data.delivery_address,
          data.delivery_city,
          data.delivery_contact,
          data.delivery_phone,
          data.transport_company,
          data.transport_cost || 0,
          data.preparation_notes,
          userId
        ]
      );

      const remitoId = (result as any).insertId;

      // Crear items del remito
      for (const item of data.items) {
        await connection.execute(
          `INSERT INTO remito_items (
            remito_id, product_id, quantity, unit_price, total_price,
            batch_number, serial_numbers, expiration_date, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            remitoId,
            item.product_id,
            item.quantity,
            item.unit_price,
            item.quantity * item.unit_price,
            item.batch_number,
            item.serial_numbers ? JSON.stringify(item.serial_numbers) : null,
            item.expiration_date,
            item.notes
          ]
        );
      }

      await connection.commit();

      // Retornar remito creado
      const remito = await this.getRemitoById(remitoId);
      return remito!;

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getRemitoById(id: number): Promise<RemitoWithDetails | null> {
    const connection = await this.db.getConnection();
    
    try {
      const [rows] = await connection.execute(
        `SELECT 
          r.*,
          c.name as client_name,
          c.code as client_code,
          o.order_number,
          u1.first_name as created_by_name,
          u2.first_name as delivered_by_name
        FROM remitos r
        LEFT JOIN clients c ON r.client_id = c.id
        LEFT JOIN orders o ON r.order_id = o.id
        LEFT JOIN users u1 ON r.created_by = u1.id
        LEFT JOIN users u2 ON r.delivered_by = u2.id
        WHERE r.id = ? AND r.is_active = TRUE`,
        [id]
      );

      const remitos = rows as RemitoWithDetails[];
      if (remitos.length === 0) return null;

      const remito = remitos[0];
      
      // Obtener items del remito
      remito.items = await this.getRemitoItems(remito.id);
      
      // Obtener historial de trazabilidad
      remito.tracking_history = await this.getTrazabilidadByRemito(remito.id);

      return remito;

    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }

  async getRemitoByNumber(remitoNumber: string): Promise<RemitoWithDetails | null> {
    const connection = await this.db.getConnection();
    
    try {
      const [rows] = await connection.execute(
        `SELECT 
          r.*,
          c.name as client_name,
          c.code as client_code,
          o.order_number,
          u1.first_name as created_by_name,
          u2.first_name as delivered_by_name
        FROM remitos r
        LEFT JOIN clients c ON r.client_id = c.id
        LEFT JOIN orders o ON r.order_id = o.id
        LEFT JOIN users u1 ON r.created_by = u1.id
        LEFT JOIN users u2 ON r.delivered_by = u2.id
        WHERE r.remito_number = ? AND r.is_active = TRUE`,
        [remitoNumber]
      );

      const remitos = rows as RemitoWithDetails[];
      if (remitos.length === 0) return null;

      const remito = remitos[0];
      
      // Obtener items del remito
      remito.items = await this.getRemitoItems(remito.id);
      
      // Obtener historial de trazabilidad
      remito.tracking_history = await this.getTrazabilidadByRemito(remito.id);

      return remito;

    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }

  async getAllRemitos(filters: RemitoFilters = {}): Promise<{ remitos: RemitoWithDetails[], total: number }> {
    const connection = await this.db.getConnection();
    
    try {
      let whereClause = 'WHERE r.is_active = TRUE';
      const params: any[] = [];

      // Aplicar filtros
      if (filters.status) {
        whereClause += ' AND r.status = ?';
        params.push(filters.status);
      }

      if (filters.remito_type) {
        whereClause += ' AND r.remito_type = ?';
        params.push(filters.remito_type);
      }

      if (filters.client_id) {
        whereClause += ' AND r.client_id = ?';
        params.push(filters.client_id);
      }

      if (filters.order_id) {
        whereClause += ' AND r.order_id = ?';
        params.push(filters.order_id);
      }

      if (filters.date_from) {
        whereClause += ' AND r.generation_date >= ?';
        params.push(filters.date_from);
      }

      if (filters.date_to) {
        whereClause += ' AND r.generation_date <= ?';
        params.push(filters.date_to);
      }

      if (filters.transport_company) {
        whereClause += ' AND r.transport_company = ?';
        params.push(filters.transport_company);
      }

      if (filters.tracking_number) {
        whereClause += ' AND r.tracking_number = ?';
        params.push(filters.tracking_number);
      }

      // Obtener total para paginación
      const [countRows] = await connection.execute(
        `SELECT COUNT(*) as total FROM remitos r ${whereClause}`,
        params
      );
      const total = (countRows as any)[0].total;

      // Paginación
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const offset = (page - 1) * limit;

      // Obtener remitos
      const [rows] = await connection.execute(
        `SELECT 
          r.*,
          c.name as client_name,
          c.code as client_code,
          o.order_number,
          u1.first_name as created_by_name,
          u2.first_name as delivered_by_name
        FROM remitos r
        LEFT JOIN clients c ON r.client_id = c.id
        LEFT JOIN orders o ON r.order_id = o.id
        LEFT JOIN users u1 ON r.created_by = u1.id
        LEFT JOIN users u2 ON r.delivered_by = u2.id
        ${whereClause}
        ORDER BY r.generation_date DESC
        LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );

      const remitos = rows as RemitoWithDetails[];

      // Obtener items para cada remito
      for (const remito of remitos) {
        remito.items = await this.getRemitoItems(remito.id);
      }

      return { remitos, total };

    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }

  async updateRemito(id: number, data: UpdateRemitoData, userId: number): Promise<Remito> {
    const connection = await this.db.getConnection();
    
    try {
      const fields = [];
      const values = [];

      Object.keys(data).forEach(key => {
        if (data[key as keyof UpdateRemitoData] !== undefined) {
          fields.push(`${key} = ?`);
          values.push(data[key as keyof UpdateRemitoData]);
        }
      });

      if (fields.length === 0) {
        throw new Error('No hay campos para actualizar');
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(id);

      await connection.execute(
        `UPDATE remitos SET ${fields.join(', ')} WHERE id = ? AND is_active = TRUE`,
        values
      );

      const updatedRemito = await this.getRemitoById(id);
      return updatedRemito!;

    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }

  async deleteRemito(id: number): Promise<void> {
    const connection = await this.db.getConnection();
    
    try {
      await connection.execute(
        'UPDATE remitos SET is_active = FALSE WHERE id = ?',
        [id]
      );
    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }

  // =====================================================
  // REMITO ITEMS - Gestión de productos en remitos
  // =====================================================

  async getRemitoItems(remitoId: number): Promise<RemitoItem[]> {
    const connection = await this.db.getConnection();
    
    try {
      const [rows] = await connection.execute(
        `SELECT 
          ri.*,
          p.name as product_name,
          p.code as product_code
        FROM remito_items ri
        LEFT JOIN products p ON ri.product_id = p.id
        WHERE ri.remito_id = ?
        ORDER BY ri.id`,
        [remitoId]
      );

      const items = rows as RemitoItem[];
      
      // Parsear serial_numbers si existe
      items.forEach(item => {
        if (item.serial_numbers && typeof item.serial_numbers === 'string') {
          try {
            item.serial_numbers = JSON.parse(item.serial_numbers);
          } catch (error) {
            item.serial_numbers = [];
          }
        }
      });

      return items;

    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }

  async updateRemitoItem(id: number, data: UpdateRemitoItemData): Promise<RemitoItem> {
    const connection = await this.db.getConnection();
    
    try {
      const fields: string[] = [];
      const values = [];

      Object.keys(data).forEach(key => {
        if (data[key as keyof UpdateRemitoItemData] !== undefined) {
          if (key === 'serial_numbers') {
            fields.push(`${key} = ?`);
            values.push(JSON.stringify(data[key as keyof UpdateRemitoItemData]));
          } else {
            fields.push(`${key} = ?`);
            values.push(data[key as keyof UpdateRemitoItemData]);
          }
        }
      });

      if (fields.length === 0) {
        throw new Error('No hay campos para actualizar');
      }

      values.push(id);

      await connection.execute(
        `UPDATE remito_items SET ${fields.join(', ')} WHERE id = ?`,
        values
      );

      // Obtener item actualizado
      const [rows] = await connection.execute(
        `SELECT 
          ri.*,
          p.name as product_name,
          p.code as product_code
        FROM remito_items ri
        LEFT JOIN products p ON ri.product_id = p.id
        WHERE ri.id = ?`,
        [id]
      );

      const items = rows as RemitoItem[];
      return items[0];

    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }

  // =====================================================
  // TRAZABILIDAD - Seguimiento de productos
  // =====================================================

  async createTrazabilidadEntry(data: CreateTrazabilidadData): Promise<TrazabilidadEntry> {
    const connection = await this.db.getConnection();
    
    try {
      const [result] = await connection.execute(
        `INSERT INTO trazabilidad (
          remito_id, product_id, stage, location, location_details,
          responsible_person, responsible_user_id, stage_end,
          temperature, humidity, quality_check, quality_notes,
          vehicle_plate, driver_name, driver_phone,
          notes, photos, documents, is_automatic
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.remito_id,
          data.product_id,
          data.stage,
          data.location,
          data.location_details,
          data.responsible_person,
          data.responsible_user_id,
          data.stage_end,
          data.temperature,
          data.humidity,
          data.quality_check || false,
          data.quality_notes,
          data.vehicle_plate,
          data.driver_name,
          data.driver_phone,
          data.notes,
          data.photos ? JSON.stringify(data.photos) : null,
          data.documents ? JSON.stringify(data.documents) : null,
          false
        ]
      );

      const entryId = (result as any).insertId;
      return await this.getTrazabilidadEntryById(entryId);

    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }

  async getTrazabilidadByRemito(remitoId: number): Promise<TrazabilidadEntry[]> {
    const connection = await this.db.getConnection();
    
    try {
      const [rows] = await connection.execute(
        `SELECT 
          t.*,
          p.name as product_name,
          u.first_name as responsible_user_name
        FROM trazabilidad t
        LEFT JOIN products p ON t.product_id = p.id
        LEFT JOIN users u ON t.responsible_user_id = u.id
        WHERE t.remito_id = ?
        ORDER BY t.stage_start ASC`,
        [remitoId]
      );

      const entries = rows as TrazabilidadEntry[];
      
      // Parsear JSON fields
      entries.forEach(entry => {
        if (entry.photos && typeof entry.photos === 'string') {
          try {
            entry.photos = JSON.parse(entry.photos);
          } catch (error) {
            entry.photos = [];
          }
        }
        if (entry.documents && typeof entry.documents === 'string') {
          try {
            entry.documents = JSON.parse(entry.documents);
          } catch (error) {
            entry.documents = [];
          }
        }
      });

      return entries;

    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }

  async getTrazabilidadEntryById(id: number): Promise<TrazabilidadEntry> {
    const connection = await this.db.getConnection();
    
    try {
      const [rows] = await connection.execute(
        `SELECT 
          t.*,
          p.name as product_name,
          u.first_name as responsible_user_name
        FROM trazabilidad t
        LEFT JOIN products p ON t.product_id = p.id
        LEFT JOIN users u ON t.responsible_user_id = u.id
        WHERE t.id = ?`,
        [id]
      );

      const entries = rows as TrazabilidadEntry[];
      const entry = entries[0];
      
      // Parsear JSON fields
      if (entry.photos && typeof entry.photos === 'string') {
        try {
          entry.photos = JSON.parse(entry.photos);
        } catch (error) {
          entry.photos = [];
        }
      }
      if (entry.documents && typeof entry.documents === 'string') {
        try {
          entry.documents = JSON.parse(entry.documents);
        } catch (error) {
          entry.documents = [];
        }
      }

      return entry;

    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }

  // =====================================================
  // ESTADÍSTICAS Y REPORTES
  // =====================================================

  async getRemitoStats(): Promise<RemitoStats> {
    const connection = await this.db.getConnection();
    
    try {
      const [rows] = await connection.execute(`
        SELECT 
          COUNT(*) as total_remitos,
          SUM(CASE WHEN status IN ('generado', 'preparando', 'listo_despacho') THEN 1 ELSE 0 END) as pending_delivery,
          SUM(CASE WHEN status = 'en_transito' THEN 1 ELSE 0 END) as in_transit,
          SUM(CASE WHEN DATE(delivery_date) = CURDATE() THEN 1 ELSE 0 END) as delivered_today,
          SUM(CASE WHEN status IN ('generado', 'preparando', 'listo_despacho') 
                   AND generation_date < DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as delayed_deliveries,
          SUM(total_value) as total_value,
          AVG(CASE WHEN delivery_date IS NOT NULL 
                   THEN TIMESTAMPDIFF(HOUR, generation_date, delivery_date) ELSE NULL END) as average_delivery_time
        FROM remitos 
        WHERE is_active = TRUE
      `);

      const stats = (rows as any)[0];
      
      return {
        total_remitos: stats.total_remitos || 0,
        pending_delivery: stats.pending_delivery || 0,
        in_transit: stats.in_transit || 0,
        delivered_today: stats.delivered_today || 0,
        delayed_deliveries: stats.delayed_deliveries || 0,
        total_value: stats.total_value || 0,
        average_delivery_time: stats.average_delivery_time || 0
      };

    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }

  // =====================================================
  // UTILIDADES
  // =====================================================

  private async generateRemitoNumber(type: string): Promise<string> {
    const connection = await this.db.getConnection();
    
    try {
      const prefix = type === 'entrega_cliente' ? 'REM' : 
                    type === 'traslado_interno' ? 'TRA' :
                    type === 'devolucion' ? 'DEV' : 'CON';
      
      const year = new Date().getFullYear().toString().slice(-2);
      
      const [rows] = await connection.execute(
        `SELECT COUNT(*) as count FROM remitos 
         WHERE remito_number LIKE ? AND YEAR(generation_date) = YEAR(NOW())`,
        [`${prefix}${year}%`]
      );

      const count = (rows as any)[0].count;
      const nextNumber = String(count + 1).padStart(4, '0');
      
      return `${prefix}${year}${nextNumber}`;

    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }

  // =====================================================
  // CONFIGURACIÓN DEL MÓDULO
  // =====================================================

  async getDeliveryZones(): Promise<DeliveryZone[]> {
    const connection = await this.db.getConnection();
    
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM delivery_zones WHERE is_active = TRUE ORDER BY name'
      );

      const zones = rows as DeliveryZone[];
      
      // Parsear postal_codes
      zones.forEach(zone => {
        if (zone.postal_codes && typeof zone.postal_codes === 'string') {
          try {
            zone.postal_codes = JSON.parse(zone.postal_codes);
          } catch (error) {
            zone.postal_codes = [];
          }
        }
      });

      return zones;

    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }

  async getTransportCompanies(): Promise<TransportCompany[]> {
    const connection = await this.db.getConnection();
    
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM transport_companies WHERE is_active = TRUE ORDER BY name'
      );

      const companies = rows as TransportCompany[];
      
      // Parsear JSON fields
      companies.forEach(company => {
        if (company.services && typeof company.services === 'string') {
          try {
            company.services = JSON.parse(company.services);
          } catch (error) {
            company.services = [];
          }
        }
        if (company.coverage_zones && typeof company.coverage_zones === 'string') {
          try {
            company.coverage_zones = JSON.parse(company.coverage_zones);
          } catch (error) {
            company.coverage_zones = [];
          }
        }
        if (company.rates && typeof company.rates === 'string') {
          try {
            company.rates = JSON.parse(company.rates);
          } catch (error) {
            company.rates = {};
          }
        }
      });

      return companies;

    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }

  async getLogisticsConfig(): Promise<Record<string, any>> {
    const connection = await this.db.getConnection();
    
    try {
      const [rows] = await connection.execute(
        'SELECT config_key, config_value, config_type FROM logistics_config WHERE is_active = TRUE'
      );

      const configs = rows as LogisticsConfig[];
      const config: Record<string, any> = {};
      
      configs.forEach(cfg => {
        let value: any = cfg.config_value;
        
        switch (cfg.config_type) {
          case 'number':
            value = parseFloat(cfg.config_value);
            break;
          case 'boolean':
            value = cfg.config_value === 'true';
            break;
          case 'json':
            try {
              value = JSON.parse(cfg.config_value);
            } catch (error) {
              value = cfg.config_value;
            }
            break;
        }
        
        config[cfg.config_key] = value;
      });

      return config;

    } catch (error) {
      throw error;
    } finally {
      connection.release();
    }
  }
}
