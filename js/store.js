/* ============================================================
 * store.js — persistence layer. All state lives in localStorage.
 * Schema (version 1):
 * {
 *   version: 1,
 *   settings: { [topicId]: { mode, direction, size, focus } },
 *   stats:    { [topicId]: { asked, correct, rounds, bestStreak } },
 *   items:    { [itemKey]:  { a, c, streak, last, label } },   // per-question record
 *   history:  [ { ts, topic, size, correct, best } ]           // recent rounds, newest first
 * }
 * ============================================================ */

"use strict";

const Store = (function () {
  const KEY = "french-trainer-state-v1";

  function blank() {
    return { version: 1, settings: {}, stats: {}, items: {}, history: [] };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const parsed = JSON.parse(raw);
      // shallow-merge so new fields in future versions get defaults
      return Object.assign(blank(), parsed);
    } catch (e) {
      return blank();
    }
  }

  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode etc. */ }
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    return blank();
  }

  return { KEY, blank, load, save, reset };
})();
