
const informix = require('../common/informixWrapper')
const logger = require('../common/logger')

String.prototype.escapeSpecialChars = function () {
  return this.replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/\f/g, "\\f")
    .replace("/\/g", "\");
};

async function updateInformix(payload) {
  logger.debug(`Informix Received from consumer-kafka :${JSON.stringify(payload)}`)
  const operation = payload.payload.operation.toLowerCase()
  console.log("=====Informix DML Operation :==========", operation)
  let sql = null
  let t0 = []
  const columns = payload.payload.data
  const primaryKey = payload.payload.Uniquecolumn
  // Build SQL query
  switch (operation) {
    case 'insert':
      {
        const columnNames = Object.keys(columns)
        sql = `insert into ${payload.payload.schema}:${payload.payload.table} (${columnNames.join(', ')}) values (${columnNames.map((k) => `?`).join(', ')});`
        t0 = Object.keys(columns).map((key) => `{"value":"${columns[key]}"}`)
      }
      break
    case 'update':
      {
        sql = `update ${payload.payload.schema}:${payload.payload.table} set ${Object.keys(columns).map((key) => `${key}= ?`).join(', ')} where ${primaryKey}= ?;`
        t0 = Object.keys(columns).map((key) => `{"value":"${columns[key]}"}`)
        t0.push(`{"value":"${columns[primaryKey]}"}`) //param value for appended for where clause
      }
      break
    case 'delete':
      {
        sql = `delete from ${payload.payload.schema}:${payload.payload.table} where ${primaryKey}= ?;`
        t0.push(`{"value":"${columns[primaryKey]}"}`)
      }
      break
    default:
      throw new Error(`Operation ${operation} is not supported`)
  }

  //Preparedstatement for informix
  t0.forEach((name, index) => t0[index] = `${name.escapeSpecialChars()}`);
  //logger.debug(`Param values : ${t0}`);
  let temp1 = "[" + `${t0}` + "]"
  logger.debug(`preparing json before parsing: ${temp1}`)
  let finalparam = JSON.parse(temp1)

  /*console.log(`Typeof finalparam : ${typeof(finalparam)}`)
  if (finalparam.constructor === Array ) console.log('isarray')
  else console.log('finalparam not an array')*/
  logger.debug(`Final sql and param values are -- ${sql} ${JSON.stringify(finalparam)}`);
  const result = await informix.executeQuery(payload.payload.schema, sql, finalparam)
  logger.debug(`ifx execute query result : ${result}`)
  return result
}

module.exports = updateInformix
