FROM node:20-alpine

RUN apk add --no-cache fping iputils

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

CMD ["node", "worker.js"]
