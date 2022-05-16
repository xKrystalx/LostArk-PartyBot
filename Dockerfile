#!/bin/bash
FROM node:18

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm config set registry https://registry.npmjs.org/

RUN npm install

COPY . .

CMD ["node", "app.js"]