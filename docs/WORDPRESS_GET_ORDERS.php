<?php
/**
 * Sincronización de Pedidos de WooCommerce con ERP
 * VERSIÓN FINAL - Con protección anti-duplicados
 * 
 * Este snippet envía automáticamente los pedidos al ERP cuando se completa una compra.
 * Funciona con TODOS los métodos de pago, incluyendo transferencias bancarias.
 * 
 * INSTRUCCIONES DE INSTALACIÓN:
 * 1. Copia este código completo
 * 2. Ve a WordPress → Plugins → Code Snippets → Add New
 * 3. Pega el código
 * 4. Configura la URL y el Secret (líneas 18-21)
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
 * Función de test - Verificar que el hook se dispara
 * Solo loggea si no se ha loggeado recientemente (evitar spam en logs)
 */
function test_order_hook_erp($order_id) {
    // Solo loggear si no se ha loggeado recientemente
    $log_key = 'erp_orders_test_logged_' . $order_id;
    if (get_transient($log_key)) {
        return; // Ya se loggeó recientemente
    }
    
    set_transient($log_key, true, 60); // No volver a loggear por 60 segundos
    
    error_log('[ERP-ORDERS-TEST] ========== HOOK DISPARADO ==========');
    error_log('[ERP-ORDERS-TEST] Hook: ' . current_filter());
    error_log('[ERP-ORDERS-TEST] Order ID: ' . $order_id);
    error_log('[ERP-ORDERS-TEST] Timestamp: ' . current_time('mysql'));
    error_log('[ERP-ORDERS-TEST] ====================================');
}

/**
 * Función principal para enviar pedido al ERP
 * Se ejecuta cuando el cliente llega a la página de agradecimiento (thankyou)
 * Esto captura TODOS los pedidos, incluyendo transferencias bancarias
 */
