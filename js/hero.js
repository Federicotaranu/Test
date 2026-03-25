/**
 * hero.js — Hero section entrance animations and scroll indicator
 *
 * Responsibilities:
 *  - Register as a named module with main.js's module registry
 *  - Drive staggered entrance sequence: headline → subheadline → CTAs
 *    (CSS animations handle the actual motion; JS adds an 'is-loaded'
 *     class on the section to allow JS-controlled fallback if desired)
 *  - Wire up the scroll indicator click to smooth-scroll past the hero
 *  - Emit hero:visible / hero:hidden on the bus as the section enters/leaves viewport
 *  - Pause background animation when the section is out of viewport (perf)
 *  - Fully respects prefers-reduced-motion
 *
 * Note: The primary entrance animations are pure CSS (animation + delay),
 * declared in styles/hero.css. JS enhances with class toggling and
 * scroll behaviour.
 */

import { registerModule, prefersReducedMotion, bus } from './main.js';

/* =============================================
   Constants
   ============================================= */

const SECTION_ID        = 'hero';
const LOADED_CLASS      = 'hero--loaded';
const PAUSED_CLASS      = 'hero--bg-paused';

/* =============================================
   Module implementation
   ============================================= */

/** @type {HTMLElement | null} */
let section = null;
/** @type {IntersectionObserver | null} */
let visibilityObserver = null;

/**
 * Smooth-scroll to the element immediately following the hero section.
 */
function scrollPastHero() {
  if (!section) return;

  const nextEl = section.nextElementSibling;
  if (nextEl) {
    nextEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    window.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
  }
}

/**
 * Wire scroll-indicator click/keyboard activation.
 */
function initScrollIndicator() {
  const indicator = section?.querySelector('.hero__scroll-indicator');
  if (!indicator) return;

  indicator.addEventListener('click', scrollPastHero);

  // Keyboard accessibility
  indicator.setAttribute('role', 'button');
  indicator.setAttribute('tabindex', '0');
  indicator.setAttribute('aria-label', 'Scroll down');
  indicator.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      scrollPastHero();
    }
  });
}

/**
 * Use IntersectionObserver to pause the background gradient animation
 * when the hero is fully off-screen (saves GPU cycles).
 * Also emits bus events so the navbar can react.
 */
function initVisibilityObserver() {
  if (!section || !('IntersectionObserver' in window)) return;

  visibilityObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          section.classList.remove(PAUSED_CLASS);
          bus.emit('hero:visible', { ratio: entry.intersectionRatio });
        } else {
          section.classList.add(PAUSED_CLASS);
          bus.emit('hero:hidden', {});
        }
      }
    },
    { threshold: 0.01 }
  );

  visibilityObserver.observe(section);
}

/**
 * If the user prefers reduced motion, skip all animation classes
 * and make all elements immediately visible.
 */
function applyReducedMotion() {
  if (!section) return;
  const animated = section.querySelectorAll(
    '.hero__headline, .hero__subheadline, .hero__cta-group, .hero__scroll-indicator'
  );
  animated.forEach((el) => {
    el.style.opacity    = '1';
    el.style.transform  = 'none';
    el.style.animation  = 'none';
  });
}

/**
 * Module init — called by main.js after DOMContentLoaded.
 */
function init() {
  section = document.getElementById(SECTION_ID);
  if (!section) return;

  // Mark section as JS-enhanced
  section.classList.add(LOADED_CLASS);

  if (prefersReducedMotion()) {
    applyReducedMotion();
  }

  initScrollIndicator();
  initVisibilityObserver();
}

/**
 * Module destroy — clean up observers and listeners.
 */
function destroy() {
  visibilityObserver?.disconnect();
  visibilityObserver = null;
}

/* =============================================
   Register with main.js module registry
   ============================================= */

registerModule('hero', { init, destroy });

export { init, destroy };
