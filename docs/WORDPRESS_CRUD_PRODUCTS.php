<?php
/**
 * WooCommerce Products CRUD (REST API) + Persistencia en BD (JSON completo) + Soft Delete
 *
 * Objetivo:
 * - Obtener el JSON COMPLETO de productos desde WooCommerce (REST API v3)
 * - Crear / Editar productos en WooCommerce
 * - Borrar con "soft delete" (WooCommerce: mover a papelera con force=false) + BD: marcar deleted_at
 * - Guardar en tu BD un JSON con TODA la info que devuelve WooCommerce del producto
 *
 * ALINEACIÓN CON LA API ERP (Node/TypeScript):
 * - La API ERP usa la MISMA WooCommerce REST API (wc/v3): POST /products, PUT /products/{id}.
 * - Payload compatible: name, type, sku, regular_price, description, manage_stock, stock_quantity, status.
 * - Variables API ERP: WOOCOMMERCE_URL, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET (wc/v3).
 * - Sincronización ERP → WooCommerce: POST /api/products/:id/sync-to-woocommerce (crear/actualizar en WC).
 * - Este snippet (PHP) sirve para pruebas desde WordPress/CLI; la tienda WC es la misma para ambos.
 *
 * Notas importantes:
 * - Este archivo está en /docs: es un snippet de referencia (copiar/pegar).
 * - NO hardcodees credenciales en repositorios. Usá variables de entorno.
 * - WooCommerce REST v3:
 *   - Listar:   GET    /wp-json/wc/v3/products
 *   - Obtener:  GET    /wp-json/wc/v3/products/{id}
 *   - Crear:    POST   /wp-json/wc/v3/products
 *   - Editar:   PUT    /wp-json/wc/v3/products/{id}
 *   - Borrar:   DELETE /wp-json/wc/v3/products/{id}?force=false  (papelera = soft delete en WooCommerce)
 *
 * Requisitos (si vas a ejecutarlo):
 * - PHP 8+ recomendado
 * - Extensión curl habilitada (si no estás dentro de WordPress)
 * - Acceso a MySQL (PDO)
 */

// ============================================================
// 0) DEBUG / LOGS (WordPress: wp-content/debug.log)
// ============================================================

/**
 * Para ver logs en WordPress:
 * - WP_DEBUG: true
 * - WP_DEBUG_LOG: true
 * - WP_DEBUG_DISPLAY: false (recomendado)
 *
 * Este snippet escribe con error_log(), igual que `WORDPRESS_ORDERS.php`.
 */
if (!defined('ERP_PRODUCTS_DEBUG')) {
    define('ERP_PRODUCTS_DEBUG', true); // ponelo en false para silenciar logs
}
if (!defined('ERP_PRODUCTS_LOG_PREFIX')) {
    define('ERP_PRODUCTS_LOG_PREFIX', '[ERP-PRODUCTS]');
}
if (!defined('ERP_PRODUCTS_LOG_PREVIEW_CHARS')) {
    define('ERP_PRODUCTS_LOG_PREVIEW_CHARS', 500);
}
if (!defined('ERP_PRODUCTS_LOG_ON_LOAD')) {
    define('ERP_PRODUCTS_LOG_ON_LOAD', true); // log al cargar el snippet (rate limited)
}

function erp_products_json($data): string
{
    // wp_json_encode maneja mejor UTF-8 en WP
    if (function_exists('wp_json_encode')) {
        $encoded = wp_json_encode($data);
        return is_string($encoded) ? $encoded : '';
    }
    $encoded = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return is_string($encoded) ? $encoded : '';
}

function erp_products_log(string $message, $context = null): void
{
    if (!defined('ERP_PRODUCTS_DEBUG') || ERP_PRODUCTS_DEBUG !== true) {
        return;
    }
    if ($context !== null) {
        $ctx = erp_products_json($context);
        if ($ctx !== '') {
            error_log(ERP_PRODUCTS_LOG_PREFIX . ' ' . $message . ' | ' . $ctx);
            return;
        }
    }
    error_log(ERP_PRODUCTS_LOG_PREFIX . ' ' . $message);
}

/**
 * Loguea una sola vez por TTL si hay transients (WordPress).
 * Si no hay WP, se limita por request (estático).
 */
