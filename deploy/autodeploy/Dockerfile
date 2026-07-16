FROM node:20-alpine

# docker-cli: 容器内通过挂载的 /var/run/docker.sock 操作宿主机 docker
# git:       执行 git pull
# openssh-client: git SSH 备用（HTTPS 凭据为主，见 README）
RUN apk add --no-cache docker-cli git openssh-client

WORKDIR /app

COPY server.js package.json ./

EXPOSE 9000

CMD ["node", "server.js"]
