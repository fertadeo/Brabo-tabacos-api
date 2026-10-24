<?php
/**
 * WooCommerce: pasar a borrador los productos publicados que existen en la tienda
 * pero cuyo SKU no está en el ERP (MF Computers API).
 *
 * Flujo:
 * 1) GET /api/integration/products/woocommerce (header x-api-key) → conjunto de SKUs del ERP.
 * 2) Listar productos de WooCommerce (REST wc/v3) con paginación.
 * 3) Para cada producto publicado: si ningún SKU relevante (padre + variaciones) está en el ERP,
 *    actualizar status => draft.
 *
 * Alineación con la API ERP (mismo proyecto que docs/WORDPRESS_CRUD_PRODUCTS.php):
 * - Códigos de producto en el ERP = campo `code`; en WooCommerce se usan como `sku`.
 * - Endpoint de catálogo: GET https://<tu-api>/api/integration/products/woocommerce
 *   (requiere header `x-api-key`; ver src/routes/integration.ts).
 *
 * Requisitos:
 * - PHP 8+ recomendado
 * - Credenciales WooCommerce REST (consumer key / secret) con permiso de lectura/escritura en productos
 * - API Key válida para el ERP
 *
 * Uso:
 * - Copiar a Code Snippets / mu-plugin y definir constantes vía getenv o wp-config.
 * - CLI: `php docs/WORDPRESS_DRAFT_ORPHAN_PRODUCTS.php` — ejecuta pasar a borrador (comportamiento actual).
 * - CLI: `php docs/WORDPRESS_DRAFT_ORPHAN_PRODUCTS.php --list-discrepancies` — solo lista diferencias ERP ↔ WooCommerce (sin modificar WC).
 *
 * Ejecución en el navegador (sin segundo snippet):
 * - En wp-config: define('DRAFT_ORPHANS_ENABLE_URL_TRIGGER', true);
 * - En el escritorio WP aparece un aviso con enlace seguro (incluye nonce). No uses solo ?mf_run_draft=1 sin nonce.
 * - Listar discrepancias (solo lectura): `?mf_list_discrepancies=1` + mismo nonce que draft (requiere DRAFT_ORPHANS_ENABLE_URL_TRIGGER).
 * - Si antes tenías otro snippet con init + mf_run_draft, eliminalo para evitar conflictos.
 */

// ============================================================
// 0) Debug / logs
// ============================================================

if (!defined('DRAFT_ORPHANS_DEBUG')) {
    define('DRAFT_ORPHANS_DEBUG', true);
}
if (!defined('DRAFT_ORPHANS_LOG_PREFIX')) {
    define('DRAFT_ORPHANS_LOG_PREFIX', '[DRAFT-WC-ORPHANS]');
}
if (!defined('DRAFT_ORPHANS_LOG_PREVIEW_CHARS')) {
    define('DRAFT_ORPHANS_LOG_PREVIEW_CHARS', 400);
}

function draft_orphans_json($data): string
{
    if (function_exists('wp_json_encode')) {
        $encoded = wp_json_encode($data);
        return is_string($encoded) ? $encoded : '';
    }
    $encoded = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return is_string($encoded) ? $encoded : '';
}

function draft_orphans_log(string $message, $context = null): void
{
    if (!defined('DRAFT_ORPHANS_DEBUG') || DRAFT_ORPHANS_DEBUG !== true) {
        return;
    }
    if ($context !== null) {
        $ctx = draft_orphans_json($context);
        if ($ctx !== '') {
            error_log(DRAFT_ORPHANS_LOG_PREFIX . ' ' . $message . ' | ' . $ctx);
            return;
        }
    }
    error_log(DRAFT_ORPHANS_LOG_PREFIX . ' ' . $message);
}

// ============================================================
// 1) Configuración
// ============================================================

/** Base URL del ERP, sin barra final. Ej: https://api.tudominio.com */
if (!defined('ERP_API_BASE_URL')) {
    define('ERP_API_BASE_URL', rtrim((string)(getenv('ERP_API_BASE_URL') ?: ''), '/'));
}

/** API Key para GET /api/integration/products/woocommerce */
if (!defined('ERP_API_KEY')) {
    define('ERP_API_KEY', (string)(getenv('ERP_API_KEY') ?: ''));
}

if (!defined('WC_BASE_URL')) {
    define('WC_BASE_URL', rtrim((string)(getenv('WC_BASE_URL') ?: ''), '/'));
}
if (!defined('WC_CONSUMER_KEY')) {
    define('WC_CONSUMER_KEY', (string)(getenv('WC_CONSUMER_KEY') ?: ''));
}
if (!defined('WC_CONSUMER_SECRET')) {
    define('WC_CONSUMER_SECRET', (string)(getenv('WC_CONSUMER_SECRET') ?: ''));
}
if (!defined('WC_API_PREFIX')) {
    define('WC_API_PREFIX', '/wp-json/wc/v3');
}

