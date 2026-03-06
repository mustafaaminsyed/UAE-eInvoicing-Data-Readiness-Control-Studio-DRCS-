# Release checkpoint - 2026-03-06

## Summary

This checkpoint confirms production rollout of:
- Traceability dual-view toggle (`PINT DR View` + `MoF Overlay View`)
- Upload UX fix to stop unintended file-picker popups when using AR/AP and Positive/Negative toggles

## Commits and merge references

- Production merge commit: `74c7c9f` (PR #5)
- Included feature commit: `7875b63` (`feat(traceability): add MoF overlay view alongside PINT DR matrix`)
- Included fix commit: `1814ae4` (`fix(upload): prevent unintended file picker triggers on scenario toggles`)

## Root cause of upload issue

Upload drop zones previously used a full-area file-input click target. Depending on interaction and layout capture, this could trigger the file dialog from adjacent control clicks.

## Fix implemented

- Switched upload interaction to explicit file-open action via `Browse CSV` button.
- Retained drag-and-drop behavior.
- Added interaction regression test to ensure scenario/dataset toggles do not trigger file input click.

Files updated:
- `src/components/upload/FileAnalysis.tsx`
- `src/components/FileUpload.tsx`
- `src/pages/UploadPage.interaction.test.tsx`

## Validation evidence

Local validation:
- `npm run lint` passed
- `npm test` passed (`33` tests)
- Regression test passed:
  - `UploadPage.interaction.test.tsx`
  - verifies AR/AP and Positive/Negative toggles do not call file-input click

Production validation (manual):
- Vercel `Current` deployment shows source commit `74c7c9f`
- `/traceability` displays both `PINT DR View` and `MoF Overlay View`
- `/upload` toggle interactions no longer open file picker

## Rollback point

If rollback is required, redeploy previous production commit (`74a5d00`) from Vercel Deployments.
Note: this would remove both the traceability toggle enhancement and upload fix.
