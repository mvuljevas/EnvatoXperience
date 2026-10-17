# Iteration Log

Registro corto de cambios relevantes para evitar pérdida de contexto entre sesiones largas.

## Template

### YYYY-MM-DD - Título corto
- Objetivo:
- Archivos:
- Validación:
- Riesgos pendientes:
- Próximo paso lógico:

## Entries
### 2026-03-20 - Custom CSS Tooltips for Action Buttons
- Objetivo: reemplazar los tooltips genéricos nativos del sistema operativo (basados en el atributo HTML `title`) por elegantes pop-ups descriptivos puramente CSS y unificados con la UI de Envato.
- Archivos: `content.js` y `marketplace-overrides.css`.
- Cambios: En `content.js` destituimos la propiedad `title` de todos los botones para evitar superposiciones con el SO, envolviendo cada botón en un contenedor `.ex-action-wrapper` junto a una sub-caja `.ex-text-tooltip` con la descripción respectiva ("Download Licence TXT", "Item Info", "Toggle Original Item", etc). En `marketplace-overrides.css` definimos estas cajas ocultas flotantes en la parte inferior de los iconos (`translateY` para efecto pop-up) reaccionando al estado `:hover`, consolidando una estética moderna, responsiva, nítida y unánime en vez de la disparidad propia de los tooltips de Chrome/Safari.

### 2026-03-20 - Removed Items (Hover JIT Image extraction & Text fallback)
- Objetivo: solucionar que algunos ítems se quedaban en el Placeholder por el "lazy loading" asíncrono de Envato Market, y resolver el fallo en la detección del botón de descarga de la licencia.
- Archivos: `content.js`.
- Cambios: En `content.js` cambiamos definitivamente la técnica de búsqueda de licencias de una heurística `a.href.includes(...)` a una de interfaz humana directa interrogando `a.textContent`, logrando encontrar siempre el escurridizo botón sin importar el routing del backend de Envato. Respecto a la Preview estancada (scrapping agresivo), hemos incorporado un detector Just-In-Time acoplado al `mouseenter` del botón de Info (`.ex-btn-info`), cuya misión es re-interrogar al DOM entero si al momento de hacer el *hover* la imagen original seguía siendo el SVG 'placeholder'. Si Envato hidrató la imagen asíncronamente después del parseo inicial, el script la inyectará y la persistirá localmente en caché.

### 2026-03-20 - Removed Items UI (Download Button)
- Objetivo: incluir un botón adicional para descargar la licencia del ítem removido directamente desde la barra inyectada, con estados habilitado/deshabilitado y tooltips informativos.
- Archivos: `content.js`, `marketplace-overrides.css`.
- Cambios: En `content.js` se agregó un bucle sobre todas las anclas (`<a>`) originales de la fila para extraer el hipervínculo que contenga `license_certificate`. Si existe, se inyecta un nuevo botón `<a class="ex-btn-download">` con ícono de descarga y tooltip `"Download Licence TXT"`. Si el autor eliminó los respaldos, se inyecta estructuralmente deshabilitado (`button disabled`) con clase `.ex-disabled` indicando `"Download Not Available"`.

### 2026-03-20 - Emergency Hotfix: Variable JS Crash y UI Copy
- Objetivo: solucionar una excepción silenciada en runtime por una variable no definida en `content.js` que abortaba la hidratación del `MutationObserver`, y actualizar copy de opciones.
- Archivos: `content.js`, `sidepanel.html`.
- Cambios: En `content.js` se reparó y consolidó formalmente el bloque iterativo de `querySelectorAll` definiendo correctamente la variable `finalSrcToUse`, ya que el parche rápido anterior omitió el bloque declarativo y provocaba un `ReferenceError`, deteniendo en seco el script antes de que llegara a crear `.envato-xperience-removed-bar` y `.ex-original-content`. Por ello es que los ítems quedaban expuestos a las reglas CSS sin una correcta jerarquía de contención, desapareciendo el `padding` y viéndose "rotos". Ahora el script procesa fluidamente cada bloque y crea la barra. En `sidepanel.html` hemos modificado la etiqueta literal de "Hide Deprecated Items" a "Hide Removed Items" para un sentido semántico más exacto.

