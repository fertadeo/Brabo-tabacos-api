import axios from 'axios';

export type ArgentinaDollarType = 'oficial' | 'blue' | 'bolsa' | 'contadoconliqui' | 'mayorista' | 'tarjeta' | 'cripto';

export interface ArgentinaUsdArsQuote {
  currency: 'ARS';
  country: 'AR';
  dollar_type: ArgentinaDollarType;
  dollar_label: string;
  buy: number;
  sell: number;
  /** Cotización de venta usada para ajuste de precios */
  rate: number;
  source: string;
  fetched_at: string;
}

const DOLLAR_LABELS: Record<ArgentinaDollarType, string> = {
  oficial: 'Dólar oficial',
  blue: 'Dólar blue',
  bolsa: 'Dólar bolsa (MEP)',
  contadoconliqui: 'Dólar contado con liqui',
  mayorista: 'Dólar mayorista',
  tarjeta: 'Dólar tarjeta',
  cripto: 'Dólar cripto'
};

export class ArgentinaExchangeRateService {
  private getDollarType(): ArgentinaDollarType {
    const raw = (process.env.USD_ARS_DOLLAR_TYPE || 'oficial').toLowerCase();
    const allowed: ArgentinaDollarType[] = [
      'oficial', 'blue', 'bolsa', 'contadoconliqui', 'mayorista', 'tarjeta', 'cripto'
    ];
    return allowed.includes(raw as ArgentinaDollarType) ? (raw as ArgentinaDollarType) : 'oficial';
  }

  /**
   * Cotización USD → ARS (Argentina) vía DolarAPI (solo consulta, sin persistir).
   */
  async fetchUsdArsQuote(): Promise<ArgentinaUsdArsQuote> {
    const dollarType = this.getDollarType();
    const url = `https://dolarapi.com/v1/dolares/${dollarType}`;

    try {
      const { data } = await axios.get<{
        compra?: number;
        venta?: number;
        moneda?: string;
        casa?: string;
        nombre?: string;
        fechaActualizacion?: string;
      }>(url, {
        timeout: 12000,
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });

      const buy = Number(data?.compra);
      const sell = Number(data?.venta);
      if (!Number.isFinite(sell) || sell <= 0) {
        throw new Error('La API de cotización no devolvió un valor de venta válido');
      }

      return {
        currency: 'ARS',
        country: 'AR',
        dollar_type: dollarType,
        dollar_label: DOLLAR_LABELS[dollarType] || data?.nombre || dollarType,
        buy: Number.isFinite(buy) ? buy : sell,
        sell,
        rate: sell,
        source: 'dolarapi.com',
        fetched_at: data?.fechaActualizacion || new Date().toISOString()
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      throw new Error(`No se pudo obtener la cotización del dólar (Argentina): ${msg}`);
    }
  }
}
