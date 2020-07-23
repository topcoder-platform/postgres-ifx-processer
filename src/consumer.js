/**
 * Receives postgres DML triggger messages from kafka and updates the informix database
 */
const config = require('config')
const Kafka = require('no-kafka')
const logger = require('./common/logger')
const updateInformix = require('./services/updateInformix')
const healthcheck = require('topcoder-healthcheck-dropin');
const auditTrail = require('./services/auditTrail');
const kafkaOptions = config.get('KAFKA')
const postMessage = require('./services/posttoslack')
const kafkaService = require('./services/pushToDirectKafka')

//const isSslEnabled = kafkaOptions.SSL && kafkaOptions.SSL.cert && kafkaOptions.SSL.key

const options = {
  groupId: kafkaOptions.KAFKA_GROUP_ID,
  connectionString: kafkaOptions.KAFKA_URL,
  ssl: {
    cert: kafkaOptions.KAFKA_CLIENT_CERT,
    key: kafkaOptions.KAFKA_CLIENT_CERT_KEY
  }
};
const consumer = new Kafka.GroupConsumer(options);

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

let cs_processId;
const terminate = () => process.exit()

/**
 *
 * @param {Array} messageSet List of messages from kafka
 * @param {String} topic The name of the message topic
 * @param {Number} partition The kafka partition to which messages are written
 */
var retryvar = "";
//let cs_payloadseqid;
async function dataHandler(messageSet, topic, partition) {
  for (const m of messageSet) { // Process messages sequentially
    let message
    let ifxstatus = 0
    try {
      // let ifxstatus = 0
      let cs_payloadseqid;
      message = JSON.parse(m.message.value)
      //logger.debug(`Consumer Received from kafka :${JSON.stringify(message)}`)
      if (message.payload.payloadseqid) cs_payloadseqid = message.payload.payloadseqid;
      logger.debug(`consumer : ${message.payload.payloadseqid} ${message.payload.table} ${message.payload.Uniquecolumn} ${message.payload.operation} ${message.timestamp} `);
      //await updateInformix(message)
      ifxstatus = await updateInformix(message)
      logger.debug(`Consumer :informix status for ${message.payload.table} ${message.payload.payloadseqid} : ${ifxstatus}`)
      if (message.payload['retryCount']) retryvar = message.payload.retryCount;
      await auditTrail([cs_payloadseqid, cs_processId, message.payload.table, message.payload.Uniquecolumn,
        message.payload.operation, "Informix-updated", retryvar, "", "", JSON.stringify(message), new Date(), message.topic], 'consumer')
      //}
    } catch (err) {
      logger.debug(`Consumer:ifx return status error for ${message.payload.table} ${message.payload.payloadseqid} : ${ifxstatus}`)
      const errmsg2 = `error-sync: Could not process kafka message or informix DB error: "${err.message}"`
      logger.error(errmsg2)
      logger.debug(`error-sync: consumer "${err.message}"`)
      await retrypushtokakfa(message, topic, m, partition)
    } finally {
      await consumer.commitOffset({ topic, partition, offset: m.offset }) // Commit offset only on success
    }
  }
}

async function retrypushtokakfa(message, topic, m, partition) {
  let cs_payloadseqid
  if (message.payload.payloadseqid) cs_payloadseqid = message.payload.payloadseqid;
  logger.debug(`Consumer : At retry function`)
  if (!cs_payloadseqid) {
    cs_payloadseqid = 'err-' + (new Date()).getTime().toString(36) + Math.random().toString(36).slice(2);
  }
  try {
    if (message.payload['retryCount']) retryvar = message.payload.retryCount;
    logger.debug(`Trying to push same message after adding retryCounter`)
    if (!message.payload.retryCount) {
      message.payload.retryCount = 0
      logger.debug('setting retry counter to 0 and max try count is : ', config.KAFKA.maxRetry);
    }
    if (message.payload.retryCount >= config.KAFKA.maxRetry) {
      logger.debug('Reached at max retry counter, sending it to error queue: ', config.KAFKA.errorTopic);
      logger.debug(`error-sync: consumer max-retry-limit reached`)
      await callposttoslack(`error-sync: postgres-ifx-processor : consumer max-retry-limit reached: "${message.payload.table}": payloadseqid : "${cs_payloadseqid}"`)
      let notifiyMessage = Object.assign({}, message, { topic: config.KAFKA.errorTopic })
      notifiyMessage.payload['recipients'] = config.KAFKA.recipients
      logger.debug('pushing following message on kafka error alert queue:')
      //retry push to error topic kafka again
      //await pushToKafka(notifiyMessage)
      await kafkaService.pushToKafka(notifiyMessage)
      return
    }
    message.payload['retryCount'] = message.payload.retryCount + 1;
    //await pushToKafka(message)
    kafkaService.pushToKafka(message)
    var errmsg9 = `consumer : Retry for Kafka push : retrycount : "${message.payload.retryCount}" : "${cs_payloadseqid}"`
    logger.debug(errmsg9)
  }
  catch (err) {
    await auditTrail([cs_payloadseqid, cs_processId, message.payload.table, message.payload.Uniquecolumn,
      message.payload.operation, "Error-republishing", message.payload['retryCount'], err.message, "", message.payload.data, new Date(), message.topic], 'consumer')
    const errmsg1 = `error-sync: postgres-ifx-processor: consumer : Error-republishing: "${err.message}"`
    logger.error(errmsg1)
    logger.debug(`error-sync: consumer re-publishing "${err.message}"`)
    await callposttoslack(errmsg1)
  } finally {
    await consumer.commitOffset({ topic, partition, offset: m.offset }) // Commit success as will re-publish
  }
}

async function callposttoslack(slackmessage) {
  if (config.SLACK.SLACKNOTIFY === 'true') {
    return new Promise(function (resolve, reject) {
      postMessage(slackmessage, (response) => {
        console.log(`respnse : ${response}`)
        if (response.statusCode < 400) {
          logger.debug('Message posted successfully');
          //callback(null);
        } else if (response.statusCode < 500) {
          const errmsg1 = `Slack Error: posting message to Slack API: ${response.statusCode} - ${response.statusMessage}`
          logger.debug(`error-sync: ${errmsg1}`)
        }
        else {
          logger.debug(`Server error when processing message: ${response.statusCode} - ${response.statusMessage}`);
          //callback(`Server error when processing message: ${response.statusCode} - ${response.statusMessage}`);
        }
        resolve("done")
      });
    }) //end
  }

}

/**
 * Initialize kafka consumer
 */
async function setupKafkaConsumer() {
  try {
    const strategies = [{
      subscriptions: [kafkaOptions.topic],
      handler: dataHandler
    }];
    await consumer.init(strategies)
    logger.info('Initialized kafka consumer')
    healthcheck.init([check])
    kafkaService.init().catch((e) => {
      logger.error(`Kafka producer intialization error: "${e}"`)
      await callposttoslack(`error-sync: postgres-ifx-processor : consumer Kafka producer intialization : ${e}`)
      terminate()
    })
  } catch (err) {
    logger.error('Could not setup kafka consumer')
    logger.logFullError(err)
    logger.debug(`error-sync: consumer kafka-setup "${err.message}"`)
    await callposttoslack(`error-sync: postgres-ifx-processor : consumer kafka-setup : ${err.message}`)
    terminate()
  }
}

setupKafkaConsumer()
