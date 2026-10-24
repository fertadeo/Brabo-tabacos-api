import {
  FacturadorApiError,
  FacturadorArcaService
} from './FacturadorArcaService';
import { ApiResponse, Personeria, ClientTaxCondition } from '../types';
import {
  inferPersoneriaDesdePadron,
  mapDetallePadronACliente,
  mejorDetalleDesdePadronCompleto
} from '../utils/padronArca';
import { getCondicionIvaLabel } from '../utils/facturadorComprobante';
import { normalizeCuitDigits } from '../utils/facturadorEnvDiagnostics';
import { taxConditionFromAfipCode } from '../utils/clientTaxCondition';

export interface ClientPadronLookupData {
  cuit: string;
  cuitEmisor: string;
  razonSocial: string | null;
  /** Alias para prellenar `name` en POST /api/clients */
  name: string | null;
  tipoPersona: string | null;
  estadoClave: string | null;
  actividadPrincipal: string | null;
  inicioActividades: string | null;
  impuestos: Array<{ id: unknown; descripcion: string | null; estado: unknown }>;
  esMonotributo: boolean;
  personeriaSugerida: Personeria | null;
  /** Valor ERP para POST/PUT clientes */
  tax_condition: ClientTaxCondition | null;
  condicionIvaSugerida: number | null;
  condicionIvaSugeridaLabel: string | null;
  padronParcial: boolean;
  advertencias: string[];
  fromCache: boolean;
}

interface CacheEntry {
  expiresAt: number;
  data: ClientPadronLookupData;
}

const padronCache = new Map<string, CacheEntry>();

function cacheTtlMs(): number {
  const raw = Number(process.env.PADRON_CACHE_TTL_MS || 600000);
  return Number.isFinite(raw) && raw > 0 ? raw : 600000;
}

function resolveCuitEmisor(cuitEmisorQuery?: string | null): { digits: string; valid11: boolean } {
  const raw =
    cuitEmisorQuery != null && String(cuitEmisorQuery).trim() !== ''
      ? String(cuitEmisorQuery)
      : process.env.FACTURADOR_CUIT_EMISOR;
  return normalizeCuitDigits(raw);
}

export class ClientPadronService {
  private facturador: FacturadorArcaService;

  constructor() {
    this.facturador = new FacturadorArcaService();
  }

  async lookupByCuit(
    cuitClienteRaw: string,
    options: {
      cuitEmisor?: string | null;
      incluirCondicionIva?: boolean;
      apiKey?: string | null;
      skipCache?: boolean;
    } = {}
  ): Promise<ApiResponse<ClientPadronLookupData>> {
    const cuitCliente = normalizeCuitDigits(cuitClienteRaw);
    if (!cuitCliente.valid11) {
      return {
        success: false,
        message: 'CUIT inválido: debe tener 11 dígitos',
        error: 'INVALID_CUIT',
        timestamp: new Date().toISOString()
      };
    }

    const cuitEmisor = resolveCuitEmisor(options.cuitEmisor);
    if (!cuitEmisor.valid11) {
      return {
        success: false,
        message:
          'CUIT emisor no configurado. Enviá cuitEmisor en query o definí FACTURADOR_CUIT_EMISOR.',
        error: 'CUIT_EMISOR_REQUERIDO',
        timestamp: new Date().toISOString()
      };
    }

    if (!this.facturador.hasCredentials(options.apiKey)) {
      return {
        success: false,
        message:
          'Facturador ARCA no configurado. Definí FACTURADOR_BASE_URL y FACTURADOR_API_KEY en el servidor.',
        error: 'FACTURADOR_NOT_CONFIGURED',
        timestamp: new Date().toISOString()
      };
    }

    const cacheKey = `${cuitEmisor.digits}:${cuitCliente.digits}`;
    if (!options.skipCache) {
      const cached = padronCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return {
          success: true,
          message: 'Datos de padrón ARCA (cache)',
          data: { ...cached.data, fromCache: true },
          timestamp: new Date().toISOString()
        };
      }
    }

