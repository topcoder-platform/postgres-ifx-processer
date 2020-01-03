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
var pl_processid;
//var pl_randonseq = 'err-' + (new Date()).getTime().toString(36) + Math.random().toString(36).slice(2)
async function setupPgClient() {
  try {
    await pgClient.connect()
    for (const triggerFunction of pgOptions.triggerFunctions) {
      await pgClient.query(`LISTEN ${triggerFunction}`)
    }
    pgClient.on('notification', async (message) => {
      // need to take care if empty message coming 
      pl_processid = message.processId
      try {
        const payload = JSON.parse(message.payload)
        const validTopicAndOriginator = (pgOptions.triggerTopics.includes(payload.topic)) && (pgOptions.triggerOriginators.includes(payload.originator)) // Check if valid topic and originator
        if (validTopicAndOriginator) {
          if (!isFailover) {
            await pushToKafka(payload)
            audit(payload)
          } else {
            await pushToDynamoDb(payload)
          }
        } else {
          logger.debug('Ignoring message with incorrect topic or originator')
          // push to slack - alertIt("slack message")
        }
      } catch (error) {
        logger.error('Could not parse message payload')
        logger.debug(`error-sync: producer parse message : "${error.message}"`)
        if (!isFailover) {
          await auditTrail([pl_randonseq, 1111, 'pl_table', 'pl_uniquecolumn', 'pl_operation', "error-producer", "", "", error.message, 'pl_payload', new Date(), 'pl_topic'], 'producer')
        }
        logger.logFullError(error)
        // push to slack - alertIt("slack message"
      }
    })
    logger.info('pg-ifx-sync producer: Listening to notifications')
  } catch (err) {
    logger.debug(`error-sync: producer postgres-setup 1 :"${err.message}"`)
    logger.error('Could not setup postgres client')
    logger.logFullError(err)
    terminate()
  }
}

const terminate = () => process.exit()

async function run() {
  try {
    await setupPgClient()
  }
  catch (err) {
    logger.debug(`Could not setup postgres client`)
    logger.debug(`error-sync: producer postgres-setup 0 :"${err.message}"`)
    terminate()
  }
}

// execute  
run()

async function audit() {
  var pl_seqid = payload.payload.payloadseqid
  var pl_topic = payload.topic
  var pl_table = payload.payload.table
  var pl_uniquecolumn = payload.payload.Uniquecolumn
  var pl_operation = payload.payload.operation
  var pl_timestamp = payload.timestamp
  var pl_payload = JSON.stringify(payload.payload)
  logger.debug(`producer : ${pl_seqid} ${pl_processid} ${pl_table} ${pl_uniquecolumn} ${pl_operation} ${payload.timestamp}`);
  auditTrail([pl_seqid, pl_processid, pl_table, pl_uniquecolumn, pl_operation, "push-to-kafka", "", "", "", pl_payload, pl_timestamp, pl_topic], 'producer')
}

app.get('/health', (req, res) => {
  res.send('health ok')
})
app.listen(port, () => console.log(`app listening on port ${port}!`))

