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
| `src/cherry-docs.ps1` | PowerShell script (needs Microsoft Word; run it directly with `& .\cherry-docs.ps1`) that produces the Cherry Wilkes teacher guide, observer quiz and student hints. The checklist is read from `scenarios.js`. |
| `src/cherry-quiz-hints.json` | One quiz question (circle, true or false, or write a word) and the say-or-do hints for each Cherry checklist point, keyed by point id. |
| `docs/` | The current Word guides, the listening checklist, and the Cherry observer quiz and student hints. |

## Two kinds of scenario
- **Family meeting** (Wilson Blue, Val Theeson): the AI plays family members on a video call. Opening checks, then each student asks their questions. Facts go on the six-heading board.
- **Support visit** (`"type": "visit"`, Cherry Wilkes for CHCCCS031 and CHCCCS040): the AI plays the person, then a supervisor. The scenario has `stages` (one person each, with `role`, `place`, `scene`, `tasks`, `rules`), and a `checklist` (the observation checklist in groups, each point with `label`, `official` wording and a `hint` for the AI; some points have `parts`). The whole class takes turns as one support worker, 5 turns each, using Say or Do. Points turn green as they are shown; the page moves to the next stage only when every point of the stage is shown (the teacher can override). "Download session (Word)" gives the full record and an empty progress note table.

## How it works
The browser calls the Anthropic API directly with a key the teacher enters once in Settings (stored only in that browser). Each answer comes back as JSON: the family's spoken turns, the question type, a coaching line, a suggested question for the lifeline, board points tagged with key fact ids, and which opening checks were covered. Stage 1 is the opening (introduce, purpose, hearing, comfort, privacy); each later student introduces themselves, then asks their questions. Nothing reaches the board until the student has been introduced.

Speech uses the browser's voices. A narrator with a different voice reads out what the back of the room cannot see: the opening message or scene, "What you can see" in a support visit, and any question or action that was typed instead of spoken. While anyone is speaking (or the AI is thinking), the microphone button is grey and says "Please wait...".

## Adding a scenario for another unit
1. Copy the Wilson block in `src/scenarios.js` (or download the JSON from Settings).
2. Write the setting, characters (facts from the family member's point of view, what they do not know), interaction rules, key facts with ids and headings, starter questions, teacher cues and debrief.
3. Rebuild with `python3 src/build.py` (on a computer without Python, do the same three replacements in PowerShell), test, upload `index.html` to this repository (Add file, Upload files, replace).
4. Regenerate the checklist by editing the cue lists in `src/checklist.js`.
