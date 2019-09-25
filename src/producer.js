/**
 * Listens to DML trigger notifications from postgres and pushes the trigger data into kafka
 */
const config = require('config')
const pg = require('pg')
const logger = require('./common/logger')
const pushToKafka = require('./services/pushToKafka')
const pgOptions = config.get('POSTGRES')
const pgConnectionString = `postgresql://${pgOptions.user}:${pgOptions.password}@${pgOptions.host}:${pgOptions.port}/${pgOptions.database}`
const pgClient = new pg.Client(pgConnectionString)
const auditTrail = require('./services/auditTrail');
const express = require('express')
const app = express()
const port = 3000


async function setupPgClient () {
  try {
    await pgClient.connect()
    for (const triggerFunction of pgOptions.triggerFunctions) {
      await pgClient.query(`LISTEN ${triggerFunction}`)
    }
    pgClient.on('notification', async (message) => {
      try {
        const payload = JSON.parse(message.payload)
	const validTopicAndOriginator = (pgOptions.triggerTopics.includes(payload.topic)) && (pgOptions.triggerOriginators.includes(payload.originator)) // Check if valid topic and originator
        if (validTopicAndOriginator) {
     console.log(`${payload.topic} ${payload.payload.table} ${payload.payload.operation} ${payload.timestamp}`);
	await pushToKafka(payload)
	} else {
          logger.debug('Ignoring message with incorrect topic or originator')
        }
     await auditTrail([payload.payload.payloadseqid,'scorecard_producer',1,payload.topic,payload.payload.table,payload.payload.Uniquecolumn,
	     payload.payload.operation,"",payload.timestamp,new Date(),JSON.stringify(payload.payload)],'producer')
      } catch (error) {
        logger.error('Could not parse message payload')
     await auditTrail([payload.payload.payloadseqid,'scorecard_producer',0,payload.topic,payload.payload.table,payload.payload.Uniquecolumn,
	     payload.payload.operation,"error",payload.timestamp,new Date(),JSON.stringify(payload.payload)],'producer')
	logger.logFullError(error)
      }
    })
    logger.info('Listening to notifications')
  } catch (err) {
    logger.error('Could not setup postgres client')
    logger.logFullError(err)
    terminate()
  }
}

async function run () {
  await setupPgClient()
}

run()

app.get('/health', (req, res) => {
        res.send('health ok')
})
app.listen(port, () => console.log(`app listening on port ${port}!`))

