# Clinica Dr. Allan Leal

Sistema web de gestion medica para pacientes, historias clinicas, agenda, recordatorios y contenido para redes.

## Publicacion en GitHub Pages

Para que GitHub Pages muestre la pagina correctamente:

1. Sube estos archivos a la raiz del repositorio.
2. El archivo principal debe llamarse exactamente `index.html`.
3. Conserva las imagenes junto al HTML:
   - `ALLAN-logo (1).jpeg`
   - `ALLAN2 (1).jpeg`
4. No pegues el contenido HTML dentro de `README.md`; GitHub Pages necesita leer el archivo `index.html`.
5. Conserva las carpetas `css/` (estilos) y `js/` (código, un archivo por módulo). Si cambias alguno, sube el número `?v=` en `index.html` para que los navegadores carguen la versión nueva.

## Acceso

Los usuarios se crean en Firebase Authentication y necesitan un documento en Firestore > `usuarios` con su UID, `active: true` y su `role`.

## Cambios incluidos

- Correccion del archivo principal de `index.html.html` a `index.html`.
- Correccion de rutas de imagen de `.png` a `.jpeg`.
- Limpieza del README para evitar que GitHub Pages muestre codigo como texto.
- Pulido visual del login, navegacion, tarjetas, tablas, modales y vista movil.
- Correccion de HTML invalido en el bloque de login.
