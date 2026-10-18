# Workflow & Development Guide

Este documento dicta cómo debe organizarse, compilarse y testearse la extensión localmente.

## 1. Arquitectura de la Extensión
La herramienta está estructurada pura y netamente para Manifest V3. El flujo de información ideal de desarrollo será:
- `manifest.json`: Punto de entrada que define qué permisos (`storage`, `activeTab`) y en qué URLs se ejecuta el content script.
- `background.js`: Service worker. Duerme la mayor parte del tiempo, se despierta para atender el click en el ícono del navegador y rutear el mensaje a la pestaña activa para mostrar/esconder el panel lateral.
- `envato-shared.js`: Helpers compartidos para detección de hosts Envato, parsing estable de `itemId`, naming de marketplace y compatibilidad de settings.
- `marketplace-init.js`: Bootstrap liviano que corre en `document_start` para reflejar cuanto antes el estado de `Hide Ads` sobre `<html>`. Usa `chrome.storage` como fuente de verdad y un mirror por host en `localStorage` para reducir el flicker del primer paint.
- `marketplace-overrides.css`: Reglas declarativas tempranas para colapsar anuncios soportados de Envato sin depender de una inyección tardía. Hoy cubre promos de header/footer, bloques de hosting/downloads, sidebars compartidos de browse y `top-sellers`, y promos de cuenta/descargas.
- `content.js`: Se inyecta en la(s) web(s) vía permisos expandidos (`<all_urls>`).
   - Posee guardias (`window !== window.top`) para no inyectarse en iframes secundarios nativos de la págia destino y generar inyecciones duplicadas.
   - Lee el DOM nativo en la red Envato para guardar la "Preview Activa" en la memoria de la extensión (`chrome.storage.local`).
   - Navega proactivamente fuera de Envato hacia el enlace final.
   - Usa el `itemId` numérico de Envato como clave estable al reconciliar metadata entre `/item`, `/reviews`, `/comments` y `/support`.
   - Expone metadata adicional del producto (`author`, `category`, `livePreviewUrl`) para alimentar la tarjeta compacta del sidepanel.
   - Analiza el historial local en su próxima ejecución limpia dentro del sitio destino y si encuentra metadata fresca (menos de 2 horas), renderiza estéticamente el **Floating Widget**.
- `removed-items.js`: Encapsula la lógica de `Hide Removed Items` para mantener separado el tratamiento de descargas inactivas del resto del flujo preview/widget.
- `sidepanel.html / css / js`: Se encarga exclusivamente de la UI del panel, los toggles de configuración y de pedir a `content.js` que le informe sobre el estatus del entorno.
   - Renderiza una tarjeta de producto compacta con precio, rating, ventas, última actualización y CTA a Live Preview.
   - Mantiene `Status` como superficie editorial/contextual.
   - Usa `Admin` como centro de orquestación de mejoras y toggles principales.
   - Abre una sub-vista `Settings` desde un botón de tuerca ubicado al bottom de `Admin`, reservando allí superficies secundarias como `About` y `Support`.
- `assets/`: Carpeta de assets del panel/UI separada en `fonts/`, `images/` e `icons/`.
- `image-cache.js`: Gestiona el caché local de imágenes en `IndexedDB` para evitar inflar `chrome.storage.local`.
- `.env.local.example`: Referencia de nombres `ENVATO_TEST_USERNAME` y `ENVATO_TEST_PASSWORD`; CI los recibe desde el entorno protegido. El runner no carga archivos .env.
- `scripts/playwright.extension.config.cjs` + `scripts/extension-smoke.spec.cjs`: smoke runner local de la extensión usando Playwright y un perfil persistente reutilizable.

## 2. Pruebas y Desarrollo Local

Dado el entorno de las Extensiones de Chrome, no hay un `npm run dev` nativo o live server funcional directo en la web inyectada. Sigue este ciclo:

1. Modifica o crea el código necesario.
2. Ve a la vista de plugins: `chrome://extensions/`.
3. Activa el **Modo Desarrollador**.
4. Dale a **Cargar extensión sin empaquetar (Load unpacked)** y apunta a `envato-xperience`.
5. **Si modificaste `content.js`, `manifest.json` o `background.js`**: Debes presionar obligatoriamente el ícono de Rellenar / Recargar (la flecha circular en tu tarjetón de extensión en Chrome) y **después refrescar obligatoriamente la pestaña** web (ThemeForest) donde estabas inyectando la prueba.
6. **Si modificaste `sidepanel.html / css / js`, `assets/` o `image-cache.js`**: Las modificaciones en el panel visual suelen reflejarse cerrando y volviendo a abrir el panel flotante, pero si no se da el caso, aplica el paso 5 de todas maneras.
7. **Si modificaste `marketplace-init.js` o `marketplace-overrides.css`**: Recarga la extensión y refresca la pestaña completa. Son assets que corren en `document_start`, así que no basta con cerrar y abrir el panel.
   - Si el problema es de header/banner, inspecciona primero si el nodo objetivo es realmente un spacer. En ThemeForest ya se comprobó que `bannerPlaceholder` también puede envolver el desktop header, así que no debe colapsarse con `height: 0`.
8. Valida siempre al menos dos superficies:
   - una página preview de Envato
   - una sub-vista de producto (`reviews`, `comments` o `support`) para confirmar continuidad de metadata e imagen
   - una página de browse/categoría para confirmar que el panel muestre un estado contextual y no un loading muerto
   - una página con promos soportadas para confirmar que `Hide Ads` no deja huecos ni flicker visible
