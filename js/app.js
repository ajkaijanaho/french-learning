/* ============================================================
 * app.js — UI + game logic. Depends on data.js and store.js.
 * ============================================================ */

(function () {
"use strict";

/* ---------------- helpers ---------------- */

const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function pct(part, whole) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function speakFrench(text) {
  if (!("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR";
    u.rate = 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch (e) { /* ignore */ }
}

/* ---------------- state ---------------- */

let state = Store.load();
let currentTopic = null;
let game = null;   // active round

const DEFAULT_SETTINGS = { mode: "choice", direction: "mixed", size: 10, focus: "all" };

function settingsFor(topicId) {
  return Object.assign({}, DEFAULT_SETTINGS, state.settings[topicId] || {});
}

function saveSettings(topicId, patch) {
  state.settings[topicId] = Object.assign(settingsFor(topicId), patch);
  Store.save(state);
}

/* ---------------- screens ---------------- */

const screens = {
  home:     $("#screen-home"),
  setup:    $("#screen-setup"),
  game:     $("#screen-game"),
  summary:  $("#screen-summary"),
  progress: $("#screen-progress"),
};

function show(name) {
  for (const k in screens) screens[k].hidden = (k !== name);
  window.scrollTo({ top: 0 });
  if (name === "home") renderHome();
  if (name === "progress") renderProgress();
}

/* ---------------- question builders ---------------- */

function makeNumberQuestion(n, direction) {
  const word = frenchNumber(n);
  if (direction === "f2n") {
    return {
      topic: "numbers", kind: "number-f2n", key: "num:" + n + ":f2n", n,
      promptHTML: '<span class="word">' + esc(word) + "</span>",
      promptText: word, promptIsFrench: true,
      answer: String(n), answerLabel: String(n),
      accept: [String(n)],
      label: "“" + word + "” = " + n,
      check: (raw) => parseInt(String(raw).trim(), 10) === n,
    };
  }
  return {
    topic: "numbers", kind: "number-n2f", key: "num:" + n + ":n2f", n,
    promptHTML: '<span class="numeral">' + n + "</span>",
    promptText: String(n), promptIsFrench: false,
    answer: word, answerLabel: word,
    accept: numberAccept(n),
    label: n + " = " + word,
  };
}

function verbSource(verbId) {
  if (IRREGULAR_VERBS[verbId]) return IRREGULAR_VERBS[verbId];
  return null;
}

function makeVerbQuestion(verbId, p, topicId, cls) {
  const v = cls ? (cls === "er" ? ER_VERBS : IR_VERBS).find(x => x.inf === verbId) : verbSource(verbId);
  const form = v.forms[p.key];
  const allForms = PRONOUNS.map(pp => v.forms[pp.key]);
  const others = [...new Set(allForms.filter(f => norm(f) !== norm(form)))];
  const prefix = cls ? "class:" + cls + ":" : "verb:";
  return {
    topic: topicId, kind: cls ? "class" : "verb", key: prefix + verbId + ":" + p.key,
    promptHTML: '<span class="word">' + esc(v.inf || v.label) + "</span> <span class='pronoun'>— " + esc(p.label) + "</span>",
    promptText: (v.inf || v.label) + ", " + p.label, promptIsFrench: false,
    answer: form, answerLabel: form,
    accept: [norm(form)],
    otherForms: others,
    label: (v.inf || v.label) + " (" + p.label + ") = " + form,
  };
}

function makeMeaningQuestion(entry, direction, topicId, group) {
  const key = "mean:" + entry.inf + ":" + direction;
  if (direction === "f2e") {
    return {
      topic: topicId, kind: "meaning-f2e", key,
      promptHTML: '<span class="word">' + esc(entry.inf) + "</span>",
      promptText: entry.inf, promptIsFrench: true,
      answer: entry.en, answerLabel: entry.en,
      accept: enAccept(entry.en),
      others: meaningDistractors(entry, "f2e", group),
      label: entry.inf + " = " + entry.en,
      placeholder: "type the English meaning…",
    };
  }
  return {
    topic: topicId, kind: "meaning-e2f", key,
    promptHTML: '<span class="english">' + esc(entry.en) + "</span>",
    promptText: entry.en, promptIsFrench: false,
    answer: entry.inf, answerLabel: entry.inf,
    accept: [norm(entry.inf), norm("to " + entry.inf)],
    others: meaningDistractors(entry, "e2f", group),
    label: entry.en + " = " + entry.inf,
    placeholder: "type the French verb…",
  };
}

/** Up to 3 distractor options for a meaning question: confusable verbs from the
 * same group first, then topped up from all verbs (the irregular group has only 3). */
function meaningDistractors(entry, kind, group) {
  const field = kind === "f2e" ? "en" : "inf";
  const seen = new Set([norm(entry.en), norm(entry.inf)]);
  const out = [];
  const pick = (list) => {
    for (const e of shuffle(list)) {
      if (out.length >= 3) return;
      const k = norm(e[field]);
      if (!seen.has(k)) { seen.add(k); out.push(e[field]); }
    }
  };
  pick(meaningPool(group).filter(e => e.inf !== entry.inf));
  pick(allVerbEntries().filter(e => e.inf !== entry.inf));
  return out;
}

function allQuestions(topic, opts) {
  if (topic.kind === "numbers") {
    const dirs = opts.direction === "mixed" ? ["f2n", "n2f"] : [opts.direction];
    const qs = [];
    for (const n of NUMBERS_RANGE) for (const d of dirs) qs.push(makeNumberQuestion(n, d));
    return qs;
  }
  if (topic.kind === "verb") {
    return PRONOUNS.map(p => makeVerbQuestion(topic.verb, p, topic.id, null));
  }
  if (topic.kind === "class") {
    const list = topic.cls === "er" ? ER_VERBS : IR_VERBS;
    const qs = [];
    for (const v of list) for (const p of PRONOUNS) qs.push(makeVerbQuestion(v.inf, p, topic.id, topic.cls));
    return qs;
  }
  if (topic.kind === "meaning") {
    const pool = meaningPool(topic.group);
    const dirs = opts.direction === "mixed" ? ["f2e", "e2f"] : [opts.direction];
    const qs = [];
    for (const e of pool) for (const d of dirs) qs.push(makeMeaningQuestion(e, d, topic.id, topic.group));
    return qs;
  }
  return [];
}

/* ---------------- distractors / choice options ---------------- */

function numberDistractors(n, count) {
  const used = new Set([n]);
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < 1000) {
    let d;
    if (Math.random() < 0.5) d = n + (Math.floor(Math.random() * 21) - 10); // near values
    else d = Math.floor(Math.random() * 101);
    if (d < 0 || d > 100 || used.has(d)) continue;
    used.add(d);
    out.push(d);
  }
  let d = 0;
  while (out.length < count) {           // deterministic fallback
    d = (d + 1) % 101;
    if (!used.has(d)) { used.add(d); out.push(d); }
  }
  return out;
}

function addChoiceOptions(q) {
  let distractors = [];
  if (q.kind === "number-f2n") {
    distractors = numberDistractors(q.n, 3).map(d => ({ label: String(d), value: String(d) }));
  } else if (q.kind === "number-n2f") {
    distractors = numberDistractors(q.n, 3).map(d => ({ label: frenchNumber(d), value: frenchNumber(d) }));
  } else if (q.kind === "meaning-f2e" || q.kind === "meaning-e2f") {
    distractors = q.others.slice(0, 3).map(v => ({ label: v, value: v }));
  } else { // verb / class
    distractors = shuffle(q.otherForms).slice(0, 3).map(f => ({ label: f, value: f }));
  }
  q.options = shuffle([{ label: q.answerLabel, value: q.answer, correct: true }]
    .concat(distractors.map(d => ({ label: d.label, value: d.value, correct: false }))));
  return q;
}

/* ---------------- deck sampling ---------------- */

function sampleDeck(topic, opts) {
  const qs = allQuestions(topic, opts);
  const size = Math.min(opts.size, qs.length);
  const accOf = (q) => {
    const r = state.items[q.key];
    return r && r.a > 0 ? r.c / r.a : null;
  };

  let chosen;
  if (opts.focus === "weak") {
    const weak  = qs.filter(q => { const a = accOf(q); return a !== null && a < 0.75; });
    const fresh = qs.filter(q => accOf(q) === null);
    const rest  = qs.filter(q => { const a = accOf(q); return a !== null && a >= 0.75; });
    chosen = shuffle(weak).concat(shuffle(fresh), shuffle(rest)).slice(0, size);
  } else {
    chosen = shuffle(qs).slice(0, size);
  }
  return shuffle(chosen);
}

/* ---------------- persistence of results ---------------- */

function recordResult(q, ok) {
  const it = state.items[q.key] || { a: 0, c: 0, streak: 0, last: 0, label: q.label };
  it.a += 1;
  if (ok) { it.c += 1; it.streak += 1; } else { it.streak = 0; }
  it.last = Date.now();
  it.label = q.label;
  state.items[q.key] = it;

  const st = state.stats[q.topic] || (state.stats[q.topic] = { asked: 0, correct: 0, rounds: 0, bestStreak: 0 });
  st.asked += 1;
  if (ok) st.correct += 1;

  Store.save(state);
}

/* ---------------- home ---------------- */

function renderHome() {
  const grid = $("#topic-grid");
  grid.innerHTML = "";
  for (const t of TOPICS) {
    const st = state.stats[t.id] || { asked: 0, correct: 0, rounds: 0, bestStreak: 0 };
    const acc = pct(st.correct, st.asked);
    const card = document.createElement("button");
    card.type = "button";
    card.className = "topic-card";
    card.innerHTML =
      '<span class="topic-icon">' + t.icon + "</span>" +
      '<span class="topic-body"><strong>' + esc(t.name) + "</strong>" +
      '<span class="muted small">' + esc(t.desc) + "</span>" +
      '<span class="chip-row">' +
        (st.asked > 0
          ? '<span class="chip">' + st.asked + " asked · " + acc + "% correct</span>"
          : '<span class="chip dim">not tried yet</span>') +
      "</span></span>";
    card.addEventListener("click", () => openSetup(t.id));
    grid.appendChild(card);
  }
}

/* ---------------- setup ---------------- */

function openSetup(topicId) {
  currentTopic = topicById(topicId);
  const s = settingsFor(topicId);

  $("#setup-title").textContent = currentTopic.icon + "  " + currentTopic.name;
  $("#setup-desc").textContent = currentTopic.desc;

  // Direction only applies to numbers and verb meanings; label the buttons per kind.
  const hasDirection = currentTopic.kind === "numbers" || currentTopic.kind === "meaning";
  $("#group-direction").style.display = hasDirection ? "" : "none";
  if (hasDirection) {
    $("#seg-direction").innerHTML = currentTopic.kind === "meaning"
      ? '<button type="button" data-val="mixed">Mixed</button>' +
        '<button type="button" data-val="f2e">French → English</button>' +
        '<button type="button" data-val="e2f">English → French</button>'
      : '<button type="button" data-val="mixed">Mixed</button>' +
        '<button type="button" data-val="f2n">French → number</button>' +
        '<button type="button" data-val="n2f">Number → French</button>';
  }

  syncSeg("mode", s.mode);
  syncSeg("direction", s.direction);
  syncSeg("size", String(s.size));
  syncSeg("focus", s.focus);

  show("setup");
}

function syncSeg(setting, value) {
  $$('.seg[data-setting="' + setting + '"] button').forEach(btn => {
    btn.classList.toggle("active", btn.dataset.val === String(value));
  });
}

$$(".seg").forEach(seg => {
  seg.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-val]");
    if (!btn || !currentTopic) return;
    const setting = seg.dataset.setting;
    const val = setting === "size" ? parseInt(btn.dataset.val, 10) : btn.dataset.val;
    saveSettings(currentTopic.id, { [setting]: val });
    syncSeg(setting, btn.dataset.val);
  });
});