function erp_products_log_once(string $key, string $message, int $ttlSeconds = 60): void
{
    if (!defined('ERP_PRODUCTS_DEBUG') || ERP_PRODUCTS_DEBUG !== true) {
        return;
    }

    if (function_exists('get_transient') && function_exists('set_transient')) {
        $tKey = 'erp_products_log_' . $key;
        if (get_transient($tKey)) {
            return;
        }
        set_transient($tKey, true, $ttlSeconds);
        erp_products_log($message);
        return;
    }

    static $seen = [];
    if (isset($seen[$key])) {
        return;
    }
    $seen[$key] = true;
    erp_products_log($message);
}

if (defined('ERP_PRODUCTS_LOG_ON_LOAD') && ERP_PRODUCTS_LOG_ON_LOAD === true) {
    erp_products_log_once('snippet_loaded', 'SNIPPET DE PRODUCTOS CARGADO (debug=' . (ERP_PRODUCTS_DEBUG ? 'ON' : 'OFF') . ')', 60);
}

// ============================================================
// 1) CONFIGURACIÓN (usar ENV; dejar defaults solo para ejemplo)
// ============================================================

// WooCommerce (las claves por defecto se usan si no hay ENV; en producción preferí ENV)
if (!defined('WC_BASE_URL')) {
    define('WC_BASE_URL', rtrim(getenv('WC_BASE_URL') ?: 'https://mfcomputers.com.ar', '/'));
}
if (!defined('WC_CONSUMER_KEY')) {
    define('WC_CONSUMER_KEY', getenv('WC_CONSUMER_KEY') ?: 'ck_a98fe758a3ec175c8b05639c4170cab24fb53878');
}
if (!defined('WC_CONSUMER_SECRET')) {
    define('WC_CONSUMER_SECRET', getenv('WC_CONSUMER_SECRET') ?: 'cs_7adfbd1caff2f209b3c2d700d5c6a31c15fb82b2');
}
if (!defined('WC_API_PREFIX')) {
    define('WC_API_PREFIX', '/wp-json/wc/v3');
}

// Base de datos (MySQL)
// ⚠️ IMPORTANTE (WordPress): DB_HOST/DB_NAME/DB_USER/DB_PASSWORD YA existen en wp-config.php.
// No los redefinimos para evitar warnings en debug.log.
if (!defined('DB_HOST')) {
    define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
}
if (!defined('DB_PORT')) {
    define('DB_PORT', getenv('DB_PORT') ?: '3306');
}
if (!defined('DB_NAME')) {
    define('DB_NAME', getenv('DB_NAME') ?: 'mfcomputers');
}
if (!defined('DB_USER')) {
    define('DB_USER', getenv('DB_USER') ?: 'root');
}
// Nuestro alias para password (para no depender de DB_PASSWORD en modo CLI)
if (!defined('DB_PASS')) {
    $pass = getenv('DB_PASS');
    if ($pass === false || $pass === null || $pass === '') {
        $pass = getenv('DB_PASSWORD');
    }
    if (($pass === false || $pass === null || $pass === '') && defined('DB_PASSWORD')) {
        $pass = DB_PASSWORD;
    }
    define('DB_PASS', is_string($pass) ? $pass : '');
}

// Tabla donde persistís el producto en tu ERP/API
// Ajustá nombres de columnas según tu esquema real.
if (!defined('DB_PRODUCTS_TABLE')) {
    define('DB_PRODUCTS_TABLE', getenv('DB_PRODUCTS_TABLE') ?: 'products');
}

// Log de configuración (sin exponer secretos)
erp_products_log_once('config', 'Config cargada', 60);
erp_products_log('WooCommerce URL', ['base_url' => WC_BASE_URL, 'api_prefix' => WC_API_PREFIX, 'has_keys' => (WC_CONSUMER_KEY !== 'ck_REEMPLAZAR' && WC_CONSUMER_SECRET !== 'cs_REEMPLAZAR')]);
erp_products_log('DB config', ['host' => DB_HOST, 'port' => DB_PORT, 'db' => DB_NAME, 'user' => DB_USER, 'table' => DB_PRODUCTS_TABLE]);

// ============================================================
// 2) SQL sugerido (ejemplo) para agregar el JSON completo
// ============================================================
/*
-- Ejemplo MySQL (ajustar a tu tabla real):
ALTER TABLE products
  ADD COLUMN woocommerce_id INT NULL,
  ADD COLUMN woocommerce_json JSON NULL,
  ADD COLUMN deleted_at DATETIME NULL,
  ADD UNIQUE KEY uq_products_woocommerce_id (woocommerce_id);

-- Si tu MySQL no soporta JSON, usá LONGTEXT:
-- ALTER TABLE products ADD COLUMN woocommerce_json LONGTEXT NULL;
*/

