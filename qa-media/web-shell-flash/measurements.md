# Web shell flash on profile refresh

Host: https://staging.terrapin.minds.com (staging, running main WITHOUT the fix)
Page: /user/jack, signed in as the E2E account
Measured: sidebar element absent from first paint until it appears.

| refresh | sidebar absent for |
|---|---|
| #1 | 204 ms |
| #2 | 52 ms |
| #3 | 58 ms |

Cumulative Layout Shift reads 0.0000 throughout. That is not evidence of no
flash: React Native Web positions with transforms, so the browser does not emit
layout-shift entries for this. The absence window above is the real signal.

before-fix-N-no-sidebar.png  captured during the gap
before-fix-N-settled.png     captured after it resolves
