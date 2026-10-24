<?php
/**
 * Columna "Aurix ERP" en la lista de productos WooCommerce
 *
 * Añade una columna con botón "Sincronizar Producto" que envía el producto
 * al ERP para vincularlo y habilitar sync bidireccional (WooCommerce ↔ ERP).
 *
 * Requisitos:
 * - WooCommerce activo
 * - Variables de configuración (wp-config.php o constantes)
 *
 * Configuración en wp-config.php:
 *   define('AURIX_ERP_WEBHOOK_URL', 'https://api.sistema.mfcomputers.com.ar/api/integration/webhook/woocommerce');
 *   define('AURIX_ERP_WEBHOOK_SECRET', 'mf-wooc-secret');
 */

// ============================================
// CONFIGURACIÓN - CAMBIA ESTOS VALORES
// ============================================
if (!defined('AURIX_ERP_WEBHOOK_URL')) {
    define('AURIX_ERP_WEBHOOK_URL', 'https://api.sistema.mfcomputers.com.ar/api/integration/webhook/woocommerce');
}
if (!defined('AURIX_ERP_WEBHOOK_SECRET')) {
    define('AURIX_ERP_WEBHOOK_SECRET', 'mf-wooc-secret'); // Debe coincidir con WEBHOOK_SECRET en tu API
}
// ============================================

/**
 * CSS para la columna Aurix ERP (título, botón, mensajes de estado)
 * Usa admin_head + comprobación de pantalla para mayor compatibilidad
 */
add_action('admin_head', 'aurix_erp_column_styles');
function aurix_erp_column_styles() {
    $screen = get_current_screen();
    if (!$screen || !in_array($screen->id, array('edit-product', 'product'), true)) {
        return;
    }
    ?>
    <style>
    /* Integración con wp-list-table: misma apariencia que el resto de columnas */
    .wp-list-table .column-aurix_erp,
    .wp-list-table th.column-aurix_erp {
        background: transparent !important;
        padding: 8px 10px;
        vertical-align: middle;
        border-left: 1px solid #c3c4c7;
    }
    .wp-list-table td.column-aurix_erp {
        background: inherit !important;
    }
    .wp-list-table tbody tr:hover td.column-aurix_erp {
        background: inherit !important;
    }

    /* Columna: título horizontal y ancho suficiente para botón + estado */
    .column-aurix_erp,
    th.column-aurix_erp {
        min-width: 200px;
        white-space: nowrap;
    }
    th.column-aurix_erp {
        writing-mode: horizontal-tb;
        text-orientation: mixed;
    }

    /* Celda: mismo padding y alineación que otras celdas */
    .aurix-erp-cell {
        display: flex;
        flex-direction: column;
        gap: 6px;
        align-items: flex-start;
        padding: 0;
    }

    /* Botón: ancho adecuado y proporciones correctas */
    .aurix-sync-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-width: 160px;
        padding: 6px 12px;
        white-space: nowrap;
        line-height: 1.4;
        height: auto;
        box-sizing: border-box;
    }
    .aurix-sync-btn:disabled {
        opacity: 0.7;
        cursor: wait;
    }

    /* Contenedor del mensaje de estado */
    .aurix-sync-status {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        line-height: 1.4;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: 500;
        max-width: 100%;
        min-height: 24px;
    }
    .aurix-sync-status:empty {
        display: none;
    }

    /* Estado: cargando */
    .aurix-sync-status--loading {
        color: #1d2327;
        background: #f0f0f1;
        border: 1px solid #dcdcde;
    }
    .aurix-sync-status--loading::before {
        content: '';
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid #2271b1;
        border-top-color: transparent;
        border-radius: 50%;
        animation: aurix-spin 0.7s linear infinite;
    }

    /* Estado: éxito */
    .aurix-sync-status--success {
        color: #00a32a;
        background: #edfaef;
        border: 1px solid #00a32a;
    }
    .aurix-sync-status--success::before {
        content: '\f147';
        font-family: dashicons;
        font-size: 16px;
        line-height: 1;
    }

    /* Estado: error */
    .aurix-sync-status--error {
        color: #d63638;
        background: #fcf0f1;
        border: 1px solid #d63638;
    }
    .aurix-sync-status--error::before {
        content: '\f158';
        font-family: dashicons;
        font-size: 16px;
        line-height: 1;
        flex-shrink: 0;
    }

    /* Mensaje "Asignar SKU" */
    .aurix-sku-required {
        color: #646970;
        font-size: 12px;
        font-style: italic;
        padding: 4px 0;
    }

    @keyframes aurix-spin {
        to { transform: rotate(360deg); }
    }
    </style>
    <?php
}

/**
 * Añade la columna "Aurix ERP" al final de la tabla
 * (Insertar antes de Etiquetas causaba solapamiento con algunos temas/plugins)
 */
add_filter('manage_edit-product_columns', 'aurix_add_erp_column');
function aurix_add_erp_column($columns) {
    $columns['aurix_erp'] = 'Aurix ERP';
    return $columns;
}

/**
 * Muestra el contenido de la columna (botón o mensaje)
 */
