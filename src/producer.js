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

const express = require('express')
const app = express()
const port = 3000


async function setupPgClient () {
  try {
    await pgClient.connect()
    // Listen to each of the trigger functions
    for (const triggerFunction of pgOptions.triggerFunctions) {
      await pgClient.query(`LISTEN ${triggerFunction}`)
    }
    pgClient.on('notification', async (message) => {
      console.log('Received trigger payload:')
      logger.debug(`Received trigger payload:`)
      logger.debug(message)
      //console.log(message)
      try {
        const payload = JSON.parse(message.payload)
        console.log("level 0",payload);
	const validTopicAndOriginator = (pgOptions.triggerTopics.includes(payload.topic)) && (pgOptions.triggerOriginators.includes(payload.originator)) // Check if valid topic and originator
        if (validTopicAndOriginator) {
         // await pushToKafka(payload)
	await pushToKafka(payload)
        } else {
          logger.debug('Ignoring message with incorrect topic or originator')
        }
      } catch (err) {
        logger.error('Could not parse message payload')
        logger.logFullError(err)
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