// ============================================================
// 3) HTTP client: WooCommerce REST API
// ============================================================

/**
 * Hace una request a WooCommerce REST API.
 * Devuelve un array (JSON decodificado) o lanza Exception en error.
 */
function wc_api_request(string $method, string $path, array $query = [], ?array $body = null): array
{
    $baseUrl = WC_BASE_URL . WC_API_PREFIX;
    $url = $baseUrl . $path;

    // Auth por query params (simple y compatible con HTTPS).
    $authQuery = array_merge($query, [
        'consumer_key' => WC_CONSUMER_KEY,
        'consumer_secret' => WC_CONSUMER_SECRET,
    ]);

    if (!empty($authQuery)) {
        $url .= (str_contains($url, '?') ? '&' : '?') . http_build_query($authQuery);
    }

    $headers = [
        'Accept: application/json',
        'Content-Type: application/json',
    ];

    // Logging (sin exponer secrets)
    $logQuery = $query;
    unset($logQuery['consumer_key'], $logQuery['consumer_secret']);
    $logUrl = $baseUrl . $path;
    if (!empty($logQuery)) {
        $logUrl .= '?' . http_build_query($logQuery);
    }
    erp_products_log('→ WooCommerce request', [
        'method' => strtoupper($method),
        'endpoint' => $path,
        'url' => $logUrl,
        'has_body' => ($body !== null),
        'body_bytes' => $body !== null ? strlen(erp_products_json($body)) : 0
    ]);

    // Si corre dentro de WordPress, preferimos WP HTTP API.
    if (function_exists('wp_remote_request')) {
        $args = [
            'method' => strtoupper($method),
            'timeout' => 30,
            'headers' => [
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
            ],
        ];

        if ($body !== null) {
            $args['body'] = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        $resp = wp_remote_request($url, $args);
        if (is_wp_error($resp)) {
            erp_products_log('❌ WooCommerce wp_remote_request error', [
                'message' => $resp->get_error_message(),
                'code' => $resp->get_error_code(),
            ]);
            throw new Exception('WooCommerce request failed: ' . $resp->get_error_message());
        }

        $status = (int) wp_remote_retrieve_response_code($resp);
        $raw = (string) wp_remote_retrieve_body($resp);
        $decoded = json_decode($raw, true);

        erp_products_log('← WooCommerce response', [
            'status' => $status,
            'bytes' => strlen($raw),
            'preview' => substr($raw, 0, ERP_PRODUCTS_LOG_PREVIEW_CHARS)
        ]);

        if ($status < 200 || $status >= 300) {
            throw new Exception("WooCommerce HTTP $status: $raw");
        }
        if (!is_array($decoded)) {
            throw new Exception('WooCommerce response is not JSON: ' . $raw);
        }
        return $decoded;
    }

    // Fallback standalone: cURL
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 30,
    ]);

    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    $raw = curl_exec($ch);
    $curlErr = curl_error($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw === false) {
        erp_products_log('❌ WooCommerce cURL error', ['message' => $curlErr]);
        throw new Exception('cURL error: ' . $curlErr);
    }

    $decoded = json_decode($raw, true);

    erp_products_log('← WooCommerce response (cURL)', [
        'status' => $status,
        'bytes' => strlen($raw),
        'preview' => substr($raw, 0, ERP_PRODUCTS_LOG_PREVIEW_CHARS)
    ]);

    if ($status < 200 || $status >= 300) {
        throw new Exception("WooCommerce HTTP $status: $raw");
    }
    if (!is_array($decoded)) {
        throw new Exception('WooCommerce response is not JSON: ' . $raw);
    }

    return $decoded;
}

// ============================================================
// 4) CRUD WooCommerce (devuelve el JSON COMPLETO del producto)
// ============================================================

function wc_get_product_full_json(int $productId, string $context = 'edit'): array
{
    erp_products_log('CRUD GET producto', ['productId' => $productId, 'context' => $context]);
    $result = wc_api_request('GET', '/products/' . $productId, ['context' => $context]);
    erp_products_log('CRUD GET producto OK', ['productId' => $productId, 'sku' => $result['sku'] ?? null]);
    return $result;
}