/** Si true, solo registra qué se haría sin llamar PUT */
if (!defined('DRAFT_ORPHANS_DRY_RUN')) {
    define('DRAFT_ORPHANS_DRY_RUN', filter_var(getenv('DRAFT_ORPHANS_DRY_RUN') ?: 'false', FILTER_VALIDATE_BOOLEAN));
}

/** Productos publicados con SKU vacío: true = considerarlos huérfanos y pasarlos a draft; false = omitirlos */
if (!defined('DRAFT_ORPHANS_TREAT_EMPTY_SKU_AS_ORPHAN')) {
    define('DRAFT_ORPHANS_TREAT_EMPTY_SKU_AS_ORPHAN', filter_var(getenv('DRAFT_ORPHANS_TREAT_EMPTY_SKU_AS_ORPHAN') ?: 'false', FILTER_VALIDATE_BOOLEAN));
}

/** Solo procesar estos status de WC (por defecto solo los visibles en tienda) */
if (!defined('DRAFT_ORPHANS_WC_STATUSES')) {
    define('DRAFT_ORPHANS_WC_STATUSES', ['publish']);
}

if (!defined('DRAFT_ORPHANS_PER_PAGE')) {
    define('DRAFT_ORPHANS_PER_PAGE', max(1, (int)(getenv('DRAFT_ORPHANS_PER_PAGE') ?: 100)));
}

/** Status de WC a incluir al listar discrepancias (publicado + borrador por defecto) */
if (!defined('DRAFT_ORPHANS_DISCREPANCY_WC_STATUSES')) {
    define('DRAFT_ORPHANS_DISCREPANCY_WC_STATUSES', ['publish', 'draft']);
}

/** Incluir en el listado los SKU que están en el ERP pero no aparecen en ningún producto WC */
if (!defined('DRAFT_ORPHANS_LIST_ERP_ONLY_SKUS')) {
    define('DRAFT_ORPHANS_LIST_ERP_ONLY_SKUS', filter_var(getenv('DRAFT_ORPHANS_LIST_ERP_ONLY_SKUS') ?: 'true', FILTER_VALIDATE_BOOLEAN));
}

/** Comparar precio regular ERP vs WC (tolerancia en unidades monetarias) */
if (!defined('DRAFT_ORPHANS_PRICE_TOLERANCE')) {
    define('DRAFT_ORPHANS_PRICE_TOLERANCE', (float)(getenv('DRAFT_ORPHANS_PRICE_TOLERANCE') ?: '0.02'));
}

/**
 * Si es true, permite ejecutar draft_orphans_run() desde el navegador con URL + nonce (solo usuarios con permiso).
 * Desactivar (false) en producción cuando ya no lo necesites.
 */
if (!defined('DRAFT_ORPHANS_ENABLE_URL_TRIGGER')) {
    define('DRAFT_ORPHANS_ENABLE_URL_TRIGGER', filter_var(getenv('DRAFT_ORPHANS_ENABLE_URL_TRIGGER') ?: 'false', FILTER_VALIDATE_BOOLEAN));
}

// ============================================================
// 2) HTTP WooCommerce REST
// ============================================================

/**
 * @return array<int, mixed> JSON decodificado como array
 */
function draft_orphans_wc_request(string $method, string $path, array $query = [], ?array $body = null): array
{
    $baseUrl = WC_BASE_URL . WC_API_PREFIX;
    $url = $baseUrl . $path;

    $authQuery = array_merge($query, [
        'consumer_key' => WC_CONSUMER_KEY,
        'consumer_secret' => WC_CONSUMER_SECRET,
    ]);
    $url .= (str_contains($url, '?') ? '&' : '?') . http_build_query($authQuery);

    draft_orphans_log('→ WC', ['method' => $method, 'path' => $path, 'has_body' => $body !== null]);

    if (function_exists('wp_remote_request')) {
        $args = [
            'method' => strtoupper($method),
            'timeout' => 60,
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
            throw new Exception('WooCommerce request failed: ' . $resp->get_error_message());
        }
        $status = (int) wp_remote_retrieve_response_code($resp);
        $raw = (string) wp_remote_retrieve_body($resp);
        $decoded = json_decode($raw, true);
        if ($status < 200 || $status >= 300) {
            throw new Exception("WooCommerce HTTP $status: $raw");
        }
        if (!is_array($decoded)) {
            throw new Exception('WooCommerce response is not JSON');
        }
        return $decoded;
    }

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
        CURLOPT_HTTPHEADER => ['Accept: application/json', 'Content-Type: application/json'],
        CURLOPT_TIMEOUT => 60,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if ($raw === false) {
        $err = curl_error($ch);
        curl_close($ch);
        throw new Exception('cURL error: ' . $err);
    }
    curl_close($ch);
    $decoded = json_decode((string) $raw, true);
    if ($status < 200 || $status >= 300) {
        throw new Exception("WooCommerce HTTP $status: $raw");
    }
    if (!is_array($decoded)) {
        throw new Exception('WooCommerce response is not JSON');
    }
    return $decoded;
}

