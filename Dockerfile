#!/bin/bash
FROM node:18

WORKDIR /usr/src/app

COPY package*.json ./
COPY yarn.lock ./

RUN yarn install

COPY . .

CMD ["node", "app.js"]