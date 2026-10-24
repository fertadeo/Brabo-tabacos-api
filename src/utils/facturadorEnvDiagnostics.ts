/** Enmascara API key para logs (no exponer valor completo). */
export function maskFacturadorApiKey(key: string): string {
  const k = (key || '').trim();
  if (!k) return '(vacío)';
  if (k.length <= 8) return `*** (len=${k.length})`;
  return `${k.slice(0, 4)}***${k.slice(-4)} (len=${k.length})`;
}

/** Normaliza CUIT a solo dígitos y valida 11 caracteres numéricos. */
export function normalizeCuitDigits(raw: string | undefined): { digits: string; valid11: boolean } {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return { digits, valid11: digits.length === 11 };
}

let loggedStartupDiagnostics = false;

/**
 * Una vez por proceso: estado de variables de entorno del facturador (sin secretos completos).
 */
export function logFacturadorEnvStartupOnce(): void {
  if (loggedStartupDiagnostics) return;
  loggedStartupDiagnostics = true;

  // Brabo retail: no asumir facturador/CUIT de MF. Solo diagnosticar si hay URL configurada.
  if (!(process.env.FACTURADOR_BASE_URL || '').trim()) {
    console.log('[FacturadorEnv] Sin FACTURADOR_BASE_URL — diagnóstico omitido (OK para retail sin ARCA).');
    return;
  }

  const baseUrl = (process.env.FACTURADOR_BASE_URL || '').trim().replace(/\/+$/, '');
  const apiKey = (process.env.FACTURADOR_API_KEY || '').trim();
  const timeoutMs = Number(process.env.FACTURADOR_TIMEOUT_MS || 15000);
  const cuitRaw = process.env.FACTURADOR_CUIT_EMISOR;
  const pvRaw = process.env.FACTURADOR_PUNTO_VENTA;
  const allowHeader = process.env.FACTURADOR_ALLOW_CLIENT_API_KEY;

  const { digits: cuitDigits, valid11: cuitOk } = normalizeCuitDigits(cuitRaw);
  const pvNum = pvRaw === undefined || String(pvRaw).trim() === '' ? null : Number(pvRaw);
  const pvOk = pvNum !== null && Number.isFinite(pvNum) && pvNum >= 1;

  console.log('[FacturadorEnv] Diagnóstico inicial (variables de entorno)', {
    FACTURADOR_BASE_URL: baseUrl
      ? { definida: true, valor: baseUrl }
      : {
          definida: false,
          problema: 'FALTA — sin URL no se puede llamar al facturador (salvo que no uses facturación)'
        },
    FACTURADOR_API_KEY: apiKey
      ? { definida: true, vista: maskFacturadorApiKey(apiKey) }
      : {
          definida: false,
          problema:
            'FALTA en servidor — la emisión necesita API key en env o x-facturador-api-key si FACTURADOR_ALLOW_CLIENT_API_KEY=true'
        },
    FACTURADOR_TIMEOUT_MS: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : { valor: timeoutMs, problema: 'inválido, usando fallback interno' },
    FACTURADOR_CUIT_EMISOR:
      cuitRaw === undefined || String(cuitRaw).trim() === ''
        ? {
            definida: false,
            nota: 'Si el body no envía cuitEmisor, la facturación fallará hasta definir esta variable'
          }
        : cuitOk
          ? { definida: true, digitos: 11, ok: true }
          : {
              definida: true,
              ok: false,
              problema: `valor incorrecto: tras quitar no-dígitos hay ${cuitDigits.length} dígitos (se requieren 11). Revisá FACTURADOR_CUIT_EMISOR`,
              digitos_normalizados: cuitDigits.length
            },
    FACTURADOR_PUNTO_VENTA:
      pvRaw === undefined || String(pvRaw).trim() === ''
        ? { definida: false, nota: 'Se usará default 1 si el body no envía puntoVenta' }
        : pvOk
          ? { definida: true, valor: pvNum }
          : { definida: true, problema: 'valor no numérico o < 1', raw: pvRaw },
    FACTURADOR_ALLOW_CLIENT_API_KEY:
      allowHeader === 'true'
        ? 'true — cabecera x-facturador-api-key permitida para roles admin/gerencia/finanzas'
        : 'false o ausente — cabecera x-facturador-api-key ignorada; usar FACTURADOR_API_KEY en servidor'
  });
}

export function logFacturadorMissingCredentials(details: {
  tieneBaseUrl: boolean;
  tieneApiKeyEnv: boolean;
  tieneApiKeyHeader: boolean;
}): void {
  console.warn('[FacturadorEnv] No hay credenciales suficientes para llamar al facturador', {
    ...details,
    ayuda:
      'Definí FACTURADOR_BASE_URL y FACTURADOR_API_KEY en el servidor, o habilitá FACTURADOR_ALLOW_CLIENT_API_KEY=true y enviá x-facturador-api-key con JWT autorizado'
  });
}

export function logFacturadorCuitInvalid(details: {
  source: 'body' | 'env';
  rawEnvPresent: boolean;
  parsedNumber: number;
  stringLength: number;
  digitsAfterNormalize: string;
}): void {
  console.warn('[FacturadorEnv] CUIT emisor inválido para facturación', {
    ...details,
    problema: 'Se requiere un CUIT de 11 dígitos (body.cuitEmisor o FACTURADOR_CUIT_EMISOR sin guiones o con guiones que se normalicen a 11 dígitos)'
  });
}

export function logFacturadorPingFailed(baseUrl: string): void {
  console.warn('[FacturadorEnv] GET /ping al facturador falló o no respondió OK', {
    FACTURADOR_BASE_URL: baseUrl || '(vacío)',
    problema: 'Revisá URL, red, firewall o que el servicio facturador esté arriba'
  });
}

/** Por cada intento de facturación: de dónde salen credenciales y CUIT/PV. */
export function logFacturadorFacturarContext(details: {
  saleId: number;
  apiKeySource: 'header' | 'env' | 'none';
  baseUrlConfigured: boolean;
  cuitEmisorSource: 'body' | 'env';
  puntoVentaSource: 'body' | 'env';
  envCuitDefined: boolean;
  envCuitValid11: boolean;
  envPuntoVentaDefined: boolean;
}): void {
  console.log('[FacturadorEnv] facturarVenta — uso de variables / fuentes', details);
}