### 2026-03-20 - Hide Deprecated Items (Precisión UI e Integración IndexedDB, Animaciones)
- Objetivo: solucionar tooltip imagen fallida asociando con ItemID, uso de IndexedDB, cambio dinámico de icono, arreglar cutoff en márgenes, y animar el expand/collapse sin clipping.
- Archivos: `manifest.json`, `content.js`, `marketplace-overrides.css`.
- Cambios: En `content.js`, simplificamos radicalmente la extracción de la imagen apuntando al layout exacto y consistente `.download__thumbnail .item-thumbnail__image a img` como primera opción. Como Envato despoja a los items eliminados de su jerarquía CSS normal de *thumbnails*, se añadió un fallback infalible de último recurso: `li.querySelectorAll('img')` escaneando e iterando sobre TODAS las imágenes de la fila hasta encontrar una que devuelva un `src` o `data-src` válido, ignorando placeholders en base64. Si eso falla, un bloque final busca cualquier elemento en la fila con `data-preview-url`. Esto asegura el 100% de tolerancia frente a mutaciones del DOM. Dejamos de usar `cloneNode` para la imagen extraída y pasamos a crear un `<img>` puro inyectando explícitamente el `src` (esto evita heredar clases de 'lazy loading' nativas de Envato que rompían el render del popover en ocasiones limitadas). Se inyectó el script principal `image-cache.js` a `content_scripts` en el manifest para servir la imagen utilizando IndexedDB caché. Cambiada heurística visual de _Toggle_, el botón `expand/collapse` cicla `SVG` (feather icon). En `marketplace-overrides.css` se removió la antigua regla invasiva `display: none !important` que escondía los contenedores y entraba en conflicto paralizando la UI, permitiendo ahora que sea la propiedad `max-height: 0` la que oculta elegante y animadamente el contenido antiguo mientras se fuerza un `display: flex !important` en nuestra barra inyectada de reemplazo para evitar que los elementos desaparezcan de la vista al oprimir el *Toggle*.

### 2026-03-20 - Hide Deprecated Items (UX Interactiva)
- Objetivo: refinar la barra de elementos removidos a la estética premium (Live Preview).
- Archivos: `content.js`, `marketplace-overrides.css`.
- Cambios: Fondo `#EDEDED` de barra principal; iconos idénticos a Live Preview con border-radius 4px; border-bottom habilitado en modo colapso; reemplazo de icono destacado por icono cuadrado en tooltip; botones completamente estructurados.
- Validación: `npm run smoke:extension`.

### 2026-03-20 - Hide Deprecated Items (Bugfix & CSS puro)
- Objetivo: agregar toggle "Hide Deprecated Items" en "Enhance UI".
- Problema solucionado: corrección de un bug en el event listener de `sidepanel.js` que no almacenaba el estado.
- Archivos: `envato-shared.js`, `sidepanel.html`, `sidepanel.js`, `marketplace-init.js`, `marketplace-overrides.css`.

### 2026-03-20 - Enhance UI en Settings
- Objetivo: agregar una sección específica 'Enhance UI' en la pestaña de Settings para aislar 'Hide Ads' de los controles generales.
- Archivos: `sidepanel.html`.
- Validación: ejecución exitosa del ambiente `npm run smoke:extension`.
- Riesgos pendientes: confirmar visualmente el espaciado de la nueva sección en la tarjeta del panel lateral.
- Próximo paso lógico: consultar al usuario si desea añadir nuevas opciones específicas en esta nueva sección.

### 2026-03-19 - Sidepanel compacto y Hide Ads temprano
- Objetivo: acercar la tarjeta del sidepanel al patrón compacto de Envato y reducir flicker al ocultar promos con `document_start`.
- Archivos: `content.js`, `content.css`, `manifest.json`, `marketplace-init.js`, `marketplace-overrides.css`, `sidepanel.html`, `sidepanel.css`, `sidepanel.js`.
- Validación: `python3 -m json.tool manifest.json`; `node --check marketplace-init.js`; `node --check content.js`; `node --check sidepanel.js`; recarga manual de la extensión requerida para validar visualmente.
- Riesgos pendientes: revisar visualmente selectores de promos si Envato cambia clases; afinar estilos del panel según referencias de UI.
- Próximo paso lógico: seguir iterando ajustes visuales finos del sidepanel antes de abrir la sección de `Support`.

