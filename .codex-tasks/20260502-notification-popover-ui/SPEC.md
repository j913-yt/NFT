# Notification popover UI refresh

## Goal

Improve the header notification popover on NFT detail pages so it reads like a polished component-library popover, with clearer hierarchy and a cleaner empty state.

## Scope

- Refactor the oversized notification component into focused modules.
- Keep polling, read/unread, refresh, and navigation behavior.
- Do not add new image assets unless the UI genuinely needs them.

## Validation

- Run frontend lint.
- Open `http://localhost:3000/nfts/22`, trigger the notification popover, and verify the layout.