$("#setup-back").addEventListener("click", () => show("home"));
$("#btn-start").addEventListener("click", () => startGame());

/* ---------------- game ---------------- */

function startGame() {
  if (!currentTopic) return;
  const opts = settingsFor(currentTopic.id);
  const deck = sampleDeck(currentTopic, opts).map(q => {
    q.mode = opts.mode;
    if (opts.mode === "choice") addChoiceOptions(q);
    return q;
  });
  game = {
    topic: currentTopic, opts, deck,
    idx: 0, correct: 0, streak: 0, bestStreak: 0,
    score: 0, answered: false, results: [], startedAt: Date.now(),
  };
  show("game");
  renderQuestion();
}

function currentQ() { return game.deck[game.idx]; }

function renderQuestion() {
  const q = currentQ();
  game.answered = false;

  $("#game-topic").textContent = game.topic.icon + " " + game.topic.name;
  $("#game-count").textContent = (game.idx + 1) + " / " + game.deck.length;
  updateHud();
  $("#game-bar").style.width = (game.idx / game.deck.length * 100) + "%";

  $("#game-prompt").innerHTML = q.promptHTML;
  $("#btn-speak").hidden = !q.promptIsFrench || !("speechSynthesis" in window);

  const area = $("#game-answer-area");
  area.innerHTML = "";
  $("#game-feedback").textContent = "";
  $("#game-feedback").className = "feedback";
  $("#btn-next").hidden = true;

  const card = $("#question-card");
  card.classList.remove("pop");
  void card.offsetWidth;           // restart animation
  card.classList.add("pop");

  if (game.opts.mode === "choice") {
    const grid = document.createElement("div");
    grid.className = "options";
    q.options.forEach((opt, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "opt";
      b.innerHTML = '<span class="opt-key">' + "ABCD"[i] + "</span> " + esc(opt.label);
      b.addEventListener("click", () => answerChoice(i));
      grid.appendChild(b);
    });
    area.appendChild(grid);
  } else {
    const form = document.createElement("div");
    form.className = "typed-row";
    const input = document.createElement("input");
    input.type = "text";
    input.autocomplete = "off";
    input.autocapitalize = "off";
    input.spellcheck = false;
    input.id = "game-input";
    input.placeholder = q.placeholder || (q.kind === "number-f2n" ? "type the number…" : "type the French form…");
    if (q.kind === "number-f2n") input.setAttribute("inputmode", "numeric");
    input.setAttribute("aria-label", "Your answer");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn primary";
    btn.textContent = "Check ✓";
    btn.addEventListener("click", () => answerText(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); game.answered ? nextQuestion() : answerText(input.value); }
    });
    form.appendChild(input);
    form.appendChild(btn);
    area.appendChild(form);
    input.focus();
  }
}