### 2026-03-19 - Nuevos ads de hosting partner
- Objetivo: ampliar `Hide Ads` para cubrir bloques promocionales de hosting y descarga inmediata detectados en sidebars de páginas de producto.
- Archivos: `marketplace-overrides.css`.
- Validación: revisión de selectores DOM reportados en captura; requiere recarga manual de la extensión y de la página para confirmar supresión temprana.
- Riesgos pendientes: Envato puede renombrar estas clases; falta smoke visual posterior a recarga.
- Próximo paso lógico: verificar visualmente que no quede hueco lateral y continuar con el siguiente bloque promocional que aparezca.

### 2026-03-19 - Colapso de sidebar promocional
- Objetivo: ocultar el `sidebar-right` completo cuando solo aporta promociones y recuperar ancho para el contenedor principal de items; además ocultar promos inline de downloads.
- Archivos: `marketplace-overrides.css`.
- Validación: ajuste basado en clases observadas en capturas (`sidebar-s sidebar-right`, `download__promotions`); requiere recarga completa para confirmar que no rompa layouts de cuenta o downloads.
- Riesgos pendientes: el ensanchamiento conservador de `.content-l`, `.content-r` y `.content-main` puede necesitar ajuste fino en vistas menos comunes.
- Próximo paso lógico: smoke visual en páginas de downloads/cuenta y, si el layout queda estable, seguir cerrando anuncios residuales por selector específico.

### 2026-03-19 - Consolidación de helpers compartidos
- Objetivo: reducir duplicación entre `marketplace-init.js`, `content.js` y `sidepanel.js` centralizando hosts Envato, parsing de `itemId` y compatibilidad del setting `Hide Ads`.
- Archivos: `envato-shared.js`, `manifest.json`, `marketplace-init.js`, `content.js`, `sidepanel.js`, `sidepanel.css`, `background.js`, `README.md`, `docs/WORKFLOW.md`, `docs/COMPLIANCE.md`.
- Validación: `python3 -m json.tool manifest.json`; `node --check envato-shared.js`; `node --check marketplace-init.js`; `node --check content.js`; `node --check sidepanel.js`; `node --check background.js`.
- Riesgos pendientes: falta smoke visual tras recargar la extensión; permanece un asset binario viejo no referenciado que no se pudo borrar automáticamente por política del entorno.
- Próximo paso lógico: hacer smoke manual de `Hide Ads` y del sidepanel para confirmar que la consolidación no alteró comportamiento observable.

### 2026-03-19 - Ensanche de downloads sin sidebar
- Objetivo: remover el ancho fijo residual de `.content-l` en layouts de downloads/cuenta cuando `Hide Ads` ya colapsó el sidebar derecho.
- Archivos: `marketplace-overrides.css`.
- Validación: ajuste basado en DOM inspeccionado (`.fixed-layout .content-l { width: 766px; }`); requiere recarga completa para confirmar expansión real del contenedor principal.
- Riesgos pendientes: puede existir otra restricción puntual más abajo en la jerarquía si alguna subvista mantiene widths internos adicionales.
- Próximo paso lógico: recargar extensión y página de downloads para confirmar que el listado ocupe el ancho recuperado; si no, seguir bajando por la jerarquía del layout.

### 2026-03-19 - Preparación de credenciales locales para Playwright
- Objetivo: habilitar debugging autenticado del DOM real de Envato sin trackear credenciales en git.
- Archivos: `.env.local`, `.env.local.example`.
- Validación: `.env.local` sigue ignorado por `.gitignore`; `.env.local.example` queda trackeado como plantilla.
- Riesgos pendientes: falta cargar credenciales de prueba para ejecutar el flujo autenticado con Playwright.
- Próximo paso lógico: completar `.env.local` y continuar con inspección autenticada de `Downloads`.

