# Cronograma de Implementación - Sistema ERP HG Group

## 1. Análisis Ejecutivo

Este documento presenta un **análisis completo** y un **cronograma de tiempos y plazos** para la implementación de los módulos solicitados por el cliente, considerando:

- **Un solo desarrollador** trabajando en el proyecto
- **Base existente** del proyecto (API REST, autenticación, estructura de datos, varios módulos ya implementados)
- **Ventas por prospección** (llamadas, correo, visitas, referidos) sin tienda online como foco principal
- **Horas productivas estimadas**: 6-7 horas/día efectivas (considerando reuniones, imprevistos y revisiones)

---

## 2. Inventario de lo que YA existe

| Módulo | Estado actual | Descripción |
|--------|---------------|-------------|
| **Autenticación y usuarios** | ✅ Implementado | JWT, roles, permisos, API keys |
| **Clientes** | ✅ Base implementada | CRUD completo, tipos (mayorista/minorista), canales de venta. Falta: prospección, historial de contactos |
| **Productos/Artículos** | ✅ Implementado | Catálogo con categorías |
| **Proveedores** | ✅ Implementado | Estructura completa (según SUGERENCIA_HG) |
| **Pedidos (Orders)** | ✅ Implementado | Ciclo completo, estados, integración con logística |
| **Ventas (Sales)** | ✅ Implementado | Controller y rutas existentes |
| **Logística** | ✅ Implementado | Remitos, trazabilidad, stock movements, zonas, transportes |
| **Dashboard** | ⚠️ Parcial | KPIs básicos (ventas diarias, pedidos activos, clientes, stock). Requiere ampliación |
| **Pagos** | ⚠️ Parcial | Controller existe, documentación vacía. Requiere definición y posible extensión |
| **Cuentas corrientes** | ⚠️ Parcial | Existe para proveedores. Falta para clientes |
| **CRM** | ❌ No existe | Historial de contactos, pipeline, seguimiento, tareas |
| **Facturación** | ❌ No existe | Comprobantes fiscales, AFIP, etc. |

---

## 3. Alcance por Módulo y Estimación de Esfuerzo

### 3.1 Dashboard principal

**Descripción:** Panel central con KPIs y métricas del negocio de ventas por prospección.

**Trabajo requerido:**
- Ampliar métricas actuales (ventas diarias, pedidos activos, clientes, stock)
- Agregar: pipeline de ventas (prospectos → clientes activos), tareas de seguimiento pendientes, vencimientos de cuenta corriente, ventas por período, gráficos de tendencia
- Integrar datos de CRM (actividad reciente, prospectos en riesgo)
- API consolidada para el frontend

**Dependencias:** Clientes extendidos, CRM básico, Cuentas corrientes.

| Fase | Actividad | Horas |
|------|-----------|-------|
| 1 | Diseño de métricas y endpoints | 8 |
| 2 | Implementación de queries y agregaciones | 16 |
| 3 | Integración y ajustes | 8 |
| **Total** | | **32 horas** |

**Plazo estimado:** 4-5 días hábiles.

---

### 3.2 Clientes (extensión para prospección)

**Descripción:** Extender el módulo actual según SUGERENCIA_HG: origen del contacto, vendedor asignado, estado en pipeline, fechas de contacto, próxima acción.

**Trabajo requerido:**
- Migración de base de datos (nuevos campos: origen, asignado_a, estado, primera_contactacion, ultima_contactacion, proximo_seguimiento, limite_credito, dias_pago, etc.)
- Actualizar entidades, repositorios, servicios y controladores
- Validaciones y reglas de negocio
- Endpoints adicionales (filtros por estado, por vendedor, por proximo_seguimiento)
- Documentación API

| Fase | Actividad | Horas |
|------|-----------|-------|
| 1 | Diseño de migración y modelo de datos | 4 |
| 2 | Migración DB y actualización de código | 20 |
| 3 | Validaciones y pruebas | 8 |
| **Total** | | **32 horas** |

**Plazo estimado:** 4-5 días hábiles.

---

### 3.3 Ventas

