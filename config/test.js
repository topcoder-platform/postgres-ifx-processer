const path = require('path')

module.exports = {
  LOG_LEVEL: process.env.LOG_LEVEL || 'debug', // Winston log level
  LOG_FILE: path.join(__dirname, '../app.log'), // File to write logs to
  INFORMIX: { // Informix connection options
    host: process.env.INFORMIX_HOST || 'localhost',
    port: parseInt(process.env.INFORMIX_PORT, 10) || 2021,
    user: process.env.INFORMIX_USER || 'informix',
    password: process.env.INFORMIX_PASSWORD || '1nf0rm1x',
    database: process.env.INFORMIX_DATABASE || 'tcs_catalog',
    server: process.env.INFORMIX_SERVER || 'informixoltp_tcp',
    minpool: parseInt(process.env.MINPOOL, 10) || 1,
    maxpool: parseInt(process.env.MAXPOOL, 10) || 60,
    maxsize: parseInt(process.env.MAXSIZE, 10) || 0,
    idleTimeout: parseInt(process.env.IDLETIMEOUT, 10) || 3600,
    timeout: parseInt(process.env.TIMEOUT, 10) || 30000
  },
  POSTGRES: { // Postgres connection options
    user: process.env.PG_USER || 'mayur',
    host: process.env.PG_HOST || 'localhost',
    database: process.env.PG_DATABASE || 'postgres', // database must exist before running the tool
    password: process.env.PG_PASSWORD || 'password',
    port: parseInt(process.env.PG_PORT, 10) || 5432,
    triggerFunctions: process.env.triggerFunctions || ['db_notifications'], // List of trigger functions to listen to
    triggerTopics: process.env.TRIGGER_TOPICS || ['db.postgres.sync'], // Names of the topic in the trigger payload
    triggerOriginators: process.env.TRIGGER_ORIGINATORS || ['tc-postgres-delta-processor'] // Names of the originator in the trigger payload
  },
  KAFKA: { // Kafka connection options
    brokers_url: process.env.KAFKA_URL || 'localhost:9092', // comma delimited list of initial brokers list
    SSL: {
      cert: process.env.KAFKA_SSL_CERT || null, // SSL client certificate file path
      key: process.env.KAFKA_SSL_KEY || null // SSL client key file path
    },
    topic: process.env.KAFKA_TOPIC || 'db.postgres.sync', // Kafka topic to push and receive messages
    partition: process.env.partition || [0] // Kafka partitions to use
  },
  TEST_TABLE: 'scorecard', // Name of test table to use. Triggers for this table must exist
  TEST_SCHEMA: 'tcs_catalog', // Name of schema "TEST_TABLE" belongs to
  TEST_INTERVAL: 5000 // 5s interval to wait for postgres DML updates to be propagated to informix
}
