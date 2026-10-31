FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321 \
    TZ=Asia/Shanghai

# Run as an unprivileged user. The app only needs to read its static files.
RUN addgroup -S app && adduser -S app -G app

COPY --chown=app:app package.json server.mjs ./
COPY --chown=app:app public ./public

USER app

EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4321) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

STOPSIGNAL SIGTERM

CMD ["node", "server.mjs"]