**Descripción:** El módulo de pedidos ya existe. Adaptar y complementar para ventas por prospección.

**Trabajo requerido:**
- Ajustar flujo para vincular pedidos con clientes del pipeline
- Presupuestos/estimaciones (si aplica)
- Reportes de ventas por período, vendedor, cliente
- Posibles integraciones con CRM
- Ajustes menores en estados y transiciones

| Fase | Actividad | Horas |
|------|-----------|-------|
| 1 | Análisis de gaps y ajustes necesarios | 4 |
| 2 | Implementación de ajustes y reportes | 16 |
| 3 | Integración con clientes/CRM | 8 |
| **Total** | | **28 horas** |

**Plazo estimado:** 3-4 días hábiles.

---

### 3.4 CRM básico con funcionalidades avanzadas

**Descripción:** CRM orientado a ventas por prospección con pipeline, historial de contactos y seguimiento.

**Funcionalidades:**
- Historial de contactos por cliente (llamadas, emails, visitas)
- Pipeline de estados (prospecto → contactado → calificado → negociación → cliente activo)
- Tareas y recordatorios (próximo seguimiento)
- Actividades recientes y próximas
- Filtros avanzados (por vendedor, estado, fecha)
- Alertas de seguimiento vencido
- Métricas de conversión (opcional, nivel avanzado)

**Trabajo requerido:**
- Tabla `contact_history` (según SUGERENCIA_HG)
- CRUD de historial de contactos
- Endpoints para pipeline y actividades
- Lógica de actualización de `ultima_contactacion` y `proximo_seguimiento`
- Reportes y métricas básicas de CRM
- Integración con módulo de clientes

| Fase | Actividad | Horas |
|------|-----------|-------|
| 1 | Diseño de modelo y tablas | 6 |
| 2 | Migración y entidades | 8 |
| 3 | Repositorios, servicios, controladores | 24 |
| 4 | Endpoints de pipeline, tareas, reportes | 16 |
| 5 | Integración con clientes y validaciones | 10 |
| **Total** | | **64 horas** |

**Plazo estimado:** 9-10 días hábiles.

---

### 3.5 Pagos

**Descripción:** Gestión de pagos de clientes (contado, cuenta corriente, múltiples métodos).

**Trabajo requerido:**
- Definir modelo de pagos (tabla `payments` si no existe)
- Vincular pagos con pedidos/ventas y cuentas corrientes
- CRUD de pagos
- Métodos de pago (efectivo, transferencia, tarjeta, cheque, etc.)
- Asignación de pagos a facturas o movimientos de CC
- Reportes de cobranza
- Integración con cuentas corrientes

| Fase | Actividad | Horas |
|------|-----------|-------|
| 1 | Análisis del estado actual y diseño | 6 |
| 2 | Modelo de datos y migración | 8 |
| 3 | Implementación completa de pagos | 24 |
| 4 | Integración con cuentas corrientes y ventas | 12 |
| **Total** | | **50 horas** |

**Plazo estimado:** 7 días hábiles.

---

### 3.6 Cuentas corrientes (clientes)

**Descripción:** Cuentas corrientes para clientes (débitos por ventas, créditos por pagos).

**Trabajo requerido:**
- Tabla `client_accounts` o similar (balance, límite de crédito, días de pago)
- Tabla `client_account_movements` (débitos, créditos, referencias)
- Crear cuenta al habilitar crédito a cliente
- Registrar débitos al facturar/entregar
- Registrar créditos al cobrar
- Validación de límite de crédito
- Reportes de aging (vencimientos por antigüedad)
- Alertas de vencimiento
- Integración con pagos

| Fase | Actividad | Horas |
|------|-----------|-------|
| 1 | Diseño de modelo (similar a supplier_accounts) | 4 |
| 2 | Migración y entidades | 8 |
| 3 | Lógica de débitos/créditos y balance | 20 |
| 4 | Reportes, aging y alertas | 12 |
| 5 | Integración con ventas y pagos | 8 |
| **Total** | | **52 horas** |

**Plazo estimado:** 7-8 días hábiles.

---

### 3.7 Logística

