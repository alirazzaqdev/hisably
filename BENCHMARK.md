# Hisably vs Vyapar — Continuous Benchmark Rule

Before building or finalizing any module, benchmark it against Vyapar (vyapar.com) and report first — do NOT just start coding.

For the current module, report:

1. **Vyapar parity check** — list the features Vyapar has in this exact area (invoicing, parties, inventory, reports, etc.). For each one, mark: ✅ we have it / ⚠️ partial / ❌ missing or skipped.
2. **Gaps & skips** — explicitly call out anything common/expected that the current plan leaves out or that was about to be skipped, and why it matters to a real shopkeeper. Don't hide skips.
3. **Where we're behind** — be honest: which Vyapar features are genuinely better or more mature than our plan right now.
4. **Where we win** — what we do that Vyapar doesn't (multi-country tax engine, W×H line items, premium UI, offline-PWA, charts/analytics, AI-ready).
5. **Recommendation** — should we match it now, defer to Phase 2/3, or intentionally skip it? Give a one-line reason each.

Keep it a short table, not an essay. Wait for the user's decision before coding.

The goal: never ship a module that's missing something obvious a Vyapar user would expect.
