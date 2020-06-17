/*
 * Kafka producer that sends messages to cloud Kafka server.
 */
const Kafka = require('no-kafka')
const logger = require('../common/logger')
const _ = require('lodash')

// Create a new producer instance with KAFKA_URL, KAFKA_CLIENT_CERT, and
// KAFKA_CLIENT_CERT_KEY environment variables
const producer = new Kafka.Producer()

/**
 * Initialize the Kafka producer.
 */
async function init() {
    try {
        await producer.init()
    } catch (e) {
        throw new Error(e)
    }
}

/**
 * Post a new event to Kafka.
 *
 * @param {Object} event the event to post
 */
async function pushToKafka(event) {
    if (_.has(event, 'payload')) {
        // Post new structure
        const result = await producer.send({
            topic: event.topic,
            message: {
                value: JSON.stringify(event)
            }
        })
        // Check if there is any error
        const error = _.get(result, '[0].error')
        if (error) {
            if (error.code === 'UnknownTopicOrPartition') {
                logger.error(`Unknown event type "${event.topic}"`)
            } else {
                logger.error(`Unable to post message on cloud-kafka due to error: "${error.code}"`)
            }
        } else {
            const success = _.get(result, '[0]')
            logger.info(`Successfully published message for topic : ${success.topic}, on partition: ${success.partition}, offset ${success.offset}`)
        }
    } else {
        logger.error("Validating error before posting message on cloud kafka.")
    }
}

module.exports = {
    init,
    pushToKafka
}