/**
 * @return array<int, array<string, mixed>>
 */
function draft_orphans_wc_list_variations(int $productId, int $page, int $perPage): array
{
    $result = draft_orphans_wc_request('GET', '/products/' . $productId . '/variations', [
        'page' => $page,
        'per_page' => $perPage,
        'context' => 'edit',
    ]);
    return is_array($result) ? $result : [];
}

function draft_orphans_wc_update_product(int $productId, array $data): array
{
    return draft_orphans_wc_request('PUT', '/products/' . $productId, [], $data);
}

// ============================================================
// 3) ERP: conjunto de SKUs
// ============================================================

/**
 * Obtiene catálogo ERP (GET /api/integration/products/woocommerce) para comparar SKU, precio y stock.
 *
 * @return array{by_sku: array<string, array{name: string, price: float, stock_quantity: int}>, sku_set: array<string, true>}
 */
function draft_orphans_fetch_erp_catalog(): array
{
    if (ERP_API_BASE_URL === '' || ERP_API_KEY === '') {
        throw new Exception('Definí ERP_API_BASE_URL y ERP_API_KEY (env o constantes antes de incluir el snippet).');
    }

    $url = ERP_API_BASE_URL . '/api/integration/products/woocommerce';
    draft_orphans_log('→ ERP catálogo', ['url' => $url]);

    if (function_exists('wp_remote_get')) {
        $resp = wp_remote_get($url, [
            'timeout' => 120,
            'headers' => [
                'Accept' => 'application/json',
                'x-api-key' => ERP_API_KEY,
            ],
        ]);
        if (is_wp_error($resp)) {
            throw new Exception('ERP request failed: ' . $resp->get_error_message());
        }
        $status = (int) wp_remote_retrieve_response_code($resp);
        $raw = (string) wp_remote_retrieve_body($resp);
    } else {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 120,
            CURLOPT_HTTPHEADER => [
                'Accept: application/json',
                'x-api-key: ' . ERP_API_KEY,
            ],
        ]);
        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if ($raw === false) {
            $e = curl_error($ch);
            curl_close($ch);
            throw new Exception('ERP cURL: ' . $e);
        }
        curl_close($ch);
    }

    if ($status < 200 || $status >= 300) {
        throw new Exception("ERP HTTP $status: " . substr($raw, 0, DRAFT_ORPHANS_LOG_PREVIEW_CHARS));
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded) || empty($decoded['success'])) {
        throw new Exception('Respuesta ERP inválida: ' . substr($raw, 0, DRAFT_ORPHANS_LOG_PREVIEW_CHARS));
    }

    $products = $decoded['data']['products'] ?? null;
    if (!is_array($products)) {
        throw new Exception('ERP: falta data.products en la respuesta.');
    }

    $bySku = [];
    foreach ($products as $p) {
        if (!is_array($p)) {
            continue;
        }
        $sku = trim((string) ($p['sku'] ?? ''));
        if ($sku === '') {
            continue;
        }
        $priceRaw = (string) ($p['regular_price'] ?? $p['price'] ?? '0');
        $bySku[$sku] = [
            'name' => (string) ($p['name'] ?? ''),
            'price' => draft_orphans_parse_decimal($priceRaw),
            'stock_quantity' => (int) ($p['stock_quantity'] ?? 0),
        ];
    }

    $skuSet = array_fill_keys(array_keys($bySku), true);
    draft_orphans_log('ERP catálogo cargado', ['skus' => count($skuSet)]);

    return ['by_sku' => $bySku, 'sku_set' => $skuSet];
}

function draft_orphans_parse_decimal(string $s): float
{
    $s = trim(str_replace(',', '.', preg_replace('/[^\d,.-]/', '', $s) ?? ''));
    if ($s === '' || $s === '-' || $s === '.') {
        return 0.0;
    }
    return (float) $s;
}

