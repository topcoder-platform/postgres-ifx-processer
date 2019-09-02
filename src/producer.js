/**
 * Listens to DML trigger notifications from postgres and pushes the trigger data into kafka
 */
const config = require('config')
const pg = require('pg')
const logger = require('./common/logger')

const busApi = require('topcoder-bus-api-wrapper')
const _ = require('lodash')

const pgOptions = config.get('POSTGRES')
const pgConnectionString = `postgresql://${pgOptions.user}:${pgOptions.password}@${pgOptions.host}:${pgOptions.port}/${pgOptions.database}`
const pgClient = new pg.Client(pgConnectionString)

const express = require('express')
const app = express()
const port = 3000

const busApiClient = busApi(_.pick(config,
        ['AUTH0_URL', 'AUTH0_AUDIENCE', 'TOKEN_CACHE_TIME',
                'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET', 'BUSAPI_URL',
                'KAFKA_ERROR_TOPIC', 'AUTH0_PROXY_SERVER_URL']))
busApiClient
        .getHealth()
        .then(result => console.log(result.body, result.status))
        .catch(err => console.log(err))

async function postTopic(payload) {
        try {
                await busApiClient.postEvent(payload)
        } catch (e) {
                console.log(e)
        }
}

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
	await postTopic(payload)
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
        //console.log('pgClient', pgClient)
        res.send('health ok')
})
app.listen(port, () => console.log(`Example app listening on port ${port}!`))