### 2026-03-19 - DOM autenticado de Downloads y corrección del selector raíz
- Objetivo: validar el árbol real de `Downloads` autenticado y corregir el override que debía expandir `content-l` al ocultar el sidebar promocional.
- Archivos: `marketplace-overrides.css`, `.env.local.example`.
- Validación: inspección autenticada con Playwright; `fixed-layout` confirmado en `<html>`; `#content > .grid-container.h-mb3 > div` confirmado con hijos `.content-l` y `.sidebar-s.sidebar-right`; simulación manual con CSS corregido expandiendo `content-l` a `1004px` y colapsando el sidebar a `0px`.
- Riesgos pendientes: falta comprobar el navegador del usuario con la extensión recargada para confirmar que el flag `data-envato-hide-ads=\"true\"` está presente y la hoja nueva quedó cargada.
- Próximo paso lógico: recargar la extensión en Chrome y confirmar en DevTools que la regla ya aparece bajo `html.fixed-layout[data-envato-hide-ads=\"true\"]`.

### 2026-03-19 - Top Sellers y promos compartidas
- Objetivo: ampliar `Hide Ads` para cubrir el sidebar compartido de `Featured Authors` y el bloque promocional `shared-elements-search_block_component__root` detectados en `top-sellers` de varios marketplaces.
- Archivos: `marketplace-overrides.css`.
- Validación: inspección en vivo con Playwright sobre `themeforest.net/top-sellers` y `3docean.net/top-sellers`; patrón confirmado con `.shared-items_grid_with_sidebar_component__sidebar` y `.shared-items_grid_with_sidebar_component__itemsGrid`.
- Riesgos pendientes: `graphicriver.net` respondió con challenge de Cloudflare en Playwright, así que queda por validar manualmente en navegador real aunque el patrón parece compartido entre marketplaces.
- Próximo paso lógico: recargar la extensión y revisar `top-sellers` en Chrome para confirmar que desaparecen el sidebar y el bloque promo sin romper el grid principal.

### 2026-03-19 - Smoke automation estándar para extensiones
- Objetivo: estandarizar un smoke runner local para la extensión usando Playwright, perfil persistente reutilizable y un bridge mínimo para abrir el panel sin depender del icono del navegador.
- Archivos: `package.json`, `package-lock.json`, `.gitignore`, `.env.local.example`, `scripts/playwright.extension.config.cjs`, `scripts/extension-smoke.spec.cjs`, `content.js`, `README.md`, `docs/WORKFLOW.md`.
- Validación: `npm install`; `npx playwright install chromium`; `node --check content.js`; `node --check scripts/playwright.extension.config.cjs`; `node --check scripts/extension-smoke.spec.cjs`; `npm run smoke:extension` con 2/3 casos pasando (`item page panel`, `top-sellers hide ads`) y el caso autenticado de `downloads` quedando acotado a sesión/layout de cuenta.
- Riesgos pendientes: el smoke autenticado depende de sesión válida o de credenciales funcionales en `/.env.local`; si se quiere reutilizar un perfil ya abierto de Chrome, falta pasar su ruta real por `PLAYWRIGHT_EXTENSION_PROFILE_DIR`.
- Próximo paso lógico: decidir si el smoke de cuenta debe reutilizar el perfil de desarrollo existente o seguir con login automático hasta estabilizar `Downloads`.

### 2026-03-19 - Smoke automation estabilizado
- Objetivo: cerrar el smoke autenticado de `Downloads` con login automático fiable y fallback de navegación real vía popover del usuario.
- Archivos: `scripts/extension-smoke.spec.cjs`, `README.md`, `docs/WORKFLOW.md`.
- Validación: `node --check scripts/extension-smoke.spec.cjs`; `npm run smoke:extension` con `3 passed`; validación explícita de `item page`, `top-sellers`, y `downloads` autenticado.
- Riesgos pendientes: no se puede reutilizar un perfil real de Chrome mientras el `user data dir` global siga bloqueado por otra instancia; para attach real hace falta `--remote-debugging-port`.
- Próximo paso lógico: commitear este bloque y dejar el smoke como baseline para futuras iteraciones funcionales.

