# Official Playwright image: browser binaries and OS dependencies are pre-installed.
# Version is pinned to the same version as package.json.
FROM mcr.microsoft.com/playwright:v1.64.1-noble

ENV CI=1 \
    NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    TARGET_URL="" \
    REPORTS_DIR=/app/reports \
    SCREENSHOTS_DIR=/app/screenshots

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund && npm cache clean --force

COPY playwright.config.js ./
COPY src ./src

RUN mkdir -p /app/reports /app/screenshots

ENTRYPOINT ["node", "src/runner.js"]
