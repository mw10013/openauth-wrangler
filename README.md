# openauth-wrangler

OpenAuth server and client example using wrangler for local dev and deployment.

## Local Dev

- cp functions/client/.dev.vars.example functions/client/.dev.vars
- pnpm -F worker dev
- pnpm -F client tailwind
- pnpm -F client dev

## Deploy (production)

- pnpm -F worker exec wrangler kv namespace create kv-production
- Update worker/wrangler.jsonc with production kv id
- pnpm -F worker exec wrangler deploy --env production
- Workers & Pages Settings: openauth-wrangler-worker-production
  - Git repository: connect to git repo
  - Build configuration
    - Deploy command: pnpm -F worker exec wrangler deploy --env production
  - Build watch paths
    - Include paths: functions/worker/* functions/shared/*
- pnpm -F client build
- pnpm -F client exec wrangler deploy --env production
- pnpm -F client exec wrangler secret put COOKIE_SECRET --env production
- Workers & Pages Settings: openauth-wrangler-client-production
  - Git repository: connect to git repo
  - Build configuration
    - Build command: pnpm -F client build
    - Deploy command: pnpm -F client exec wrangler deploy --env production
  - Build watch paths
    - Include paths: functions/client/* functions/shared/*

## Deploy (staging)

- Steps of Deploy (production) substituting staging for production
- Workers & Pages Settings: openauth-wrangler-worker-staging/openauth-wrangler-client-production
  - Branch control: staging

## Node version for build

- See .node-version in root.
- https://github.com/shadowspawn/node-version-usage

## Prettier

- pnpm add -D --save-exact prettier --workspace-root
- https://prettier.io/docs/en/ignore
  - Prettier will also follow rules specified in the ".gitignore" file if it exists in the same directory from which it is run.
- pnpm prettier . --check
