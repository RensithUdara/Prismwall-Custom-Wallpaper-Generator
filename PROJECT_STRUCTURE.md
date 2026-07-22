# Prismwall Studio Project Structure

```text
prismwall-studio/
  index.html                 Public portfolio landing page
  assets/
    brand/                   Source app icon and web favicon
    images/                  Portfolio preview images
    downloads/               Public desktop app downloads
  dist/                      Tauri/web app bundle
    index.html               App landing page
    generator/               Functional wallpaper generator
    wallpaper/               Wallpaper detail and export viewer
    images/                  Packaged preview images
    downloads/               Packaged desktop app downloads
    js/
      engine.js              ES module wallpaper drawing engine
      engine.global.js       File/Tauri-safe global engine build
      generator.js           ES module generator controller
      generator.global.js    File/Tauri-safe generator controller
      wallpapers.js          Wallpaper preset catalog
      home.js                App landing gallery controller
      detail.js              Wallpaper detail viewer controller
    styles.css               Shared app styles
  src-tauri/                 Tauri desktop shell and native commands
  package.json               Project scripts and Tauri CLI dependency
```

Main entry points:

- Public portfolio: `index.html`
- Packaged app landing: `dist/index.html`
- Wallpaper generator: `dist/generator/index.html`
- Old generator path: `dist/create/index.html` redirects to `dist/generator/index.html`
