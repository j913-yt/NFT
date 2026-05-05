# Progress

## Recovery

- Task: Reduce frontend initial load without changing behavior.
- Shape: single-full
- Progress: 5/5
- Current: Complete.
- Files: `.codex-tasks/20260505-frontend-load-optimization/TODO.csv`
- Next: Split global and wallet providers.

## Log

- Created task artifacts.
- Reviewed provider boundaries. Root provider currently imports wallet dependencies through RainbowKit and wagmi; wallet button and notification center are global header entries.
- Split global providers so `components/Providers.js` now only owns NextUI.
- Added `WalletProviders`, `WalletConnectEntry`, and `DynamicWalletConnectButton`; header and auth pages now use the dynamic wallet entry.
- Added wallet-session change event and gated notification polling so the interval only starts after token and wallet are present.
- `npm run lint` passed with existing image/useMemo warnings unrelated to this change.
- `npm run build` passed. Production output reports shared First Load JS at 90.5 kB, `/` at 218 kB, `/auth/login` at 99.3 kB, `/auth/register` at 99.4 kB.
- Restarted `next dev` on `http://localhost:3000`; smoke checks for `/` and `/auth/login` returned HTTP 200.
