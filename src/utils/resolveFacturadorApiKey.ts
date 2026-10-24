import { AuthenticatedRequest } from '../middleware/jwt';

/** Roles que pueden enviar API key del facturador en cabecera (solo si FACTURADOR_ALLOW_CLIENT_API_KEY=true). */
const ROLES_HEADER_API_KEY = ['admin', 'gerencia', 'finanzas'] as const;

export type ResolveFacturadorApiKeyResult =
  | { apiKey?: string; error?: undefined }
  | { apiKey?: undefined; error: { status: number; message: string } };

/**
 * Resuelve si se usa la cabecera `x-facturador-api-key` para llamar al facturador.
 *
 * - Si FACTURADOR_ALLOW_CLIENT_API_KEY !== 'true': ignora la cabecera (prod recomendado).
 * - Si está en true: solo acepta cabecera con JWT y rol admin | gerencia | finanzas.
 * - Sin JWT (solo x-api-key de MF API): ignora la cabecera del facturador.
 */
export function resolveFacturadorApiKeyFromHeader(req: AuthenticatedRequest): ResolveFacturadorApiKeyResult {
  const raw = req.headers['x-facturador-api-key'];
  const val = Array.isArray(raw) ? raw[0] : raw;
  if (!val || !String(val).trim()) {
    return {};
  }

  const allow = process.env.FACTURADOR_ALLOW_CLIENT_API_KEY === 'true';
  if (!allow) {
    console.warn(
      '[Facturacion] Cabecera x-facturador-api-key ignorada (FACTURADOR_ALLOW_CLIENT_API_KEY no es true; usar FACTURADOR_API_KEY en servidor)'
    );
    return {};
  }

  if (!req.user) {
    console.warn(
      '[Facturacion] Cabecera x-facturador-api-key ignorada (requiere usuario JWT; integraciones con solo x-api-key deben usar FACTURADOR_API_KEY en el servidor)'
    );
    return {};
  }

  if (!ROLES_HEADER_API_KEY.includes(req.user.role as (typeof ROLES_HEADER_API_KEY)[number])) {
    return {
      error: {
        status: 403,
        message:
          'No autorizado: solo roles admin, gerencia o finanzas pueden enviar x-facturador-api-key cuando FACTURADOR_ALLOW_CLIENT_API_KEY=true.'
      }
    };
  }

  return { apiKey: String(val).trim() };
}
