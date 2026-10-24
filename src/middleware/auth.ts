import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types';
import { ApiKeyService } from '../services/ApiKeyService';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    name: string;
    type: 'api_key' | 'webhook';
    apiKeyId?: number;
  };
}

// Middleware de autenticación básica para API Key
// Primero intenta validar contra la base de datos, luego usa variable de entorno como fallback
export const authenticateApiKey = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    const response: ApiResponse = {
      success: false,
      message: 'API Key requerida',
      error: 'Header x-api-key es requerido',
      timestamp: new Date().toISOString()
    };
    res.status(401).json(response);
    return;
  }

  try {
    // Primero intentar validar contra la base de datos
    const apiKeyService = new ApiKeyService();
    const validatedKey = await apiKeyService.validateApiKey(apiKey);

    if (validatedKey) {
      // Validar IP permitida si está configurada
      const clientIp = req.ip || req.socket.remoteAddress || '';
      if (validatedKey.allowed_ips) {
        const allowedIps = validatedKey.allowed_ips.split(',').map(ip => ip.trim());
        if (!allowedIps.includes(clientIp) && !allowedIps.includes('*')) {
          const response: ApiResponse = {
            success: false,
            message: 'IP no autorizada',
            error: `Tu IP (${clientIp}) no está autorizada para usar esta API Key`,
            timestamp: new Date().toISOString()
          };
          res.status(403).json(response);
          return;
        }
      }

      // Validar expiración
      if (validatedKey.expires_at) {
        const expiryDate = new Date(validatedKey.expires_at);
        if (expiryDate <= new Date()) {
          const response: ApiResponse = {
            success: false,
            message: 'API Key expirada',
            error: 'Esta API Key ha expirado',
            timestamp: new Date().toISOString()
          };
          res.status(401).json(response);
          return;
        }
      }

      req.user = {
        id: `api-key-${validatedKey.id}`,
        name: validatedKey.key_name,
        type: 'api_key',
        apiKeyId: validatedKey.id
      };

      // Registrar uso (asíncrono, no bloquea la respuesta)
      apiKeyService.logApiKeyUsage(validatedKey.id, {
        endpoint: req.path,
        method: req.method,
        ip_address: clientIp,
        user_agent: req.get('user-agent')
      }).catch(err => {
        console.error('Error al registrar uso de API Key:', err);
      });

      next();
      return;
    }
  } catch (error) {
    // Si hay error al validar contra BD, continuar con fallback
    console.error('Error al validar API Key contra BD:', error);
  }

  // Fallback: validar contra variable de entorno (compatibilidad hacia atrás)
  const expectedApiKey = process.env.API_KEY || 'mfcomputers-api-key-2024';

  if (apiKey !== expectedApiKey) {
    const response: ApiResponse = {
      success: false,
      message: 'API Key inválida',
      error: 'API Key proporcionada no es válida',
      timestamp: new Date().toISOString()
    };
    res.status(401).json(response);
    return;
  }

  req.user = {
    id: 'api-user',
    name: 'API User (Legacy)',
    type: 'api_key'
  };

  next();
};

