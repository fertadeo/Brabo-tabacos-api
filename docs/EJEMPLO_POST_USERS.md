# Ejemplo de POST para Crear Usuario - Frontend

## Endpoint
```
POST http://localhost:8083/api/users
```

## Headers Requeridos
```javascript
{
  'Authorization': 'Bearer <tu_token_jwt>',
  'Content-Type': 'application/json'
}
```

## Campos Requeridos
- `username` (string): Nombre de usuario único
- `email` (string): Email válido del usuario
- `password` (string): Mínimo 6 caracteres
- `firstName` (string) o `FirstName` (string): Nombre del usuario
- `lastName` (string) o `LastName` (string): Apellido del usuario
- `role` (string): Uno de: `admin`, `gerencia`, `ventas`, `logistica`, `finanzas`, `manager`, `employee`, `viewer`

## Campos Opcionales
- `isActive` (boolean) o `is_active` (boolean): Estado activo del usuario (default: `true`)

---

## Ejemplo 1: Usando camelCase (Recomendado)

```javascript
// Ejemplo con fetch API
async function createUser(userData) {
  const token = localStorage.getItem('token'); // O donde guardes el token
  
  try {
    const response = await fetch('http://localhost:8083/api/users', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'logistical',
        email: 'fernandotadeos@gmail.com',
        password: 'contraseña123',
        firstName: 'Fernando Manuel',
        lastName: 'Tadeo Suárez',
        role: 'logistica',
        isActive: true
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }

    const responseData = await response.json();
    console.log('Usuario creado exitosamente:', responseData.data);
    return responseData.data;
  } catch (error) {
    console.error('Error al crear usuario:', error);
    throw error;
  }
}

// Uso
createUser({
  username: 'logistical',
  email: 'fernandotadeos@gmail.com',
  password: 'contraseña123',
  firstName: 'Fernando Manuel',
  lastName: 'Tadeo Suárez',
  role: 'logistica'
});
```

---

## Ejemplo 2: Usando PascalCase (También aceptado)

```javascript
// El backend acepta ambos formatos
async function createUser(userData) {
  const token = localStorage.getItem('token');
  
  const response = await fetch('http://localhost:8083/api/users', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      username: 'logistical',
      email: 'fernandotadeos@gmail.com',
      password: 'contraseña123',
      FirstName: 'Fernando Manuel',  // ← PascalCase
      LastName: 'Tadeo Suárez',       // ← PascalCase
      role: 'logistica',
      isActive: true
    })
  });

  const data = await response.json();
  return data;
}
```

---

## Ejemplo 3: Con Axios

```javascript
import axios from 'axios';

async function createUser(userData) {
  const token = localStorage.getItem('token');
  
  try {
    const response = await axios.post(
      'http://localhost:8083/api/users',
      {
        username: userData.username,
        email: userData.email,
        password: userData.password,
        firstName: userData.firstName,  // o FirstName
        lastName: userData.lastName,     // o LastName
        role: userData.role,
        isActive: userData.isActive ?? true
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.data;
  } catch (error) {
    if (error.response) {
      // Error del servidor (400, 403, 500, etc.)
      console.error('Error del servidor:', error.response.data);
      throw new Error(error.response.data.message || 'Error al crear usuario');
    } else {
      // Error de red o de configuración
      console.error('Error de red:', error.message);
      throw error;
    }
  }
}
```

---

## Ejemplo 4: React Hook con manejo de errores completo

