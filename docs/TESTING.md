# Testing

Priority unit tests: posting service, money/FX, period locking, org isolation, gateway idempotency (later).

Integration: invoice → journal → payment flows.

E2E (Playwright, later): onboard → invoice → pay → reconcile → P&L → close month.

Accounting invariants: SPEC §96.