function updateHud() {
  $("#game-streak").textContent = "🔥 " + game.streak;
  $("#game-score").textContent = "★ " + game.score;
}

function answerText(raw) {
  if (game.answered) return;
  const q = currentQ();
  const ok = q.check ? q.check(raw) : q.accept.includes(norm(raw));
  settle(q, ok, norm(raw));
}

function answerChoice(i) {
  if (game.answered) return;
  const q = currentQ();
  const opt = q.options[i];
  settle(q, !!opt.correct, opt.value);
}

function settle(q, ok, given) {
  game.answered = true;
  recordResult(q, ok);

  if (ok) {
    game.correct += 1;
    game.streak += 1;
    game.bestStreak = Math.max(game.bestStreak, game.streak);
    game.score += 10 + Math.min(game.streak - 1, 10); // streak bonus
  } else {
    game.streak = 0;
  }
  game.results.push({ q, ok, given });
  updateHud();
  $("#game-bar").style.width = ((game.idx + 1) / game.deck.length * 100) + "%";

  // feedback
  const fb = $("#game-feedback");
  fb.className = "feedback " + (ok ? "ok" : "ko");
  fb.innerHTML = ok
    ? "✔ Correct!" + (game.streak >= 3 ? ' <span class="chip streak">🔥 streak ×' + game.streak + "</span>" : "")
    : "✘ Not quite — the answer is <strong>" + esc(q.answerLabel) + "</strong>";

  // highlight choice buttons
  if (game.opts.mode === "choice") {
    $$("#game-answer-area .opt").forEach((b, i) => {
      b.disabled = true;
      const opt = q.options[i];
      if (opt.correct) b.classList.add("correct");
      else if (norm(opt.value) === norm(given)) b.classList.add("wrong");
    });
  } else {
    const input = $("#game-input");
    if (input) {
      input.disabled = true;
      input.classList.add(ok ? "correct" : "wrong");
    }
  }

  const next = $("#btn-next");
  next.hidden = false;
  next.textContent = (game.idx + 1 >= game.deck.length) ? "See results ▸" : "Next ▸";
  next.focus();
}

