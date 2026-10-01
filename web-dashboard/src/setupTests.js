// Minimal test setup to ensure a DOM-like environment and stub common browser APIs
// This file is loaded by Vitest before running tests (configured in vite.config.js).

// Ensure window/document exist (Vitest + jsdom sets them, but be defensive)
if (typeof globalThis.window === 'undefined') globalThis.window = {};
if (typeof globalThis.document === 'undefined') globalThis.document = {};

// Provide a basic matchMedia stub to avoid warnings from some libraries
if (typeof window.matchMedia === 'undefined') {
  window.matchMedia = function () {
    return { matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {} };
  };
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Prevent leaflet from failing if it examines userAgent or other navigator props
if (typeof window.navigator === 'undefined') {
  window.navigator = { userAgent: 'node' };
}

// Some components import Leaflet's CSS. In tests, importing css can be ignored; Vitest / Vite handles css imports.

// No mocks of modules are placed here; switching to jsdom ensures leaflet can be imported safely during test collection.