function wc_list_products(int $page = 1, int $perPage = 100, array $filters = []): array
{
    erp_products_log('CRUD LIST productos', ['page' => $page, 'per_page' => $perPage]);
    $query = array_merge($filters, [
        'page' => $page,
        'per_page' => $perPage,
        'context' => 'edit',
    ]);
    $result = wc_api_request('GET', '/products', $query);
    erp_products_log('CRUD LIST productos OK', ['count' => is_array($result) ? count($result) : 0]);
    return $result;
}

function wc_create_product(array $productData): array
{
    erp_products_log('CRUD CREATE producto', ['name' => $productData['name'] ?? null, 'sku' => $productData['sku'] ?? null]);
    $result = wc_api_request('POST', '/products', [], $productData);
    erp_products_log('CRUD CREATE producto OK', ['woocommerce_id' => $result['id'] ?? null, 'sku' => $result['sku'] ?? null]);
    return $result;
}

function wc_update_product(int $productId, array $productData): array
{
    erp_products_log('CRUD UPDATE producto', ['productId' => $productId, 'fields' => array_keys($productData)]);
    $result = wc_api_request('PUT', '/products/' . $productId, [], $productData);
    erp_products_log('CRUD UPDATE producto OK', ['productId' => $productId, 'sku' => $result['sku'] ?? null]);
    return $result;
}

/**
 * Soft delete en WooCommerce: mueve a papelera (trash) con force=false.
 * Devuelve el producto resultante (JSON completo).
 */
function wc_soft_delete_product(int $productId): array
{
    erp_products_log('CRUD SOFT DELETE producto', ['productId' => $productId]);
    $result = wc_api_request('DELETE', '/products/' . $productId, ['force' => 'false']);
    erp_products_log('CRUD SOFT DELETE producto OK', ['productId' => $productId]);
    return $result;
}

// ============================================================
// 5) Persistencia en BD: guardar JSON completo + soft delete local
// ============================================================

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_PORT, DB_NAME);
    erp_products_log('Conectando a DB...', ['host' => DB_HOST, 'port' => DB_PORT, 'db' => DB_NAME, 'user' => DB_USER]);
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    erp_products_log('✅ DB conectada');
    return $pdo;
}

/**
 * Upsert por woocommerce_id.
 * Guarda el JSON completo de WooCommerce en `woocommerce_json`.
 */
function db_upsert_product_from_wc(array $wcProduct): void
{
    $woocommerceId = (int)($wcProduct['id'] ?? 0);
    if ($woocommerceId <= 0) {
        erp_products_log('❌ Producto WooCommerce inválido (sin id)', ['wcProduct_keys' => array_keys($wcProduct)]);
        throw new Exception('Producto WooCommerce inválido: falta id');
    }

    $sku = (string)($wcProduct['sku'] ?? '');
    $name = (string)($wcProduct['name'] ?? '');
    $status = (string)($wcProduct['status'] ?? '');
    $price = (string)($wcProduct['price'] ?? '');
    $stockQuantity = $wcProduct['stock_quantity'] ?? null;
    $deletedAt = null; // si viene desde WC, lo tratamos como activo salvo que vos decidas lo contrario.

    $json = json_encode($wcProduct, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        erp_products_log('❌ No se pudo serializar woocommerce_json', ['woocommerce_id' => $woocommerceId, 'sku' => $sku]);
        throw new Exception('No se pudo serializar woocommerce_json');
    }

    erp_products_log('Upsert producto en DB', [
        'woocommerce_id' => $woocommerceId,
        'sku' => $sku,
        'name' => $name,
        'json_bytes' => strlen($json),
        'table' => DB_PRODUCTS_TABLE
    ]);

    // Nota: ajustá las columnas reales de tu tabla.
    $sql = "
        INSERT INTO " . DB_PRODUCTS_TABLE . " (woocommerce_id, sku, name, status, price, stock_quantity, woocommerce_json, deleted_at, updated_at)
        VALUES (:woocommerce_id, :sku, :name, :status, :price, :stock_quantity, :woocommerce_json, :deleted_at, NOW())
        ON DUPLICATE KEY UPDATE
            sku = VALUES(sku),
            name = VALUES(name),
            status = VALUES(status),
            price = VALUES(price),
            stock_quantity = VALUES(stock_quantity),
            woocommerce_json = VALUES(woocommerce_json),
            deleted_at = VALUES(deleted_at),
            updated_at = NOW()
    ";

    $stmt = db()->prepare($sql);
    $stmt->execute([
        ':woocommerce_id' => $woocommerceId,
        ':sku' => $sku,
        ':name' => $name,
        ':status' => $status,
        ':price' => $price,
        ':stock_quantity' => $stockQuantity,
        ':woocommerce_json' => $json,
        ':deleted_at' => $deletedAt,
    ]);

    erp_products_log('✅ Upsert OK', ['woocommerce_id' => $woocommerceId, 'sku' => $sku]);
}

