<?php
/**
 * VERSIÓN SIMPLIFICADA PARA PRUEBAS
 * 
 * Usa esta versión si la versión completa no funciona.
 * Tiene logging detallado en cada paso.
 */

// ============================================
// CONFIGURACIÓN - CAMBIA ESTOS VALORES
// ============================================
define('ERP_API_URL', 'https://api.sistema.mfcomputers.com.ar/api/woocommerce/categories/sync');
define('ERP_WEBHOOK_SECRET', 'mf-wooc-secret'); // Debe coincidir con WEBHOOK_SECRET en tu API
// ============================================

/**
 * Función principal para sincronizar todas las categorías
 * Se ejecuta cuando se crea, edita o borra una categoría
 */
function sync_categories_simple($term_id, $tt_id = '', $taxonomy = '') {
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
    
    $action = current_filter(); // 'created_product_cat', 'edited_product_cat', o 'delete_product_cat'
    
    error_log('=== INICIO SINCRONIZACIÓN ===');
    error_log('Acción: ' . $action);
    error_log('Categoría ID: ' . $term_id);
    error_log('Taxonomía: ' . $taxonomy_str);
    
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
            error_log('Categoría eliminada en WooCommerce: ID ' . $term_id . ' - ' . $deleted_term->name);
        }
    }
    
    // Obtener todas las categorías actuales (después del borrado, la eliminada ya no estará)
    $cats = get_terms(array(
        'taxonomy' => 'product_cat',
        'hide_empty' => false
    ));
    
    if (is_wp_error($cats)) {
        error_log('ERROR obteniendo categorías: ' . $cats->get_error_message());
        return;
    }
    
    error_log('Total categorías actuales en WooCommerce: ' . count($cats));
    
    // Formatear todas las categorías existentes
    $payload = array('categories' => array());
    foreach ($cats as $cat) {
        $payload['categories'][] = array(
            'id' => (int)$cat->term_id,
            'name' => $cat->name,
            'slug' => $cat->slug,
            'parent' => $cat->parent ? (int)$cat->parent : 0
        );
    }
    
    // Si se borró una categoría, agregar información sobre la eliminada
    if ($deleted_category_info) {
        error_log('Nota: Categoría eliminada detectada. La sincronización actualizará el estado en el ERP.');
    }
    
    error_log('Payload preparado: ' . count($payload['categories']) . ' categorías');
    
    // Obtener URL y Secret de constantes
    $api_url = defined('ERP_API_URL') ? ERP_API_URL : 'https://api.sistema.mfcomputers.com.ar/api/woocommerce/categories/sync';
    $secret = defined('ERP_WEBHOOK_SECRET') ? ERP_WEBHOOK_SECRET : 'mf-wooc-secret';
    
    error_log('URL: ' . $api_url);
    error_log('Secret configurado: ' . (empty($secret) ? 'NO CONFIGURADO' : '***configurado***'));
    error_log('Enviando request...');
    
    $response = wp_remote_post($api_url, array(
        'method' => 'POST',
        'timeout' => 30,
        'blocking' => true, // true para ver errores
        'headers' => array(
            'Content-Type' => 'application/json',
            'X-Webhook-Secret' => $secret
        ),
        'body' => json_encode($payload)
    ));
    
    if (is_wp_error($response)) {
        error_log('ERROR: ' . $response->get_error_message());
        error_log('Código de error: ' . $response->get_error_code());
        return;
    }
    
    $code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);
    
    error_log('Código respuesta: ' . $code);
    error_log('Cuerpo respuesta: ' . substr($body, 0, 500));
    
    if ($code === 200) {
        $response_data = json_decode($body, true);
        if ($response_data && isset($response_data['data'])) {
            error_log('Resultado: ' . $response_data['data']['created'] . ' creadas, ' . 
                     $response_data['data']['updated'] . ' actualizadas, ' . 
                     (isset($response_data['data']['deactivated']) ? $response_data['data']['deactivated'] : 0) . ' desactivadas');
        }
    }
    
    error_log('=== FIN SINCRONIZACIÓN ===');
}

// Registrar hooks para crear, editar y borrar
add_action('created_product_cat', 'sync_categories_simple', 10, 3);
add_action('edited_product_cat', 'sync_categories_simple', 10, 3);
add_action('delete_product_cat', 'sync_categories_simple', 10, 3);

error_log('Snippet simple cargado. URL configurada: ' . (defined('ERP_API_URL') ? ERP_API_URL : 'NO DEFINIDA'));
error_log('Hooks registrados: created_product_cat, edited_product_cat, delete_product_cat');