/**
 * Obtiene todos los SKU conocidos en el ERP (código de producto).
 *
 * @return array<string, true> set sku => true
 */
function draft_orphans_fetch_erp_sku_set(): array
{
    return draft_orphans_fetch_erp_catalog()['sku_set'];
}

/**
 * Extrae SKUs del meta_data de WooCommerce (_mfcomputers_erp_code) por si el SKU visible está vacío.
 *
 * @param array<string, mixed> $wcProduct
 * @return array<int, string>
 */
function draft_orphans_meta_erp_codes(array $wcProduct): array
{
    $out = [];
    $meta = $wcProduct['meta_data'] ?? null;
    if (!is_array($meta)) {
        return $out;
    }
    foreach ($meta as $row) {
        if (!is_array($row)) {
            continue;
        }
        if (($row['key'] ?? '') === '_mfcomputers_erp_code') {
            $v = trim((string) ($row['value'] ?? ''));
            if ($v !== '') {
                $out[] = $v;
            }
        }
    }
    return $out;
}

function draft_orphans_product_codes_for_match(array $wcProduct): array
{
    $codes = [];
    $parentSku = trim((string) ($wcProduct['sku'] ?? ''));
    if ($parentSku !== '') {
        $codes[] = $parentSku;
    }
    foreach (draft_orphans_meta_erp_codes($wcProduct) as $c) {
        $codes[] = $c;
    }
    $codes = array_values(array_unique($codes));

    $type = (string) ($wcProduct['type'] ?? 'simple');
    $id = (int) ($wcProduct['id'] ?? 0);

    if ($type === 'variable' && $id > 0) {
        $page = 1;
        do {
            $vars = draft_orphans_wc_list_variations($id, $page, DRAFT_ORPHANS_PER_PAGE);
            $n = count($vars);
            foreach ($vars as $v) {
                if (!is_array($v)) {
                    continue;
                }
                $vs = trim((string) ($v['sku'] ?? ''));
                if ($vs !== '') {
                    $codes[] = $vs;
                }
                foreach (draft_orphans_meta_erp_codes($v) as $c) {
                    $codes[] = $c;
                }
            }
            $page++;
        } while ($n >= DRAFT_ORPHANS_PER_PAGE);
    }

    return array_values(array_unique(array_filter($codes, static fn ($x) => $x !== '')));
}

/**
 * @param array<string, true> $erpSkus
 */
function draft_orphans_is_in_erp(array $wcProduct, array $erpSkus): bool
{
    $codes = draft_orphans_product_codes_for_match($wcProduct);
    if ($codes === []) {
        return DRAFT_ORPHANS_TREAT_EMPTY_SKU_AS_ORPHAN ? false : true;
    }
    foreach ($codes as $c) {
        if (isset($erpSkus[$c])) {
            return true;
        }
    }
    return false;
}

/**
 * Códigos candidatos en una línea de producto o variación (SKU + meta ERP).
 *
 * @param array<string, mixed> $line
 * @return array<int, string>
 */
function draft_orphans_line_codes(array $line): array
{
    $codes = [];
    $sku = trim((string) ($line['sku'] ?? ''));
    if ($sku !== '') {
        $codes[] = $sku;
    }
    foreach (draft_orphans_meta_erp_codes($line) as $c) {
        $codes[] = $c;
    }

    return array_values(array_unique(array_filter($codes, static fn ($x) => $x !== '')));
}

/**
 * Precio “de catálogo” en WC para comparar con ERP (regular, o sale/price si no hay regular).
 *
 * @param array<string, mixed> $line
 */
function draft_orphans_wc_display_price(array $line): float
{
    $reg = trim((string) ($line['regular_price'] ?? ''));
    if ($reg !== '') {
        return draft_orphans_parse_decimal($reg);
    }
    $sale = trim((string) ($line['sale_price'] ?? ''));
    if ($sale !== '') {
        return draft_orphans_parse_decimal($sale);
    }

    return draft_orphans_parse_decimal(trim((string) ($line['price'] ?? '0')));
}

/**
 * @param array<string, array{name: string, price: float, stock_quantity: int}> $erpBySku
 * @return array<int, array<string, mixed>>
 */
