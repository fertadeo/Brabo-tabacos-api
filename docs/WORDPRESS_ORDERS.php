<?php
/**
 * Sincronización de Pedidos de WooCommerce con ERP
 * VERSIÓN 2.0 - Con detección de ediciones, eliminaciones y cambios de estado
 * 
 * Este snippet envía automáticamente los pedidos al ERP cuando:
 * - Se completa una compra (pedido nuevo)
 * - Se edita un pedido (cambios en productos, direcciones, totales, etc.)
 * - Cambia el estado del pedido (En Espera, Procesando, Completado, etc.)
 * - Se elimina un pedido (soft delete)
 * 
 * Funciona con TODOS los métodos de pago, incluyendo transferencias bancarias.
 * 
 * INSTRUCCIONES DE INSTALACIÓN:
 * 1. Copia este código completo
 * 2. Ve a WordPress → Plugins → Code Snippets → Add New
 * 3. Pega el código
 * 4. Configura la URL y el Secret (líneas 20-27)
 * 5. Activa el snippet
 * 
 * IMPORTANTE: Cambia la URL y el Secret según tu configuración
 */

// ============================================
// CONFIGURACIÓN - CAMBIA ESTOS VALORES
// ============================================
if (!defined('ERP_ORDERS_API_URL')) {
    define('ERP_ORDERS_API_URL', 'https://api.sistema.mfcomputers.com.ar/api/integration/webhook/woocommerce/order');
}

// Usar la misma constante que el snippet de categorías para evitar duplicados
if (!defined('ERP_WEBHOOK_SECRET')) {
    define('ERP_WEBHOOK_SECRET', 'mf-wooc-secret'); // Debe coincidir con WEBHOOK_SECRET en tu API
}
// ============================================

/**
 * Función auxiliar para preparar el payload del pedido
 * Reutilizable para crear, actualizar y eliminar
 */
