ARG NODE_IMAGE=docker.io/library/node:24-bookworm-slim@sha256:2fe369e969550cde8e867afc3fe370b260140cab4a23d467074295b42163d553
FROM ${NODE_IMAGE} AS build
WORKDIR /workspace
RUN npm install --global pnpm@11.23.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ocr/package.json apps/ocr/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/licenses/package.json packages/licenses/package.json
RUN pnpm install --frozen-lockfile --filter @dfragon/ocr...
COPY apps/ocr apps/ocr
COPY packages/licenses/src packages/licenses/src
COPY packages/licenses/notices packages/licenses/notices
COPY packages/licenses/overrides.json packages/licenses/overrides.json
COPY packages/ui/foundation.css packages/ui/foundation.css
COPY packages/ui/stylex.config.ts packages/ui/stylex.config.ts
COPY packages/ui/src/typo.tsx packages/ui/src/typo.tsx
RUN pnpm --filter @dfragon/ocr build && pnpm --filter @dfragon/ocr deploy --legacy --prod /production
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production OCR_HOST=0.0.0.0 OCR_DATA_DIR=/data PORT=3100
WORKDIR /app
COPY --from=build /production/package.json ./package.json
COPY --from=build /production/node_modules ./node_modules
COPY --from=build /workspace/apps/ocr/dist ./dist
USER node
EXPOSE 3100
CMD ["node", "dist/src/main.js"]