### 2026-03-19 - Corrección del placeholder del header
- Objetivo: revertir el colapso agresivo del nodo `bannerPlaceholder` tras comprobar que en ThemeForest también actúa como contenedor del desktop header.
- Archivos: `marketplace-init.js`, `marketplace-overrides.css`, `README.md`, `docs/WORKFLOW.md`.
- Validación: inspección de DOM/computed styles con Playwright; el nodo `.shared-global_header-global_header_component__bannerPlaceholder` apareció con clases `desktopHeader bannerPlaceholder`; `node --check marketplace-init.js`; `npm run smoke:extension` con `3 passed`; requiere confirmar visualmente tras recargar la extensión.
- Riesgos pendientes: si vuelve a quedar espacio residual en alguna vista, habrá que encontrar el nodo espaciador exacto en esa variante, sin tocar el contenedor del header.
- Próximo paso lógico: hard refresh en una home/category con `Hide Ads` activo y revisar si desaparece el gap sin ocultar el header; si persiste, capturar el selector exacto del spacer residual.

### 2026-03-19 - Support card en Settings
- Objetivo: añadir una superficie discreta de funding dentro de `Settings` con copy breve y CTA visual estilo GitHub Sponsors.
- Archivos: `sidepanel.html`, `sidepanel.css`, `README.md`.
- Validación: requiere recarga de la extensión y comprobación visual del layout del botón dentro de la pestaña `Settings`.
- Riesgos pendientes: afinar copy o añadir más métodos de apoyo sin saturar visualmente el panel.
- Próximo paso lógico: validar la proporción visual del botón y, si el tono te convence, extender luego la sección a PayPal o Buy Me a Coffee.

### 2026-03-19 - Segundo CTA de Support
- Objetivo: ampliar la card de funding con un segundo botón de PayPal manteniendo el mismo patrón visual del CTA principal.
- Archivos: `sidepanel.html`, `sidepanel.css`.
- Validación: requiere recarga de la extensión y comprobación visual del alineado de ambos botones en `Settings`.
- Riesgos pendientes: revisar comportamiento responsive si luego se agregan más métodos de apoyo en la misma fila.
- Próximo paso lógico: validar visualmente la pareja `Sponsor` + `PayPal` y decidir si el siguiente método entra en una segunda fila o en un selector más compacto.

### 2026-03-19 - Tercer CTA de Support
- Objetivo: completar la fila de funding con un tercer botón para Buy Me a Coffee entre GitHub Sponsors y PayPal.
- Archivos: `sidepanel.html`, `sidepanel.css`.
- Validación: requiere recarga de la extensión y comprobación visual del reparto horizontal de los tres botones en `Settings`.
- Riesgos pendientes: con tres CTAs la fila queda más densa; puede requerir segunda fila o labels más cortos si el ancho útil no alcanza.
- Próximo paso lógico: validar visualmente la fila de tres botones y decidir si conviene mantenerla así o pasar a un layout de dos filas.

### 2026-03-19 - Copy humano e iconos de Support
- Objetivo: hacer el mensaje de funding más honesto y natural, dejando claro que se están construyendo varias herramientas al mismo tiempo, y reforzar la visibilidad de los iconos de los CTAs.
- Archivos: `sidepanel.html`, `sidepanel.css`.
- Validación: requiere recarga de la extensión y comprobación visual del texto y del icono de GitHub Sponsors dentro de `Settings`.
- Riesgos pendientes: si el copy se siente todavía demasiado largo para el ancho del panel, habrá que compactarlo una vuelta más sin perder humanidad.
- Próximo paso lógico: revisar visualmente la card y, si el texto se siente bien, documentar luego la sección `Support` de forma más formal en `README` o `WORKFLOW`.

### 2026-03-19 - Support layout en stack
- Objetivo: mejorar la legibilidad de los iconos y repartir mejor el ancho de los CTAs, dejando `Sponsor` arriba y `Coffee` + `PayPal` debajo.
- Archivos: `sidepanel.html`, `sidepanel.css`.
- Validación: requiere recarga de la extensión y comprobación visual del nuevo stack y de los iconos refinados.
- Riesgos pendientes: si el botón superior sigue viéndose demasiado pesado, habrá que bajar un poco su altura o ajustar el peso del label.
- Próximo paso lógico: validar visualmente el nuevo stack y, si queda bien, ya recién entonces commitear el bloque completo de `Support`.

