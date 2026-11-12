# 🇫🇷 French Trainer (static site)

A zero-dependency, offline-friendly drill game for French. No backend — all state
(stats, per-question mastery, settings, round history) is kept in the browser's
`localStorage`.

## Run it

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## Topics

| Topic | What it drills |
|---|---|
| Mixed practice · all topics | Every task below shuffled together, including both answer directions |
| Numbers 0–100 | French number words ↔ numerals, both directions (vingt, soixante-dix, quatre-vingts, quatre-vingt-un…) |
| avoir / être / aller | Full present-tense conjugation of each irregular verb |
| -er verbs (class I) | 14 regular first-group verbs incl. spelling-change cases (`nous mangeons`, `nous commençons`) |
| -ir verbs (class II) | 10 regular second-group verbs (finir pattern: `-is, -is, -it, -issons, -issez, -issent`) |
| Verb meanings · irregular | English meanings of avoir / être / aller, French ⇄ English |
| Verb meanings · -er verbs | English meanings of the 14 class-I verbs, French ⇄ English |
| Verb meanings · -ir verbs | English meanings of the 10 class-II verbs, French ⇄ English |

## Features

- **Mixed practice**: draw questions from every topic in one round, with mixed
  directions and weak-spot selection across the full question pool. Progress is
  still tracked for each underlying topic as well as for mixed rounds overall.
- **Two answer modes**: multiple choice (4 options) or free typing.
  Typed answers are checked leniently: accents, apostrophes, hyphens and the
  filler word *et* are ignored (`"vingt et un"` = `"vingt-un"`, `"jai"` = `"j'ai"`).
  Verb-meaning answers accept synonyms and an optional leading *to*
  (`"to speak"`, `"speak"`, `"talk"` all count for *parler*).
- **Rounds** of 5/10/20/30 questions, random or focused on your *weak spots*
  (items you've answered wrong before).
- **Scoring**: 10 points per correct answer plus a streak bonus.
- **Progress screen**: per-topic accuracy, best streaks, weakest items,
  recent rounds, and an option to erase all saved data.
- **🔊 button** on French→number questions reads the word aloud via the
  browser's built-in speech synthesis (`fr-FR`), when available.
- Keyboard friendly: `Enter` checks the answer / advances to the next card.

## Files

```
index.html        page structure / screens
css/style.css     styling
js/data.js        content: numbers 0–100 generator, verb conjugations, topics
js/store.js       localStorage persistence layer
js/app.js         game logic + UI
```
