FROM node:lts-alpine

WORKDIR /opt
COPY package*.json

RUN npm install

COPY . .

EXPOSE 80
ENTRYPOINT ["npm", "start"]
