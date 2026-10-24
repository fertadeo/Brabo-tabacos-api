const mysql = require('mysql2/promise');
require('dotenv').config();

function normalizeSlug(value) {
  if (typeof value !== 'string') return null;
  let slug = value.trim();
  if (!slug) return null;
  if (/^https?:\/\//i.test(slug)) return null;
  slug = slug.replace(/^\/+|\/+$/g, '').replace(/\s+/g, '-').toLowerCase();
  if (!slug || slug.includes('/') || /\s/.test(slug)) return null;
  return slug;
}

function normalizePermalink(value) {
  if (typeof value !== 'string') return null;
  const permalink = value.trim();
  return /^https?:\/\//i.test(permalink) ? permalink : null;
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    onlyNull: false,
    pageSize: 100
  };

  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    if (arg === '--only-null') args.onlyNull = true;
    if (arg.startsWith('--page-size=')) {
      const raw = Number(arg.split('=')[1]);
      if (Number.isFinite(raw) && raw > 0 && raw <= 100) args.pageSize = Math.floor(raw);
    }
  }
  return args;
}

async function fetchWooProductById({ baseUrl, consumerKey, consumerSecret, woocommerceId }) {
  const endpoint = `/wp-json/wc/v3/products/${woocommerceId}`;
  const url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`, 'utf8').toString('base64');

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    }
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    throw new Error(`Respuesta invalida de WooCommerce para id=${woocommerceId}: ${text}`);
  }

  if (response.status === 404) return null;

  if (!response.ok) {
    const message = data?.message || data?.code || `HTTP ${response.status}`;
    const error = new Error(`WooCommerce API Error: ${message}`);
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

async function fetchWooProductByIdWithRetry(params, retries = 3, baseDelayMs = 500) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchWooProductById(params);
    } catch (error) {
      const statusCode = Number(error?.statusCode || 0);
      const retryable = statusCode === 429 || statusCode >= 500;
      if (!retryable || attempt === retries) throw error;
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return null;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));

  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mfcomputers'
  });

  const baseUrl = process.env.WOOCOMMERCE_URL || '';
  const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY || '';
  const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET || '';

  if (!baseUrl || !consumerKey || !consumerSecret) {
    throw new Error('Faltan credenciales de WooCommerce en .env');
  }

  try {
    console.log('Iniciando backfill de woocommerce_slug + woocommerce_permalink...');
    console.log(`Opciones: dryRun=${args.dryRun}, onlyNull=${args.onlyNull}, pageSize=${args.pageSize}`);

    const whereClause = args.onlyNull
      ? 'WHERE woocommerce_id IS NOT NULL AND (woocommerce_slug IS NULL OR woocommerce_slug = "" OR woocommerce_permalink IS NULL OR woocommerce_permalink = "")'
      : 'WHERE woocommerce_id IS NOT NULL';

    const [rows] = await db.query(
      `SELECT id, code, woocommerce_id, woocommerce_slug, woocommerce_permalink FROM products ${whereClause} ORDER BY id ASC`
    );

    let updated = 0;
    let unchanged = 0;
    let missingInWoo = 0;
    let failed = 0;

    for (const row of rows) {
      const wooId = Number(row.woocommerce_id);
      try {
        const remote = await fetchWooProductByIdWithRetry({
          baseUrl,
          consumerKey,
          consumerSecret,
          woocommerceId: wooId
        });

        if (!remote) {
          missingInWoo += 1;
          continue;
        }

        const status = typeof remote?.status === 'string' ? remote.status : '';
        const nextSlug = status === 'publish' ? normalizeSlug(remote?.slug) : null;
        const nextPermalink = status === 'publish' ? normalizePermalink(remote?.permalink) : null;
        const localSlug = normalizeSlug(row.woocommerce_slug);
        const localPermalink = normalizePermalink(row.woocommerce_permalink);

        const sameValue = (localSlug || null) === (nextSlug || null) &&
          (localPermalink || null) === (nextPermalink || null);
        if (sameValue) {
          unchanged += 1;
          continue;
        }

        if (!args.dryRun) {
          await db.query(
            'UPDATE products SET woocommerce_slug = ?, woocommerce_permalink = ?, updated_at = NOW() WHERE id = ?',
            [nextSlug, nextPermalink, row.id]
          );
        }
        updated += 1;
      } catch (error) {
        failed += 1;
        console.error(`Error en producto id=${row.id} wc_id=${wooId}:`, error.message || error);
      }
    }

    console.log('');
    console.log('Backfill finalizado');
    console.log(`- Productos ERP evaluados: ${rows.length}`);
    console.log(`- Actualizados: ${updated}`);
    console.log(`- Sin cambios: ${unchanged}`);
    console.log(`- No encontrados en WooCommerce: ${missingInWoo}`);
    console.log(`- Fallidos: ${failed}`);
    if (args.dryRun) {
      console.log('- Modo dry-run: no se escribieron cambios en base de datos');
    }
  } finally {
    await db.end();
  }
}

run().catch((error) => {
  console.error('Error en backfill de woocommerce_slug:', error.message || error);
  process.exit(1);
});

