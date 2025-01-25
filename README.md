# openauth-wrangler

## Client

- pnpm -F client-hono dev
- pnpm -F client-hono tailwind
- pnpm -F client-hono exec wrangler ...
- pnpm -F client-hono exec wrangler deploy --env production

### Build & deploy commands

- Build command: pnpm -F client-hono build
- Deploy command: pnpm -F client-hono exec wrangler deploy --env production

## Prettier

-- pnpm add -D --save-exact prettier --workspace-root

- https://prettier.io/docs/en/ignore
  - Prettier will also follow rules specified in the ".gitignore" file if it exists in the same directory from which it is run.
- pnpm prettier . --check

# pnpm

- pnpm list -r typescript

## Node version for build and scripts

- See .node-version in root.
- https://github.com/shadowspawn/node-version-usage