function prepare_order_payload($order, $action = 'create') {
    if (!$order || is_wp_error($order)) {
        return null;
    }
    
    // Preparar payload del pedido en formato similar al REST API de WooCommerce
    $order_payload = array(
        'id' => $order->get_id(),
        'number' => $order->get_order_number(),
        'status' => $order->get_status(),
        'date_created' => $order->get_date_created() ? $order->get_date_created()->date('c') : null,
        'date_created_gmt' => $order->get_date_created() ? $order->get_date_created()->date('c') : null,
        'date_modified' => $order->get_date_modified() ? $order->get_date_modified()->date('c') : null,
        'date_modified_gmt' => $order->get_date_modified() ? $order->get_date_modified()->date('c') : null,
        'currency' => $order->get_currency(),
        'total' => (string)$order->get_total(),
        'discount_total' => (string)$order->get_total_discount(),
        'shipping_total' => (string)$order->get_shipping_total(),
        'tax_total' => (string)$order->get_total_tax(),
        'customer_id' => $order->get_customer_id(),
        'customer_ip_address' => $order->get_customer_ip_address(),
        'customer_user_agent' => $order->get_customer_user_agent(),
        // Métodos de pago
        'payment_method' => $order->get_payment_method(),
        'payment_method_title' => $order->get_payment_method_title(),
        'transaction_id' => $order->get_transaction_id(),
        'date_paid' => $order->get_date_paid() ? $order->get_date_paid()->date('c') : null,
        'date_paid_gmt' => $order->get_date_paid() ? $order->get_date_paid()->date('c') : null,
        'date_completed' => $order->get_date_completed() ? $order->get_date_completed()->date('c') : null,
        'date_completed_gmt' => $order->get_date_completed() ? $order->get_date_completed()->date('c') : null,
        'billing' => array(
            'first_name' => $order->get_billing_first_name(),
            'last_name' => $order->get_billing_last_name(),
            'company' => $order->get_billing_company(),
            'address_1' => $order->get_billing_address_1(),
            'address_2' => $order->get_billing_address_2(),
            'city' => $order->get_billing_city(),
            'state' => $order->get_billing_state(),
            'postcode' => $order->get_billing_postcode(),
            'country' => $order->get_billing_country(),
            'email' => $order->get_billing_email(),
            'phone' => $order->get_billing_phone()
        ),
        'shipping' => array(
            'first_name' => $order->get_shipping_first_name(),
            'last_name' => $order->get_shipping_last_name(),
            'company' => $order->get_shipping_company(),
            'address_1' => $order->get_shipping_address_1(),
            'address_2' => $order->get_shipping_address_2(),
            'city' => $order->get_shipping_city(),
            'state' => $order->get_shipping_state(),
            'postcode' => $order->get_shipping_postcode(),
            'country' => $order->get_shipping_country(),
            'phone' => $order->get_shipping_phone()
        ),
        'line_items' => array(),
        'shipping_lines' => array(),
        'meta_data' => array(),
        // ⭐ NUEVO: Indicar el tipo de acción
        'action' => $action // 'create', 'update', 'delete'
    );
    
    // Agregar items del pedido
    $items = $order->get_items();
    if (!is_array($items)) {
        $items = array();
    }
    foreach ($items as $item_id => $item) {
        $product = $item->get_product();
        $sku = '';
        if ($product) {
            $sku = $product->get_sku();
        }
        
        $quantity = (float)$item->get_quantity();
        $total = (float)$item->get_total();
        $unit_price = $quantity > 0 ? $total / $quantity : 0;
        
        $order_payload['line_items'][] = array(
            'id' => $item_id,
            'name' => $item->get_name(),
            'product_id' => $item->get_product_id(),
            'variation_id' => $item->get_variation_id(),
            'quantity' => $quantity,
            'tax_class' => $item->get_tax_class(),
            'subtotal' => (string)$item->get_subtotal(),
            'subtotal_tax' => (string)$item->get_subtotal_tax(),
            'total' => (string)$total,
            'total_tax' => (string)$item->get_total_tax(),
            'sku' => $sku,
            'price' => $unit_price
        );
    }
    
    // Agregar métodos de envío
    $shipping_items = $order->get_items('shipping');
    if (!is_array($shipping_items)) {
        $shipping_items = array();
    }
    foreach ($shipping_items as $item_id => $shipping_item) {
        $order_payload['shipping_lines'][] = array(
            'id' => $item_id,
            'method_title' => $shipping_item->get_method_title(),
            'method_id' => $shipping_item->get_method_id(),
            'total' => (string)$shipping_item->get_total(),
            'total_tax' => (string)$shipping_item->get_total_tax()
        );
    }
    
    // Agregar metadata del pedido
    $meta_data = $order->get_meta_data();
    if (!is_array($meta_data)) {
        $meta_data = array();
    }
    foreach ($meta_data as $meta) {
        $order_payload['meta_data'][] = array(
            'id' => $meta->id,
            'key' => $meta->key,
            'value' => $meta->value
        );
    }
    
    return $order_payload;
}

/**
 * Función principal para enviar pedido al ERP
 * @param int $order_id ID del pedido
 * @param string $action Tipo de acción: 'create', 'update', 'delete'
 * @param string $hook_name Nombre del hook que disparó la acción (para logging)
 */