```typescript
import { useState } from 'react';

interface CreateUserData {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'gerencia' | 'ventas' | 'logistica' | 'finanzas' | 'manager' | 'employee' | 'viewer';
  isActive?: boolean;
}

function useCreateUser() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createUser = async (userData: CreateUserData) => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch('http://localhost:8083/api/users', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: userData.username,
          email: userData.email,
          password: userData.password,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          isActive: userData.isActive ?? true
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // Manejar errores de validación
        if (response.status === 400 && data.data) {
          const validationErrors = data.data.map((err: any) => err.msg).join(', ');
          throw new Error(`Errores de validación: ${validationErrors}`);
        }
        throw new Error(data.message || `Error ${response.status}`);
      }

      return data.data;
    } catch (err: any) {
      const errorMessage = err.message || 'Error desconocido al crear usuario';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createUser, loading, error };
}

// Uso en componente
function UserManagementComponent() {
  const { createUser, loading, error } = useCreateUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const newUser = await createUser({
        username: 'logistical',
        email: 'fernandotadeos@gmail.com',
        password: 'contraseña123',
        firstName: 'Fernando Manuel',
        lastName: 'Tadeo Suárez',
        role: 'logistica'
      });
      
      console.log('Usuario creado:', newUser);
      alert('Usuario creado exitosamente');
    } catch (err) {
      console.error('Error:', err);
      alert(`Error: ${error || err.message}`);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Formulario aquí */}
      <button type="submit" disabled={loading}>
        {loading ? 'Creando...' : 'Crear Usuario'}
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  );
}
```

---

## Respuesta Exitosa (201 Created)

```json
{
  "success": true,
  "message": "Usuario creado exitosamente",
  "data": {
    "id": 5,
    "username": "logistical",
    "email": "fernandotadeos@gmail.com",
    "firstName": "Fernando Manuel",
    "lastName": "Tadeo Suárez",
    "role": "logistica",
    "isActive": true,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Errores Comunes y Respuestas

### 400 Bad Request - Errores de Validación
```json
{
  "success": false,
  "message": "Errores de validación",
  "data": [
    {
      "type": "field",
      "msg": "lastName es requerido",
      "path": "lastName",
      "location": "body"
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 401 Unauthorized - Token faltante o inválido
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

### 403 Forbidden - Rol insuficiente
```json
{
  "success": false,
  "message": "Forbidden: insufficient role"
}
```

### 409 Conflict - Usuario o email duplicado
```json
{
  "success": false,
  "message": "El nombre de usuario o email ya existe",
  "error": "...",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Notas Importantes

1. **Token JWT**: El token debe estar en el header `Authorization: Bearer <token>`
2. **Roles permitidos**: Solo usuarios con rol `admin` o `gerencia` pueden crear usuarios
3. **Nombres de campos flexibles**: 
   - `firstName` o `FirstName` ✅
   - `lastName` o `LastName` ✅
   - `isActive` o `is_active` ✅
4. **Password mínimo**: 6 caracteres
5. **Email**: Debe ser un email válido
6. **Permisos automáticos**: Al crear un usuario, automáticamente hereda todos los permisos del rol asignado

---

## Ejemplo Completo con Validación en Frontend

```typescript
// Validar antes de enviar
function validateUserData(data: CreateUserData): string[] {
  const errors: string[] = [];

  if (!data.username || data.username.trim().length === 0) {
    errors.push('Username es requerido');
  }

  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Email válido es requerido');
  }

  if (!data.password || data.password.length < 6) {
    errors.push('Password debe tener al menos 6 caracteres');
  }

  if (!data.firstName || data.firstName.trim().length === 0) {
    errors.push('FirstName es requerido');
  }

  if (!data.lastName || data.lastName.trim().length === 0) {
    errors.push('LastName es requerido');
  }

  const validRoles = ['admin', 'gerencia', 'ventas', 'logistica', 'finanzas', 'manager', 'employee', 'viewer'];
  if (!data.role || !validRoles.includes(data.role)) {
    errors.push(`Role debe ser uno de: ${validRoles.join(', ')}`);
  }

  return errors;
}

// Usar validación antes de crear
async function createUserWithValidation(userData: CreateUserData) {
  const validationErrors = validateUserData(userData);
  
  if (validationErrors.length > 0) {
    throw new Error(`Errores de validación: ${validationErrors.join(', ')}`);
  }

  return await createUser(userData);
}
```

