FROM node:18

WORKDIR /urs/src/app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 80
EXPOSE 443

CMD ["node", "app.js"]