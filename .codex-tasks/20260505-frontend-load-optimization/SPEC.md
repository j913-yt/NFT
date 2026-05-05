# Frontend Load Optimization

## Goal

Reduce initial client-side load and development compile pressure without changing current NFT marketplace business behavior.

## Scope

- Keep NextUI available globally.
- Move wallet providers out of the root provider so wallet dependencies are loaded only by wallet entry points.
- Dynamically load wallet UI entry points where they are used.
- Start notification polling only when a wallet session token and wallet are present.

## Non-Goals

- Do not change NFT listing, creation, purchase, delist, login, or notification business logic.
- Do not remove the selected wallet options.
- Do not introduce fallback or mock behavior.

## Validation

- Run lint or build where feasible.
- Confirm the changed modules compile.
- Keep failures explicit if local environment blocks validation.
