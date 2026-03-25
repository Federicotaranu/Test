/**
 * main.js — Apple-style website entry point
 *
 * Responsibilities:
 *  - Import and initialize all feature modules
 *  - Guard against reduced-motion preference
 *  - Expose a lightweight module registry for later beads to hook into
 *
 * Module stubs are imported conditionally; actual implementations
 * are added by subsequent beads (nav.js, scroll-animations.js, etc.).
 */

'use strict';

/* =============================================
   Utilities
   ============================================= */

/**
 * Returns true if the user prefers reduced motion.
 * Used to gate animation initialization throughout the app.
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Lightweight event bus for cross-module communication.
 * Usage:
 *   bus.on('nav:scroll', handler)
 *   bus.emit('nav:scroll', { scrolled: true })
 */
export const bus = (() => {
  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();

  return {
    /**
     * Register a listener for an event.
     * @param {string} event
     * @param {Function} handler
     */
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
    },

    /**
     * Remove a listener.
     * @param {string} event
     * @param {Function} handler
     */
    off(event, handler) {
      listeners.get(event)?.delete(handler);
    },

    /**
     * Emit an event with optional data.
     * @param {string} event
     * @param {*} [data]
     */
    emit(event, data) {
      listeners.get(event)?.forEach((handler) => handler(data));
    },
  };
})();

/* =============================================
   Module registry
   Modules register themselves here so they can be
   accessed or re-initialized by other parts of the app.
   ============================================= */

/** @type {Map<string, { init: Function, destroy?: Function }>} */
const modules = new Map();

/**
 * Register a named module.
 * @param {string} name
 * @param {{ init: Function, destroy?: Function }} mod
 */
export function registerModule(name, mod) {
  modules.set(name, mod);
}

/**
 * Retrieve a registered module by name.
 * @param {string} name
 * @returns {{ init: Function, destroy?: Function } | undefined}
 */
export function getModule(name) {
  return modules.get(name);
}

/* =============================================
   Initialization
   ============================================= */

/**
 * Initialize all registered modules in order.
 * Modules added by later beads will call registerModule() at the
 * top of their files; this function iterates whatever is registered
 * at DOMContentLoaded time.
 */
function initModules() {
  for (const [name, mod] of modules) {
    try {
      mod.init();
    } catch (err) {
      console.error(`[main] Failed to initialize module "${name}":`, err);
    }
  }
}

/**
 * Core site initialization — runs after DOM is ready.
 */
function init() {
  // -----------------------------------------------
  // Dynamic module imports
  // Each import() is wrapped in a try/catch so missing
  // files (from beads not yet implemented) fail silently.
  // -----------------------------------------------

  const moduleImports = [
    // Navigation (nav bead)
    import('./nav.js').catch(() => null),

    // Scroll-triggered animations (scroll-animations bead)
    import('./scroll-animations.js').catch(() => null),

    // Hero entrance animations (hero bead)
    import('./hero.js').catch(() => null),

    // Parallax effects (parallax bead)
    import('./parallax.js').catch(() => null),
  ];

  Promise.all(moduleImports).then(() => {
    initModules();
  });

  // -----------------------------------------------
  // Scroll direction tracking
  // Emitted on bus as 'scroll:direction' for nav dark-mode switching, etc.
  // -----------------------------------------------
  let lastScrollY = window.scrollY;
  let ticking = false;

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const currentScrollY = window.scrollY;
        const direction = currentScrollY > lastScrollY ? 'down' : 'up';

        bus.emit('scroll:update', {
          y: currentScrollY,
          direction,
          atTop: currentScrollY < 10,
        });

        lastScrollY = currentScrollY;
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  // -----------------------------------------------
  // Resize debounce
  // -----------------------------------------------
  let resizeTimer;

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      bus.emit('viewport:resize', {
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }, 150);
  }

  window.addEventListener('resize', onResize, { passive: true });
}

/* =============================================
   Bootstrap
   ============================================= */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // DOM already parsed (script deferred / module)
  init();
}
