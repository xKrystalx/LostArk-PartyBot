FROM node:18

WORKDIR /urs/src/app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["node", "app.js"]