// Middleware de autenticación para webhooks (más permisivo)
export const authenticateWebhook = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  // Express normaliza headers a minúsculas, pero intentar múltiples variantes por si acaso
  const webhookSecret = (req.headers['x-webhook-secret'] || req.headers['X-Webhook-Secret'] || req.headers['X-WEBHOOK-SECRET']) as string;
  const apiKey = (req.headers['x-api-key'] || req.headers['X-API-Key'] || req.headers['X-API-KEY']) as string;
  const expectedSecret = process.env.WEBHOOK_SECRET || 'mf-wooc-secret';
  const expectedApiKey = process.env.API_KEY || 'mfcomputers-api-key-2024';

  // Log de todas las requests que lleguen al webhook (para debugging)
  console.log(`[WEBHOOK-AUTH] Request recibida en: ${req.method} ${req.path}`);
  console.log(`[WEBHOOK-AUTH] IP: ${req.ip || req.socket.remoteAddress || 'unknown'}`);
  
  // Log de TODOS los headers para debugging
  console.log(`[WEBHOOK-AUTH] Todos los headers recibidos:`, Object.keys(req.headers).reduce((acc: any, key) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('api') || lowerKey.includes('webhook') || lowerKey.includes('secret') || lowerKey.includes('key')) {
      acc[key] = req.headers[key] ? '***presente***' : 'no presente';
    }
    return acc;
  }, {}));
  
  console.log(`[WEBHOOK-AUTH] Headers específicos:`, {
    'x-webhook-secret': webhookSecret ? '***presente***' : 'no presente',
    'x-api-key': apiKey ? '***presente***' : 'no presente',
    'X-Webhook-Secret': req.headers['x-webhook-secret'] ? '***presente***' : 'no presente',
    'X-API-Key': req.headers['x-api-key'] ? '***presente***' : 'no presente',
    'X-WEBHOOK-SECRET': req.headers['x-webhook-secret'] ? '***presente***' : 'no presente',
    'X-API-KEY': req.headers['x-api-key'] ? '***presente***' : 'no presente',
    'content-type': req.headers['content-type'],
    'user-agent': req.get('user-agent')?.substring(0, 50) || 'unknown'
  });
  
  console.log(`[WEBHOOK-AUTH] NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`[WEBHOOK-AUTH] Body preview:`, req.body ? JSON.stringify(req.body).substring(0, 200) : 'no body');
  
  // Detectar webhooks de prueba de WooCommerce (solo tienen webhook_id) y permitirlos sin auth
  if (req.body && req.body.webhook_id && !req.body.id) {
    console.log(`[WEBHOOK-AUTH] ✅ Webhook de prueba detectado, permitiendo sin autenticación`);
    req.user = {
      id: 'webhook-user-test',
      name: 'Webhook Test User',
      type: 'webhook'
    };
    next();
    return;
  }

  // Para webhooks, permitir sin autenticación en desarrollo, testing o si NODE_ENV no está configurado (entorno local)
  if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    console.log(`[WEBHOOK-AUTH] ✅ Autenticación bypass (modo desarrollo)`);
    req.user = {
      id: 'webhook-user',
      name: 'Webhook User',
      type: 'webhook'
    };
    next();
    return;
  }

  // PRIMERO verificar Webhook Secret (si está presente, permite acceso sin API key)
  if (webhookSecret && webhookSecret === expectedSecret) {
    console.log(`[WEBHOOK-AUTH] ✅ Autenticación exitosa con Webhook Secret`);
    req.user = {
      id: 'webhook-user',
      name: 'Webhook User',
      type: 'webhook'
    };
    next();
    return;
  }

  // SI NO hay secret válido, entonces validar API Key contra base de datos
  if (apiKey) {
    try {
      const apiKeyService = new ApiKeyService();
      const validatedKey = await apiKeyService.validateApiKey(apiKey);
      
      if (validatedKey && validatedKey.is_active) {
        req.user = {
          id: `webhook-api-key-${validatedKey.id}`,
          name: validatedKey.key_name,
          type: 'webhook',
          apiKeyId: validatedKey.id
        };
        next();
        return;
      }
    } catch (error) {
      // Continuar con fallback si hay error
      console.error('Error al validar API Key para webhook:', error);
    }

    // Fallback: validar contra variable de entorno
    if (apiKey === expectedApiKey) {
      req.user = {
        id: 'webhook-user',
        name: 'Webhook User',
        type: 'webhook'
      };
      next();
      return;
    }
  }

  // Si no hay autenticación válida, rechazar
  console.error(`[WEBHOOK-AUTH] ❌ AUTENTICACIÓN FALLIDA`);
  console.error(`[WEBHOOK-AUTH] Webhook Secret recibido: ${webhookSecret ? 'presente' : 'no presente'}`);
  console.error(`[WEBHOOK-AUTH] Webhook Secret esperado: ${expectedSecret.substring(0, 10)}...`);
  console.error(`[WEBHOOK-AUTH] API Key recibida: ${apiKey ? 'presente' : 'no presente'}`);
  console.error(`[WEBHOOK-AUTH] API Key esperada: ${expectedApiKey.substring(0, 10)}...`);
  
  const response: ApiResponse = {
    success: false,
    message: 'Autenticación requerida',
    error: 'Se requiere header x-api-key o x-webhook-secret válido',
    timestamp: new Date().toISOString()
  };
  res.status(401).json(response);
  return;
};

// Middleware opcional de autenticación (solo si se proporciona API Key)
export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const apiKey = req.headers['x-api-key'] as string;

  if (apiKey) {
    try {
      // Intentar validar contra base de datos
      const apiKeyService = new ApiKeyService();
      const validatedKey = await apiKeyService.validateApiKey(apiKey);
      
      if (validatedKey && validatedKey.is_active) {
        req.user = {
          id: `api-key-${validatedKey.id}`,
          name: validatedKey.key_name,
          type: 'api_key',
          apiKeyId: validatedKey.id
        };
        next();
        return;
      }
    } catch (error) {
      // Continuar con fallback si hay error
      console.error('Error al validar API Key opcional:', error);
    }

    // Fallback: validar contra variable de entorno
    const expectedApiKey = process.env.API_KEY || 'mfcomputers-api-key-2024';
    if (apiKey === expectedApiKey) {
      req.user = {
        id: 'api-user',
        name: 'API User (Legacy)',
        type: 'api_key'
      };
    }
  }

  next();
};