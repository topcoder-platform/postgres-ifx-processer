/**
 * Provides services to execute queries on Informix database
 */
const config = require('config')
const Wrapper = require('informix-wrapper')
const logger = require('./logger')

const informixOptions = config.get('INFORMIX')
const writeOperationRegex = new RegExp('^(insert|update|delete|create)', 'i') // Regex to check if sql query is a write operation

/**
 * Creates a connection to Informix
 * @param {String} database Name of database to connect to
 * @param {Boolean} isWrite Whether the query is a write operation or not
 * @param {Function} reject The callback function called in case of errors
 * @returns {Object} The connection object
 */
function createConnection (database, isWrite, reject) {
  const jdbc = new Wrapper({ ...informixOptions, ...{ database } })
  jdbc.on('error', (err) => {
    if (isWrite) {
      jdbc.endTransaction(err, (err) => {
        jdbc.disconnect()
        return reject(err)
      })
    } else {
      jdbc.disconnect()
      return reject(err)
    }
  })
  return jdbc.initialize()
}

/**
 * Executes a sql query on the given database
 * @param {String} database Name of database to query on
 * @param {String} sql The sql query
 * @param {Object} [params] Optional configuration options
 * @returns {Promise<Object|Error>} Returns the result of the query on success or the error object on failure
 */
function executeQuery (database, sql, params) {
  return new Promise((resolve, reject) => {
    const isWrite = writeOperationRegex.test(sql.trim())
    const connection = createConnection(database, isWrite, reject)
    connection.connect((err) => {
      if (err) {
        connection.disconnect()
        return reject(err)
      }

      if (isWrite) { // Write operations are executed inside a transaction
        connection.beginTransaction(() => {
          connection.query(sql, (err, res) => {
            if (err) {
              return reject(err)
            }
            resolve(res)
          }, {
            start: (q) => {
              logger.debug(`Starting to execute ${q}`)
            },
            finish: (f) => {
              connection.endTransaction(null, () => {
                connection.disconnect()
                logger.debug(`Finished executing`)
              })
            }
          }).execute(params)
        })
      } else {
        connection.query(sql, (err, res) => {
          if (err) {
            return reject(err)
          }
          resolve(res)
        }, {
          start: (q) => {
            logger.debug(`Starting to execute ${q}`)
          },
          finish: (f) => {
            connection.disconnect()
            logger.debug(`Finished executing`)
          }
        }).execute(params)
      }
    })
  })
}

module.exports = {
  executeQuery
}
