import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { closeConnections, testConnection } from './config/database';
import cookieParser from 'cookie-parser';
import { initializeAdminUser } from './utils/initAdmin';
import { initializeSuperAdminUser } from './utils/initSuperAdmin';
import { initializeSystemEventsTable } from './utils/initSystemEvents';
import { ActivityLoggerService } from './services/ActivityLoggerService';
import { logFacturadorEnvStartupOnce } from './utils/facturadorEnvDiagnostics';

// Load environment variables
dotenv.config();
logFacturadorEnvStartupOnce();

const app = express();
const PORT = process.env.PORT || 8087;
/** Nombre de instancia. Ignora restos MF en .env copiado de otro cliente. */
function resolveAppDisplayName(): string {
  const raw =
    process.env.APP_NAME?.trim() ||
    process.env.NEXT_PUBLIC_APP_NAME?.trim() ||
    '';
  if (!raw || /mf\s*computers/i.test(raw) || /mfcomputers/i.test(raw)) {
    return 'Brabo Tabacos';
  }
  return raw;
}
const APP_DISPLAY_NAME = resolveAppDisplayName();
const HEALTH_MESSAGE = 'Brabo Tabacos API is running';

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
})); // Security headers

// CORS: en producción SOLO CORS_ORIGIN (sin hardcodear MF ni dominios ajenos).
function buildAllowedOrigins(): string[] {
  const fromEnv = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  const defaults =
    process.env.NODE_ENV === 'production'
      ? []
      : ['http://localhost:43127', 'http://127.0.0.1:43127', 'http://localhost:3000'];

  return Array.from(new Set([...fromEnv, ...defaults]));
}

const allowedOrigins = buildAllowedOrigins();

function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  return allowedOrigins.includes(origin);
}

function applyCorsHeaders(req: express.Request, res: express.Response): void {
  const origin = req.get('origin');
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
}

// Debug: mostrar orígenes permitidos al iniciar
console.log('🌐 CORS - Orígenes permitidos:', allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    // Debug: mostrar el origen recibido
    console.log(`🔍 CORS - Origen recibido: ${origin || 'sin origen'}`);
    
    // Permitir requests sin origen (mobile apps, Postman, etc.)
    if (!origin) {
      console.log('✅ CORS - Permitiendo request sin origen');
      return callback(null, true);
    }
    
    // Verificar si el origen está permitido
    if (isOriginAllowed(origin)) {
      console.log(`✅ CORS - Origen permitido: ${origin}`);
      callback(null, true);
    } else {
      console.error(`❌ CORS - Origen bloqueado: ${origin}`);
      console.error(`   Orígenes permitidos: ${allowedOrigins.join(', ')}`);
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-api-key',
    'x-facturador-api-key',
    'X-Requested-With',
    'Accept'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
app.use(morgan('combined')); // Logging

// Middleware para parsear form-urlencoded PRIMERO (para webhooks de prueba de WooCommerce)
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  type: 'application/x-www-form-urlencoded'
}));

// Middleware para parsear JSON - solo procesa cuando Content-Type es JSON
app.use(express.json({ 
  limit: '10mb',
  strict: false,
  type: ['application/json', 'application/*+json', 'text/json'] // Solo procesa JSON explícito
}));
app.use(cookieParser());

