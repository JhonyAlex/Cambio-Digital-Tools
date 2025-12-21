# DIRECTRICES DE ARQUITECTURA E INSTRUCCIONES PARA LA IA

Este documento define las reglas estrictas de desarrollo para "CambioDigital Tools". Cualquier modificación futura debe respetar estos principios para garantizar la integridad de los datos y la sincronización en la nube.

## 1. REGLA DE ORO: VALIDACIÓN DE CONECTIVIDAD (KILL SWITCH)
**Prioridad:** CRÍTICA (Bloqueante)

El sistema está diseñado para **no funcionar** si no hay una conexión estable a la base de datos configurada (especialmente en modo Cloud/Firebase).

*   **Instrucción:** Antes de realizar CUALQUIER operación de lectura, escritura, actualización o eliminación en los servicios (`services/*`), se debe invocar obligatoriamente:
    ```typescript
    await validateConnectivity();
    ```
*   **Comportamiento:** Si esta función falla, lanzará un error que detendrá la ejecución. No se debe envolver este error en un `try/catch` silencioso que permita continuar la operación en modo "degradado". El sistema debe fallar para proteger la integridad de los datos.

## 2. PATRÓN DE REPOSITORIO (ADAPTER PATTERN)

Para permitir el cambio fácil de proveedores de base de datos (ej. migrar de Firebase a Supabase o AWS), el código de la UI (`components/*`) NUNCA debe acceder directamente a `localStorage`, `indexedDB` o `firestore`.

*   **Estructura Obligatoria en Servicios:**
    1.  Definir una **Interfaz** (ej: `IPayrollRepository`).
    2.  Implementar un **Adaptador Local** (ej: `LocalStorageAdapter`).
    3.  Implementar un **Adaptador Cloud** (ej: `FirebaseAdapter`).
    4.  Usar una **Factory** al final del archivo para exportar la instancia correcta basada en `DB_PROVIDER`.

## 3. CENTRALIZACIÓN DE CONFIGURACIÓN

*   **Archivo:** `services/config.ts`
*   **Regla:** Toda configuración de infraestructura (API Keys, URLs de base de datos, flags de características) debe residir aquí.
*   **Cambio de Proveedor:** Cambiar `DB_PROVIDER` en este archivo debe ser la única acción necesaria para cambiar toda la persistencia de la aplicación.

## 4. LISTA DE SERVICIOS CRÍTICOS

Cualquier cambio en la lógica de negocio debe actualizar los siguientes archivos respetando las reglas anteriores:

1.  **Chronos (Archivos/Voz):** `services/storageService.ts`
2.  **Nómina (Finanzas):** `services/payrollService.ts`
3.  **Ingresos (Proyectos):** `services/revenueService.ts`

## 5. MANEJO DE ERRORES VISUALES

El componente `ConnectionBlocker` en `App.tsx` es el responsable global de la UI cuando `validateConnectivity()` falla. No elimine ni modifique este componente a menos que sea para mejorar la detección de desconexión.
