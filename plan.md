# Plan: Training App With Notes and Completion

Build a TypeScript web-first training app as a PWA, using a one-time PDF extraction pipeline that converts the three phase PDFs into validated JSON bundled with the app. In v1, the app should not just display the training plan; it should also persist per-exercise notes and completion state locally on the device, including bulk complete and bulk reset actions for the current phase or program.

## Steps

1. Define the product boundary for v1: phase switching, exercise details, offline access after install, per-exercise notes, per-exercise completion toggles, and bulk check or uncheck actions for the currently visible program. Exclude authentication, cloud sync, and session history for now.
2. Inspect one PDF manually to confirm the exact layout of the "Detailed program" section, how phases and exercises are ordered, and whether images or video links are embedded consistently. This blocks the extraction implementation.
3. Design a canonical data schema shared by the extraction step and the app UI. Minimum content entities: program, phase, exercise, display order, image asset reference, video URL, and source-PDF trace metadata. Minimum user-state entities: exercise id, note text, completion boolean, and updated timestamp.
4. Build a one-time import script in TypeScript that reads each PDF, isolates the "Detailed program" section, extracts structured exercise rows, and writes normalized JSON plus copied or extracted media assets where possible. This depends on steps 2 and 3.
5. Add a review pass for extracted output: flag missing images, ambiguous exercise names, or absent video links so the generated JSON can be corrected before shipping. This runs immediately after step 4.
6. Scaffold the app as a TypeScript PWA with a local data-loading layer for the bundled JSON and a separate local persistence layer for user state. Use browser storage suited for offline persistence so notes and completion state survive reloads. This can begin once the schema in step 3 is stable.
7. Build the home screen around phase navigation: users switch between Phase 1, Phase 2, and Phase 3 and see the corresponding program summary and exercise list, including completion status per exercise.
8. Build the exercise detail flow: each exercise shows program name, exercise name, image or placeholder, video link when present, a notes area under the exercise, and a completion check mark. This depends on steps 6 and 7.
9. Add bulk actions for the current visible phase or program: mark all exercises complete and clear all exercise completion states. Recommended behavior is to clear completion only and preserve notes.
10. Add offline behavior for the bundled JSON, media assets, and locally persisted notes and completion state so the app still works after installation with no network connection.
11. Validate the full slice with sample data from all three PDFs, then refine empty states, placeholder behavior, note-saving feedback, and bulk-action confirmation behavior.

## Relevant Files

- [intructions.md](/Users/julio/copilot-POC/training-app/intructions.md) - current product notes and initial requirements.
- [Phase 1.pdf](/Users/julio/copilot-POC/training-app/Phase%201.pdf) - source content for the first phase and the best candidate for initial extraction rule design.
- [Phase 2.pdf](/Users/julio/copilot-POC/training-app/Phase%202.pdf) - source content for validating whether extraction rules generalize.
- [Phase 3.pdf](/Users/julio/copilot-POC/training-app/Phase%203.pdf) - source content for validating whether extraction rules generalize.

## Verification

1. Confirm the extraction script outputs one normalized JSON payload per phase and that every exercise has a stable id, display order, and source trace.
2. Manually compare a sample of extracted exercises against the "Detailed program" section in each PDF to catch layout-related parsing mistakes.
3. Verify the home screen can switch phases without network access and render the expected exercises from bundled JSON.
4. Verify note text entered under an exercise persists after reload and remains scoped to the correct exercise.
5. Verify single exercise completion toggles persist after reload and display correctly in both list and detail views.
6. Verify the bulk check and bulk uncheck actions affect the current visible phase or program only.
7. Verify missing images fall back to placeholders and missing video links do not break the UI.
8. Run a focused build, typecheck, or test pass for the extraction script and the app before considering the plan complete.

## Decisions

- Included in scope: web browser first release, offline support after install, static JSON bundled with the app, extracted images when possible, placeholder images when not, external video URLs when found, per-exercise notes, per-exercise completion state, and bulk completion actions.
- Recommended stack: Next.js or a React-based TypeScript PWA for the UI, plus a standalone TypeScript import script for PDF-to-JSON conversion.
- Recommended ingestion strategy: one-time controlled import, not a fully autonomous in-app agent in v1, because PDF extraction is brittle and needs review.
- Recommended persistence model: training content stays in bundled JSON; user-entered notes and completion state are stored locally on the device for offline use.
- Recommended behavior: bulk uncheck clears completion flags only and does not erase notes.
- Deliberately excluded from v1: authentication, cross-device sync, workout history by date, admin CMS, and live PDF re-import inside the user app.

## Further Considerations

1. If you later want workout history instead of a simple done or not-done state, evolve completion from a boolean into per-date or per-session records without changing the PDF ingestion layer.
2. If the PDFs are visually inconsistent, the import pipeline should support a small manual override file rather than trying to force a fully automatic parser.
3. If video links are missing from the PDFs, decide whether editors will add them manually during the review pass or whether v1 should omit them where unavailable.