// Debug middleware for CORS and requests
app.use((req, res, next) => {
  // Log ALL incoming requests to webhook endpoints (antes del middleware de auth)
  if (req.url.includes('/webhook/woocommerce')) {
    console.log('\n🔔 ====== WEBHOOK REQUEST INCOMING ======');
    console.log(`📍 URL: ${req.method} ${req.url}`);
    console.log(`📍 IP: ${req.ip || req.socket.remoteAddress || 'unknown'}`);
    console.log(`📍 User-Agent: ${req.get('user-agent') || 'unknown'}`);
    console.log(`📍 Content-Type: ${req.get('content-type') || 'not set'}`);
    console.log(`📍 Headers relacionados:`);
    console.log(`   - X-Webhook-Secret: ${req.get('x-webhook-secret') ? '***presente***' : 'no presente'}`);
    console.log(`   - X-API-Key: ${req.get('x-api-key') ? '***presente***' : 'no presente'}`);
    console.log(`📍 Body preview:`, req.body ? JSON.stringify(req.body).substring(0, 300) : 'no body');
    if (req.body && typeof req.body === 'object') {
      console.log(`📍 Body keys: ${Object.keys(req.body).join(', ')}`);
      // Detectar si es pedido real o prueba
      if (req.body.id && !req.body.webhook_id) {
        console.log(`✅ PEDIDO REAL DETECTADO - ID: ${req.body.id}`);
      } else if (req.body.webhook_id) {
        console.log(`🧪 WEBHOOK DE PRUEBA - webhook_id: ${req.body.webhook_id}`);
      }
    }
    console.log('🔔 ====== FIN WEBHOOK REQUEST ======\n');
  }
  
  // Log CORS-related headers
  if (req.method === 'OPTIONS') {
    console.log('=== CORS PREFLIGHT REQUEST ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Origin:', req.get('origin'));
    console.log('Access-Control-Request-Method:', req.get('access-control-request-method'));
    console.log('Access-Control-Request-Headers:', req.get('access-control-request-headers'));
  }
  
  // Log request body for PUT/POST
  if (req.method === 'PUT' || req.method === 'POST') {
    console.log('=== REQUEST DEBUG ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Origin:', req.get('origin'));
    console.log('Content-Type:', req.get('content-type'));
    console.log('Body received:', JSON.stringify(req.body, null, 2));
    console.log('Body type:', typeof req.body);
    console.log('Body is array?', Array.isArray(req.body));
    if (req.body) {
      console.log('Body keys:', Object.keys(req.body));
    }
  }
  next();
});

// Health check endpoint — mensaje fijo Brabo (no depende de APP_NAME sucio)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: HEALTH_MESSAGE,
    service: 'brabo-tabacos-api',
    app: APP_DISPLAY_NAME,
    timestamp: new Date().toISOString(),
    port: PORT,
  });
});

// Manejar errores de parsing del body (debe ir ANTES de las rutas)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Si es un error de parsing del body
  if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
    console.error('❌ Error de parsing del body:', err.message);
    console.error('Content-Type recibido:', req.headers['content-type']);
    console.error('Body raw:', (err as any).body);
    
    // Si el Content-Type es form-urlencoded o el body parece ser form-urlencoded
    if (req.headers['content-type']?.includes('application/x-www-form-urlencoded') || 
        (typeof (err as any).body === 'string' && (err as any).body.includes('='))) {
      console.log('ℹ️ Detectado form-urlencoded, pero el parser no lo procesó. Continuando...');
      // El body puede estar vacío, pero el controlador puede manejar esto
      req.body = {}; // Resetear body para que el controlador pueda manejarlo
      next();
      return;
    }
    
    res.status(400).json({
      success: false,
      message: 'Error de formato en el body',
      error: 'El body no es un JSON válido. Verifica el formato de los datos enviados.',
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  next(err);
});

// Import API routes
import apiRoutes from './routes';

// Mount API routes
app.use('/api', apiRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The route ${req.originalUrl} does not exist`
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  applyCorsHeaders(req, res);

  if (err?.message === 'No permitido por CORS') {
    res.status(403).json({
      success: false,
      error: 'CORS',
      message: 'Origen no permitido por la política CORS del servidor',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  console.error('Global error:', err);
  ActivityLoggerService.logError(req, err.message || 'Error interno del servidor', {
    severity: 'critical',
    status_code: err.status || 500,
    metadata: { stack: process.env.NODE_ENV === 'development' ? err.stack : undefined },
  });
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('❌ Failed to connect to database. Server will not start.');
      process.exit(1);
    }

    // Inicializar usuario admin si está habilitado (por defecto: true)
    const initAdminOnStart = process.env.INIT_ADMIN_ON_START !== 'false';
    if (initAdminOnStart) {
      await initializeAdminUser();
    }

    await initializeSystemEventsTable();

    const initSuperAdminOnStart = process.env.INIT_SUPERADMIN_ON_START === 'true';
    if (initSuperAdminOnStart) {
      await initializeSuperAdminUser();
    }

    app.listen(PORT, () => {
      console.log(`🚀 ${APP_DISPLAY_NAME} API Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`📡 API endpoint: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received. Closing MySQL pool...`);
  try {
    await closeConnections();
  } catch (error) {
    console.error('Error closing MySQL pool:', error);
  }
  process.exit(0);
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

startServer();
