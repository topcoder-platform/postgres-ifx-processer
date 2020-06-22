const path = require('path')

module.exports = {
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug', // Winston log level
  LOG_FILE: path.join(__dirname, '../app.log'), // File to write logs to
  INFORMIX: { // Informix connection options
    host: process.env.INFORMIX_HOST || 'localhost',
    port: parseInt(process.env.INFORMIX_PORT, 10) || 2021,
    user: process.env.INFORMIX_USER || 'informix',
    password: process.env.INFORMIX_PASSWORD || 'password',
    database: process.env.INFORMIX_DATABASE || 'db',
    server: process.env.INFORMIX_SERVER || 'informixserver',
    minpool: parseInt(process.env.MINPOOL, 10) || 1,
    maxpool: parseInt(process.env.MAXPOOL, 10) || 60,
    maxsize: parseInt(process.env.MAXSIZE, 10) || 0,
    idleTimeout: parseInt(process.env.IDLETIMEOUT, 10) || 3600,
    timeout: parseInt(process.env.TIMEOUT, 10) || 30000
  },
  POSTGRES: { // Postgres connection options
    user: process.env.PG_USER || 'pg_user',
    host: process.env.PG_HOST || 'localhost',
    database: process.env.PG_DATABASE || 'postgres', // database must exist before running the tool
    password: process.env.PG_PASSWORD || 'password',
    port: parseInt(process.env.PG_PORT, 10) || 5432,

    triggerFunctions: process.env.TRIGGER_FUNCTIONS || 'prod_db_notifications', // List of trigger functions to listen to
    triggerTopics: process.env.TRIGGER_TOPICS || ['prod.db.postgres.sync'], // Names of the topic in the trigger payload
    triggerOriginators: process.env.TRIGGER_ORIGINATORS || ['tc-postgres-delta-processor'] // Names of the originator in the trigger payload
  },
  KAFKA: { // Kafka connection options
    brokers_url: process.env.KAFKA_URL || 'localhost:9092', // comma delimited list of initial brokers list
    SSL: {
      cert: process.env.KAFKA_CLIENT_CERT || null, // SSL client certificate file path
      key: process.env.KAFKA_CLIENT_CERT_KEY || null // SSL client key file path
    },
    topic: process.env.KAFKA_TOPIC || 'db.topic.sync', // Kafka topic to push and receive messages
    partition: process.env.partition || [0], // Kafka partitions to use
    maxRetry: process.env.MAX_RETRY || 10,
    errorTopic: process.env.ERROR_TOPIC || 'db.scorecardtable.error',
    recipients: ['admin@abc.com'], // Kafka partitions to use,
    KAFKA_URL: process.env.KAFKA_URL,
    KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || 'prod-postgres-ifx-consumer',
    KAFKA_CLIENT_CERT: process.env.KAFKA_CLIENT_CERT ? process.env.KAFKA_CLIENT_CERT.replace('\\n', '\n') : null,
    KAFKA_CLIENT_CERT_KEY: process.env.KAFKA_CLIENT_CERT_KEY ? process.env.KAFKA_CLIENT_CERT_KEY.replace('\\n', '\n') : null,
  },
  SLACK: {
    URL: process.env.SLACKURL || 'us-east-1',
    SLACKCHANNEL: process.env.SLACKCHANNEL || 'ifxpg-migrator',
    SLACKNOTIFY: process.env.SLACKNOTIFY || 'false'
  },
  RECONSILER: {
    RECONSILER_START: process.env.RECONSILER_START || 5,
    RECONSILER_END: process.env.RECONSILER_END || 1,
    RECONSILER_DURATION_TYPE: process.env.RECONSILER_DURATION_TYPE || 'm'
  },
  DYNAMODB:
  {
    DYNAMODB_TABLE: process.env.DYNAMODB_TABLE || 'prod_pg_ifx_payload_sync',
    DD_ElapsedTime: process.env.DD_ElapsedTime || 600000
  },

  AUTH0_URL: process.env.AUTH0_URL,
  AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE,
  TOKEN_CACHE_TIME: process.env.TOKEN_CACHE_TIME,
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
  AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET,
  BUSAPI_URL: process.env.BUSAPI_URL,
  KAFKA_ERROR_TOPIC: process.env.KAFKA_ERROR_TOPIC,
  AUTH0_PROXY_SERVER_URL: process.env.AUTH0_PROXY_SERVER_URL
}