### 2026-03-19 - Carpeta dedicada para iconos UI
- Objetivo: separar los iconos SVG del sidepanel en una subcarpeta dedicada para escalar mejor la UI sin reestructurar todo el repo a un árbol `assets/` completo.
- Archivos: `images/icons/*`, `sidepanel.html`, `README.md`.
- Validación: requiere recarga de la extensión y comprobación visual de que los tres CTAs sigan resolviendo sus assets correctamente.
- Riesgos pendientes: si más adelante el volumen de assets crece mucho, puede convenir una reestructura mayor; por ahora `images/icons/` mantiene el cambio incremental y limpio.
- Próximo paso lógico: si esta organización te convence, seguir el mismo patrón para futuros SVG del panel.

### 2026-03-19 - Reestructura controlada de assets UI
- Objetivo: mover fonts, imágenes y SVGs del panel a un árbol `assets/` para escalar la UI sin tocar los iconos específicos del manifest.
- Archivos: `assets/fonts/*`, `assets/images/*`, `assets/icons/*`, `manifest.json`, `sidepanel.html`, `sidepanel.css`, `README.md`, `docs/WORKFLOW.md`.
- Validación: requiere recarga de la extensión y comprobación visual de logos, estado `Outside Envato` y CTAs de `Support`; el smoke debe seguir verde.
- Riesgos pendientes: quedan carpetas legacy vacías por limpiar (`fonts/`, `images/`) si ya no contienen nada útil.
- Próximo paso lógico: validar que el árbol nuevo funcione y luego limpiar las carpetas legacy vacías para dejar el repo coherente.

### 2026-03-20 - Admin view, safe Removed Items rendering, and nomenclature cleanup
- Objetivo: alinear el producto con su identidad actual como enhancer, sintetizar los toggles clave en `Status`, mover la orquestación ampliada a `Admin`, y sacar deuda estructural/obsoleta del repo.
- Archivos: `manifest.json`, `content.js`, `removed-items.js`, `sidepanel.html`, `sidepanel.css`, `sidepanel.js`, `image-cache.js`, `README.md`, `docs/WORKFLOW.md`, `docs/COMPLIANCE.md`, `docs/ROADMAP.md`, `docs/IMAGECACHE.md`, `docs/AGENTSINSTRUCTIONS.md`.
- Cambios: se separó `Hide Removed Items` a `removed-items.js`; se eliminó el uso riesgoso de `innerHTML` para esa superficie construyendo la UI con DOM APIs; se removieron scripts ad hoc ya obsoletos (`fix_image.js`, `update_script.js`); el panel pasó de `Status/Settings` a `Status/Admin`, añadiendo quick controls para `Auto Remove`, `Floating Widget`, `Hide Removed Items` y `Hide Ads`, y dejando `Admin` como superficie más preparada para futuras opciones de experiencia.
- Validación: `node --check` sobre los scripts principales; smoke baseline de Playwright sobre item page, top-sellers y downloads autenticado.
- Riesgos pendientes: el nuevo layout del panel requiere validación visual manual tras recargar la extensión; la superficie `Admin` está preparada para crecer, pero todavía no existe un segundo bloque de opciones más allá de `Core Experience` y `Enhance Envato`.
- Próximo paso lógico: recargar la extensión, revisar visualmente `Status/Admin`, y luego decidir la siguiente familia de enhancements que entrará en `Admin`.

### 2026-03-20 - Admin settings subview
- Objetivo: limpiar `Status`, dejar `Admin` más enfocado y empezar a estructurar una sub-vista real de configuración para opciones secundarias.
- Archivos: `sidepanel.html`, `sidepanel.css`, `sidepanel.js`, `README.md`, `docs/WORKFLOW.md`.
- Cambios: se removió `Quick Controls` de `Status`; `Admin` se consolidó como superficie principal de toggles; `About` y `Support` se movieron a una sub-vista `Settings` dentro de `Admin`.
- Validación: `node --check sidepanel.js`; `npm run smoke:extension` con `3 passed`.
- Riesgos pendientes: falta validación visual manual del layout final de `Admin` y de la transición hacia la sub-vista `Settings`.
- Próximo paso lógico: revisar el layout real y luego decidir si la siguiente familia de mejoras de `Admin` será `Enhance UI`, `Marketplace Utilities` o una organización por categorías más formal.

