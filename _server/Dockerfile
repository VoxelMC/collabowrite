FROM node:current-alpine

WORKDIR /app

COPY package.json .
# COPY package-lock.json .
COPY pnpm-lock.yaml .

RUN npm install --production

COPY . .

ENV PORT=3000

CMD [ "npm", "start" ]
