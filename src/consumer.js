/**
 * Receives postgres DML triggger messages from kafka and updates the informix database
 */
const config = require('config')
const Kafka = require('no-kafka')
const logger = require('./common/logger')
const updateInformix = require('./services/updateInformix')
const pushToKafka = require('./services/pushToKafka')
const healthcheck = require('topcoder-healthcheck-dropin');
const kafkaOptions = config.get('KAFKA')
//const sleep = require('sleep');
const isSslEnabled = kafkaOptions.SSL && kafkaOptions.SSL.cert && kafkaOptions.SSL.key
const consumer = new Kafka.SimpleConsumer({
  connectionString: kafkaOptions.brokers_url,
  ...(isSslEnabled && { // Include ssl options if present
    ssl: {
      cert: kafkaOptions.SSL.cert,
      key: kafkaOptions.SSL.key
    }
  })
})


  const check = function () {
    if (!consumer.client.initialBrokers && !consumer.client.initialBrokers.length) {
      return false;
    }
    let connected = true;
    consumer.client.initialBrokers.forEach(conn => {
      logger.debug(`url ${conn.server()} - connected=${conn.connected}`);
      connected = conn.connected & connected;
    });
    return connected;
  };


const terminate = () => process.exit()
/**
 *
 * @param {Array} messageSet List of messages from kafka
 * @param {String} topic The name of the message topic
 * @param {Number} partition The kafka partition to which messages are written
 */
async function dataHandler (messageSet, topic, partition) {
  for (const m of messageSet) { // Process messages sequentially
    try {
      const payload = JSON.parse(m.message.value)
      logger.debug('Received payload from kafka:')
      logger.debug(payload)
      await updateInformix(payload)
 //     await insertConsumerAudit(payload, true, undefined, false)
      await consumer.commitOffset({ topic, partition, offset: m.offset }) // Commit offset only on success
    } catch (err) {
      logger.error('Could not process kafka message')
      logger.logFullError(err)
      if (!payload.retryCount) {
        payload.retryCount = 0
      }
      if (payload.retryCount >= config.KAFKA.maxRetry) {
        await pushToKafka(
          Object.assign({}, payload, { topic: config.KAFKA.errorTopic, recipients: config.KAFKA.recipients })
        )
        return
      }
      await pushToKafka(
        Object.assign({}, payload, { retryCount: payload.retryCount + 1 })
      )
      }
    }
  }


/**
 * Initialize kafka consumer
 */
async function setupKafkaConsumer () {
  try {
    await consumer.init()
    await consumer.subscribe(kafkaOptions.topic, kafkaOptions.partition, { time: Kafka.LATEST_OFFSET }, dataHandler)
    logger.info('Initialized kafka consumer')
    healthcheck.init([check])
  } catch (err) {
    logger.error('Could not setup kafka consumer')
    logger.logFullError(err)
    terminate()
  }
}

setupKafkaConsumer()

