# Vincular woocommerce_id de productos – Guía de implementación para el frontend

Guía para integrar el botón "Vincular productos con WooCommerce" en el módulo de productos del ERP.

---

## 1. API Endpoint

| Método | URL | Auth | Rol |
|--------|-----|------|-----|
| POST | `/api/products/link-woocommerce-ids` | JWT Bearer | gerencia |

**Body:** ninguno (no requiere body).

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "message": "Vinculación completada: 150 vinculados, 50 ya vinculados, 30 no encontrados en ERP",
  "data": {
    "linked": 150,
    "already_linked": 50,
    "not_found_in_erp": 30,
    "total_processed": 230,
    "errors": []
  },
  "timestamp": "2025-02-03T..."
}
```

**Respuesta error (5xx):**
```json
{
  "success": false,
  "message": "Error vinculando productos con WooCommerce",
  "error": "...",
  "timestamp": "..."
}
```

---

## 2. Ubicación recomendada en la UI

1. **Vista de listado de productos** – Barra de acciones superior, junto a "Nuevo producto".
2. **Sección de integración WooCommerce** – Si existe una sección de configuración/sincronización.
3. **Ambos** – Botón en el listado y también en la sección de integración.

---

## 3. Implementación recomendada (React / Next.js)

### 3.1 Función de llamada a la API

```ts
// services/products.ts o lib/api/products.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8086';

export interface LinkWoocommerceIdsResult {
  linked: number;
  already_linked: number;
  not_found_in_erp: number;
  total_processed: number;
  errors: string[];
}

export async function linkWoocommerceIds(
  token: string
): Promise<LinkWoocommerceIdsResult> {
  const res = await fetch(`${API_BASE}/api/products/link-woocommerce-ids`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.message || data.error || 'Error vinculando productos');
  }

  if (!data.success || !data.data) {
    throw new Error(data.message || 'Error inesperado');
  }

  return data.data;
}
```

### 3.2 Hook personalizado (React)

```tsx
// hooks/useLinkWoocommerceIds.ts

import { useState } from 'react';
import { linkWoocommerceIds, LinkWoocommerceIdsResult } from '@/services/products';

export function useLinkWoocommerceIds(getToken: () => string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LinkWoocommerceIdsResult | null>(null);

  const execute = async () => {
    const token = getToken?.();
    if (!token) {
      setError('Sesión no válida');
      return null;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await linkWoocommerceIds(token);
      setResult(data);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error vinculando productos';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { execute, loading, error, result };
}
```

### 3.3 Componente botón con confirmación y resultados

```tsx
// components/products/LinkWoocommerceIdsButton.tsx

'use client';

import { useState } from 'react';
import { useLinkWoocommerceIds } from '@/hooks/useLinkWoocommerceIds';
import { useAuth } from '@/contexts/AuthContext'; // Ajustar según tu contexto

export function LinkWoocommerceIdsButton() {
  const { token } = useAuth(); // O tu forma de obtener el JWT
  const { execute, loading, error, result } = useLinkWoocommerceIds(() => token);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClick = () => {
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    await execute();
    setShowConfirm(false);
    // Opcional: invalidar/refetch la lista de productos
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Vinculando...' : 'Vincular con WooCommerce'}
      </button>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md">
            <h3 className="text-lg font-semibold mb-2">Vincular productos con WooCommerce</h3>
            <p className="text-gray-600 mb-4">
              Esto vinculará los productos del ERP con WooCommerce según su SKU.
              Puede tardar varios segundos si hay muchos productos.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={handleCancel} className="px-4 py-2 border rounded">
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Procesando...' : 'Ejecutar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded">
          {error}
        </div>
      )}

      {result && (
        <div className="p-3 bg-green-50 text-green-800 rounded">
          <p className="font-medium">Vinculación completada</p>
          <ul className="text-sm mt-1">
            <li>{result.linked} vinculados</li>
            <li>{result.already_linked} ya vinculados</li>
            <li>{result.not_found_in_erp} no encontrados en ERP</li>
          </ul>
          {result.errors.length > 0 && (
            <p className="text-amber-700 mt-2">Algunos errores: {result.errors.length}</p>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 4. Consideraciones UX

| Aspecto | Recomendación |
|---------|---------------|
| Duración | Puede tardar 5–30 segundos según cantidad de productos. Mostrar loading y evitar múltiples clics. |
| Confirmación | Usar modal de confirmación antes de ejecutar. |
| Feedback | Mostrar resumen (linked, already_linked, not_found_in_erp) al finalizar. |
| Permisos | Solo rol `gerencia`. Ocultar el botón si el usuario no tiene permisos. |
| Actualización de datos | Tras ejecutar, recargar la lista de productos o invalidar cache si usás SWR/React Query. |

---

## 5. Integración con SWR / React Query (opcional)

```tsx
// Con React Query

import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useLinkWoocommerceIdsMutation() {
  const queryClient = useQueryClient();
  const { token } = useAuth();

  return useMutation({
    mutationFn: () => linkWoocommerceIds(token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Uso en componente
const mutation = useLinkWoocommerceIdsMutation();

<button
  onClick={() => mutation.mutate()}
  disabled={mutation.isPending}
>
  {mutation.isPending ? 'Vinculando...' : 'Vincular con WooCommerce'}
</button>
```

---

## 6. Textos sugeridos para la UI

- **Botón:** "Vincular con WooCommerce"
- **Tooltip:** "Obtiene el woocommerce_id de los productos que existen en WooCommerce (por SKU)"
- **Título del modal:** "Vincular productos con WooCommerce"
- **Mensaje de confirmación:** "Esto vinculará los productos del ERP con WooCommerce según su SKU. Puede tardar varios segundos."
- **Éxito:** "Vinculación completada: X vinculados, Y ya vinculados, Z no encontrados"
- **Error:** "Error vinculando productos con WooCommerce. Verifica la configuración."

---

## 7. Checklist de implementación

- [ ] Función de API con JWT
- [ ] Hook o mutation para manejar loading/error/resultado
- [ ] Modal de confirmación
- [ ] Mensajes de éxito y error
- [ ] Control de permisos (rol gerencia)
- [ ] Deshabilitar botón durante la ejecución
- [ ] Refetch o invalidación de la lista de productos al finalizar
