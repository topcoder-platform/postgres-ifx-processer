/**
 * Receives postgres DML triggger messages from kafka and updates the informix database
 */
const config = require('config')
const Kafka = require('no-kafka')
const logger = require('./common/logger')
const updateInformix = require('./services/updateInformix')
const pushToKafka = require('./services/pushToKafka')
const healthcheck = require('topcoder-healthcheck-dropin');
const auditTrail = require('./services/auditTrail');
const kafkaOptions = config.get('KAFKA')
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
async function dataHandler(messageSet, topic, partition) {
  for (const m of messageSet) { // Process messages sequentially
    let message
    try {
      message = JSON.parse(m.message.value)
      logger.debug('Received message from kafka:')
      logger.debug(JSON.stringify(message))
      await updateInformix(message)
      await consumer.commitOffset({ topic, partition, offset: m.offset }) // Commit offset only on success
      await auditTrail([message.payload.payloadseqid,'scorecard_consumer',message.payload.table,message.payload.Uniquecolumn,
             message.payload.operation,1,0,"",message.timestamp,new Date(),message.payload],'consumer')
    } catch (err) {
      logger.error('Could not process kafka message')
      //logger.logFullError(err)
      try {
        await consumer.commitOffset({ topic, partition, offset: m.offset }) // Commit success as will re-publish
        logger.debug('Trying to push same message after adding retryCounter')
        if (!message.payload.retryCount) {
          message.payload.retryCount = 0
          logger.debug('setting retry counter to 0 and max try count is : ', config.KAFKA.maxRetry);
        }
        if (message.payload.retryCount >= config.KAFKA.maxRetry) {
          logger.debug('Recached at max retry counter, sending it to error queue: ', config.KAFKA.errorTopic);

          let notifiyMessage = Object.assign({}, message, { topic: config.KAFKA.errorTopic })
          notifiyMessage.payload['recipients'] = config.KAFKA.recipients
          logger.debug('pushing following message on kafka error alert queue:')
          logger.debug(notifiyMessage)
          await pushToKafka(notifiyMessage)
          return
        }
        message.payload['retryCount'] = message.payload.retryCount + 1;
        await pushToKafka(message)
        logger.debug('pushed same message after adding retryCount')
      } catch (err) {
	 //await auditTrail([payload.payload.payloadseqid,'scorecard_consumer',payload.payload.table,payload.payload.Uniquecolumn,
           //  payload.payload.operation,0,message.payload.retryCount,"re-publish kafka err",payload.timestamp,new Date(),""],'consumer')
        logger.error("Error occured in re-publishing kafka message", err)
      }
    }
  }
}


/**
 * Initialize kafka consumer
 */
async function setupKafkaConsumer() {
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
