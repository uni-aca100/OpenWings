FROM node:lts-alpine3.23
WORKDIR /usr/src/app

COPY package*.json ./
COPY src ./src

# entrypoint script loads env and runs npm start
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]