add_action('manage_product_posts_custom_column', 'aurix_erp_column_content', 10, 2);
function aurix_erp_column_content($column, $post_id) {
    if ($column !== 'aurix_erp') {
        return;
    }

    $product = wc_get_product($post_id);
    if (!$product) {
        echo '<em>—</em>';
        return;
    }

    $sku = $product->get_sku();
    if (empty($sku)) {
        echo '<span class="aurix-sku-required">Asignar SKU para sincronizar</span>';
        return;
    }

    $nonce = wp_create_nonce('aurix_sync_' . $post_id);
    ?>
    <div class="aurix-erp-cell">
        <button type="button"
                class="button aurix-sync-btn"
                data-product-id="<?php echo esc_attr($post_id); ?>"
                data-nonce="<?php echo esc_attr($nonce); ?>">
            Sincronizar Producto
        </button>
        <span class="aurix-sync-status" id="aurix-status-<?php echo (int) $post_id; ?>"></span>
    </div>
    <?php
}

/**
 * Encola el script AJAX en la pantalla de listado de productos
 */
add_action('admin_footer', 'aurix_erp_sync_script');
function aurix_erp_sync_script() {
    $screen = get_current_screen();
    if (!$screen || $screen->id !== 'edit-product') {
        return;
    }
    ?>
    <script>
    jQuery(document).ready(function($) {
        $('.aurix-sync-btn').on('click', function() {
            var btn = $(this);
            var productId = btn.data('product-id');
            var nonce = btn.data('nonce');
            var statusEl = $('#aurix-status-' + productId);

            function setStatus(text, state) {
                statusEl
                    .removeClass('aurix-sync-status--loading aurix-sync-status--success aurix-sync-status--error')
                    .addClass('aurix-sync-status--' + state)
                    .text(text);
            }

            btn.prop('disabled', true);
            setStatus('Enviando...', 'loading');

            $.ajax({
                url: ajaxurl,
                type: 'POST',
                data: {
                    action: 'aurix_sync_product_to_erp',
                    product_id: productId,
                    nonce: nonce
                },
                success: function(response) {
                    if (response.success) {
                        setStatus('Sincronizado', 'success');
                    } else {
                        setStatus('Error: ' + (response.data || 'Desconocido'), 'error');
                    }
                },
                error: function(xhr, status, err) {
                    setStatus('Error de conexión', 'error');
                },
                complete: function() {
                    btn.prop('disabled', false);
                }
            });
        });
    });
    </script>
    <?php
}

/**
 * Handler AJAX: obtiene el producto y lo envía al ERP
 */
add_action('wp_ajax_aurix_sync_product_to_erp', 'aurix_sync_product_to_erp_handler');
function aurix_sync_product_to_erp_handler() {
    $product_id = isset($_POST['product_id']) ? absint($_POST['product_id']) : 0;
    if (!$product_id) {
        wp_send_json_error('Producto inválido');
    }

    if (!wp_verify_nonce(isset($_POST['nonce']) ? sanitize_text_field(wp_unslash($_POST['nonce'])) : '', 'aurix_sync_' . $product_id)) {
        wp_send_json_error('Nonce inválido');
    }

    if (!current_user_can('edit_products')) {
        wp_send_json_error('Sin permisos');
    }

    $product = wc_get_product($product_id);
    if (!$product) {
        wp_send_json_error('Producto no encontrado');
    }

    $sku = $product->get_sku();
    if (empty($sku)) {
        wp_send_json_error('El producto debe tener SKU asignado');
    }

    // Construir payload compatible con la API ERP
    $images = array();
    $image_id = $product->get_image_id();
    if ($image_id) {
        $src = wp_get_attachment_image_url($image_id, 'full');
        if ($src) {
            $images[] = array('id' => $image_id, 'src' => $src);
        }
    }
    foreach ($product->get_gallery_image_ids() as $img_id) {
        $src = wp_get_attachment_image_url($img_id, 'full');
        if ($src) {
            $images[] = array('id' => $img_id, 'src' => $src);
        }
    }

    $payload = array(
        'action' => 'product.updated',
        'product' => array(
            'id' => $product->get_id(),
            'sku' => $sku,
            'name' => $product->get_name(),
            'status' => $product->get_status(),
            'price' => $product->get_regular_price(),
            'regular_price' => $product->get_regular_price(),
            'stock_quantity' => $product->get_stock_quantity(),
            'description' => $product->get_description(),
            'short_description' => $product->get_short_description(),
            'images' => $images
        )
    );

    $api_url = defined('AURIX_ERP_WEBHOOK_URL') ? AURIX_ERP_WEBHOOK_URL : 'https://api.sistema.mfcomputers.com.ar/api/integration/webhook/woocommerce';
    $secret = defined('AURIX_ERP_WEBHOOK_SECRET') ? AURIX_ERP_WEBHOOK_SECRET : 'mf-wooc-secret';

    $response = wp_remote_post($api_url, array(
        'method' => 'POST',
        'timeout' => 15,
        'blocking' => true,
        'headers' => array(
            'Content-Type' => 'application/json',
            'X-Webhook-Secret' => $secret
        ),
        'body' => wp_json_encode($payload)
    ));

    if (is_wp_error($response)) {
        wp_send_json_error($response->get_error_message());
    }

    $code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);

    if ($code >= 200 && $code < 300) {
        wp_send_json_success('Producto sincronizado con el ERP');
    } else {
        $decoded = json_decode($body, true);
        $msg = isset($decoded['message']) ? $decoded['message'] : 'Código ' . $code;
        wp_send_json_error($msg);
    }
}
