# Universal Website Testing Report

- **Target:** https://jti.polinema.ac.id/dermaga
- **Browser:** chromium
- **Generated:** 2026-11-06T07:59:35.698Z
- **Duration:** 40.24 s
- **Run status:** failed

## Summary

| Total | PASS | FAIL | SKIP | Pass rate |
| ---: | ---: | ---: | ---: | ---: |
| 19 | 15 | 3 | 1 | 83.3% |

> SKIP means the page did not provide the element/feature being tested; it is not counted as PASS.

## Test cases

| Status | Test case | Duration | Notes |
| --- | --- | ---: | --- |
| PASS | chromium › accessibility.spec.js › Basic accessibility checks › document declares a language | 2.50 s |  |
| PASS | chromium › accessibility.spec.js › Basic accessibility checks › page has a top-level heading | 1.66 s |  |
| PASS | chromium › accessibility.spec.js › Basic accessibility checks › images have alternative text attributes | 1.56 s |  |
| PASS | chromium › accessibility.spec.js › Basic accessibility checks › element IDs are unique | 1.48 s |  |
| PASS | chromium › accessibility.spec.js › Basic accessibility checks › links and buttons have accessible names | 1.53 s |  |
| PASS | chromium › forms.spec.js › Form detection and basic validation › forms are detected on the homepage | 1.50 s |  |
| PASS | chromium › forms.spec.js › Form detection and basic validation › visible form controls have accessible labels | 1.48 s |  |
| PASS | chromium › images.spec.js › images load successfully | 2.13 s |  |
| PASS | chromium › links.spec.js › internal links resolve without HTTP errors | 2.47 s |  |
| PASS | chromium › navigation.spec.js › Homepage, loading, and basic performance › homepage is reachable and returns a successful HTTP status | 1.53 s |  |
| PASS | chromium › navigation.spec.js › Homepage, loading, and basic performance › homepage has a non-empty page title | 1.51 s |  |
| PASS | chromium › navigation.spec.js › Homepage, loading, and basic performance › page finishes loading and renders a body | 1.55 s |  |
| PASS | chromium › navigation.spec.js › Homepage, loading, and basic performance › basic navigation performance stays within configured budgets | 1.56 s |  |
| SKIP | chromium › navigation.spec.js › Homepage, loading, and basic performance › primary navigation exists and contains usable links | 1.47 s | No visible navigation links were found in <nav>, [role="navigation"], or <header>. |
| PASS | chromium › navigation.spec.js › Homepage, loading, and basic performance › no JavaScript console errors on the homepage | 2.55 s |  |
| PASS | chromium › navigation.spec.js › Homepage, loading, and basic performance › no uncaught page errors on the homepage | 2.47 s |  |
| FAIL | chromium › responsive.spec.js › Responsive layout - desktop (1440x900) › renders without horizontal overflow at 1440x900 | 2.74 s | Error: Horizontal overflow is 360px (tolerance 2px). Possible offenders: [] |
| FAIL | chromium › responsive.spec.js › Responsive layout - tablet (810x1080) › renders without horizontal overflow at 810x1080 | 2.79 s | Error: Horizontal overflow is 203px (tolerance 2px). Possible offenders: [] |
| FAIL | chromium › responsive.spec.js › Responsive layout - mobile (390x844) › renders without horizontal overflow at 390x844 | 1.61 s | Error: Horizontal overflow is 98px (tolerance 2px). Possible offenders: [] |

Open `report.html` for the interactive HTML report, or `html/index.html` for the Playwright report.