function send_order_to_erp($order_id, $action = 'create', $hook_name = '') {
    // Para actualizaciones, no usar protección anti-duplicados (necesitamos enviar cada cambio)
    if ($action === 'create') {
        $processed_key = 'erp_order_processed_' . $order_id;
        if (get_transient($processed_key)) {
            error_log('[ERP-ORDERS] ⚠️ Pedido #' . $order_id . ' ya fue procesado recientemente. Omitiendo...');
            return;
        }
    }
    
    error_log('[ERP-ORDERS] 🔔 ========== FUNCIÓN EJECUTADA ==========');
    error_log('[ERP-ORDERS] Acción: ' . strtoupper($action));
    error_log('[ERP-ORDERS] Timestamp: ' . current_time('mysql'));
    error_log('[ERP-ORDERS] Order ID: ' . $order_id);
    // Obtener el hook actual de forma segura
    $current_hook = '';
    if (function_exists('current_filter')) {
        $current_hook = current_filter();
    }
    error_log('[ERP-ORDERS] Hook: ' . ($hook_name ?: $current_hook));
    
    // Verificar que WooCommerce esté activo
    if (!function_exists('wc_get_order')) {
        error_log('[ERP-ORDERS] ❌ ERROR: WooCommerce no está activo o no está cargado');
        return;
    }
    
    // Obtener el objeto del pedido
    $order = wc_get_order($order_id);
    
    if (!$order || is_wp_error($order)) {
        error_log('[ERP-ORDERS] ❌ ERROR: No se pudo obtener el pedido ID: ' . $order_id);
        if (is_wp_error($order)) {
            error_log('[ERP-ORDERS] Error WP: ' . $order->get_error_message());
        }
        return;
    }
    
    error_log('[ERP-ORDERS] ✅ Pedido obtenido correctamente');
    error_log('[ERP-ORDERS] Order Number: ' . $order->get_order_number());
    error_log('[ERP-ORDERS] Status: ' . $order->get_status());
    error_log('[ERP-ORDERS] Payment Method: ' . $order->get_payment_method_title());
    error_log('[ERP-ORDERS] Email: ' . $order->get_billing_email());
    error_log('[ERP-ORDERS] Total: ' . $order->get_total());
    
    // Preparar payload del pedido
    $order_payload = prepare_order_payload($order, $action);
    
    if (!$order_payload) {
        error_log('[ERP-ORDERS] ❌ ERROR: No se pudo preparar el payload del pedido');
        return;
    }
    
    error_log('[ERP-ORDERS] Payload preparado con ' . count($order_payload['line_items']) . ' items');
    
    // Configurar URL y Secret
    $api_url = defined('ERP_ORDERS_API_URL') ? ERP_ORDERS_API_URL : 'https://api.sistema.mfcomputers.com.ar/api/integration/webhook/woocommerce/order';
    $secret = defined('ERP_WEBHOOK_SECRET') ? ERP_WEBHOOK_SECRET : 'mf-wooc-secret';
    
    error_log('[ERP-ORDERS] URL de destino: ' . $api_url);
    error_log('[ERP-ORDERS] Secret configurado: ' . (empty($secret) ? 'NO CONFIGURADO' : '***configurado***'));
    
    // Preparar headers con autenticación y acción
    $headers = array(
        'Content-Type' => 'application/json',
        'X-Webhook-Secret' => $secret,
        'X-Order-Action' => $action // Header adicional para indicar la acción
    );
    
    // Convertir a JSON
    $json_payload = json_encode($order_payload);
    error_log('[ERP-ORDERS] Payload JSON tamaño: ' . strlen($json_payload) . ' bytes');
    
    // Enviar pedido al ERP
    error_log('[ERP-ORDERS] Enviando request a la API...');
    
    $response = wp_remote_post($api_url, array(
        'method'    => 'POST',
        'timeout'   => 30,
        'blocking'  => true,
        'headers'   => $headers,
        'body'      => $json_payload
    ));
    
    // Procesar respuesta
    if (is_wp_error($response)) {
        $error_message = $response->get_error_message();
        $error_code = $response->get_error_code();
        error_log('[ERP-ORDERS] ❌ ERROR al enviar pedido:');
        error_log('[ERP-ORDERS] Código de error: ' . $error_code);
        error_log('[ERP-ORDERS] Mensaje: ' . $error_message);
        return;
    }
    
    $response_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    
    error_log('[ERP-ORDERS] Código de respuesta HTTP: ' . $response_code);
    error_log('[ERP-ORDERS] Cuerpo de respuesta: ' . substr($response_body, 0, 500));
    
    if ($response_code === 200 || $response_code === 201) {
        $action_label = ucfirst($action);
        error_log('[ERP-ORDERS] ✅✅✅ PEDIDO ' . $action_label . ' ENVIADO EXITOSAMENTE AL ERP ✅✅✅');
        
        // Solo marcar como procesado para pedidos nuevos (evitar duplicados)
        if ($action === 'create') {
            $processed_key = 'erp_order_processed_' . $order_id;
            set_transient($processed_key, true, 3600); // 1 hora
            
            // También guardar en meta del pedido como respaldo
            $order->update_meta_data('_erp_sent_at', current_time('mysql'));
            $order->update_meta_data('_erp_sent', true);
            $order->save();
        }
        
        $response_data = json_decode($response_body, true);
        if ($response_data && isset($response_data['message'])) {
            error_log('[ERP-ORDERS] Mensaje del ERP: ' . $response_data['message']);
        }
    } else {
        error_log('[ERP-ORDERS] ⚠️ Respuesta no exitosa. Código: ' . $response_code);
        error_log('[ERP-ORDERS] Respuesta completa: ' . $response_body);
    }
    
    error_log('[ERP-ORDERS] ========== ENVÍO FINALIZADO ==========');
}

