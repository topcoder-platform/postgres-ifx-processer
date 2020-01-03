/**
 * Listens to DML trigger notifications from postgres and pushes the trigger data into kafka
 */
const config = require('config')
const pg = require('pg')
const logger = require('./common/logger')
const pushToKafka = require('./services/pushToKafka')
const pushToDynamoDb = require('./services/pushToDynamoDb')
const pgOptions = config.get('POSTGRES')
const pgConnectionString = `postgresql://${pgOptions.user}:${pgOptions.password}@${pgOptions.host}:${pgOptions.port}/${pgOptions.database}`
const pgClient = new pg.Client(pgConnectionString)
const auditTrail = require('./services/auditTrail');
const express = require('express')
const app = express()
const port = 3000
const isFailover = process.argv[2] != undefined ? (process.argv[2] === 'failover' ? true : false) : false
async function setupPgClient() {
  try {
    await pgClient.connect()
    for (const triggerFunction of pgOptions.triggerFunctions) {
      await pgClient.query(`LISTEN ${triggerFunction}`)
    }
    pgClient.on('notification', async (message) => {
      const pl_randonseq = 'err-' + (new Date()).getTime().toString(36) + Math.random().toString(36).slice(2)
      try {
        const payload = JSON.parse(message.payload)
        const validTopicAndOriginator = (pgOptions.triggerTopics.includes(payload.topic)) && (pgOptions.triggerOriginators.includes(payload.originator)) // Check if valid topic and originator
        if (validTopicAndOriginator) {
          if (!isFailover) {
            logger.info('trying to push on kafka topic')
            await pushToKafka(payload)
            logger.info('pushed to kafka and added for audit trail')
          } else {
            logger.info('taking backup on dynamodb for reconciliation')
            await pushToDynamoDb(payload)
          }
          audit(message)
        } else {
          logger.debug('Ignoring message with incorrect topic or originator')
          // push to slack - alertIt("slack message")
        }
      } catch (error) {
        logger.error('Could not parse message payload')
        logger.debug(`error-sync: producer parse message : "${error.message}"`)
        logger.logFullError(error)
        if (!isFailover) {
          await auditTrail([pl_randonseq, 1111, "", "", "", "error-producer", "", "", error.message, "", new Date(), ""], 'producer')
        }
        // push to slack - alertIt("slack message"
      }
    })
    logger.info('pg-ifx-sync producer: Listening to pg-trigger channel.')
  } catch (err) {
    logger.error('Error in setting up postgres client: ', err.message)
    logger.logFullError(err)
    // push to slack - alertIt("slack message")
    terminate()
  }
}

const terminate = () => process.exit()

async function run() {
  logger.debug("Initialising producer setup...")
  await setupPgClient()
}

// execute  
run()

async function audit(message) {
  const pl_processid = message.processId
  const payload = JSON.parse(message.payload)
  const pl_seqid = payload.payload.payloadseqid
  const pl_topic = payload.topic // TODO can move in config ? 
  const pl_table = payload.payload.table
  const pl_uniquecolumn = payload.payload.Uniquecolumn
  const pl_operation = payload.payload.operation
  const pl_timestamp = payload.timestamp
  const pl_payload = JSON.stringify(payload.payload)
  const logMessage = `${pl_seqid} ${pl_processid} ${pl_table} ${pl_uniquecolumn} ${pl_operation} ${payload.timestamp}`
  if (!isFailover) {
    logger.debug(`producer : ${logMessage}`);
  } else {
    logger.debug(`Producer DynamoDb : ${logMessage}`);
  }
  auditTrail([pl_seqid, pl_processid, pl_table, pl_uniquecolumn, pl_operation, "push-to-kafka", "", "", "", pl_payload, pl_timestamp, pl_topic], 'producer')
}

function alertIt(message) {
  /**
      // call slack 
   */
}

app.get('/health', (req, res) => {
  res.send('health ok')
})
app.listen(port, () => console.log(`app listening on port ${port}!`))