function nextQuestion() {
  if (!game || !game.answered) return;
  game.idx += 1;
  if (game.idx >= game.deck.length) finishGame();
  else renderQuestion();
}

function finishGame(aborted) {
  const st = state.stats[game.topic.id] || (state.stats[game.topic.id] = { asked: 0, correct: 0, rounds: 0, bestStreak: 0 });
  if (!aborted) {
    st.rounds += 1;
    st.bestStreak = Math.max(st.bestStreak, game.bestStreak);
    state.history.unshift({
      ts: Date.now(), topic: game.topic.id,
      size: game.deck.length, correct: game.correct, best: game.bestStreak,
    });
    state.history = state.history.slice(0, 30);
    Store.save(state);
  }
  renderSummary(aborted);
  show("summary");
}

function renderSummary(aborted) {
  const total = game.deck.length;
  const acc = pct(game.correct, total);
  const secs = Math.round((Date.now() - game.startedAt) / 1000);
  $("#summary-title").textContent = aborted ? "Round aborted" : "Round complete!";
  $("#summary-score").textContent = game.score;

  $("#summary-stats").innerHTML =
    stat("Correct", game.correct + " / " + total) +
    stat("Accuracy", acc + "%") +
    stat("Best streak", "🔥 " + game.bestStreak) +
    stat("Time", secs + " s");

  const missed = game.results.filter(r => !r.ok);
  const wrap = $("#summary-missed-wrap");
  const ul = $("#summary-missed");
  ul.innerHTML = "";
  if (missed.length) {
    wrap.hidden = false;
    for (const m of missed) {
      const li = document.createElement("li");
      li.innerHTML = esc(m.q.label);
      ul.appendChild(li);
    }
  } else {
    wrap.hidden = true;
  }
}

