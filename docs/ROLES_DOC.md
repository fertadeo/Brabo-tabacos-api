# Sistema de Roles y Permisos - Documentación para Frontend

## 📋 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Conceptos Fundamentales](#conceptos-fundamentales)
3. [Roles Disponibles](#roles-disponibles)
4. [Permisos por Módulo](#permisos-por-módulo)
5. [Endpoints de la API](#endpoints-de-la-api)
6. [Permisos Excepcionales a Usuarios](#permisos-excepcionales-a-usuarios) ⭐
7. [Ejemplos de Uso](#ejemplos-de-uso)
8. [Cómo Implementar en el Frontend](#cómo-implementar-en-el-frontend)

---

## Introducción

El sistema de roles y permisos del ERP Norte Abanicos permite gestionar de forma granular qué acciones puede realizar cada usuario o rol en el sistema. Este sistema proporciona:

- **Roles predefinidos**: Para agrupar usuarios con funciones similares
- **Permisos granulares**: Para controlar acciones específicas (crear, ver, actualizar, eliminar)
- **Asignación flexible**: Permisos pueden asignarse tanto a roles como a usuarios individuales
- **Permisos temporales**: Los permisos directos a usuarios pueden tener fecha de expiración

---

## Conceptos Fundamentales

### Roles
Los roles son grupos predefinidos que tienen un conjunto de permisos asociados. Los usuarios tienen un rol principal, pero también pueden tener permisos adicionales asignados directamente.

### Permisos
Los permisos son acciones específicas que pueden realizarse en el sistema. Cada permiso tiene:
- **Código único**: Identificador del permiso (ej: `products.create`)
- **Módulo**: Módulo al que pertenece (ej: `products`, `orders`)
- **Descripción**: Descripción legible del permiso

### Jerarquía de Permisos
Los usuarios obtienen permisos de dos fuentes:
1. **Permisos del rol**: Heredados del rol asignado al usuario
2. **Permisos directos**: Asignados específicamente al usuario (pueden tener expiración)

Si un usuario tiene un permiso de cualquiera de estas fuentes, puede realizar la acción.

---

## Roles Disponibles

### 1. **admin**
- **Descripción**: Administrador del sistema
- **Permisos**: Tiene TODOS los permisos del sistema automáticamente
- **Uso**: Acceso completo para configuración y gestión del sistema

### 2. **gerencia**
- **Descripción**: Personal gerencial
- **Permisos**: Visualización y gestión general de todos los módulos, excepto gestión completa de usuarios
- **Uso**: Gestión operativa del ERP

### 3. **ventas**
- **Descripción**: Personal del área de ventas
- **Permisos**: 
  - Ver productos y estadísticas
  - Crear y gestionar pedidos
  - Ver y crear clientes
  - Ver dashboard
  - Ver y crear pagos
- **Uso**: Gestión de ventas y atención al cliente

### 4. **logistica**
- **Descripción**: Personal del área de logística
- **Permisos**:
  - Ver productos y gestionar stock
  - Ver pedidos y actualizar estados de remito
  - Ver compras
  - Gestionar remitos (crear, actualizar, despachar, entregar)
  - Ver y gestionar trazabilidad
- **Uso**: Gestión de inventario y logística de pedidos

### 5. **finanzas**
- **Descripción**: Personal del área financiera
- **Permisos**:
  - Ver productos y estadísticas
  - Ver pedidos y estadísticas
  - Gestionar compras (crear, actualizar, gestionar proveedores)
  - Ver clientes
  - Gestionar caja (ver, gastos, exportar)
  - Gestionar pagos (crear, actualizar, eliminar)
  - Ver dashboard y estadísticas
- **Uso**: Gestión financiera y contable

### 6. **manager**
- **Descripción**: Gerentes de área
- **Permisos**: Similar a gerencia pero sin gestión de usuarios (solo visualización)
- **Uso**: Gestión operativa con restricciones de usuarios

### 7. **employee**
- **Descripción**: Empleados generales
- **Permisos básicos**:
  - Ver productos
  - Ver y crear pedidos
  - Ver clientes
  - Ver dashboard
- **Uso**: Operaciones básicas del día a día

### 8. **viewer**
- **Descripción**: Usuarios de solo lectura
- **Permisos**: Solo visualización (todos los permisos que terminan en `.view`, `.view_stats`, `.view_activities`)
- **Uso**: Consultas y reportes sin capacidad de modificación

---

## Permisos por Módulo

### Módulo: Products (Productos)

| Código | Nombre | Descripción |
|--------|--------|-------------|
| `products.view` | Ver productos | Permite ver el listado y detalles de productos |
| `products.create` | Crear productos | Permite crear nuevos productos |
| `products.update` | Actualizar productos | Permite modificar productos existentes |
| `products.delete` | Eliminar productos | Permite eliminar productos (soft delete) |
| `products.delete_permanent` | Eliminación permanente | Permite eliminar productos permanentemente |
| `products.manage_stock` | Gestionar stock | Permite actualizar el stock de productos |
| `products.view_stats` | Ver estadísticas | Permite ver estadísticas del módulo de productos |

### Módulo: Orders (Pedidos)

| Código | Nombre | Descripción |
|--------|--------|-------------|
| `orders.view` | Ver pedidos | Permite ver el listado y detalles de pedidos |
| `orders.create` | Crear pedidos | Permite crear nuevos pedidos |
| `orders.update` | Actualizar pedidos | Permite modificar pedidos existentes |
| `orders.delete` | Eliminar pedidos | Permite eliminar pedidos |
| `orders.view_stats` | Ver estadísticas | Permite ver estadísticas del módulo de pedidos |
| `orders.reserve_stock` | Reservar stock | Permite reservar stock para pedidos |
| `orders.update_remito_status` | Actualizar estado de remito | Permite actualizar el estado de remito de pedidos |

### Módulo: Purchases (Compras)

| Código | Nombre | Descripción |
|--------|--------|-------------|
| `purchases.view` | Ver compras | Permite ver el listado y detalles de compras |
| `purchases.create` | Crear compras | Permite crear nuevas compras |
| `purchases.update` | Actualizar compras | Permite modificar compras existentes |
| `purchases.delete` | Eliminar compras | Permite eliminar compras |
| `purchases.view_stats` | Ver estadísticas | Permite ver estadísticas del módulo de compras |
| `purchases.manage_items` | Gestionar items | Permite gestionar items de compras |
| `purchases.manage_suppliers` | Gestionar proveedores | Permite gestionar proveedores |

### Módulo: Clients (Clientes)

| Código | Nombre | Descripción |
|--------|--------|-------------|
| `clients.view` | Ver clientes | Permite ver el listado y detalles de clientes |
| `clients.create` | Crear clientes | Permite crear nuevos clientes |
| `clients.update` | Actualizar clientes | Permite modificar clientes existentes |
| `clients.delete` | Eliminar clientes | Permite eliminar clientes |
| `clients.view_stats` | Ver estadísticas | Permite ver estadísticas del módulo de clientes |

### Módulo: Cash (Caja)

| Código | Nombre | Descripción |
|--------|--------|-------------|
| `cash.view` | Ver resumen de caja | Permite ver resúmenes de caja (día, período, mensual) |
| `cash.manage_expenses` | Gestionar gastos | Permite crear y gestionar gastos operativos |
| `cash.export` | Exportar movimientos | Permite exportar movimientos de caja |

### Módulo: Payments (Pagos)

| Código | Nombre | Descripción |
|--------|--------|-------------|
| `payments.view` | Ver pagos | Permite ver el listado y detalles de pagos |
| `payments.create` | Crear pagos | Permite crear nuevos pagos |
| `payments.update` | Actualizar pagos | Permite modificar pagos existentes |
| `payments.delete` | Eliminar pagos | Permite eliminar pagos |

### Módulo: Dashboard

| Código | Nombre | Descripción |
|--------|--------|-------------|
| `dashboard.view` | Ver dashboard | Permite acceder al dashboard principal |
| `dashboard.view_stats` | Ver estadísticas | Permite ver estadísticas en el dashboard |
| `dashboard.view_activities` | Ver actividades | Permite ver actividades recientes en el dashboard |

### Módulo: Logistics (Logística)

| Código | Nombre | Descripción |
|--------|--------|-------------|
| `logistics.view_remitos` | Ver remitos | Permite ver remitos de logística |
| `logistics.create_remitos` | Crear remitos | Permite crear nuevos remitos |
| `logistics.update_remitos` | Actualizar remitos | Permite modificar remitos |
| `logistics.delete_remitos` | Eliminar remitos | Permite eliminar remitos |
| `logistics.manage_remito_status` | Gestionar estados | Permite cambiar estados de remitos (preparar, despachar, entregar) |
| `logistics.view_trazabilidad` | Ver trazabilidad | Permite ver trazabilidad de remitos |
| `logistics.manage_trazabilidad` | Gestionar trazabilidad | Permite crear y actualizar trazabilidad |

### Módulo: Users (Usuarios y Roles)

| Código | Nombre | Descripción |
|--------|--------|-------------|
| `users.view` | Ver usuarios | Permite ver el listado de usuarios |
| `users.create` | Crear usuarios | Permite crear nuevos usuarios |
| `users.update` | Actualizar usuarios | Permite modificar usuarios existentes |
| `users.delete` | Eliminar usuarios | Permite eliminar usuarios |
| `users.manage_roles` | Gestionar roles | Permite gestionar roles del sistema |
| `users.manage_permissions` | Gestionar permisos | Permite gestionar permisos del sistema |
| `users.assign_permissions` | Asignar permisos | Permite asignar permisos a roles y usuarios |

---

## Endpoints de la API

### Base URL
Todas las rutas comienzan con `/api/roles` o `/api/users`

### Autenticación
**TODAS las rutas requieren autenticación JWT mediante el header:**
```
Authorization: Bearer <token>
```

⚠️ **IMPORTANTE**: Todos los endpoints de usuarios y roles requieren el Bearer token en el header. Sin el token, recibirás un error 401 (Unauthorized).

---

### 🔐 PERMISOS

#### GET `/api/roles/permissions`
Obtener todos los permisos del sistema.

**Permisos requeridos**: `admin`, `gerencia`

**Query Parameters**:
- `module` (opcional): Filtrar por módulo (ej: `products`, `orders`)
- `is_active` (opcional): Filtrar por estado activo (`true`/`false`)

**Ejemplo de respuesta**:
```json
{
  "success": true,
  "message": "Permisos obtenidos exitosamente",
  "data": [
    {
      "id": 1,
      "name": "Ver productos",
      "code": "products.view",
      "module": "products",
      "description": "Permite ver el listado y detalles de productos",
      "is_active": true,
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### GET `/api/roles/permissions/modules`
Obtener lista de módulos únicos.

**Permisos requeridos**: `admin`, `gerencia`

**Ejemplo de respuesta**:
```json
{
  "success": true,
  "message": "Módulos obtenidos exitosamente",
  "data": [
    "cash",
    "clients",
    "dashboard",
    "logistics",
    "orders",
    "payments",
    "products",
    "purchases",
    "users"
  ],
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### GET `/api/roles/permissions/:id`
Obtener un permiso por ID.

**Permisos requeridos**: `admin`, `gerencia`

**Ejemplo de respuesta**:
```json
{
  "success": true,
  "message": "Permiso obtenido exitosamente",
  "data": {
    "id": 1,
    "name": "Ver productos",
    "code": "products.view",
    "module": "products",
    "description": "Permite ver el listado y detalles de productos",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### POST `/api/roles/permissions`
Crear un nuevo permiso.

**Permisos requeridos**: `admin`

**Body**:
```json
{
  "name": "Nuevo permiso",
  "code": "module.action",
  "module": "module",
  "description": "Descripción del permiso",
  "is_active": true
}
```

**Campos requeridos**:
- `name`: Nombre del permiso
- `code`: Código único del permiso
- `module`: Módulo al que pertenece

#### PUT `/api/roles/permissions/:id`
Actualizar un permiso existente.

**Permisos requeridos**: `admin`

**Body** (todos los campos son opcionales):
```json
{
  "name": "Nombre actualizado",
  "code": "module.action",
  "module": "module",
  "description": "Descripción actualizada",
  "is_active": false
}
```

#### DELETE `/api/roles/permissions/:id`
Eliminar un permiso.

**Permisos requeridos**: `admin`

---

### 👥 ROLES Y PERMISOS

#### GET `/api/roles`
Obtener lista de todos los roles disponibles en el sistema.

**Permisos requeridos**: `admin`, `gerencia`

**Ejemplo de respuesta**:
```json
{
  "success": true,
  "message": "Roles obtenidos exitosamente",
  "data": [
    {
      "code": "admin",
      "name": "Administrador",
      "description": "Acceso completo al sistema"
    },
    {
      "code": "gerencia",
      "name": "Gerencia",
      "description": "Personal gerencial con gestión operativa"
    },
    {
      "code": "ventas",
      "name": "Ventas",
      "description": "Personal del área de ventas"
    },
    {
      "code": "logistica",
      "name": "Logística",
      "description": "Personal del área de logística e inventario"
    },
    {
      "code": "finanzas",
      "name": "Finanzas",
      "description": "Personal del área financiera"
    },
    {
      "code": "manager",
      "name": "Manager",
      "description": "Gerentes de área"
    },
    {
      "code": "employee",
      "name": "Empleado",
      "description": "Empleados generales"
    },
    {
      "code": "viewer",
      "name": "Visualizador",
      "description": "Usuarios de solo lectura"
    }
  ],
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### GET `/api/roles/summary`
Obtener resumen de permisos por rol.

**Permisos requeridos**: `admin`, `gerencia`

**Ejemplo de respuesta**:
```json
{
  "success": true,
  "message": "Resumen de permisos por rol obtenido exitosamente",
  "data": {
    "admin": [
      {
        "id": 1,
        "name": "Ver productos",
        "code": "products.view",
        "module": "products",
        ...
      }
    ],
    "gerencia": [...],
    "ventas": [...],
    "logistica": [...],
    "finanzas": [...],
    "manager": [...],
    "employee": [...],
    "viewer": [...]
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### GET `/api/roles/:role/permissions`
Obtener permisos de un rol específico.

**Permisos requeridos**: `admin`, `gerencia`

**Parámetros**:
- `role`: Uno de: `admin`, `manager`, `employee`, `viewer`, `gerencia`, `ventas`, `logistica`, `finanzas`

**Ejemplo**:
```
GET /api/roles/ventas/permissions
```

#### POST `/api/roles/:role/permissions`
Asignar un permiso a un rol.

**Permisos requeridos**: `admin`

**Body**:
```json
{
  "permission_id": 1
}
```

**Parámetros**:
- `role`: Uno de los roles válidos

#### DELETE `/api/roles/:role/permissions/:permissionId`
Remover un permiso de un rol.

**Permisos requeridos**: `admin`

---

### 👤 USUARIOS Y PERMISOS

#### GET `/api/roles/users/:userId/permissions`
Obtener todos los permisos de un usuario (rol + directos).

**Permisos requeridos**: `admin`, `gerencia`

**Ejemplo de respuesta**:
```json
{
  "success": true,
  "message": "Permisos del usuario obtenidos exitosamente",
  "data": {
    "user": {
      "id": 1,
      "username": "usuario1",
      "role": "ventas"
    },
    "permissions": [
      {
        "id": 1,
        "name": "Ver productos",
        "code": "products.view",
        "module": "products",
        ...
      }
    ],
    "rolePermissions": [
      // Permisos del rol del usuario
    ],
    "directPermissions": [
      // Permisos asignados directamente al usuario
      {
        "id": 1,
        "name": "Crear productos",
        "code": "products.create",
        "module": "products",
        "expires_at": "2024-12-31T23:59:59.000Z",
        "granted_by": 2
      }
    ]
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### POST `/api/roles/assign`
Asignar un permiso a un rol o usuario.

**Permisos requeridos**: `admin`

**Body**:
```json
{
  "permission_id": 1,
  "role": "ventas"  // O usar user_id en su lugar
}
```

O para usuario específico:
```json
{
  "permission_id": 1,
  "user_id": 5,
  "expires_at": "2024-12-31T23:59:59.000Z"  // Opcional, NULL = permanente
}
```

**Nota**: Debe especificar `role` O `user_id`, no ambos.

#### DELETE `/api/roles/users/:userId/permissions/:permissionId`
Remover un permiso directo de un usuario.

**Permisos requeridos**: `admin`

**Nota**: Solo remueve permisos directos, no los del rol.

---

## Permisos Excepcionales a Usuarios

### Caso de Uso: Extensiones de Permisos Individuales

El sistema permite asignar permisos adicionales a usuarios individuales **más allá de su rol base**. Esto es útil para casos excepcionales donde un usuario necesita capacidades que normalmente no tiene por su rol.

**Ejemplos comunes:**
- Un vendedor (`ventas`) que necesita generar presupuestos (normalmente solo gerencia puede)
- Un empleado (`employee`) que temporalmente necesita gestionar stock (normalmente solo logística/gerencia)
- Un usuario de logística que necesita acceso temporal a módulos financieros
- Cualquier permiso específico que se requiera por situación especial

### ¿Cómo Funciona?

1. **Permisos del Rol**: El usuario mantiene todos los permisos de su rol base (ej: `ventas`)
2. **Permisos Directos**: Se pueden agregar permisos adicionales específicos al usuario
3. **Combinación**: El usuario puede realizar acciones si tiene el permiso por **cualquiera** de las dos fuentes (rol o directo)

### Pasos para Asignar Permisos Excepcionales

#### Paso 1: Verificar qué permisos necesita el usuario

```javascript
// Obtener todos los permisos disponibles en el sistema
const allPermissions = await fetch('/api/roles/permissions', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

#### Paso 2: Identificar el permiso específico necesario

Ejemplo: Si un vendedor necesita generar presupuestos:
- Primero, el permiso debe existir en el sistema (ej: `budgets.create`)
- Si no existe, un `admin` debe crearlo primero

#### Paso 3: Asignar el permiso al usuario

```javascript
// Asignar permiso de crear presupuestos a un vendedor
// Opción A: Permanente
await fetch('/api/roles/assign', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    permission_id: 25, // ID del permiso budgets.create
    user_id: 5,        // ID del usuario vendedor
    expires_at: null   // NULL = permanente
  })
});

// Opción B: Temporal (30 días)
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 30);

await fetch('/api/roles/assign', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    permission_id: 25,
    user_id: 5,
    expires_at: expiresAt.toISOString()
  })
});
```

#### Paso 4: Verificar los permisos del usuario

```javascript
// Ver todos los permisos del usuario (rol + directos)
const userPerms = await fetch(`/api/roles/users/5/permissions`, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// La respuesta incluye:
// - permissions: todos los permisos (rol + directos combinados)
// - rolePermissions: solo permisos del rol
// - directPermissions: solo permisos asignados directamente
```

#### Paso 5: Remover un permiso excepcional (si es necesario)

```javascript
// Remover permiso directo de un usuario
await fetch('/api/roles/users/5/permissions/25', {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${adminToken}` }
});
```

### Ejemplo Completo: Panel de Gestión de Permisos Excepcionales

```javascript
// Componente React para gestionar permisos excepcionales de un usuario
function UserExceptionPermissions({ userId, userRole }) {
  const [userPermissions, setUserPermissions] = useState(null);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [filteredPermissions, setFilteredPermissions] = useState([]);
  
  // Cargar datos
  useEffect(() => {
    loadData();
  }, [userId]);
  
  const loadData = async () => {
    const [userRes, allRes, roleRes] = await Promise.all([
      fetch(`/api/roles/users/${userId}/permissions`),
      fetch('/api/roles/permissions?is_active=true'),
      fetch(`/api/roles/${userRole}/permissions`)
    ]);
    
    const userData = await userRes.json();
    const allData = await allRes.json();
    const roleData = await roleRes.json();
    
    setUserPermissions(userData.data);
    
    // Filtrar: mostrar solo permisos que NO tiene por su rol
    const rolePermIds = roleData.data.map(p => p.id);
    const exceptions = allData.data.filter(p => !rolePermIds.includes(p.id));
    setAvailablePermissions(exceptions);
    setFilteredPermissions(exceptions);
  };
  
  const assignExceptionPermission = async (permissionId, isTemporary = false, days = 30) => {
    const body = {
      permission_id: permissionId,
      user_id: userId,
      expires_at: null
    };
    
    if (isTemporary) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);
      body.expires_at = expiresAt.toISOString();
    }
    
    await fetch('/api/roles/assign', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    loadData(); // Recargar
  };
  
  const removeExceptionPermission = async (permissionId) => {
    await fetch(`/api/roles/users/${userId}/permissions/${permissionId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    
    loadData(); // Recargar
  };
  
  return (
    <div className="exception-permissions">
      <h3>Permisos Excepcionales</h3>
      <p>Usuario: {userPermissions?.user.username} (Rol: {userRole})</p>
      
      {/* Permisos actuales del usuario (excepcionales) */}
      <div className="current-exceptions">
        <h4>Permisos Excepcionales Asignados</h4>
        {userPermissions?.directPermissions.map(perm => (
          <div key={perm.id} className="permission-item">
            <span>{perm.name} ({perm.code})</span>
            {perm.expires_at && (
              <span className="expires">
                Expira: {new Date(perm.expires_at).toLocaleDateString()}
              </span>
            )}
            <button onClick={() => removeExceptionPermission(perm.id)}>
              Remover
            </button>
          </div>
        ))}
      </div>
      
      {/* Lista de permisos disponibles para asignar */}
      <div className="available-exceptions">
        <h4>Permisos Disponibles para Asignar</h4>
        <input 
          type="text" 
          placeholder="Buscar permiso..."
          onChange={(e) => {
            const search = e.target.value.toLowerCase();
            setFilteredPermissions(
              availablePermissions.filter(p => 
                p.name.toLowerCase().includes(search) || 
                p.code.toLowerCase().includes(search)
              )
            );
          }}
        />
        {filteredPermissions.map(perm => (
          <div key={perm.id} className="permission-item">
            <span>{perm.name} ({perm.code})</span>
            <button onClick={() => assignExceptionPermission(perm.id, false)}>
              Asignar Permanente
            </button>
            <button onClick={() => assignExceptionPermission(perm.id, true, 30)}>
              Asignar 30 días
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Crear Nuevos Permisos (para casos donde no existen)

Si necesitas crear un permiso nuevo (ej: `budgets.create` para presupuestos):

```javascript
// Solo admin puede crear nuevos permisos
const createPermission = async () => {
  await fetch('/api/roles/permissions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Crear presupuestos',
      code: 'budgets.create',
      module: 'budgets',
      description: 'Permite crear nuevos presupuestos',
      is_active: true
    })
  });
};
```

---

### 👥 USUARIOS

#### GET `/api/users`
Obtener todos los usuarios del sistema con sus roles.

**Permisos requeridos**: `admin`, `gerencia`

**Query Parameters**:
- `is_active` (opcional): Filtrar por estado activo (`true`/`false`)
- `role` (opcional): Filtrar por rol específico (ej: `ventas`, `gerencia`)

**Ejemplo de respuesta**:
```json
{
  "success": true,
  "message": "Usuarios obtenidos exitosamente",
  "data": [
    {
      "id": 1,
      "username": "admin",
      "email": "admin@norte.com",
      "firstName": "Administrador",
      "lastName": "Sistema",
      "role": "admin",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": 2,
      "username": "vendedor1",
      "email": "vendedor@norte.com",
      "firstName": "Juan",
      "lastName": "Pérez",
      "role": "ventas",
      "isActive": true,
      "createdAt": "2024-01-02T00:00:00.000Z",
      "updatedAt": "2024-01-02T00:00:00.000Z"
    }
  ],
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Ejemplo de uso**:
```javascript
// Obtener todos los usuarios
const users = await fetch('/api/users', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Obtener solo usuarios activos
const activeUsers = await fetch('/api/users?is_active=true', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Obtener solo usuarios con rol ventas
const salesUsers = await fetch('/api/users?role=ventas', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

#### GET `/api/users/:id`
Obtener un usuario específico por ID.

**Permisos requeridos**: `admin`, `gerencia`

**Ejemplo de respuesta**:
```json
{
  "success": true,
  "message": "Usuario obtenido exitosamente",
  "data": {
    "id": 1,
    "username": "admin",
    "email": "admin@norte.com",
    "firstName": "Administrador",
    "lastName": "Sistema",
    "role": "admin",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Nota de Seguridad**: Estos endpoints nunca retornan el `password_hash` del usuario por seguridad.

#### POST `/api/users`
Crear un nuevo usuario en el sistema.

**Permisos requeridos**: `admin`

**Body**:
```json
{
  "username": "nuevo_usuario",
  "password": "contraseña_segura",
  "first_name": "Juan",
  "last_name": "Pérez",
  "email": "juan.perez@empresa.com",
  "role": "ventas",
  "is_active": true
}
```

**Campos requeridos**:
- `username`: Nombre de usuario único (string)
- `password`: Contraseña del usuario (string, mínimo 6 caracteres recomendado)
- `role`: Rol del usuario (string, uno de: `admin`, `gerencia`, `ventas`, `logistica`, `finanzas`, `manager`, `employee`, `viewer`)

**Campos opcionales**:
- `first_name`: Nombre del usuario (string)
- `last_name`: Apellido del usuario (string)
- `email`: Email del usuario (string, formato válido)
- `is_active`: Estado activo del usuario (boolean, default: `true`)

**Ejemplo de respuesta**:
```json
{
  "success": true,
  "message": "Usuario creado exitosamente",
  "data": {
    "id": 5,
    "username": "nuevo_usuario",
    "email": "juan.perez@empresa.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "role": "ventas",
    "is_active": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**✅ ASIGNACIÓN AUTOMÁTICA DE PERMISOS DEL ROL**:

Cuando se crea un usuario con un rol (ej: `logistica`, `ventas`, `gerencia`), el backend **asigna automáticamente** todos los permisos granulares correspondientes a ese rol.

**Cómo funciona**:
1. Al crear un usuario, se le asigna un rol (ej: `role: "logistica"`)
2. El sistema automáticamente obtiene todos los permisos del rol desde la tabla `role_permissions`
3. El usuario hereda inmediatamente todos los permisos asociados a ese rol
4. No se requieren llamadas adicionales a la API para asignar permisos del rol

**Ejemplo**:
```javascript
// Crear usuario con rol logistica
POST /api/users
{
  "username": "fernando",
  "email": "fernando@norte.com",
  "password": "contraseña123",
  "firstName": "Fernando",
  "lastName": "García",
  "role": "logistica"  // ← Al asignar este rol...
}

// Automáticamente el usuario tendrá todos los permisos de logistica:
// - products.view
// - products.view_stats
// - products.manage_stock
// - orders.view
// - orders.view_stats
// - orders.update_remito_status
// - purchases.view
// - purchases.manage_items
// - logistics.view_remitos
// - logistics.create_remitos
// - logistics.update_remitos
// - logistics.manage_remito_status
// - logistics.view_trazabilidad
// - logistics.manage_trazabilidad
// - dashboard.view

// Verificar permisos del usuario recién creado:
GET /api/roles/users/:userId/permissions
// → Retorna todos los permisos del rol "logistica" automáticamente
```

**Nota importante**: Los permisos del rol se obtienen dinámicamente desde la tabla `role_permissions`. Si se modifican los permisos de un rol, todos los usuarios con ese rol heredan automáticamente los cambios.

#### PUT `/api/users/:id`
Actualizar un usuario existente.

**Permisos requeridos**: `admin`

**Body** (todos los campos son opcionales excepto que al menos uno debe estar presente):
```json
{
  "username": "usuario_actualizado",
  "password": "nueva_contraseña",
  "first_name": "Juan",
  "last_name": "García",
  "email": "juan.garcia@empresa.com",
  "role": "logistica",
  "is_active": false
}
```

**✅ ACTUALIZACIÓN AUTOMÁTICA DE PERMISOS AL CAMBIAR ROL**:

Cuando se actualiza el `role` de un usuario, el sistema automáticamente:
1. **Obtiene dinámicamente** los permisos del nuevo rol desde `role_permissions`
2. **Mantiene intactos** los permisos excepcionales (directos) asignados al usuario en `user_permissions`
3. **Combina ambos** cuando se consultan los permisos del usuario

**Ejemplo**:
```javascript
// Usuario tiene rol "ventas" con permisos de ventas
// Se actualiza a rol "logistica"
PUT /api/users/5
{
  "role": "logistica"  // ← Cambio de rol
}

// Automáticamente el usuario ahora tiene:
// - Todos los permisos del rol "logistica" (obtenidos dinámicamente)
// - Sus permisos excepcionales previos (si tenía alguno)
// - No necesita ninguna llamada adicional para asignar permisos
```

**Nota importante**: Los permisos del rol se obtienen dinámicamente, por lo que si se modifican los permisos de un rol en `role_permissions`, todos los usuarios con ese rol heredan automáticamente los cambios sin necesidad de actualizar usuarios individuales.

**Ejemplo de respuesta**:
```json
{
  "success": true,
  "message": "Usuario actualizado exitosamente",
  "data": {
    "id": 5,
    "username": "usuario_actualizado",
    "email": "juan.garcia@empresa.com",
    "firstName": "Juan",
    "lastName": "García",
    "role": "logistica",
    "is_active": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### DELETE `/api/users/:id`
Eliminar un usuario del sistema.

**Permisos requeridos**: `admin`

**Ejemplo de respuesta**:
```json
{
  "success": true,
  "message": "Usuario eliminado exitosamente",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Nota**: Se recomienda realizar un soft delete (marcar como inactivo) en lugar de eliminar físicamente el registro.

---

## Ejemplos de Uso

### Ejemplo 1: Verificar si un usuario puede crear productos

```javascript
// Después de obtener los permisos del usuario
const userPermissions = await fetch('/api/roles/users/5/permissions', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const hasPermission = userPermissions.data.permissions.some(
  p => p.code === 'products.create'
);

if (hasPermission) {
  // Mostrar botón de crear producto
}
```

### Ejemplo 2: Asignar un permiso temporal a un usuario

```javascript
// Asignar permiso de creación de productos por 30 días
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 30);

await fetch('/api/roles/assign', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    permission_id: 2, // products.create
    user_id: 5,
    expires_at: expiresAt.toISOString()
  })
});
```

### Ejemplo 3: Obtener todos los permisos de un módulo

```javascript
// Obtener todos los permisos del módulo de productos
const permissions = await fetch('/api/roles/permissions?module=products', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### Ejemplo 4: Obtener lista de usuarios con sus roles

```javascript
// Obtener todos los usuarios con Bearer token
const users = await fetch('/api/users', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const usersData = await users.json();
console.log('Usuarios:', usersData.data);
```

### Ejemplo 5: Obtener lista de todos los roles disponibles

```javascript
// Obtener todos los roles disponibles (solo admin y gerencia)
const roles = await fetch('/api/roles', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const rolesData = await roles.json();
console.log('Roles disponibles:', rolesData.data);
```

### Ejemplo 6: Ver qué permisos tiene un rol

```javascript
// Ver permisos del rol "ventas"
const rolePermissions = await fetch('/api/roles/ventas/permissions', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

## Cómo Implementar en el Frontend

### 1. Obtención de Permisos del Usuario Actual

Después del login, obtener los permisos del usuario:

```javascript
// En el servicio de autenticación
async function getUserPermissions(userId, token) {
  const response = await fetch(`/api/roles/users/${userId}/permissions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  return data.data.permissions.map(p => p.code);
}

// Guardar en estado (React/Redux/Vuex, etc.)
const permissions = await getUserPermissions(user.id, token);
// Guardar en: localStorage, Context, Store, etc.
```

### 2. Hook/Utilidad para Verificar Permisos

```javascript
// React Hook ejemplo
function usePermissions() {
  const [permissions, setPermissions] = useState([]);
  
  useEffect(() => {
    // Cargar permisos del usuario
    const loadPermissions = async () => {
      const user = JSON.parse(localStorage.getItem('user'));
      const token = localStorage.getItem('token');
      const perms = await getUserPermissions(user.id, token);
      setPermissions(perms);
    };
    loadPermissions();
  }, []);
  
  const hasPermission = (code) => {
    return permissions.includes(code);
  };
  
  const hasAnyPermission = (codes) => {
    return codes.some(code => permissions.includes(code));
  };
  
  const hasAllPermissions = (codes) => {
    return codes.every(code => permissions.includes(code));
  };
  
  return { permissions, hasPermission, hasAnyPermission, hasAllPermissions };
}
```

### 3. Componente de Protección de Rutas

```javascript
// React Router ejemplo
function ProtectedRoute({ permission, children }) {
  const { hasPermission } = usePermissions();
  
  if (!hasPermission(permission)) {
    return <Navigate to="/unauthorized" />;
  }
  
  return children;
}

// Uso:
<Route path="/products/create" element={
  <ProtectedRoute permission="products.create">
    <CreateProduct />
  </ProtectedRoute>
} />
```

### 4. Componente de Botón Condicional

```javascript
// Botón que solo se muestra si tiene permiso
function CreateProductButton() {
  const { hasPermission } = usePermissions();
  
  if (!hasPermission('products.create')) {
    return null;
  }
  
  return <button onClick={handleCreate}>Crear Producto</button>;
}
```

### 5. Directiva para Vue.js

```javascript
// Vue.js directive
app.directive('permission', {
  mounted(el, binding) {
    const permissions = JSON.parse(localStorage.getItem('permissions') || '[]');
    if (!permissions.includes(binding.value)) {
      el.style.display = 'none';
      // O: el.remove();
    }
  }
});

// Uso:
// <button v-permission="'products.create'">Crear</button>
```

### 6. Guard para Angular

```typescript
// Angular Guard
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private authService: AuthService) {}
  
  canActivate(route: ActivatedRouteSnapshot): boolean {
    const requiredPermission = route.data['permission'];
    const userPermissions = this.authService.getUserPermissions();
    return userPermissions.includes(requiredPermission);
  }
}

// En routing:
{
  path: 'products/create',
  component: CreateProductComponent,
  canActivate: [PermissionGuard],
  data: { permission: 'products.create' }
}
```

### 7. Gestión de Permisos (Panel de Admin)

```javascript
// Componente para gestionar permisos de usuarios
function UserPermissionsManager({ userId }) {
  const [userPermissions, setUserPermissions] = useState(null);
  const [allPermissions, setAllPermissions] = useState([]);
  
  useEffect(() => {
    // Cargar permisos del usuario y todos los permisos disponibles
    Promise.all([
      fetch(`/api/roles/users/${userId}/permissions`),
      fetch('/api/roles/permissions')
    ]).then(async ([userRes, allRes]) => {
      const userData = await userRes.json();
      const allData = await allRes.json();
      setUserPermissions(userData.data);
      setAllPermissions(allData.data);
    });
  }, [userId]);
  
  const assignPermission = async (permissionId, expiresAt = null) => {
    await fetch('/api/roles/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        permission_id: permissionId,
        user_id: userId,
        expires_at: expiresAt
      })
    });
    // Recargar permisos
  };
  
  const removePermission = async (permissionId) => {
    await fetch(`/api/roles/users/${userId}/permissions/${permissionId}`, {
      method: 'DELETE'
    });
    // Recargar permisos
  };
  
  // Renderizar interfaz de gestión...
}
```

---

## Códigos de Respuesta HTTP

- **200 OK**: Operación exitosa
- **201 Created**: Recurso creado exitosamente
- **400 Bad Request**: Datos inválidos
- **401 Unauthorized**: No autenticado o token inválido
- **403 Forbidden**: No tiene permisos suficientes
- **404 Not Found**: Recurso no encontrado
- **409 Conflict**: Conflicto (ej: permiso ya asignado)
- **500 Internal Server Error**: Error del servidor

---

## Notas Importantes

1. **Permisos del rol ADMIN**: El rol `admin` tiene automáticamente TODOS los permisos del sistema. No es necesario asignarlos manualmente.

2. **Permisos Excepcionales**: El sistema soporta completamente la asignación de permisos individuales a usuarios más allá de su rol. Esto permite casos como dar permisos especiales a vendedores, empleados, etc. Ver sección ["Permisos Excepcionales a Usuarios"](#permisos-excepcionales-a-usuarios).

3. **Expiración de permisos**: Los permisos directos a usuarios pueden tener fecha de expiración. Después de la fecha, el permiso se elimina automáticamente de las verificaciones.

4. **Permisos inactivos**: Los permisos con `is_active: false` no se consideran al verificar permisos, aunque estén asignados.

5. **Actualización de permisos**: Si se cambia el rol de un usuario, los permisos del rol se actualizan automáticamente. Los permisos directos (excepcionales) se mantienen intactos.

6. **Crear nuevos permisos**: Si necesitas un permiso que no existe (ej: `budgets.create`), un `admin` puede crearlo usando `POST /api/roles/permissions` y luego asignarlo a usuarios específicos.

7. **Performance**: Para mejor rendimiento, cachear los permisos del usuario en el frontend y actualizar solo cuando sea necesario.

8. **Validación del lado del servidor**: Siempre validar permisos en el backend. El frontend solo oculta/muestra elementos, pero el backend es la autoridad definitiva.

---

## Soporte

Para dudas o problemas con el sistema de roles y permisos, contactar al equipo de desarrollo.

---

**Última actualización**: Noviembre 2025

**Nota**: Este documento incluye soporte completo para permisos excepcionales a usuarios individuales, permitiendo que administradores y gerentes puedan extender las capacidades de usuarios específicos más allá de su rol base.