/**
 * Hook para pedidos nuevos (cuando el cliente llega a la página de agradecimiento)
 */
function handle_new_order($order_id) {
    send_order_to_erp($order_id, 'create', 'woocommerce_thankyou');
}

/**
 * Hook para actualizaciones de pedidos (incluye cambios de estado, productos, direcciones, etc.)
 * @param int $order_id ID del pedido
 * @param string $old_status Estado anterior (opcional, solo para woocommerce_order_status_changed)
 * @param string $new_status Estado nuevo (opcional, solo para woocommerce_order_status_changed)
 */
function handle_order_update($order_id, $old_status = '', $new_status = '') {
    // Verificar que el pedido existe y no está siendo eliminado
    $order = wc_get_order($order_id);
    if (!$order || is_wp_error($order)) {
        return;
    }
    
    // Si se pasaron estados (desde woocommerce_order_status_changed), loggear específicamente
    if (!empty($old_status) && !empty($new_status) && $old_status !== $new_status) {
        error_log('[ERP-ORDERS] 🔄 Cambio de estado detectado: ' . $old_status . ' → ' . $new_status);
    }
    
    // Enviar actualización al ERP
    send_order_to_erp($order_id, 'update', 'woocommerce_order_update');
}

/**
 * Hook para eliminaciones de pedidos (antes de eliminar)
 */
function handle_order_delete($order_id) {
    // Obtener el pedido antes de que se elimine
    $order = wc_get_order($order_id);
    if (!$order || is_wp_error($order)) {
        return;
    }
    
    error_log('[ERP-ORDERS] 🗑️ Eliminación de pedido detectada: #' . $order_id);
    
    // Enviar notificación de eliminación al ERP
    send_order_to_erp($order_id, 'delete', 'woocommerce_before_delete_order');
}

/**
 * Hook para cuando se mueve un pedido a la papelera (trash)
 */
function handle_order_trash($post_id) {
    // Verificar que es un pedido de WooCommerce
    if (get_post_type($post_id) !== 'shop_order') {
        return;
    }
    
    $order = wc_get_order($post_id);
    if (!$order || is_wp_error($order)) {
        return;
    }
    
    error_log('[ERP-ORDERS] 🗑️ Pedido movido a papelera: #' . $post_id);
    
    // Enviar notificación de eliminación al ERP
    send_order_to_erp($post_id, 'delete', 'wp_trash_post');
}

/**
 * Hook para cuando se guarda un pedido (después de guardar)
 * Usamos este hook para detectar actualizaciones generales
 */
