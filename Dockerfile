FROM node:22-alpine
WORKDIR /app
ENV HOST=0.0.0.0
ENV PORT=4321
COPY package.json server.mjs ./
COPY public ./public
EXPOSE 4321
CMD ["node", "server.mjs"]