### 2026-03-20 - Bottom Settings trigger in Admin
- Objetivo: corregir la visibilidad del acceso a `Settings` dentro de `Admin` y dejar trazabilidad explícita del cierre de iteración.
- Archivos: `sidepanel.html`, `README.md`, `docs/WORKFLOW.md`, `docs/AGENTSINSTRUCTIONS.md`, `docs/ROADMAP.md`.
- Cambios: el botón de tuerca `Settings` se movió desde la sub-vista oculta hacia el bottom real de `Admin`; la documentación se actualizó para reflejar que `Status` es contextual, `Admin` concentra los toggles, y el acceso a `Settings` ocurre desde el borde inferior; además se reforzó la instrucción operativa de siempre proponer el siguiente paso lógico al cerrar una iteración.
- Validación: inspección de markup; `node --check sidepanel.js`.
- Riesgos pendientes: falta validación visual manual del botón en el panel recargado.
- Próximo paso lógico: recargar la extensión, confirmar visualmente el botón de `Settings` en `Admin`, y luego definir la primera familia concreta de opciones para `Enhance Envato`.

### 2026-05-09 - Naming docs: noframevato -> envato-xperience
- Objetivo: alinear la documentación con el nuevo nombre del producto y del repositorio.
- Archivos: `README.md`, `docs/WORKFLOW.md`.
- Cambios: se reemplazaron referencias documentales a `noframevato` por `envato-xperience` en la URL de clonación, la instrucción de `Load unpacked` y el árbol de estructura del proyecto.
- Validación: revisión directa de las referencias actualizadas.
- Riesgos pendientes: el path local del workspace puede seguir llamándose `noframevato` hasta que se renombre físicamente la carpeta en disco.
- Próximo paso lógico: decidir si el branding visible del producto debe unificarse también entre `XPerience` y `Xperience` en manifiesto, UI y documentación.

### 2026-10-16 - Simplify Support copy
- Objetivo: usar una invitación breve y neutral a colaborar.
- Archivos: `sidepanel.html`.
- Cambios: se reemplazó el texto sobre dificultades financieras por una invitación a apoyar este y otros proyectos.
- Validación: diff revisado; sin cambios de estructura o comportamiento.
- Pendiente: revisión visual del texto en Settings > Support tras reabrir el panel.

### 2026-10-16 - Ko-fi support link
- Objetivo: reemplazar Buy Me a Coffee por Ko-fi.
- Archivos: `sidepanel.html`, `sidepanel.css`, `assets/icons/`, `README.md`.
- Cambios: nuevo enlace a `https://ko-fi.com/mvuljevas`, SVG provisto por el autor con proporción horizontal y nombre accesible; se retiró el icono anterior.
- Validación: SVG parseado, copia verificada y diff sin errores de espacios.
- Pendiente: revisar visualmente Settings > Support al reabrir el panel.

### 2026-10-16 - PayPal support wordmark
- Objetivo: unificar la presentación de PayPal y Ko-fi.
- Archivos: `assets/icons/icon-paypal.svg`, `sidepanel.html`, `sidepanel.css`.
- Cambios: SVG de PayPal provisto por el autor, altura de 20px como Ko-fi y ancho proporcional; nombre accesible en la imagen y eliminación del texto duplicado.
- Validación: SVG parseado, proporciones y diff revisados.
- Pendiente: revisión visual en Settings > Support al reabrir el panel.

### 2026-10-17 - PayPal.me support URL
- Cambio: actualizado el enlace de PayPal en `sidepanel.html` a `https://www.paypal.com/paypalme/mvuljevas`.
- Validación: enlace del botón comprobado y diff sin errores de formato.
- Pendiente: comprobar la navegación desde el panel.

### 2026-10-17 - Exact domain boundaries
- Cambio: matching por hostname y límite de subdominio; widget limitado al hostname de destino exacto.
- Validación: regresiones Node para hosts reales, dominios parecidos, credenciales y rutas engañosas.

### 2026-10-17 - Downloads observer lifecycle
- Cambio: desconexión de observadores al desactivar Hide Removed Items y guardia contra callbacks pendientes.
- Validación: regresión Node de desactivación, espera de lista y reactivación. La restauración visual sigue a cargo del CSS existente.