function handle_order_saved($order) {
    // Verificar que es un objeto WC_Order válido
    if (!$order || !is_a($order, 'WC_Order')) {
        return;
    }
    
    $order_id = $order->get_id();
    if (!$order_id) {
        return;
    }
    
    // Evitar bucles infinitos: usar transient para evitar procesar múltiples veces en corto tiempo
    $transient_key = 'erp_order_update_processing_' . $order_id;
    if (get_transient($transient_key)) {
        return; // Ya se está procesando o se procesó recientemente
    }
    
    // Marcar como procesando por 10 segundos
    set_transient($transient_key, true, 10);
    
    // Procesar la actualización
    handle_order_update($order_id);
}

// ============================================
// REGISTRAR HOOKS - Evitar duplicados
// ============================================

// Solo registrar hooks si WooCommerce está activo
if (class_exists('WooCommerce') || function_exists('wc_get_order')) {
    
    // Hook para pedidos nuevos (cuando el cliente completa la compra)
    if (!has_action('woocommerce_thankyou', 'handle_new_order')) {
        add_action('woocommerce_thankyou', 'handle_new_order', 10, 1);
    }

// Hook para cuando se guarda un pedido (después de guardar)
// Esto incluye: cambios de estado, productos, direcciones, totales, etc.
if (!has_action('woocommerce_after_order_object_save', 'handle_order_saved')) {
    add_action('woocommerce_after_order_object_save', 'handle_order_saved', 10, 1);
}

// También usar woocommerce_order_status_changed para detectar específicamente cambios de estado
// Este hook recibe 3 parámetros: order_id, old_status, new_status
if (!has_action('woocommerce_order_status_changed', 'handle_order_update')) {
    add_action('woocommerce_order_status_changed', 'handle_order_update', 10, 3);
}


// Hook para eliminaciones permanentes
if (!has_action('woocommerce_before_delete_order', 'handle_order_delete')) {
    add_action('woocommerce_before_delete_order', 'handle_order_delete', 10, 1);
}

    // Hook para cuando se mueve a papelera (trash)
    if (!has_action('wp_trash_post', 'handle_order_trash')) {
        add_action('wp_trash_post', 'handle_order_trash', 10, 1);
    }
    
} else {
    // Si WooCommerce no está activo, loggear un warning
    if (!get_transient('erp_orders_wc_not_active_log')) {
        set_transient('erp_orders_wc_not_active_log', true, 3600); // 1 hora
        error_log('[ERP-ORDERS] ⚠️ WARNING: WooCommerce no está activo. Los hooks no se registrarán.');
    }
}

// ============================================
// LOG DE CARGA - Solo una vez para evitar spam
// ============================================
if (!get_transient('erp_orders_snippet_loaded_log')) {
    set_transient('erp_orders_snippet_loaded_log', true, 60);
    
    error_log('[ERP-ORDERS] ==========================================');
    error_log('[ERP-ORDERS] SNIPPET DE PEDIDOS CARGADO - VERSIÓN 2.0');
    error_log('[ERP-ORDERS] URL configurada: ' . (defined('ERP_ORDERS_API_URL') ? ERP_ORDERS_API_URL : 'NO DEFINIDA'));
    error_log('[ERP-ORDERS] Secret configurado: ' . (defined('ERP_WEBHOOK_SECRET') ? 'CONFIGURADO' : 'NO DEFINIDO'));
    error_log('[ERP-ORDERS] Hooks registrados:');
    error_log('[ERP-ORDERS]   - woocommerce_thankyou (pedidos nuevos)');
    error_log('[ERP-ORDERS]   - woocommerce_after_order_object_save (actualizaciones)');
    error_log('[ERP-ORDERS]   - woocommerce_order_status_changed (cambios de estado)');
    error_log('[ERP-ORDERS]   - woocommerce_before_delete_order (eliminaciones)');
    error_log('[ERP-ORDERS]   - wp_trash_post (papelera)');
    error_log('[ERP-ORDERS] ⚠️ IMPORTANTE: Detecta creaciones, ediciones, cambios de estado y eliminaciones');
    error_log('[ERP-ORDERS] Protección anti-duplicados: ACTIVADA (solo para pedidos nuevos)');
    error_log('[ERP-ORDERS] ==========================================');
}
