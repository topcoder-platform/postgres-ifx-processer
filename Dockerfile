FROM openjdk:11.0.5-jdk-stretch

RUN apt-get update && wget -qO- https://deb.nodesource.com/setup_8.x | bash - && apt-get install -y nodejs libpq-dev g++ make

WORKDIR /opt/app
COPY . .

RUN npm install
#RUN npm install dotenv --save
ENTRYPOINT ["npm","run"]