/**
 * Soft delete local (BD): marca deleted_at por woocommerce_id.
 */
function db_soft_delete_product_by_woocommerce_id(int $woocommerceId): void
{
    erp_products_log('Soft delete en DB', ['woocommerce_id' => $woocommerceId, 'table' => DB_PRODUCTS_TABLE]);
    $sql = "UPDATE " . DB_PRODUCTS_TABLE . " SET deleted_at = NOW(), updated_at = NOW() WHERE woocommerce_id = :woocommerce_id";
    $stmt = db()->prepare($sql);
    $stmt->execute([':woocommerce_id' => $woocommerceId]);
    erp_products_log('✅ Soft delete DB OK', ['woocommerce_id' => $woocommerceId]);
}

// ============================================================
// 6) “Orquestador”: WooCommerce CRUD + persistencia del JSON
// ============================================================

/**
 * Obtiene el JSON completo del producto desde WooCommerce y lo persiste (upsert).
 */
function sync_one_product_from_wc_to_db(int $productId): array
{
    erp_products_log('===== SYNC 1 PRODUCTO (WC → DB) =====', ['productId' => $productId]);
    $wcProduct = wc_get_product_full_json($productId, 'edit');
    db_upsert_product_from_wc($wcProduct);
    erp_products_log('===== SYNC FINALIZADO =====', ['productId' => $productId]);
    return $wcProduct;
}

/**
 * Crea producto en WooCommerce, devuelve JSON completo, y lo persiste.
 */
function create_product_in_wc_and_persist(array $productData): array
{
    erp_products_log('===== CREAR PRODUCTO (WC) =====', ['payload_preview' => substr(erp_products_json($productData), 0, ERP_PRODUCTS_LOG_PREVIEW_CHARS)]);
    $wcProduct = wc_create_product($productData);
    db_upsert_product_from_wc($wcProduct);
    erp_products_log('===== CREAR FINALIZADO =====', ['woocommerce_id' => $wcProduct['id'] ?? null, 'sku' => $wcProduct['sku'] ?? null]);
    return $wcProduct;
}

/**
 * Edita producto en WooCommerce, devuelve JSON completo, y lo persiste.
 */
function update_product_in_wc_and_persist(int $productId, array $productData): array
{
    erp_products_log('===== EDITAR PRODUCTO (WC) =====', ['productId' => $productId, 'payload_preview' => substr(erp_products_json($productData), 0, ERP_PRODUCTS_LOG_PREVIEW_CHARS)]);
    $wcProduct = wc_update_product($productId, $productData);
    db_upsert_product_from_wc($wcProduct);
    erp_products_log('===== EDITAR FINALIZADO =====', ['woocommerce_id' => $wcProduct['id'] ?? null, 'sku' => $wcProduct['sku'] ?? null]);
    return $wcProduct;
}

/**
 * Soft delete:
 * - WooCommerce: DELETE force=false (papelera)
 * - BD: deleted_at = NOW()
 */
function soft_delete_product_in_wc_and_db(int $productId): array
{
    erp_products_log('===== SOFT DELETE (WC + DB) =====', ['productId' => $productId]);
    $wcProduct = wc_soft_delete_product($productId);
    db_soft_delete_product_by_woocommerce_id($productId);
    erp_products_log('===== SOFT DELETE FINALIZADO =====', ['productId' => $productId]);
    return $wcProduct;
}

// ============================================================
// 7) Hooks WordPress: log en debug.log al interactuar con productos
// ============================================================
// Al crear/editar/borrar un producto desde el admin de WooCommerce o desde la REST API,
// se escribe una línea en wp-content/debug.log (requiere WP_DEBUG_LOG = true).

