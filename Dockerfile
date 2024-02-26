
FROM node:20-alpine

WORKDIR /app

COPY resolv.conf /etc/resolv.conf

COPY package*.json .

RUN apk update && apk add --update git 

RUN npm install --verbose

COPY . .

RUN npm install nodemon -g

RUN npm install mongoose

RUN npm install pm2 -g

EXPOSE 3000

CMD [ "pm2-runtime", "start", "bin/www"]
