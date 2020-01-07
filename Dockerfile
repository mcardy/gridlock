FROM node:lts-alpine

WORKDIR /opt
COPY pacakage*.json

RUN npm install

COPY . .

EXPOSE 80
ENTRYPOINT ["npm", "start"]
