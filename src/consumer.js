/**
 * Receives postgres DML triggger messages from kafka and updates the informix database
 */
const config = require('config')
const Kafka = require('no-kafka')
const logger = require('./common/logger')
const informix = require('./common/informixWrapper.js')

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

const terminate = () => process.exit()

/**
 * Updates informix database with insert/update/delete operation
 * @param {Object} payload The DML trigger data
 */
async function updateInformix (payload) {
  logger.debug('Starting to update informix with data:')
  logger.debug(payload)
  //const operation = payload.operation.toLowerCase()
  const operation = payload.payload.operation.toLowerCase()
  console.log("level producer1 ",operation)
	let sql = null

        const columns = payload.payload.data
        const primaryKey = payload.payload.Uniquecolumn
  // Build SQL query
  switch (operation) {
    case 'insert':
      {
        const columnNames = Object.keys(columns)
        sql = `insert into ${payload.payload.schema}:${payload.payload.table} (${columnNames.join(', ')}) values (${columnNames.map((k) => `'${columns[k]}'`).join(', ')});` // "insert into <schema>:<table> (col_1, col_2, ...) values (val_1, val_2, ...)"
      }
      break
    case 'update':
      {
	  sql = `update ${payload.payload.schema}:${payload.payload.table} set ${Object.keys(columns).map((key) => `${key}='${columns[key]}'`).join(', ')} where ${primaryKey}=${columns[primaryKey]};` // "update <schema>:<table> set col_1=val_1, col_2=val_2, ... where primary_key_col=primary_key_val"
      }
      break
    case 'delete':
      {
       // const columns = payload.data
        //const primaryKey = payload.Uniquecolumn
        sql = `delete from ${payload.payload.schema}:${payload.payload.table} where ${primaryKey}=${columns[primaryKey]};` // ""delete from <schema>:<table> where primary_key_col=primary_key_val"
      }
      break
    default:
      throw new Error(`Operation ${operation} is not supported`)
  }

  const result = await informix.executeQuery(payload.payload.schema, sql, null)
  return result
}

/**
 *
 * @param {Array} messageSet List of messages from kafka
 * @param {String} topic The name of the message topic
 * @param {Number} partition The kafka partition to which messages are written
 */
async function dataHandler (messageSet, topic, partition) {
  for (const m of messageSet) { // Process messages sequentially
    try {
      const payload = JSON.parse(m.message.value)
      logger.debug('Received payload from kafka:')
      logger.debug(payload)
      await updateInformix(payload)
      await consumer.commitOffset({ topic, partition, offset: m.offset }) // Commit offset only on success
    } catch (err) {
      logger.error('Could not process kafka message')
      logger.logFullError(err)
    }
  }
}

/**
 * Initialize kafka consumer
 */
async function setupKafkaConsumer () {
  try {
    await consumer.init()
    await consumer.subscribe(kafkaOptions.topic, kafkaOptions.partition, { time: Kafka.LATEST_OFFSET }, dataHandler)
    logger.info('Initialized kafka consumer')
  } catch (err) {
    logger.error('Could not setup kafka consumer')
    logger.logFullError(err)
    terminate()
  }
}

setupKafkaConsumer()
