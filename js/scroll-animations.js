/**
 * scroll-animations.js — IntersectionObserver-based scroll animation system
 *
 * Watches every element with `.animate-on-scroll` and adds `.is-visible`
 * when it enters the viewport, triggering the CSS opacity/translate transition
 * defined in main.css.
 *
 * Stagger: child elements inside a `.stagger-children` parent receive
 * incremental `transition-delay` values (0.1 s each) so they animate in
 * sequence rather than all at once.
 *
 * Respects `prefers-reduced-motion` — skips all animation setup when the
 * user has requested reduced motion.
 */

'use strict';

import { prefersReducedMotion, registerModule } from './main.js';

/* =============================================
   Constants
   ============================================= */

/** Root margin: trigger slightly before the element is fully in view */
const ROOT_MARGIN = '0px 0px -60px 0px';

/** Minimum fraction of the element that must be visible to trigger */
const THRESHOLD = 0.1;

/** Delay increment between staggered children (seconds) */
const STAGGER_STEP = 0.1;

/** Maximum stagger delay — prevents very long waits on large lists */
const STAGGER_MAX = 0.8;

/* =============================================
   Helpers
   ============================================= */

/**
 * Apply staggered transition-delay to direct children of `parent`
 * that also carry the `.animate-on-scroll` class.
 *
 * @param {Element} parent
 */
function applyStagger(parent) {
  const children = Array.from(
    parent.querySelectorAll(':scope > .animate-on-scroll')
  );

  children.forEach((child, index) => {
    const delay = Math.min(index * STAGGER_STEP, STAGGER_MAX);
    child.style.transitionDelay = `${delay}s`;
  });
}

/**
 * Mark a single element (and any staggered children) as visible.
 *
 * @param {Element} el
 */
function makeVisible(el) {
  el.classList.add('is-visible');
}

/* =============================================
   Observer setup
   ============================================= */

/**
 * Create and return a configured IntersectionObserver.
 *
 * @returns {IntersectionObserver}
 */
function createObserver() {
  return new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const el = entry.target;
        makeVisible(el);

        // Once visible, no need to keep watching — unobserve for perf.
        observer.unobserve(el);
      });
    },
    {
      rootMargin: ROOT_MARGIN,
      threshold: THRESHOLD,
    }
  );
}

/* =============================================
   Public API
   ============================================= */

/**
 * Initialise the scroll animation system.
 *
 * - Finds all `.animate-on-scroll` elements in the document.
 * - Applies stagger delays to elements inside `.stagger-children` wrappers.
 * - Observes each element with IntersectionObserver.
 *
 * Safe to call multiple times (e.g., after dynamic content is added) —
 * already-visible elements are skipped.
 */
export function init() {
  // Bail out if the user prefers reduced motion
  if (prefersReducedMotion()) {
    // Make all animated elements immediately visible
    document
      .querySelectorAll('.animate-on-scroll')
      .forEach((el) => el.classList.add('is-visible'));
    return;
  }

  if (!('IntersectionObserver' in window)) {
    // Fallback for very old browsers: just show everything
    document
      .querySelectorAll('.animate-on-scroll')
      .forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = createObserver();

  // Stagger setup — must run before observing so delays are set
  document.querySelectorAll('.stagger-children').forEach(applyStagger);

  // Observe every animate-on-scroll element not yet made visible
  document.querySelectorAll('.animate-on-scroll').forEach((el) => {
    if (!el.classList.contains('is-visible')) {
      observer.observe(el);
    }
  });
}

/**
 * Re-scan the DOM for newly added `.animate-on-scroll` elements.
 * Useful after dynamic content injection (e.g., lazy-loaded sections).
 */
export function refresh() {
  init();
}

/* =============================================
   Register with the module system
   ============================================= */
registerModule('scroll-animations', { init, destroy: () => {} });