**Descripción:** Módulo ya implementado (remitos, trazabilidad, transportes, zonas).

**Trabajo requerido:**
- Ajustes menores según feedback del cliente
- Posibles mejoras en reportes o integración con pedidos
- Documentación y pruebas de regresión

| Fase | Actividad | Horas |
|------|-----------|-------|
| 1 | Revisión y ajustes menores | 8 |
| **Total** | | **8 horas** |

**Plazo estimado:** 1 día hábil.

---

### 3.8 Facturación

**Descripción:** Emisión de comprobantes fiscales (facturas, notas de crédito) y eventual integración con AFIP.

**Trabajo requerido:**
- Modelo de facturas (cabecera, ítems, tipos de comprobante)
- Vinculación factura ↔ pedido/remito
- Generación de número de comprobante
- Cálculo de IVA según condición del cliente
- Generación de PDF
- Integración con AFIP (Web Services) — alta complejidad
- Notas de crédito y anulaciones

**Nota:** La integración con AFIP puede requerir certificados digitales, homologación y pruebas en ambiente de desarrollo. Es el módulo más complejo.

| Fase | Actividad | Horas |
|------|-----------|-------|
| 1 | Diseño de modelo y tipos de comprobante | 8 |
| 2 | Migración, entidades, CRUD base | 16 |
| 3 | Lógica fiscal (IVA, subtotales) y numeración | 12 |
| 4 | Generación de PDF | 8 |
| 5 | Integración AFIP (feasible básico) | 40 |
| 6 | Notas de crédito y ajustes | 12 |
| **Total** | | **96 horas** |

**Plazo estimado:** 12-14 días hábiles (o más si hay demoras con AFIP).

---

### 3.9 Otros módulos / “Entre otros”

**Incluye:**
- Reportes generales (ventas, compras, stock, clientes)
- Configuración del sistema
- Mejoras de UX en API
- Documentación
- Testing y corrección de bugs

| Actividad | Horas |
|-----------|-------|
| Reportes generales | 16 |
| Configuración y ajustes | 8 |
| Documentación y testing | 16 |
| **Total** | **40 horas** |

**Plazo estimado:** 5-6 días hábiles.

---

## 4. Cronograma Global

### Resumen de horas por módulo

| Módulo | Horas | Días hábiles (aprox.) |
|--------|-------|------------------------|
| Dashboard principal | 32 | 4-5 |
| Clientes (extensión) | 32 | 4-5 |
| Ventas | 28 | 3-4 |
| CRM | 64 | 9-10 |
| Pagos | 50 | 7 |
| Cuentas corrientes | 52 | 7-8 |
| Logística | 8 | 1 |
| Facturación | 96 | 12-14 |
| Otros (reportes, docs, testing) | 40 | 5-6 |
| **TOTAL** | **402** | **~52-60 días** |

### Orden sugerido (dependencias)

```
1. Clientes (extensión)     → Base para CRM, ventas, CC
2. CRM                      → Base para Dashboard y Ventas
3. Cuentas corrientes       → Base para Pagos y Facturación
4. Pagos                    → Depende de CC
5. Ventas (ajustes)         → Depende de Clientes y CRM
6. Dashboard                → Depende de Clientes, CRM, CC
7. Logística (ajustes)      → Independiente
8. Facturación              → Depende de Ventas, CC, Pagos
9. Otros (reportes, docs)   → Al final
```

---

## 5. Cronograma Detallado por Fases

### Fase 1: Fundamentos (Semanas 1-3)

| Semana | Módulo | Entregables |
|--------|--------|-------------|
| 1 | Clientes (extensión) | Migración DB, campos de prospección, endpoints actualizados |
| 2 | CRM (parte 1) | Tabla contact_history, CRUD historial, integración con clientes |
| 3 | CRM (parte 2) | Pipeline, tareas, reportes básicos de CRM |

### Fase 2: Finanzas (Semanas 4-6)

| Semana | Módulo | Entregables |
|--------|--------|-------------|
| 4 | Cuentas corrientes | Modelo, débitos/créditos, balance, límites |
| 5 | Pagos | CRUD pagos, métodos de pago, vinculación con CC |
| 6 | Integración CC + Pagos | Reportes aging, alertas, pruebas de flujo completo |

