ARG NODE_IMAGE=docker.io/library/node:24-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553
FROM ${NODE_IMAGE} AS build
WORKDIR /workspace
RUN npm install --global pnpm@11.23.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches patches
COPY apps/api/package.json apps/api/package.json
COPY packages/lib/package.json packages/lib/package.json
COPY packages/licenses/package.json packages/licenses/package.json
RUN pnpm install --frozen-lockfile --filter @dfragon/api...
COPY packages/lib/tsconfig.json packages/lib/tsconfig.json
COPY packages/lib/src packages/lib/src
COPY packages/licenses/src/copy-notices.mjs packages/licenses/src/copy-notices.mjs
COPY packages/licenses/notices/lib packages/licenses/notices/lib
COPY apps/api/tsconfig*.json apps/api/
COPY apps/api/src apps/api/src
COPY apps/api/test apps/api/test
COPY apps/api/test-support apps/api/test-support
RUN pnpm --filter @dfragon/api test \
    && pnpm --filter @dfragon/api deploy --legacy --prod /production

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /production/package.json ./package.json
COPY --from=build /production/node_modules ./node_modules
COPY --from=build /workspace/apps/api/dist ./dist
COPY --chmod=755 apps/api/docker-entrypoint.sh /usr/local/bin/dfragon-api-entrypoint
USER node
EXPOSE 3000
ENTRYPOINT ["dfragon-api-entrypoint"]
CMD ["node", "--import", "reflect-metadata", "dist/main.js"]
