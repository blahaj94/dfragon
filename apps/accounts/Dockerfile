FROM docker.io/library/node:26-bookworm-slim@sha256:86f07bc9c5dce4578cf37e5a418b7bfc7f817cda25cde66e2b66e95ed86c4567 AS build
WORKDIR /workspace
RUN npm install --global pnpm@12.11.2
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/accounts/package.json apps/accounts/package.json
COPY packages/lib/package.json packages/lib/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/licenses/package.json packages/licenses/package.json
COPY packages/licenses/src/copy-notices.mjs packages/licenses/src/copy-notices.mjs
RUN pnpm install --frozen-lockfile --filter @dfragon/accounts...
COPY packages/lib/tsconfig.json packages/lib/tsconfig.json
COPY packages/lib/src packages/lib/src
COPY packages/licenses/notices/lib packages/licenses/notices/lib
COPY apps/accounts/tsconfig*.json apps/accounts/
COPY apps/accounts/src apps/accounts/src
COPY apps/accounts/browser apps/accounts/browser
COPY apps/accounts/test apps/accounts/test
COPY apps/accounts/test-support apps/accounts/test-support
COPY scripts/test-support/docker-postgres.mjs scripts/test-support/docker-postgres.mjs
COPY scripts/test/docker-postgres.test.mjs scripts/test/docker-postgres.test.mjs
COPY packages/ui/tokens.css packages/ui/tokens.css
COPY packages/ui/foundation.css packages/ui/foundation.css
COPY packages/ui/stylex.config.ts packages/ui/stylex.config.ts
COPY packages/ui/src/typo.tsx packages/ui/src/typo.tsx
COPY packages/ui/src/tokens.stylex.ts packages/ui/src/tokens.stylex.ts
COPY packages/licenses/notices/upstream/stylex-LICENSE.txt packages/licenses/notices/upstream/stylex-LICENSE.txt
RUN pnpm --filter @dfragon/accounts test \
    && pnpm --filter @dfragon/accounts deploy --legacy --prod /production

FROM docker.io/library/node:26-bookworm-slim@sha256:86f07bc9c5dce4578cf37e5a418b7bfc7f817cda25cde66e2b66e95ed86c4567 AS runtime
ARG SOURCE_COMMIT=""
ENV NODE_ENV=production
WORKDIR /app
COPY scripts/server-build-info.mjs /tmp/dfragon-server-build-info.mjs
RUN node /tmp/dfragon-server-build-info.mjs accounts "$SOURCE_COMMIT" /app/build-info.json \
    && rm /tmp/dfragon-server-build-info.mjs
COPY --from=build /production/package.json ./package.json
COPY --from=build /production/node_modules ./node_modules
COPY --from=build /workspace/apps/accounts/dist ./dist
COPY --chmod=755 apps/accounts/docker-entrypoint.sh /usr/local/bin/dfragon-accounts-entrypoint
USER node
EXPOSE 3000
ENTRYPOINT ["dfragon-accounts-entrypoint"]
CMD ["node", "--import", "reflect-metadata", "dist/main.js"]
