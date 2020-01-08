FROM node:lts-alpine

WORKDIR /opt
COPY package*.json ./

RUN npm install

COPY . .

RUN npm run-script bundle

EXPOSE 80
ENTRYPOINT ["npm", "start"]
