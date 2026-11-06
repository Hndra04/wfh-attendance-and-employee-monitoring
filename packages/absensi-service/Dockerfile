FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/absensi-service/package.json ./packages/absensi-service/package.json
COPY packages/absensi-service/tsconfig.json ./packages/absensi-service/tsconfig.json
COPY packages/absensi-service/nest-cli.json ./packages/absensi-service/nest-cli.json
COPY packages/absensi-service/scripts ./packages/absensi-service/scripts
COPY packages/absensi-service/src ./packages/absensi-service/src
COPY packages/monitoring-service/package.json ./packages/monitoring-service/package.json
COPY packages/monitoring-service/tsconfig.json ./packages/monitoring-service/tsconfig.json
COPY packages/monitoring-service/nest-cli.json ./packages/monitoring-service/nest-cli.json
COPY packages/monitoring-service/src ./packages/monitoring-service/src
COPY apps/absensi-web/package.json ./apps/absensi-web/package.json
COPY apps/absensi-web/tsconfig.json ./apps/absensi-web/tsconfig.json
COPY apps/absensi-web/tsconfig.node.json ./apps/absensi-web/tsconfig.node.json
COPY apps/absensi-web/vite.config.ts ./apps/absensi-web/vite.config.ts
COPY apps/absensi-web/index.html ./apps/absensi-web/index.html
COPY apps/absensi-web/src ./apps/absensi-web/src
COPY apps/monitoring-web/package.json ./apps/monitoring-web/package.json
COPY apps/monitoring-web/tsconfig.json ./apps/monitoring-web/tsconfig.json
COPY apps/monitoring-web/tsconfig.node.json ./apps/monitoring-web/tsconfig.node.json
COPY apps/monitoring-web/vite.config.ts ./apps/monitoring-web/vite.config.ts
COPY apps/monitoring-web/index.html ./apps/monitoring-web/index.html
COPY apps/monitoring-web/src ./apps/monitoring-web/src
COPY seed ./seed

RUN npm install

WORKDIR /app/packages/absensi-service

EXPOSE 3001
CMD ["npm", "run", "start:dev"]
