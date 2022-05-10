#!/bin/bash
FROM --platform=linux/arm32v7 node:18

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["node", "app.js"]