function draft_orphans_compare_line_issues(
    array $line,
    array $erpBySku,
    int $parentId,
    string $parentName,
    string $kind
): array {
    $issues = [];
    $wcId = (int) ($line['id'] ?? 0);
    $wcStatus = (string) ($line['status'] ?? '');
    $codes = draft_orphans_line_codes($line);

    if ($codes === []) {
        return [[
            'kind' => 'sin_sku',
            'wc_product_id' => $parentId,
            'wc_line_id' => $wcId,
            'wc_status' => $wcStatus,
            'parent_name' => $parentName,
            'line_label' => $kind,
            'message' => 'Sin SKU ni _mfcomputers_erp_code en esta línea',
        ]];
    }

    $erpRow = null;
    $matchedSku = null;
    foreach ($codes as $c) {
        if (isset($erpBySku[$c])) {
            $erpRow = $erpBySku[$c];
            $matchedSku = $c;
            break;
        }
    }

    if ($erpRow === null) {
        return [[
            'kind' => 'no_en_erp',
            'wc_product_id' => $parentId,
            'wc_line_id' => $wcId,
            'wc_status' => $wcStatus,
            'parent_name' => $parentName,
            'line_label' => $kind,
            'codes_considerados' => $codes,
            'message' => 'Ningún código de esta línea está en el catálogo ERP',
        ]];
    }

    $wcPrice = draft_orphans_wc_display_price($line);
    if (abs($wcPrice - $erpRow['price']) > DRAFT_ORPHANS_PRICE_TOLERANCE) {
        $issues[] = [
            'kind' => 'precio',
            'wc_product_id' => $parentId,
            'wc_line_id' => $wcId,
            'wc_status' => $wcStatus,
            'parent_name' => $parentName,
            'line_label' => $kind,
            'sku_matched' => $matchedSku,
            'erp_price' => $erpRow['price'],
            'wc_price' => $wcPrice,
            'message' => 'Precio distinto al ERP',
        ];
    }

    $manageStock = !empty($line['manage_stock']);
    if ($manageStock) {
        $wcStock = (int) ($line['stock_quantity'] ?? 0);
        if ($wcStock !== $erpRow['stock_quantity']) {
            $issues[] = [
                'kind' => 'stock',
                'wc_product_id' => $parentId,
                'wc_line_id' => $wcId,
                'wc_status' => $wcStatus,
                'parent_name' => $parentName,
                'line_label' => $kind,
                'sku_matched' => $matchedSku,
                'erp_stock' => $erpRow['stock_quantity'],
                'wc_stock' => $wcStock,
                'message' => 'Stock distinto al ERP',
            ];
        }
    }

    return $issues;
}

/**
 * Recorre líneas de producto (simple: una línea; variable: una por variación) y acumula discrepancias + SKUs vistos en WC.
 *
 * @param array<string, array{name: string, price: float, stock_quantity: int}> $erpBySku
 * @param array<string, true> $wcSkuSeen se rellena con todos los códigos vistos en WC (referencia).
 * @return array<int, array<string, mixed>>
 */
function draft_orphans_collect_line_issues(array $erpBySku, array &$wcSkuSeen): array
{
    $rows = [];

    foreach (DRAFT_ORPHANS_DISCREPANCY_WC_STATUSES as $wcListStatus) {
        $page = 1;
        do {
            $items = draft_orphans_wc_request('GET', '/products', [
                'page' => $page,
                'per_page' => DRAFT_ORPHANS_PER_PAGE,
                'context' => 'edit',
                'status' => (string) $wcListStatus,
            ]);
            if (!is_array($items)) {
                break;
            }
            $batch = count($items);
            foreach ($items as $p) {
                if (!is_array($p)) {
                    continue;
                }
                $pid = (int) ($p['id'] ?? 0);
                $ptype = (string) ($p['type'] ?? 'simple');
                $pname = (string) ($p['name'] ?? '');
                if ($pid <= 0) {
                    continue;
                }

                if ($ptype === 'variable') {
                    $vpage = 1;
                    do {
                        $vars = draft_orphans_wc_list_variations($pid, $vpage, DRAFT_ORPHANS_PER_PAGE);
                        $vn = count($vars);
                        foreach ($vars as $v) {
                            if (!is_array($v)) {
                                continue;
                            }
                            foreach (draft_orphans_line_codes($v) as $c) {
                                $wcSkuSeen[$c] = true;
                            }
                            foreach (draft_orphans_compare_line_issues($v, $erpBySku, $pid, $pname, 'variación') as $issue) {
                                $rows[] = $issue;
                            }
                        }
                        $vpage++;
                    } while ($vn >= DRAFT_ORPHANS_PER_PAGE);
                } else {
                    foreach (draft_orphans_line_codes($p) as $c) {
                        $wcSkuSeen[$c] = true;
                    }
                    foreach (draft_orphans_compare_line_issues($p, $erpBySku, $pid, $pname, $ptype) as $issue) {
                        $rows[] = $issue;
                    }
                }
            }
            $page++;
        } while ($batch >= DRAFT_ORPHANS_PER_PAGE);
    }

    return $rows;
}