9. Para validar descargas autenticadas, usar el workflow manual protegido descrito en `AUTHENTICATED_SMOKE.md`. El smoke general no carga `.env.local`. Nunca trackear credenciales, cookies ni perfiles en Git.
10. Si quieres un smoke repetible de la extensión completa, usa:
   ```bash
   npm install
   npm run smoke:extension
   ```
   - El perfil persistente por defecto vive en `.playwright/chrome-extension-dev`.
   - Si ya tienes un perfil de desarrollo con sesión iniciada, reutilízalo con `PLAYWRIGHT_EXTENSION_PROFILE_DIR=/ruta/al/perfil`.
   - Si ese perfil pertenece al Chrome principal que está abierto, el smoke no podrá relanzarlo mientras el `user data dir` raíz siga bloqueado por `SingletonLock`.
   - El smoke de cuenta intenta llegar a `Downloads` por URL directa y, si hace falta, navega por el popover del usuario como lo hace un usuario real.

## 3. Directriz de Integración
Cualquier nueva función o corrección de bugs debe revisarse validando que ambas interacciones principales funcionen:
1. El switch por defecto (Auto-Remove): Redirige la ventana destrozando el wrapper de Envato.
2. El modo visual (Floating Widget): Limpia estilos y ancla el panel flotante.
3. La continuidad de datos: el sidepanel debe seguir mostrando el mismo producto correcto aunque cambie la sub-ruta de Envato.
4. La supresión temprana de promos: `Hide Ads` debe entrar antes del paint y no depender de un parche tardío en `content.js`.
5. El flujo de `Hide Removed Items`: la transformación de descargas inactivas debe seguir siendo segura, reversible visualmente y aislada del resto del content script.
6. El smoke automation: el bridge de testing en `content.js` solo debe abrir/cerrar el panel y exponer estado mínimo. No convertirlo en una API paralela de negocio.
No rompas un modo para arreglar otro.

## 4. Metodología Segura de Iteración
Para evitar colapsos de contexto durante sesiones largas, cada iteración debe dejar rastro técnico mínimo en el repo y en la conversación:

1. **Snapshot técnico breve**:
   - Registrar qué archivos cambiaron.
   - Registrar qué comportamiento se esperaba ajustar.
   - Registrar qué validaciones se ejecutaron (`node --check`, recarga manual, smoke visual, etc.).

2. **Log de iteración**:
   - Añadir una entrada corta en `docs/ITERATIONLOG.md` cuando la iteración cambie comportamiento, arquitectura, scraping, UX visible o flujo de publicación.
   - La entrada debe capturar: fecha, objetivo, archivos tocados, validación y riesgos pendientes.

3. **Actualización de docs vivas**:
   - Si cambia arquitectura, flujo de carga, storage, compliance, UX principal o naming, actualizar en la misma iteración el documento correspondiente (`WORKFLOW`, `COMPLIANCE`, `ROADMAP`, `README`, etc.).
   - No dejar documentación estructural para "después".

4. **Cierre obligatorio de iteración**:
   - Resumir qué quedó hecho.
   - Declarar explícitamente qué no se validó todavía.
   - Sugerir explícitamente el siguiente paso lógico inmediato, aunque el usuario no lo pida.

5. **Artefactos temporales**:
   - Si se usan snapshots visuales, logs o resultados de smoke, deben conservarse solo mientras aporten valor a la iteración.
   - No acumular basura temporal en el repo.

## 5. Regresiones deterministas

Ejecutar `npm test` para límites de dominio, ciclo de observadores y respuestas fuera de orden. Ejecutar `npm run test:extension:regression` para navegación automática/manual, widget, continuidad de metadata y toggle de Removed Items en Chromium con fixtures locales y perfil temporal aislado. Estas pruebas no sustituyen el smoke autenticado contra Envato real.

## 6. Versionado SemVer

La fuente es `package.json`; usar `npm run release:patch`, `release:minor` o `release:major` según corrección compatible, nueva funcionalidad compatible o cambio incompatible. El hook npm `version` sincroniza el manifiesto; npm mantiene el lockfile. About lee la versión del manifiesto en runtime. No editar versiones a mano ni repetir el literal en HTML.

Los comandos no crean commits ni tags. Revisar cambios, ejecutar `npm test` y regresiones de extensión, hacer commit en la rama funcional, integrar a `develop` y finalmente a `main`. CI valida coherencia y formato estable X.Y.Z compatible con Chrome.

## 7. Smoke autenticado protegido

El smoke general ya no carga `.env.local` ni ejecuta descargas autenticadas. Usar únicamente el workflow manual `Private authenticated smoke` sobre main y el entorno protegido `envato-auth-smoke`. Cargar credenciales de una cuenta de pruebas directamente como environment secrets en GitHub. Ver `AUTHENTICATED_SMOKE.md`; no publicar capturas, perfiles ni diagnósticos del login.

## 8. Repositorio público y pull requests

`develop` es la rama por defecto y recibe los PRs funcionales. `main` recibe integraciones revisadas desde develop. Todos los PRs se asignan a mvuljevas; el workflow de metadata añade labels por área sin quitar labels manuales. Usa pull_request_target únicamente para la API de GitHub y nunca hace checkout ni ejecuta código del PR. Las ramas auxiliares integradas se eliminan; main y develop se conservan. El README es para usuarios finales, la documentación de desarrollo vive en DEVELOPMENT.md y el ZIP de tienda se genera por allowlist.
