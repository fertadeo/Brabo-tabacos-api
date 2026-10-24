<?php
/**
 * Sincronización Completa de Categorías de Productos con ERP
 * 
 * Este snippet envía TODAS las categorías al ERP cuando se crea o edita una categoría.
 * 
 * INSTRUCCIONES DE INSTALACIÓN:
 * 1. Copia este código completo
 * 2. Ve a WordPress → Plugins → Code Snippets → Add New
 * 3. Pega el código
 * 4. Configura la URL y el Secret (líneas 15-16)
 * 5. Activa el snippet
 * 
 * IMPORTANTE: Cambia la URL y el Secret según tu configuración
 */

// ============================================
// CONFIGURACIÓN - CAMBIA ESTOS VALORES
// ============================================
define('ERP_API_URL', 'https://api.sistema.mfcomputers.com.ar/api/woocommerce/categories/sync');
define('ERP_WEBHOOK_SECRET', 'mf-wooc-secret'); // Debe coincidir con WEBHOOK_SECRET en tu API
// ============================================

/**
 * Función principal para sincronizar todas las categorías
 */
function sync_all_product_categories_to_erp($term_id, $tt_id = '', $taxonomy = '') {
    // Normalizar $taxonomy - puede venir como array, string o vacío
    $taxonomy_str = '';
    if (is_array($taxonomy)) {
        // Si es array, tomar el primer elemento o usar 'product_cat' por defecto
        $taxonomy_str = !empty($taxonomy) ? (string)reset($taxonomy) : 'product_cat';
    } elseif (is_string($taxonomy)) {
        $taxonomy_str = $taxonomy;
    } else {
        // Si está vacío o es otro tipo, usar 'product_cat' por defecto
        $taxonomy_str = 'product_cat';
    }
    
    // Solo procesar categorías de productos
    // Si la taxonomía no es 'product_cat' y no está vacía, ignorar
    if ($taxonomy_str !== 'product_cat' && $taxonomy_str !== '') {
        error_log('[ERP-SYNC] Ignorando taxonomía: ' . $taxonomy_str);
        return;
    }
    
    $action = current_filter(); // 'created_product_cat', 'edited_product_cat', o 'delete_product_cat'
    
    error_log('[ERP-SYNC] ========== INICIANDO SINCRONIZACIÓN ==========');
    error_log('[ERP-SYNC] Acción: ' . $action);
    error_log('[ERP-SYNC] Categoría ID: ' . $term_id);
    error_log('[ERP-SYNC] Taxonomía: ' . $taxonomy_str);
    
    // Si es borrado, capturar información antes de que se elimine
    $deleted_category_info = null;
    if ($action === 'delete_product_cat') {
        $deleted_term = get_term($term_id, 'product_cat');
        if ($deleted_term && !is_wp_error($deleted_term)) {
            $deleted_category_info = array(
                'id' => (int)$deleted_term->term_id,
                'name' => $deleted_term->name,
                'slug' => $deleted_term->slug,
                'parent' => $deleted_term->parent ? (int)$deleted_term->parent : 0,
                'deleted' => true
            );
            error_log('[ERP-SYNC] 🗑️ Categoría eliminada en WooCommerce: ID ' . $term_id . ' - "' . $deleted_term->name . '"');
        }
    }
    
    // Obtener TODAS las categorías de productos (después del borrado, la eliminada ya no estará)
    error_log('[ERP-SYNC] Obteniendo todas las categorías actuales...');
    $all_categories = get_terms(array(
        'taxonomy' => 'product_cat',
        'hide_empty' => false, // Incluir incluso si no tienen productos
        'orderby' => 'term_id',
        'order' => 'ASC'
    ));
    
    if (is_wp_error($all_categories)) {
        error_log('[ERP-SYNC] ERROR: No se pudieron obtener las categorías: ' . $all_categories->get_error_message());
        return;
    }
    
    if (empty($all_categories) && !$deleted_category_info) {
        error_log('[ERP-SYNC] ADVERTENCIA: No hay categorías para sincronizar');
        return;
    }
    
    error_log('[ERP-SYNC] Total de categorías actuales en WooCommerce: ' . count($all_categories));
    
    // Si se borró una categoría, agregar nota en el log
    if ($deleted_category_info) {
        error_log('[ERP-SYNC] Nota: Categoría eliminada detectada. La sincronización actualizará el estado en el ERP.');
    }
    
    // Formatear todas las categorías
    $categories_payload = array();
    foreach ($all_categories as $category) {
        $categories_payload[] = array(
            'id' => (int) $category->term_id,
            'name' => $category->name,
            'slug' => $category->slug,
            'parent' => $category->parent ? (int) $category->parent : 0
        );
    }
    
    error_log('[ERP-SYNC] Categorías formateadas: ' . json_encode($categories_payload));
    
    // Preparar payload completo
    $payload = array(
        'categories' => $categories_payload
    );
    
    $json_payload = json_encode($payload);
    error_log('[ERP-SYNC] Payload JSON: ' . substr($json_payload, 0, 500) . '...');
    
    // Configurar URL y Secret
    $api_url = ERP_API_URL;
    $secret = ERP_WEBHOOK_SECRET;
    
    error_log('[ERP-SYNC] URL de destino: ' . $api_url);
    error_log('[ERP-SYNC] Secret configurado: ' . (empty($secret) ? 'NO CONFIGURADO' : '***configurado***'));
    
    // Preparar headers
    $headers = array(
        'Content-Type' => 'application/json',
        'X-Webhook-Secret' => $secret
    );
    
    error_log('[ERP-SYNC] Enviando request a la API...');
    
    // Enviar todas las categorías al ERP
    $response = wp_remote_post($api_url, array(
        'method'    => 'POST',
        'timeout'   => 30, // 30 segundos de timeout
        'blocking'  => true, // Bloquear para ver errores inmediatamente (cambiar a false en producción)
        'headers'   => $headers,
        'body'      => $json_payload
    ));
    
    // Procesar respuesta
    if (is_wp_error($response)) {
        $error_message = $response->get_error_message();
        $error_code = $response->get_error_code();
        error_log('[ERP-SYNC] ❌ ERROR al enviar webhook:');
        error_log('[ERP-SYNC] Código de error: ' . $error_code);
        error_log('[ERP-SYNC] Mensaje: ' . $error_message);
        return;
    }
    
    $response_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    
    error_log('[ERP-SYNC] Código de respuesta HTTP: ' . $response_code);
    error_log('[ERP-SYNC] Cuerpo de respuesta: ' . $response_body);
    
    if ($response_code === 200) {
        error_log('[ERP-SYNC] ✅ Sincronización exitosa!');
        $response_data = json_decode($response_body, true);
        if ($response_data && isset($response_data['data'])) {
            $result_msg = $response_data['data']['created'] . ' creadas, ' . $response_data['data']['updated'] . ' actualizadas';
            if (isset($response_data['data']['deactivated']) && $response_data['data']['deactivated'] > 0) {
                $result_msg .= ', ' . $response_data['data']['deactivated'] . ' desactivadas';
            }
            error_log('[ERP-SYNC] Resultado: ' . $result_msg);
        }
    } else {
        error_log('[ERP-SYNC] ⚠️ Respuesta no exitosa. Código: ' . $response_code);
        error_log('[ERP-SYNC] Respuesta completa: ' . $response_body);
    }
    
    error_log('[ERP-SYNC] ========== SINCRONIZACIÓN FINALIZADA ==========');
}