/**
 * Lista diferencias entre catálogo ERP y WooCommerce (no modifica la tienda).
 *
 * Incluye: líneas WC sin match en ERP, precio/stock distinto, líneas sin SKU; opcionalmente SKU solo en ERP.
 *
 * @return array{wc_issues: array<int, array<string, mixed>>, erp_only: array<int, array<string, mixed>>, stats: array{wc_issue_rows: int, erp_skus: int, wc_skus_seen: int, erp_only_count: int}}
 */
function draft_orphans_list_discrepancies(): array
{
    $catalog = draft_orphans_fetch_erp_catalog();
    $erpBySku = $catalog['by_sku'];
    $wcSkuSeen = [];

    $wcIssues = draft_orphans_collect_line_issues($erpBySku, $wcSkuSeen);

    $erpOnly = [];
    if (DRAFT_ORPHANS_LIST_ERP_ONLY_SKUS) {
        foreach ($erpBySku as $sku => $row) {
            if (!isset($wcSkuSeen[$sku])) {
                $erpOnly[] = [
                    'kind' => 'solo_en_erp',
                    'sku' => $sku,
                    'erp_name' => $row['name'],
                    'erp_price' => $row['price'],
                    'erp_stock' => $row['stock_quantity'],
                    'message' => 'SKU en ERP sin coincidencia en ningún producto/variación WC',
                ];
            }
        }
    }

    $stats = [
        'wc_issue_rows' => count($wcIssues),
        'erp_skus' => count($erpBySku),
        'wc_skus_seen' => count($wcSkuSeen),
        'erp_only_count' => count($erpOnly),
    ];
    draft_orphans_log('Listado discrepancias', $stats);

    return [
        'wc_issues' => $wcIssues,
        'erp_only' => $erpOnly,
        'stats' => $stats,
    ];
}

/**
 * @param array{wc_issues: array<int, array<string, mixed>>, erp_only: array<int, array<string, mixed>>, stats: array<string, int>} $report
 */
