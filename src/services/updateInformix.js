
const informix = require('../common/informixWrapper')
const logger = require('../common/logger')

/**
 * Updates informix database with insert/update/delete operation
 * @param {Object} payload The DML trigger data
 */
async function updateInformix (payload) {
  logger.debug('Starting to update informix with data:')
  logger.debug(payload)
  if (payload.payload.table === 'scorecard_question'){
  logger.debug('inside scorecard_question')
  sleep.sleep(2);
  }
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
        sql = `delete from ${payload.payload.schema}:${payload.payload.table} where ${primaryKey}=${columns[primaryKey]};` // ""delete from <schema>:<table> where primary_key_col=primary_key_val"
      }
      break
    default:
      throw new Error(`Operation ${operation} is not supported`)
  }

  const result = await informix.executeQuery(payload.payload.schema, sql, null)
  return result
}

module.exports = updateInformix
