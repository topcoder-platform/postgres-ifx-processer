/*
 * Kafka producer that sends messages to Kafka server.
 */
const config = require('config')
const Kafka = require('no-kafka')
const logger = require('../common/logger')
const busApi = require('topcoder-bus-api-wrapper')
const _ = require('lodash')

const kafkaOptions = config.get('KAFKA')
const isSslEnabled = kafkaOptions.SSL && kafkaOptions.SSL.cert && kafkaOptions.SSL.key
let producer


const busApiClient = busApi(_.pick(config,
  ['AUTH0_URL', 'AUTH0_AUDIENCE', 'TOKEN_CACHE_TIME',
          'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET', 'BUSAPI_URL',
          'KAFKA_ERROR_TOPIC', 'AUTH0_PROXY_SERVER_URL']))
busApiClient
  .getHealth()
  .then(result => console.log(result.body, result.status))
  .catch(err => console.log(err))


async function pushToKafka(payload) {
  try {
          await busApiClient.postEvent(payload)
  } catch (e) {
          console.log(e)
  }
}

module.exports = pushToKafka

