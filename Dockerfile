FROM openjdk:11.0.3-jdk-stretch

RUN sed -i '/stretch-updates/d' /etc/apt/sources.list
RUN sed -i 's/security.debian/archive.debian/' /etc/apt/sources.list
RUN sed -i 's/deb.debian/archive.debian/' /etc/apt/sources.list

RUN apt-get update && wget -qO- https://deb.nodesource.com/setup_8.x | bash - && apt-get install -y nodejs libpq-dev g++ make

WORKDIR /opt/app
COPY . .
RUN git config --global url."https://git@".insteadOf git://
RUN npm install
#RUN npm install dotenv --save
ENTRYPOINT ["npm","run"]
