# NAIGX backend — production image (`M-19`, [D-50](../docs/25-D-50-Deployment-Topology.md)).
#
# ⚠️ RUNS AS A NON-ROOT USER, AND THE PDF RENDERER HAS NO `--no-sandbox`.
# That pair is the point of this file. `M-18` finding M-4 asked for both, and
# non-root alone does not achieve it: Chromium's namespace sandbox also needs
# the seccomp profile in `deploy/seccomp/chromium.json`. The image and that
# profile are coupled — see its README.
#
# Chromium comes from the distribution, not from Playwright's downloader.
# `D-43` chose `playwright-core` with a system browser precisely so that no
# browser is bundled; `npm ci` here must therefore never fetch one.

# ---------------------------------------------------------------------------
# Build — toolchain, dev dependencies, and the two generated Prisma clients.
# ---------------------------------------------------------------------------
FROM node:24-slim AS build

WORKDIR /app

# Manifests first so a dependency-free source edit reuses the install layer.
COPY package.json package-lock.json ./

# `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` is belt and braces: `playwright-core` does
# not download browsers, and a future swap to full `playwright` would silently
# add ~150 MB to this layer without it.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci

# The schemas are needed before `prisma generate`, and there are TWO clients —
# the primary store and the separate trace store (`DB §1.4`). Generating only
# the first leaves `src/db/trace-client.ts` with an unresolvable import.
COPY prisma ./prisma
COPY prisma.config.ts prisma.trace.config.ts ./
RUN npm run prisma:generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Drop dev dependencies from the tree that gets copied forward. Done after the
# build because `tsc` is a dev dependency.
RUN npm prune --omit=dev

# ---------------------------------------------------------------------------
# Runtime — distribution Chromium, no toolchain, no source, no root.
# ---------------------------------------------------------------------------
FROM node:24-slim AS runtime

# `chromium-sandbox` is a SEPARATE Debian package and it is the one that makes
# the sandbox work. Without it Chromium reports "No usable sandbox!" and
# refuses to start unless `--no-sandbox` is passed — which is exactly what this
# image is built to avoid. Verified 2026-09-08.
#
# `fonts-liberation` is not decoration: with no font installed, every glyph in
# an exported PDF renders as a hollow box.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
         chromium \
         chromium-sandbox \
         fonts-liberation \
         ca-certificates \
         tini \
    && rm -rf /var/lib/apt/lists/*

# Chromium is found by an explicit path rather than by probing. `pdf.ts` keeps a
# candidate list for developer machines; a deployment states where its browser
# is, so a missing package fails loudly instead of silently selecting another.
ENV NAIGX_BROWSER_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app

# Ownership is set on copy. A later `chown -R` would duplicate every layer it
# touched, roughly doubling the image.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json

# Migrations are applied by the deployment, not by the application on boot
# (`SA §9.3` rollback: migrations must be reversible independently of code).
# The schemas ship so `prisma migrate deploy` can run in this image.
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts /app/prisma.trace.config.ts ./

# ⚠️ THE ARTIFACT SCHEMAS (`FR-039`, AD-08). `artifact-validation.ts` reads
# `schemas/<type>.schema.json` two levels up from `dist/nie/` — `/app/schemas`
# here — and `dist/ops/schemas.js` publishes the same files. Until 2026-09-09
# this directory was never copied: the image built, the tests passed (they run
# from the checkout), and the first job-description submission to the deployed
# instance failed Stage 9 with "No registered schema for artifact type". Every
# artifact-bearing path was affected; `business_requirement` hid it by
# producing none.
COPY --chown=node:node schemas ./schemas

# `node` is a non-root user the base image already provides, uid 1000.
USER node

EXPOSE 3000

# Chromium leaves zombie processes behind when it is killed, and PID 1 in a
# container does not reap them by default. Without an init, a container that
# has rendered many PDFs accumulates defunct processes until it cannot fork.
ENTRYPOINT ["/usr/bin/tini", "--"]

CMD ["node", "dist/index.js"]