    try {
      const padron = await this.facturador.getPadronCompleto(
        cuitEmisor.digits,
        cuitCliente.digits,
        { apiKey: options.apiKey }
      );

      const detalle = padron.data ? mejorDetalleDesdePadronCompleto(padron.data) : null;

      if (!detalle) {
        return {
          success: false,
          message: 'No se encontraron datos en padrón ARCA para este CUIT',
          error: 'PADRON_SIN_DATOS',
          data: {
            cuit: cuitCliente.digits,
            cuitEmisor: cuitEmisor.digits,
            razonSocial: null,
            name: null,
            tipoPersona: null,
            estadoClave: null,
            actividadPrincipal: null,
            inicioActividades: null,
            impuestos: [],
            esMonotributo: false,
            personeriaSugerida: null,
            tax_condition: null,
            condicionIvaSugerida: null,
            condicionIvaSugeridaLabel: null,
            padronParcial: Boolean(padron.parcial),
            advertencias: padron.data?.trazas ?? [],
            fromCache: false
          },
          timestamp: new Date().toISOString()
        };
      }

      const mapped = mapDetallePadronACliente(detalle);
      const advertencias: string[] = [...(padron.data?.trazas ?? [])];

      if (padron.parcial) {
        advertencias.unshift('Consulta parcial: al menos un alcance de padrón no respondió.');
      }

      let condicionIvaSugerida: number | null = null;
      let condicionIvaSugeridaLabel: string | null = null;

      if (options.incluirCondicionIva !== false) {
        try {
          const sugerencia = await this.facturador.getSugerenciaCondicionIva(
            cuitEmisor.digits,
            cuitCliente.digits,
            { apiKey: options.apiKey }
          );
          if (sugerencia.sugerencia != null && Number.isFinite(Number(sugerencia.sugerencia))) {
            condicionIvaSugerida = Number(sugerencia.sugerencia);
            condicionIvaSugeridaLabel = getCondicionIvaLabel(condicionIvaSugerida);
          }
          if (sugerencia.advertencias?.length) {
            advertencias.push(...sugerencia.advertencias);
          }
        } catch {
          advertencias.push(
            'No se pudo obtener sugerencia de condición IVA; confirmá con el contador.'
          );
        }
      }

      advertencias.push('La sugerencia de condición IVA es orientativa; confirmar con el contador.');

      const personeriaSugerida = inferPersoneriaDesdePadron(mapped.tipoPersona);
      const tax_condition = taxConditionFromAfipCode(
        condicionIvaSugerida,
        personeriaSugerida ?? undefined
      );

      const data: ClientPadronLookupData = {
        cuit: cuitCliente.digits,
        cuitEmisor: cuitEmisor.digits,
        razonSocial: mapped.razonSocial,
        name: mapped.razonSocial,
        tipoPersona: mapped.tipoPersona,
        estadoClave: mapped.estadoClave,
        actividadPrincipal: mapped.actividadPrincipal,
        inicioActividades: mapped.inicioActividades,
        impuestos: mapped.impuestos,
        esMonotributo: mapped.esMonotributo,
        personeriaSugerida,
        tax_condition,
        condicionIvaSugerida,
        condicionIvaSugeridaLabel,
        padronParcial: Boolean(padron.parcial),
        advertencias: [...new Set(advertencias.filter(Boolean))],
        fromCache: false
      };

      padronCache.set(cacheKey, {
        expiresAt: Date.now() + cacheTtlMs(),
        data
      });

      return {
        success: true,
        message: padron.parcial
          ? 'Datos de padrón ARCA (consulta parcial)'
          : 'Datos de padrón ARCA',
        data,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const apiErr = error as FacturadorApiError;
      const status = apiErr.status && apiErr.status >= 400 ? apiErr.status : 502;
      return {
        success: false,
        message: apiErr.message || 'Error consultando padrón ARCA',
        error: apiErr.code || 'PADRON_ERROR',
        timestamp: new Date().toISOString()
      };
    }
  }
}
