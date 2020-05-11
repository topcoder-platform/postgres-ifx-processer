
const informix = require('../common/informixWrapper')
const logger = require('../common/logger')

async function updateInformix (payload) {
  logger.debug(`Received payload at updateinformix stringify : ${JSON.stringify(payload)}`)
  logger.debug('=====Starting to update informix with data:====')
  const operation = payload.payload.operation.toLowerCase()
  console.log("Informix DML Operation :",operation)
	let sql = null
	let t0 = []
	let paramvalue = null

        const columns = payload.payload.data
	logger.debug(`Columns details at updateinformix : ${columns}`)
        const primaryKey = payload.payload.Uniquecolumn
  // Build SQL query
  switch (operation) {
    case 'insert':
      {
        const columnNames = Object.keys(columns)
        //sql = `insert into ${payload.payload.schema}:${payload.payload.table} (${columnNames.join(', ')}) values (${columnNames.map((k) => `'${columns[k]}'`).join(', ')});` 
        sql = `insert into ${payload.payload.schema}:${payload.payload.table} (${columnNames.join(', ')}) values (${columnNames.map((k) => `?`).join(', ')});`
        t0 = Object.keys(columns).map((key) => `{"value":"${columns[key]}"}`)
        paramvalue = "[" + `${t0}` + "]"
      }
      break
    case 'update':
      {
	  //sql = `update ${payload.payload.schema}:${payload.payload.table} set ${Object.keys(columns).map((key) => `${key}='${columns[key]}'`).join(', ')} where ${primaryKey}=${columns[primaryKey]};` 
	  sql = `update ${payload.payload.schema}:${payload.payload.table} set ${Object.keys(columns).map((key) => `${key}= ?`).join(', ')} where ${primaryKey}= ?;`
	  t0 = Object.keys(columns).map((key) => `{"value":"${columns[key]}"}`)
          t0.push(`{"value":"${columns[primaryKey]}"}`) //param value for appended for where clause
	  paramvalue = "[" + `${t0}` + "]"
      }
      break
    case 'delete':
      {
        //sql = `delete from ${payload.payload.schema}:${payload.payload.table} where ${primaryKey}=${columns[primaryKey]};`
	 sql = `delete from ${payload.payload.schema}:${payload.payload.table} where ${primaryKey}= ?;`
	 t0.push(`{"value":"${columns[primaryKey]}"}`)
	 paramvalue = "[" + `${t0}` + "]"
      }
      break
    default:
      throw new Error(`Operation ${operation} is not supported`)
  }

  //const result = await informix.executeQuery(payload.payload.schema, sql, null)
  //return result
	
  //Preparedstatement for informix
  logger.debug(`Before JSON conversion Parameter values are : ${paramvalue}`);
  var finalparam = JSON.parse(paramvalue)
  console.log(`Typeof finalparam : ${typeof(finalparam)}`)
  if (finalparam.constructor === Array ) console.log('isarray')
   else console.log('finalparam not an array')
     
  const result = await informix.executeQuery(payload.payload.schema, sql, finalparam)
  return result.then((res)=>{logger.debug(`Preparedstmt Result status : ${res}`)}).catch((e) => {logger.debug(`Preparedstmt Result error  ${e}`)})
}

module.exports = updateInformix
