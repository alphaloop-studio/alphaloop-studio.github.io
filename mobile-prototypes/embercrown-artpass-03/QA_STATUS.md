# EMBERCROWN Art Pass 0.3.1 — Option A status

## Completed

- First-input duplicate guard changed from a zero timestamp to negative infinity.
- Static QA rejects the unsafe first-tap signature.
- Mobile and desktop browser QA scripts always emit a result file, including fatal failures.
- A cache-stable public loader reconstructs the verified single-page build from six gzip/base64 payload fragments.
- Reconstructed HTML SHA-256: `766bff35725956fc301568f7c52d6909ba32a70932ac0af8da6f6ff813c83ad5`.

## Still required before the mobile performance gate passes

- Execute the public URL in a real iPhone Safari session for at least 20 minutes.
- Confirm start, joystick, attack, spell, dodge, oath progression, boss phases and victory.
- Background Safari once, resume it, and confirm WebGL remains active.
- Record sustained FPS, p95 frame time, context-loss count and device heat.

Open the public URL with `?perf=1` to expose the in-game device diagnostics panel.