if (function_exists('add_action')) {

    add_action('woocommerce_new_product', 'erp_products_log_on_new_product', 10, 2);
    function erp_products_log_on_new_product(int $product_id, $product = null): void
    {
        $sku = '';
        if (is_object($product) && method_exists($product, 'get_sku')) {
            $sku = $product->get_sku();
        } elseif ($product_id && function_exists('wc_get_product')) {
            $p = wc_get_product($product_id);
            $sku = $p ? $p->get_sku() : '';
        }
        erp_products_log('WP HOOK: Producto creado (admin/API)', ['product_id' => $product_id, 'sku' => $sku]);
    }

    add_action('woocommerce_update_product', 'erp_products_log_on_update_product', 10, 2);
    function erp_products_log_on_update_product(int $product_id, $product = null): void
    {
        $sku = '';
        if (is_object($product) && method_exists($product, 'get_sku')) {
            $sku = $product->get_sku();
        } elseif ($product_id && function_exists('wc_get_product')) {
            $p = wc_get_product($product_id);
            $sku = $p ? $p->get_sku() : '';
        }
        erp_products_log('WP HOOK: Producto actualizado (admin/API)', ['product_id' => $product_id, 'sku' => $sku]);
    }

    add_action('woocommerce_trash_product', 'erp_products_log_on_trash_product', 10, 1);
    function erp_products_log_on_trash_product(int $product_id): void
    {
        erp_products_log('WP HOOK: Producto enviado a papelera', ['product_id' => $product_id]);
    }

    add_action('woocommerce_before_delete_product', 'erp_products_log_on_delete_product', 10, 2);
    function erp_products_log_on_delete_product(int $product_id, $product = null): void
    {
        erp_products_log('WP HOOK: Producto eliminado permanentemente', ['product_id' => $product_id]);
    }

    // Fires on every save (admin + REST API), útil para sync desde ERP
    add_action('woocommerce_after_product_object_save', 'erp_products_log_on_after_product_save', 10, 2);
    function erp_products_log_on_after_product_save($product, $data_store = null): void
    {
        if (!is_object($product) || !method_exists($product, 'get_id')) {
            return;
        }
        $id = $product->get_id();
        $sku = method_exists($product, 'get_sku') ? $product->get_sku() : '';
        $name = method_exists($product, 'get_name') ? $product->get_name() : '';
        erp_products_log('WP HOOK: Producto guardado (after_save)', ['product_id' => $id, 'sku' => $sku, 'name' => $name]);
    }

    erp_products_log_once('hooks_products', 'Hooks de productos ERP-PRODUCTS registrados (new_product, update_product, trash_product, before_delete_product, after_product_object_save)', 300);
}

// ============================================================
// 8) Ejemplos de uso (CLI)
// ============================================================

/**
 * Ejecutá:
 *   php docs/WORDPRESS_CRUD_PRODUCTS.php
 *
 * Antes seteá variables de entorno:
 *   WC_BASE_URL, WC_CONSUMER_KEY, WC_CONSUMER_SECRET
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS, DB_PRODUCTS_TABLE
 */
if (PHP_SAPI === 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    try {
        // 1) OBTENER + PERSISTIR 1 producto (JSON completo)
        // $product = sync_one_product_from_wc_to_db(4664);
        // echo "Sync OK producto #{$product['id']} SKU={$product['sku']}\n";

        // 2) CREAR producto en WooCommerce + persistir JSON completo
        /*
        $created = create_product_in_wc_and_persist([
            'name' => 'Producto de prueba API',
            'type' => 'simple',
            'regular_price' => '1000',
            'description' => 'Creado desde snippet PHP',
            'sku' => 'TEST-API-001',
            'manage_stock' => true,
            'stock_quantity' => 10,
            'status' => 'draft',
        ]);
        echo "Creado OK producto #{$created['id']}\n";
        */

        // 3) EDITAR producto + persistir JSON completo
        /*
        $updated = update_product_in_wc_and_persist(4664, [
            'regular_price' => '19999',
            'stock_quantity' => 5,
        ]);
        echo "Actualizado OK producto #{$updated['id']}\n";
        */

        // 4) BORRAR (soft delete) + marcar deleted_at en BD
        /*
        $deleted = soft_delete_product_in_wc_and_db(4664);
        echo "Soft delete OK producto #{$deleted['id']} (moved to trash)\n";
        */

        // 5) LISTAR productos (paginado) + (opcional) persistir todos
        /*
        $page = 1;
        $perPage = 50;
        $items = wc_list_products($page, $perPage);
        echo "Recibidos " . count($items) . " productos\n";
        foreach ($items as $p) {
            db_upsert_product_from_wc($p);
        }
        echo "Persistidos OK\n";
        */

        echo "OK (no se ejecutó ninguna acción porque los ejemplos están comentados).\n";
    } catch (Throwable $e) {
        fwrite(STDERR, "ERROR: " . $e->getMessage() . "\n");
        exit(1);
    }
}