function stat(k, v) {
  return '<div class="stat"><div class="stat-v">' + esc(v) + '</div><div class="stat-k">' + esc(k) + "</div></div>";
}

$("#btn-next").addEventListener("click", nextQuestion);
$("#btn-abort").addEventListener("click", () => { if (game) finishGame(true); });
$("#btn-speak").addEventListener("click", () => speakFrench(currentQ().promptText));
$("#btn-again").addEventListener("click", () => startGame());
$("#btn-resetup").addEventListener("click", () => openSetup(game.topic.id));
$("#btn-summary-home").addEventListener("click", () => show("home"));

// global Enter = advance once answered (covers choice mode keyboard use)
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && game && !screens.game.hidden && game.answered) {
    if (document.activeElement && document.activeElement.id === "game-input") return; // handled locally
    e.preventDefault();
    nextQuestion();
  }
});

/* ---------------- progress ---------------- */

function renderProgress() {
  const tbody = $("#stats-table tbody");
  tbody.innerHTML = "";
  for (const t of TOPICS) {
    const st = state.stats[t.id] || { asked: 0, correct: 0, rounds: 0, bestStreak: 0 };
    const acc = pct(st.correct, st.asked);
    const tr = document.createElement("tr");
    tr.innerHTML =
      "<td>" + t.icon + " " + esc(t.name) + "</td>" +
      "<td>" + st.rounds + "</td>" +
      "<td>" + st.asked + "</td>" +
      "<td>" + st.correct + "</td>" +
      '<td><div class="mini-bar"><div style="width:' + acc + '%"></div></div> ' + acc + "%</td>" +
      "<td>" + (st.bestStreak > 0 ? "🔥 " + st.bestStreak : "—") + "</td>";
    tbody.appendChild(tr);
  }

  // weakest items (>=3 attempts), worst accuracy first
  const weak = Object.values(state.items)
    .filter(it => it.a >= 3)
    .sort((a, b) => (a.c / a.a) - (b.c / b.a) || b.a - a.a)
    .slice(0, 8);
  const wl = $("#weak-list");
  wl.innerHTML = "";
  if (!weak.length) {
    wl.innerHTML = '<li class="muted">Answer at least 3 questions to see your weak spots.</li>';
  } else {
    for (const it of weak) {
      const li = document.createElement("li");
      li.innerHTML = esc(it.label) +
        ' <span class="chip">' + it.c + "/" + it.a + " (" + pct(it.c, it.a) + "%)</span>";
      wl.appendChild(li);
    }
  }

  // recent rounds
  const hl = $("#history-list");
  hl.innerHTML = "";
  if (!state.history.length) {
    hl.innerHTML = '<li class="muted">No rounds played yet.</li>';
  } else {
    for (const h of state.history.slice(0, 10)) {
      const t = topicById(h.topic);
      const li = document.createElement("li");
      const when = new Date(h.ts).toLocaleString();
      li.innerHTML = (t ? t.icon + " " + esc(t.name) : h.topic) +
        ' — <strong>' + h.correct + "/" + h.size + "</strong> (" + pct(h.correct, h.size) + "%)" +
        (h.best > 1 ? " 🔥" + h.best : "") +
        ' <span class="muted small">' + esc(when) + "</span>";
      hl.appendChild(li);
    }
  }
}

$("#btn-reset-all").addEventListener("click", () => {
  if (confirm("Erase all saved progress, stats and settings from this browser?")) {
    state = Store.reset();
    renderProgress();
    show("home");
  }
});

/* ---------------- nav ---------------- */

$("#nav-home").addEventListener("click", () => { game = null; show("home"); });
$("#nav-progress").addEventListener("click", () => { game = null; show("progress"); });
$("#progress-back").addEventListener("click", () => show("home"));

/* ---------------- boot ---------------- */

show("home");

// tiny hook for debugging / automated tests (no effect on normal use)
if (typeof window !== "undefined") {
  window.__ft = {
    getState: () => state,
    getGame: () => game,
    openSetup, startGame, currentQ, answerText, answerChoice, nextQuestion, show, renderHome, renderProgress,
  };
}

})();
