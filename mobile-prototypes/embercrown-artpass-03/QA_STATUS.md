# EMBERCROWN Art Pass 0.3.1 — Option A status

## Completed

- The official build recipe patches the real input guard from `let stamp = 0;` to `let stamp = -Infinity;`.
- Static QA rejects the unsafe first-tap signature.
- Mobile and desktop browser QA scripts always emit a result file, including fatal failures.
- A cache-stable public loader reconstructs the verified single-page build from six gzip/base64 payload fragments.
- Final reconstructed HTML SHA-256: `62262bea4150eff04b4d7bfd044123e6decad499916893ddf7e263477794b5a6`.
- Local logic/input automation passed start, movement, attack, spell, dodge, oath progression, boss phases and victory using a Babylon API QA stub.

## Explicitly not yet passed

- Public production-WebGL browser automation could not be executed in the available environment because outbound browser/DNS access is blocked and connector-originated commits did not create GitHub Actions runs.
- Real iPhone Safari 20-minute performance, heat, background/resume and WebGL context-loss testing remains pending.

## Real-device performance gate

Open the public URL with `?perf=1` and play continuously for at least 20 minutes. The in-game gate passes only when:

- average FPS is at least 30,
- frame-time p95 is at most 50 ms,
- WebGL context-loss count is zero.

After the run, use the in-game copy button to export the device report.
