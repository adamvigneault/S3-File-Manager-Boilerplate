FROM node:11

RUN mkdir /app
WORKDIR /app

CMD ["npm", "start"]