/**
 * Función para verificar que los hooks estén funcionando
 */
function test_category_hooks($term_id, $tt_id = '', $taxonomy = '') {
    // Normalizar $taxonomy
    $taxonomy_str = '';
    if (is_array($taxonomy)) {
        $taxonomy_str = !empty($taxonomy) ? (string)reset($taxonomy) : 'product_cat';
    } elseif (is_string($taxonomy)) {
        $taxonomy_str = $taxonomy;
    } else {
        $taxonomy_str = 'product_cat';
    }
    
    if ($taxonomy_str !== 'product_cat' && $taxonomy_str !== '') {
        return;
    }
    error_log('[HOOK-TEST] ✅ HOOK DISPARADO: ' . current_filter());
    error_log('[HOOK-TEST] Term ID: ' . $term_id);
    error_log('[HOOK-TEST] Taxonomy: ' . $taxonomy_str);
}

// Registrar hooks
// IMPORTANTE: Descomenta la línea de test si quieres verificar que los hooks funcionan
// add_action('created_product_cat', 'test_category_hooks', 5, 3);
// add_action('edited_product_cat', 'test_category_hooks', 5, 3);

// Hooks principales para sincronización
add_action('created_product_cat', 'sync_all_product_categories_to_erp', 10, 3);
add_action('edited_product_cat', 'sync_all_product_categories_to_erp', 10, 3);
add_action('delete_product_cat', 'sync_all_product_categories_to_erp', 10, 3);

error_log('[ERP-SYNC] Snippet cargado correctamente. Hooks registrados.');