### Fase 3: Operación y visibilidad (Semanas 7-8)

| Semana | Módulo | Entregables |
|--------|--------|-------------|
| 7 | Ventas (ajustes) | Ajustes de flujo, reportes, integración con CRM |
| 8 | Dashboard principal | KPIs consolidados, pipeline, tareas pendientes, métricas |

### Fase 4: Logística y facturación (Semanas 9-12)

| Semana | Módulo | Entregables |
|--------|--------|-------------|
| 9 | Logística | Ajustes menores, documentación |
| 10-11 | Facturación (parte 1) | Modelo, CRUD, lógica fiscal, PDF |
| 12 | Facturación (parte 2) | Integración AFIP, notas de crédito |

### Fase 5: Cierre (Semana 13)

| Semana | Actividad | Entregables |
|--------|-----------|-------------|
| 13 | Otros | Reportes generales, documentación, testing, corrección de bugs |

---

## 6. Cronograma visual (resumen)

```
Semana  1  │ Clientes (extensión)  ████████
Semana  2  │ CRM - Historial       ████████
Semana  3  │ CRM - Pipeline        ████████
Semana  4  │ Cuentas corrientes    ████████
Semana  5  │ Pagos                 ████████
Semana  6  │ Integración CC+Pagos  ████
Semana  7  │ Ventas (ajustes)      ██████
Semana  8  │ Dashboard             ████████
Semana  9  │ Logística             ██
Semana 10  │ Facturación - Base    ████████
Semana 11  │ Facturación - AFIP    ████████
Semana 12  │ Facturación - Cierre  ████
Semana 13  │ Reportes, docs, QA    █████
```

---

## 7. Factores de riesgo y mitigación

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| AFIP más complejo de lo esperado | Alta | Alto | Priorizar facturación sin AFIP; AFIP en fase posterior |
| Cambios de alcance del cliente | Media | Alto | Definir MVP por módulo y congelar alcance en cada fase |
| Bugs en módulos existentes | Media | Medio | Testing de regresión y priorizar correcciones críticas |
| Fatiga/sobrecarga (1 desarrollador) | Media | Medio | Buffer del 15-20% en plazos; evitar sprints muy largos |

---

## 8. Recomendaciones

### 8.1 Para el cliente
1. Priorizar un MVP por módulo: Clientes + CRM + Pagos + CC permiten operar ventas por prospección de forma útil.
2. Considerar facturación en dos etapas: primero comprobantes internos/PDF; después integración AFIP.
3. Definir con claridad requisitos fiscales (tipos de comprobante, IVA, moneda) antes de facturación.
4. Planificar al menos una revisión semanal para ajustar prioridades y plazos.

### 8.2 Para el desarrollador
1. Trabajar por fases cortas (1-2 semanas) y entregar valor incremental.
2. Documentar APIs y cambios de modelo a medida que se implementan.
3. Mantener tests básicos (al menos para flujos críticos de pagos y CC).
4. Usar migraciones versionadas para cambios de base de datos.
5. Incluir buffer del 15-20% en la planificación por imprevistos.

---

## 9. Resumen ejecutivo

- **Total estimado:** ~402 horas (aprox. 52-60 días hábiles para un desarrollador).
- **Duración sugerida:** 12-14 semanas (3-3,5 meses) con un ritmo sostenible.
- **Módulos con mayor esfuerzo:** Facturación (AFIP), CRM, Cuentas corrientes.
- **Módulos con base existente:** Clientes, Ventas, Logística, Dashboard (requieren extensión, no arrancar de cero).
- **Orden lógico:** Clientes → CRM → Cuentas corrientes → Pagos → Ventas → Dashboard → Logística → Facturación → Reportes y documentación.

Este cronograma es una estimación base y puede ajustarse según disponibilidad real, prioridades del cliente y resultados de las primeras fases.

---

**Fecha de elaboración:** Febrero 2025  
**Versión:** 1.0  
**Documento de referencia:** SUGERENCIA_HG.md
