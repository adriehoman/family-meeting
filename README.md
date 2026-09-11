# Family Meeting

A classroom page where an AI plays a person's family members (for example Rosie and Clifton, the wife and son of Wilson Blue) and a class of students interviews them. Built for TAFE Queensland CHC33021 units, first used for CHCAGE011 Assessment Task 2 Part A preparation.

Live page: https://adriehoman.github.io/family-meeting/ (PIN protected).

## Files

| File | Purpose |
|---|---|
| `index.html` | The built page that GitHub Pages serves. Never edit by hand; rebuild from `src/`. |
| `src/template.html` | Page layout, styles, settings and help text. Contains three markers: `/*PORTRAITS*/`, `/*SCENARIOS*/`, `/*APP*/`. |
| `src/app.js` | All behaviour: prompt building, API call, speech in and out, student turns, coaching, lifeline, opening stage, board de-duplication, PIN gate, settings. |
| `src/scenarios.js` | The cases. Each scenario has `characters` (each with facts, persona, voice, portrait), `interactionRules`, `headings`, `keyFacts`, `starterQuestions`, `teacher` notes. Add a new unit here or load a JSON through Settings. |
| `src/portraits.js` | Drawn portraits (olderWoman, olderMan, man, woman). Users can upload their own pictures in Settings. |
| `src/build.py` | Assembles the page: `python3 build.py [PIN]`. |
| `src/guide.js`, `src/checklist.js` | Node scripts (need the `docx` package) that produce the teacher guide and the student listening checklist. |
| `docs/` | The current Word guide and listening checklist. |

## How it works
The browser calls the Anthropic API directly with a key the teacher enters once in Settings (stored only in that browser). Each answer comes back as JSON: the family's spoken turns, the question type, a coaching line, a suggested question for the lifeline, board points tagged with key fact ids, and which opening checks were covered. Stage 1 is the opening (introduce, purpose, hearing, comfort, privacy); each later student introduces themselves, then asks their questions. Nothing reaches the board until the student has been introduced.

## Adding a scenario for another unit
1. Copy the Wilson block in `src/scenarios.js` (or download the JSON from Settings).
2. Write the setting, characters (facts from the family member's point of view, what they do not know), interaction rules, key facts with ids and headings, starter questions, teacher cues and debrief.
3. Rebuild with `python3 src/build.py`, test, upload `index.html` to this repository (Add file, Upload files, replace).
4. Regenerate the checklist by editing the cue lists in `src/checklist.js`.
