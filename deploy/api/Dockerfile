ARG NODE_IMAGE=docker.io/library/node:24-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553
FROM ${NODE_IMAGE} AS build
WORKDIR /workspace
RUN npm install --global pnpm@11.23.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/licenses/package.json packages/licenses/package.json
RUN pnpm install --frozen-lockfile --filter @ldb/api...
COPY apps/api/tsconfig*.json apps/api/
COPY apps/api/src apps/api/src
COPY apps/api/browser apps/api/browser
COPY packages/ui/foundation.css packages/ui/foundation.css
COPY packages/ui/src/typo.tsx packages/ui/src/typo.tsx
RUN pnpm --filter @ldb/api build \
    && pnpm --filter @ldb/api deploy --legacy --prod /production

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /production/package.json ./package.json
COPY --from=build /production/node_modules ./node_modules
COPY --from=build /workspace/apps/api/dist ./dist
COPY --chmod=755 deploy/api/entrypoint.sh /usr/local/bin/ldb-api-entrypoint
USER node
EXPOSE 3000
ENTRYPOINT ["ldb-api-entrypoint"]
CMD ["node", "--import", "reflect-metadata", "dist/main.js"]