function draft_orphans_render_discrepancies_html(array $report): string
{
    $wc = $report['wc_issues'] ?? [];
    $erpOnly = $report['erp_only'] ?? [];
    $stats = $report['stats'] ?? [];

    $esc = static function ($v): string {
        if (function_exists('esc_html')) {
            return esc_html((string) $v);
        }

        return htmlspecialchars((string) $v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    };

    ob_start();
    echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Discrepancias ERP / WooCommerce</title>';
    echo '<style>body{font-family:system-ui,sans-serif;padding:1rem;} table{border-collapse:collapse;width:100%;margin:1rem 0;} th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;font-size:13px;} th{background:#f0f0f1;}</style>';
    echo '</head><body><h1>Discrepancias ERP ↔ WooCommerce</h1>';
    echo '<p><strong>Resumen:</strong> ';
    echo $esc(draft_orphans_json($stats) ?: '');
    echo '</p>';

    echo '<h2>Incidencias en WooCommerce</h2>';
    if ($wc === []) {
        echo '<p>Ninguna incidencia por línea de producto.</p>';
    } else {
        echo '<table><thead><tr><th>Tipo</th><th>WC ID</th><th>Línea</th><th>Estado</th><th>Nombre</th><th>Detalle</th></tr></thead><tbody>';
        foreach ($wc as $row) {
            echo '<tr>';
            echo '<td>' . $esc($row['kind'] ?? '') . '</td>';
            echo '<td>' . $esc((string) ($row['wc_product_id'] ?? '')) . '</td>';
            echo '<td>' . $esc((string) ($row['wc_line_id'] ?? '')) . '</td>';
            echo '<td>' . $esc($row['wc_status'] ?? '') . '</td>';
            echo '<td>' . $esc($row['parent_name'] ?? '') . '</td>';
            $detail = $row['message'] ?? '';
            if (!empty($row['codes_considerados'])) {
                $detail .= ' — códigos: ' . draft_orphans_json($row['codes_considerados']);
            }
            if (isset($row['erp_price'], $row['wc_price'])) {
                $detail .= ' — ERP: ' . $row['erp_price'] . ' / WC: ' . $row['wc_price'];
            }
            if (isset($row['erp_stock'], $row['wc_stock'])) {
                $detail .= ' — ERP stock: ' . $row['erp_stock'] . ' / WC stock: ' . $row['wc_stock'];
            }
            echo '<td>' . $esc($detail) . '</td>';
            echo '</tr>';
        }
        echo '</tbody></table>';
    }

    if ($erpOnly !== []) {
        echo '<h2>SKU solo en ERP (no aparecen en WC)</h2>';
        echo '<table><thead><tr><th>SKU</th><th>Nombre ERP</th><th>Precio</th><th>Stock</th></tr></thead><tbody>';
        foreach ($erpOnly as $row) {
            echo '<tr>';
            echo '<td>' . $esc($row['sku'] ?? '') . '</td>';
            echo '<td>' . $esc($row['erp_name'] ?? '') . '</td>';
            echo '<td>' . $esc((string) ($row['erp_price'] ?? '')) . '</td>';
            echo '<td>' . $esc((string) ($row['erp_stock'] ?? '')) . '</td>';
            echo '</tr>';
        }
        echo '</tbody></table>';
    }

    $admin = function_exists('admin_url') ? admin_url() : '/';
    echo '<p><a href="' . (function_exists('esc_url') ? esc_url($admin) : htmlspecialchars($admin, ENT_QUOTES, 'UTF-8')) . '">Volver al escritorio</a></p>';
    echo '</body></html>';

    return (string) ob_get_clean();
}

/**
 * @return array{drafted: int, skipped: int, errors: int, scanned: int, dry_run: bool}
 */
function draft_orphans_run(): array
{
    $erpSkus = draft_orphans_fetch_erp_sku_set();

    $drafted = 0;
    $skipped = 0;
    $errors = 0;
    $scanned = 0;

    foreach (DRAFT_ORPHANS_WC_STATUSES as $wcListStatus) {
        $page = 1;
        do {
            $items = draft_orphans_wc_request('GET', '/products', [
                'page' => $page,
                'per_page' => DRAFT_ORPHANS_PER_PAGE,
                'context' => 'edit',
                'status' => (string) $wcListStatus,
            ]);
            if (!is_array($items)) {
                break;
            }
            $batch = count($items);
            foreach ($items as $p) {
                if (!is_array($p)) {
                    continue;
                }
                $scanned++;
                $pid = (int) ($p['id'] ?? 0);
                $st = (string) ($p['status'] ?? '');
                if ($pid <= 0 || $st === 'draft') {
                    $skipped++;
                    continue;
                }

                if (draft_orphans_is_in_erp($p, $erpSkus)) {
                    $skipped++;
                    continue;
                }

                $skuInfo = draft_orphans_product_codes_for_match($p);
                draft_orphans_log('Huérfano detectado', [
                    'id' => $pid,
                    'name' => $p['name'] ?? '',
                    'type' => $p['type'] ?? '',
                    'codes_considerados' => $skuInfo,
                    'dry_run' => DRAFT_ORPHANS_DRY_RUN,
                ]);

                if (DRAFT_ORPHANS_DRY_RUN) {
                    $drafted++;
                    continue;
                }

                try {
                    draft_orphans_wc_update_product($pid, ['status' => 'draft']);
                    $drafted++;
                } catch (Throwable $e) {
                    $errors++;
                    draft_orphans_log('Error al pasar a draft', ['id' => $pid, 'error' => $e->getMessage()]);
                }
            }
            $page++;
        } while ($batch >= DRAFT_ORPHANS_PER_PAGE);
    }

    $summary = [
        'drafted' => $drafted,
        'skipped' => $skipped,
        'errors' => $errors,
        'scanned' => $scanned,
        'dry_run' => DRAFT_ORPHANS_DRY_RUN,
    ];
    draft_orphans_log('Resumen draft orphans', $summary);
    return $summary;
}

// ============================================================
// 4) WordPress: acción programada (opcional)
// ============================================================

if (function_exists('add_action')) {
    /**
     * Programá en WP-Cron, por ejemplo desde otro snippet:
     * `wp_schedule_event(time(), 'daily', 'mfcomputers_draft_wc_orphans_event');`
     */
    add_action('mfcomputers_draft_wc_orphans_event', static function (): void {
        try {
            draft_orphans_run();
        } catch (Throwable $e) {
            draft_orphans_log('Cron draft orphans falló', ['error' => $e->getMessage()]);
        }
    });

    /**
     * Ejecución manual desde el navegador (opción A segura): requiere nonce y captura errores (evita “error crítico”).
     *
     * 1) En wp-config.php: define('DRAFT_ORPHANS_ENABLE_URL_TRIGGER', true);
     * 2) En el escritorio WP, arriba aparece un aviso con enlace “Ejecutar draft huérfanos” (solo administración).
     * 3) O construí la URL con: wp_nonce_url( home_url('/?mf_run_draft=1'), 'draft_orphans_run_once', '_wpnonce' );
     */
    if (DRAFT_ORPHANS_ENABLE_URL_TRIGGER) {
        add_action('admin_notices', static function (): void {
            if (!current_user_can('manage_woocommerce')) {
                return;
            }
            $url = wp_nonce_url(home_url('/?mf_run_draft=1'), 'draft_orphans_run_once', '_wpnonce');
            $urlList = wp_nonce_url(home_url('/?mf_list_discrepancies=1'), 'draft_orphans_run_once', '_wpnonce');
            echo '<div class="notice notice-info"><p><strong>MF Draft huérfanos:</strong> ';
            echo '<a href="' . esc_url($url) . '">Ejecutar una vez (abre resultado en la misma ventana)</a>';
            echo ' · <a href="' . esc_url($urlList) . '">Listar discrepancias ERP / WC (solo lectura)</a>';
            echo ' — Desactivá DRAFT_ORPHANS_ENABLE_URL_TRIGGER cuando termines.</p></div>';
        });

        add_action('init', static function (): void {
            $runDraft = !empty($_GET['mf_run_draft']);
            $listDisc = !empty($_GET['mf_list_discrepancies']);
            if (!$runDraft && !$listDisc) {
                return;
            }
            if (!DRAFT_ORPHANS_ENABLE_URL_TRIGGER) {
                return;
            }
            if (!is_user_logged_in() || !current_user_can('manage_woocommerce')) {
                wp_die(esc_html__('Permisos insuficientes.', 'draft-orphans'), '', ['response' => 403]);
            }
            $nonce = isset($_GET['_wpnonce']) ? sanitize_text_field(wp_unslash((string) $_GET['_wpnonce'])) : '';
            if ($nonce === '' || !wp_verify_nonce($nonce, 'draft_orphans_run_once')) {
                wp_die(esc_html__('Enlace inválido o caducado. Volvé al escritorio y usá el aviso del snippet.', 'draft-orphans'), '', ['response' => 403]);
            }
            if ($listDisc) {
                if (!function_exists('draft_orphans_list_discrepancies')) {
                    wp_die(esc_html__('No está cargada la función draft_orphans_list_discrepancies.', 'draft-orphans'), '', ['response' => 500]);
                }
                try {
                    $report = draft_orphans_list_discrepancies();
                    nocache_headers();
                    header('Content-Type: text/html; charset=utf-8');
                    echo draft_orphans_render_discrepancies_html($report);
                    exit;
                } catch (Throwable $e) {
                    nocache_headers();
                    header('Content-Type: text/html; charset=utf-8');
                    echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Error</title></head><body><h1>Error al listar</h1><pre>';
                    echo esc_html($e->getMessage()) . "\n\n" . esc_html($e->getFile()) . ':' . (int) $e->getLine();
                    echo '</pre><p><a href="' . esc_url(admin_url()) . '">Volver al escritorio</a></p></body></html>';
                    exit;
                }
            }
            if (!function_exists('draft_orphans_run')) {
                wp_die(esc_html__('No está cargada la función draft_orphans_run (revisá el snippet).', 'draft-orphans'), '', ['response' => 500]);
            }
            try {
                $r = draft_orphans_run();
                $out = draft_orphans_json($r);
                if ($out === '') {
                    $out = print_r($r, true);
                }
                nocache_headers();
                header('Content-Type: text/html; charset=utf-8');
                echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Draft huérfanos</title></head><body><pre>';
                echo esc_html($out);
                echo '</pre><p><a href="' . esc_url(admin_url()) . '">Volver al escritorio</a></p></body></html>';
                exit;
            } catch (Throwable $e) {
                nocache_headers();
                header('Content-Type: text/html; charset=utf-8');
                echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Error</title></head><body><h1>Error al ejecutar</h1><pre>';
                echo esc_html($e->getMessage()) . "\n\n" . esc_html($e->getFile()) . ':' . (int) $e->getLine();
                echo '</pre><p><a href="' . esc_url(admin_url()) . '">Volver al escritorio</a></p></body></html>';
                exit;
            }
        }, 20);
    }
}

// ============================================================
// 5) CLI
// ============================================================

if (PHP_SAPI === 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    $argv = $GLOBALS['argv'] ?? [];
    $listMode = in_array('--list-discrepancies', $argv, true);
    try {
        if ($listMode) {
            $report = draft_orphans_list_discrepancies();
            $out = draft_orphans_json($report);
            echo ($out !== '' ? $out : print_r($report, true)) . "\n";
        } else {
            $r = draft_orphans_run();
            echo draft_orphans_json($r) . "\n";
        }
    } catch (Throwable $e) {
        fwrite(STDERR, 'ERROR: ' . $e->getMessage() . "\n");
        exit(1);
    }
}