function send_order_to_erp($order_id) {
    // ⭐ PROTECCIÓN: Verificar si este pedido ya fue procesado recientemente
    $processed_key = 'erp_order_processed_' . $order_id;
    
    if (get_transient($processed_key)) {
        error_log('[ERP-ORDERS] ⚠️ Pedido #' . $order_id . ' ya fue procesado recientemente. Omitiendo...');
        return; // Ya se procesó, no hacer nada
    }
    
    error_log('[ERP-ORDERS] 🔔 ========== FUNCIÓN EJECUTADA ==========');
    error_log('[ERP-ORDERS] Timestamp: ' . current_time('mysql'));
    error_log('[ERP-ORDERS] Order ID: ' . $order_id);
    error_log('[ERP-ORDERS] Hook: ' . current_filter());
    
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
    
    // Preparar payload del pedido en formato similar al REST API de WooCommerce
    // Este JSON completo se guardará en el campo 'json' de la base de datos
    $order_payload = array(
        'id' => $order->get_id(),
        'number' => $order->get_order_number(),
        'status' => $order->get_status(),
        'date_created' => $order->get_date_created()->date('c'),
        'date_created_gmt' => $order->get_date_created()->date('c'), // Para compatibilidad
        'date_modified' => $order->get_date_modified()->date('c'),
        'date_modified_gmt' => $order->get_date_modified()->date('c'), // Para compatibilidad
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
        'meta_data' => array()
    );
    
    // Agregar items del pedido
    $items = $order->get_items();
    error_log('[ERP-ORDERS] Items en el pedido: ' . count($items));
    
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
        
        error_log('[ERP-ORDERS] Item agregado: ' . $item->get_name() . ' (SKU: ' . ($sku ?: 'SIN SKU') . ') x' . $quantity);
    }
    
    // Agregar métodos de envío
    foreach ($order->get_items('shipping') as $item_id => $shipping_item) {
        $order_payload['shipping_lines'][] = array(
            'id' => $item_id,
            'method_title' => $shipping_item->get_method_title(),
            'method_id' => $shipping_item->get_method_id(),
            'total' => (string)$shipping_item->get_total(),
            'total_tax' => (string)$shipping_item->get_total_tax()
        );
    }
    
    // Agregar metadata del pedido
    foreach ($order->get_meta_data() as $meta) {
        $order_payload['meta_data'][] = array(
            'id' => $meta->id,
            'key' => $meta->key,
            'value' => $meta->value
        );
    }
    
    error_log('[ERP-ORDERS] Payload preparado con ' . count($order_payload['line_items']) . ' items');
    
    // Configurar URL y Secret
    $api_url = defined('ERP_ORDERS_API_URL') ? ERP_ORDERS_API_URL : 'https://api.sistema.mfcomputers.com.ar/api/integration/webhook/woocommerce/order';
    $secret = defined('ERP_WEBHOOK_SECRET') ? ERP_WEBHOOK_SECRET : 'mf-wooc-secret';
    
    error_log('[ERP-ORDERS] URL de destino: ' . $api_url);
    error_log('[ERP-ORDERS] Secret configurado: ' . (empty($secret) ? 'NO CONFIGURADO' : '***configurado***'));
    
    // Preparar headers con autenticación
    $headers = array(
        'Content-Type' => 'application/json',
        'X-Webhook-Secret' => $secret
    );
    
    // Convertir a JSON
    $json_payload = json_encode($order_payload);
    error_log('[ERP-ORDERS] Payload JSON tamaño: ' . strlen($json_payload) . ' bytes');
    
    // Enviar pedido al ERP
    error_log('[ERP-ORDERS] Enviando request a la API...');
    
    $response = wp_remote_post($api_url, array(
        'method'    => 'POST',
        'timeout'   => 30, // 30 segundos de timeout
        'blocking'  => true, // Bloquear para ver errores inmediatamente
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
        error_log('[ERP-ORDERS] ✅✅✅ PEDIDO ENVIADO EXITOSAMENTE AL ERP ✅✅✅');
        
        // ⭐ MARCAR COMO PROCESADO - Evitar duplicados por 1 hora
        set_transient($processed_key, true, 3600); // 1 hora = 3600 segundos
        
        // También guardar en meta del pedido como respaldo
        $order->update_meta_data('_erp_sent_at', current_time('mysql'));
        $order->update_meta_data('_erp_sent', true);
        $order->save();
        
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

// ============================================
// REGISTRAR HOOKS - Evitar duplicados
// ============================================

// Verificar que los hooks no se registren múltiples veces
if (!has_action('woocommerce_thankyou', 'test_order_hook_erp')) {
    add_action('woocommerce_thankyou', 'test_order_hook_erp', 5, 1);
}

// Hook principal - woocommerce_thankyou se dispara cuando el cliente llega a la página de agradecimiento
// Esto captura TODOS los pedidos, incluyendo transferencias bancarias
if (!has_action('woocommerce_thankyou', 'send_order_to_erp')) {
    add_action('woocommerce_thankyou', 'send_order_to_erp', 10, 1);
}

// Opcional: También usar woocommerce_new_order para capturar inmediatamente
// Descomenta solo si quieres recibir pedidos ANTES de que el cliente vea la página de agradecimiento
// NOTA: Esto puede causar duplicados si también usas woocommerce_thankyou
// if (!has_action('woocommerce_new_order', 'send_order_to_erp')) {
//     add_action('woocommerce_new_order', 'send_order_to_erp', 10, 1);
// }

// ============================================
// LOG DE CARGA - Solo una vez para evitar spam
// ============================================
if (!get_transient('erp_orders_snippet_loaded_log')) {
    set_transient('erp_orders_snippet_loaded_log', true, 60); // Log solo una vez por minuto
    
    error_log('[ERP-ORDERS] ==========================================');
    error_log('[ERP-ORDERS] SNIPPET DE PEDIDOS CARGADO');
    error_log('[ERP-ORDERS] URL configurada: ' . (defined('ERP_ORDERS_API_URL') ? ERP_ORDERS_API_URL : 'NO DEFINIDA'));
    error_log('[ERP-ORDERS] Secret configurado: ' . (defined('ERP_WEBHOOK_SECRET') ? 'CONFIGURADO' : 'NO DEFINIDO'));
    error_log('[ERP-ORDERS] Hook principal: woocommerce_thankyou');
    error_log('[ERP-ORDERS] ⚠️ IMPORTANTE: Captura TODOS los pedidos, incluso transferencias bancarias');
    error_log('[ERP-ORDERS] Protección anti-duplicados: ACTIVADA');
    error_log('[ERP-ORDERS] ==========================================');
}
