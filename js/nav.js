/**
 * nav.js — Apple-style sticky navbar behaviour
 *
 * Responsibilities:
 *  1. Apply .is-scrolled when page scrolls past threshold
 *  2. Apply .is-dark when nav overlaps a `.section--dark` element
 *  3. Toggle mobile hamburger menu (.menu-open)
 *  4. Close mobile menu on Escape / outside-click / resize
 *
 * Registers itself with the module registry in main.js so it can be
 * re-initialized if needed (e.g. after dynamic content insertion).
 */

import { bus, registerModule, prefersReducedMotion } from './main.js';

/* =============================================
   Constants
   ============================================= */

/** Pixels scrolled before the frosted-glass style kicks in. */
const SCROLL_THRESHOLD = 10;

/** CSS classes toggled on #main-nav */
const CLS_SCROLLED  = 'is-scrolled';
const CLS_DARK      = 'is-dark';
const CLS_MENU_OPEN = 'menu-open';

/* =============================================
   Module state
   ============================================= */

/** @type {HTMLElement|null} */
let nav = null;

/** @type {HTMLButtonElement|null} */
let hamburger = null;

/** @type {HTMLElement|null} */
let mobileMenu = null;

/** @type {IntersectionObserver|null} */
let darkSectionObserver = null;

/** Number of dark sections currently intersecting the nav. */
let darkSectionCount = 0;

/* =============================================
   Scroll handling
   ============================================= */

/**
 * Update .is-scrolled based on current scroll position.
 * Called via the shared bus (scroll:update) so it shares the rAF
 * throttle already set up in main.js.
 *
 * @param {{ y: number, direction: string, atTop: boolean }} payload
 */
function onScrollUpdate({ y, atTop }) {
  if (!nav) return;

  if (atTop || y < SCROLL_THRESHOLD) {
    nav.classList.remove(CLS_SCROLLED);
  } else {
    nav.classList.add(CLS_SCROLLED);
  }
}

/* =============================================
   Dark-section detection (IntersectionObserver)
   ============================================= */

/**
 * Watch all `.section--dark` elements.
 * When any of them intersects the top 44 px of the viewport (the nav
 * bar height) we switch to dark mode.
 *
 * rootMargin: "-0px 0px -<rest of viewport>px 0px" clips the root to
 * just the nav band at the top.
 */
function initDarkSectionObserver() {
  if (!('IntersectionObserver' in window)) return;

  const NAV_HEIGHT = 44;
  const vpHeight   = window.innerHeight;

  // Observe a horizontal strip equal to the nav bar height
  const rootMargin = `0px 0px -${vpHeight - NAV_HEIGHT}px 0px`;

  darkSectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          darkSectionCount += 1;
        } else {
          darkSectionCount = Math.max(0, darkSectionCount - 1);
        }
      });

      if (nav) {
        nav.classList.toggle(CLS_DARK, darkSectionCount > 0);
      }
    },
    { rootMargin }
  );

  document.querySelectorAll('.section--dark').forEach((section) => {
    darkSectionObserver.observe(section);
  });

  // Re-create observer on resize so rootMargin stays accurate
  bus.on('viewport:resize', () => {
    darkSectionObserver?.disconnect();
    darkSectionCount = 0;
    initDarkSectionObserver();
  });
}

/* =============================================
   Mobile menu
   ============================================= */

/** Open the mobile dropdown. */
function openMenu() {
  if (!nav || !hamburger || !mobileMenu) return;

  nav.classList.add(CLS_MENU_OPEN);
  hamburger.setAttribute('aria-expanded', 'true');
  hamburger.setAttribute('aria-label', 'Close menu');
  mobileMenu.setAttribute('aria-hidden', 'false');

  // Prevent body scroll while menu is open
  document.body.style.overflow = 'hidden';

  // Trap focus to the menu links
  mobileMenu.querySelector('a')?.focus();
}

/** Close the mobile dropdown. */
function closeMenu() {
  if (!nav || !hamburger || !mobileMenu) return;

  nav.classList.remove(CLS_MENU_OPEN);
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.setAttribute('aria-label', 'Open menu');
  mobileMenu.setAttribute('aria-hidden', 'true');

  document.body.style.overflow = '';
}

/** Toggle the mobile menu open/closed. */
function toggleMenu() {
  const isOpen = nav?.classList.contains(CLS_MENU_OPEN);
  isOpen ? closeMenu() : openMenu();
}

/**
 * Close menu when the user clicks/taps outside the nav bar.
 * @param {MouseEvent} e
 */
function onDocumentClick(e) {
  if (!nav) return;
  if (!nav.contains(/** @type {Node} */ (e.target))) {
    closeMenu();
  }
}

/**
 * Close menu on Escape key.
 * @param {KeyboardEvent} e
 */
function onKeydown(e) {
  if (e.key === 'Escape') {
    closeMenu();
    hamburger?.focus();
  }
}

/**
 * Close menu when viewport expands past mobile breakpoint (≥ 901 px).
 * @param {{ width: number }} payload
 */
function onViewportResize({ width }) {
  if (width > 900) {
    closeMenu();
  }
}

/* =============================================
   Initialization & teardown
   ============================================= */

function init() {
  nav        = document.getElementById('main-nav');
  hamburger  = document.getElementById('nav-hamburger');
  mobileMenu = document.getElementById('nav-mobile-menu');

  if (!nav) {
    console.warn('[nav] #main-nav not found — skipping nav init');
    return;
  }

  // ── Scroll state ──────────────────────────────
  // Sync immediately on init (handles page reload at scroll position)
  onScrollUpdate({
    y:    window.scrollY,
    atTop: window.scrollY < SCROLL_THRESHOLD,
    direction: 'none',
  });

  bus.on('scroll:update', onScrollUpdate);

  // ── Dark section detection ────────────────────
  initDarkSectionObserver();

  // ── Mobile menu ───────────────────────────────
  if (hamburger) {
    hamburger.addEventListener('click', toggleMenu);
  }

  document.addEventListener('click',   onDocumentClick);
  document.addEventListener('keydown',  onKeydown);
  bus.on('viewport:resize', onViewportResize);
}

function destroy() {
  bus.off('scroll:update',    onScrollUpdate);
  bus.off('viewport:resize',  onViewportResize);

  hamburger?.removeEventListener('click', toggleMenu);
  document.removeEventListener('click',   onDocumentClick);
  document.removeEventListener('keydown',  onKeydown);

  darkSectionObserver?.disconnect();
  darkSectionObserver = null;
  darkSectionCount    = 0;

  // Clean up any open menu state
  closeMenu();

  nav = hamburger = mobileMenu = null;
}

/* =============================================
   Register with main.js module system
   ============================================= */
registerModule('nav', { init, destroy });

// Also self-init immediately if the DOM is already ready
// (handles the case where this module is imported after DOMContentLoaded)
if (document.readyState !== 'loading') {
  init();
}
