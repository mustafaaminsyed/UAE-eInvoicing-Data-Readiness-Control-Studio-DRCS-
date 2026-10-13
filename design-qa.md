# Landing page final baseline QA

- Source visual truth: latest approved DRCS landing implementation and repository regulatory assets.
- Implementation screenshots:
  - `e2e/artifacts/landing-desktop-1440.png`
  - `e2e/artifacts/landing-laptop-1024.png`
  - `e2e/artifacts/landing-tablet-768.png`
  - `e2e/artifacts/landing-mobile-390.png`
- Viewports: 1440 x 1400, 1024 x 1360, 768 x 1400, and 390 x 1600 CSS px at device scale factor 1.

## Findings

- Fonts and typography: dashboard KPI labels and findings use stronger contrast and slightly larger minimum sizes without changing the component dimensions. `Readiness score` replaces `Ready`.
- Spacing and layout rhythm: hero, dashboard footprint, four-step workflow, and surrounding page geometry are unchanged. No overlap or horizontal overflow was detected.
- Colors and visual tokens: existing Dariba emerald/navy palette is preserved.
- Image quality and asset fidelity: MoF, FTA, and Peppol logos now share fixed 64 px display stages, contained scaling, consistent card padding, and aligned subtitles.
- Asset optimization: application copies of the MoF and FTA logos were resized from 1536 x 1024 to 320 x 213 with high-quality bicubic resampling and transparency preserved. Repository originals remain untouched.
- Copy and content: `Engro UAE` was replaced with `UAE Enterprise`. Illustrative findings use generic actions such as Investigate, Resolve, Review, and Map; no unverified PINT-AE rule identifiers are shown.
- Disclaimer: increased to 11 px, medium weight, darker blue-grey contrast, and a stronger divider.
- Responsiveness: desktop, laptop, tablet, and mobile captures remain clean.
- Keyboard accessibility: Enter-key activation passed for Get Started, Watch Overview, and Explore the Workflow.

## Destination verification

- Get Started → `/upload`: existing route and browser navigation passed.
- Explore the Workflow → `#workflow`: in-page workflow navigation passed; no dedicated workflow route exists.
- See how it works → `#workflow`: in-page workflow navigation passed. The previous video-implying label was removed.

## Verification

- Focused component test passed.
- Responsive, destination, and keyboard Playwright suite passed: 6/6.
- Lint passed.
- Production build passed.
- Browser console and uncaught page errors checked.
- No `Engro` content or `IBR-*` identifiers remain in the public hero preview.
- Optimized output sizes: MoF 56 KB and FTA 39 KB, both below the 100 KB target.

## Remaining issues

- P3 mobile: the miniature dashboard remains intentionally dense at 390 px; its key values are discernible, but detailed findings are primarily a visual overview at that width.
- Existing build warnings remain: stale Browserslist data and application chunks over 500 KB.

final result: passed

