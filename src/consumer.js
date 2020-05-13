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
const postMessage = require('./services/posttoslack')
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

let cs_processId;
const terminate = () => process.exit()
/**
 *
 * @param {Array} messageSet List of messages from kafka
 * @param {String} topic The name of the message topic
 * @param {Number} partition The kafka partition to which messages are written
 */
var retryvar="";
//let cs_payloadseqid;
async function dataHandler(messageSet, topic, partition) {
let cs_payloadseqid
	for (const m of messageSet) { // Process messages sequentially
    let message
    try {
     // let ifxstatus = 0
      message = JSON.parse(m.message.value)
      logger.debug(`Consumer Received from kafka :${JSON.stringify(message)}`)
      if (message.payload.payloadseqid) cs_payloadseqid = message.payload.payloadseqid;
      logger.debug(`consumer : ${message.payload.payloadseqid} ${message.payload.table} ${message.payload.Uniquecolumn} ${message.payload.operation} ${message.timestamp} `);
       await updateInformix(message)
       //ifxstatus = await updateInformix(message)
       //logger.debug(`Consumer : Informix return status : ${ifxstatus}`)
      await consumer.commitOffset({ topic, partition, offset: m.offset }) // Commit offset only on success
	if (message.payload['retryCount']) retryvar = message.payload.retryCount;
       auditTrail([cs_payloadseqid,cs_processId,message.payload.table,message.payload.Uniquecolumn,
            message.payload.operation,"Informix-updated",retryvar,"","",JSON.stringify(message), message.timestamp,message.topic],'consumer')
    } catch (err) {
      const errmsg2 = `error-sync: Could not process kafka message or informix DB error: "${err.message}"`  
      logger.error(errmsg2)
      logger.debug(`error-sync: consumer "${err.message}"`) 
       if (!cs_payloadseqid){
	    cs_payloadseqid= 'err-'+(new Date()).getTime().toString(36) + Math.random().toString(36).slice(2);}
/*	     await auditTrail([cs_payloadseqid,3333,'message.payload.table','message.payload.Uniquecolumn',
           'message.payload.operation',"Error-Consumer","",err.message,"",'message.payload.data',new Date(),'message.topic'],'consumer')
       }else{
	       auditTrail([cs_payloadseqid,4444,message.payload.table,message.payload.Uniquecolumn,
            message.payload.operation,"Informix-updated",retryvar,"consumer2","",JSON.stringify(message), message.timestamp,message.topic],'consumer')
                   }*/
	    
      try {
	if (message.payload['retryCount']) retryvar = message.payload.retryCount;
        await consumer.commitOffset({ topic, partition, offset: m.offset }) // Commit success as will re-publish
	logger.debug(`Trying to push same message after adding retryCounter`)
        if (!message.payload.retryCount) {
          message.payload.retryCount = 0
          logger.debug('setting retry counter to 0 and max try count is : ', config.KAFKA.maxRetry);
        }
        if (message.payload.retryCount >= config.KAFKA.maxRetry) {
          logger.debug('Recached at max retry counter, sending it to error queue: ', config.KAFKA.errorTopic);
          logger.debug(`error-sync: consumer max-retry-limit reached`) 
              // push to slack - alertIt("slack message"
          await callposttoslack(`error-sync: postgres-ifx-processor : consumer max-retry-limit reached: "${message.payload.table}": payloadseqid : "${cs_payloadseqid}"`)
	  let notifiyMessage = Object.assign({}, message, { topic: config.KAFKA.errorTopic })
          notifiyMessage.payload['recipients'] = config.KAFKA.recipients
          logger.debug('pushing following message on kafka error alert queue:')
          //logger.debug(notifiyMessage)
	  await pushToKafka(notifiyMessage)
          return
        }
        message.payload['retryCount'] = message.payload.retryCount + 1;
        await pushToKafka(message)
	var errmsg9 = `error-sync: Retry for Kafka push : retrycount : "${message.payload.retryCount}" : "${cs_payloadseqid}"`
     logger.debug(errmsg9)
     //await callposttoslack(errmsg9)
      } catch (err) {
        
   await auditTrail([cs_payloadseqid,cs_processId,message.payload.table,message.payload.Uniquecolumn,
            message.payload.operation,"Error-republishing",message.payload['retryCount'],err.message,"",message.payload.data, message.timestamp,message.topic],'consumer')
	      const errmsg1 = `error-sync: postgres-ifx-processor: consumer : Error-republishing: "${err.message}"`
	      logger.error(errmsg1)
              logger.debug(`error-sync: consumer re-publishing "${err.message}"`)
              // push to slack - alertIt("slack message"
              await callposttoslack(errmsg1)
      }
    }
  }
}

async function callposttoslack(slackmessage) {
if(config.SLACK.SLACKNOTIFY === 'true') {
    return new Promise(function (resolve, reject) {
        postMessage(slackmessage, (response) => {
          console.log(`respnse : ${response}`)
                if (response.statusCode < 400) {
                logger.debug('Message posted successfully');
                //callback(null);
            } else if (response.statusCode < 500) {
                const errmsg1 =`Slack Error: posting message to Slack API: ${response.statusCode} - ${response.statusMessage}`
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
    await consumer.init()
    //await consumer.subscribe(kafkaOptions.topic, kafkaOptions.partition, { time: Kafka.LATEST_OFFSET }, dataHandler)
    await consumer.subscribe(kafkaOptions.topic, dataHandler)
	  
    logger.info('Initialized kafka consumer')
    healthcheck.init([check])
  } catch (err) {
    logger.error('Could not setup kafka consumer')
    logger.logFullError(err)
    logger.debug(`error-sync: consumer kafka-setup "${err.message}"`) 
    terminate()
  }
}

setupKafkaConsumer()
