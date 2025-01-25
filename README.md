# openauth-wrangler

## Worker

- pnpm -F worker dev
- pnpm -F worker exec wrangler ...

### Deploy

- pnpm -F worker exec wrangler kv namespace create kv-staging
- pnpm -F worker exec wrangler deploy --env staging
- pnpm -F worker exec wrangler kv namespace create kv-production
- pnpm -F worker exec wrangler deploy --env production

### Build & deploy commands

- Deploy command: pnpm -F worker exec wrangler deploy --env production

## Client

- pnpm -F client-hono dev
- pnpm -F client-hono tailwind
- pnpm -F client-hono exec wrangler ...

### Deploy

- pnpm -F client-hono build
- pnpm -F client-hono exec wrangler deploy --env production

### Build & deploy commands

- Build command: pnpm -F client-hono build
- Deploy command: pnpm -F client-hono exec wrangler deploy --env production

# pnpm

- pnpm list -r typescript

## Node version for build and scripts

- See .node-version in root.
- https://github.com/shadowspawn/node-version-usage

## Prettier

-- pnpm add -D --save-exact prettier --workspace-root

- https://prettier.io/docs/en/ignore
  - Prettier will also follow rules specified in the ".gitignore" file if it exists in the same directory from which it is run.
- pnpm prettier . --check

