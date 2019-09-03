
FROM node:8.2.1
LABEL app="pg-ifx-notify" version="1.0"

WORKDIR /opt/app
COPY . .

RUN npm install
RUN npm install dotenv --save
#ENTRYPOINT ["/bin/bash" , "-c", "source ./env_producer.sh && printenv"]
ENTRYPOINT ["npm","run"]
