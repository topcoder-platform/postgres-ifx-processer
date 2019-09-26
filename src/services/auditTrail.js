const config = require('config')
const pg = require('pg')
const logger = require('../common/logger')

const pgOptions = config.get('POSTGRES')
const pgConnectionString = `postgresql://${pgOptions.user}:${pgOptions.password}@${pgOptions.host}:${pgOptions.port}/${pgOptions.database}`
let pgClient2

async function setupPgClient2 () {
  pgClient2 = new pg.Client(pgConnectionString)
  try {
    await pgClient2.connect()
	logger.debug('Connected to Pg Client2 Audit:')
    }
   catch (err) {
    logger.error('Could not setup postgres client2')
    logger.logFullError(err)
    process.exit()
  }
}

async function auditTrail (data,sourcetype) {
if (!pgClient2) {
	await setupPgClient2()
}
if (sourcetype === 'producer'){
 sql = 'INSERT INTO tcs_catalog.producer_scorecard_audit(payloadseqid,origin_source,kafka_post_status,topic_name,table_name,Uniquecolumn,operationtype,errormessage,payloadtime,auditdatetime,payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)'
logger.debug(`--Audit Trail update producer--`)
} else {
sql = 'INSERT INTO tcs_catalog.consumer_scorecard_audit(payloadseqid,origin_source,table_name,Uniquecolumn,operationtype,dest_db_status, dest_retry_count,errormessage,payloadtime,auditdatetime,dest_operationquery) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)'
logger.debug(`--Audit Trail  update consumer--`)
}
  return pgClient2.query(sql, data, (err, res) => {
  if (err) {
  logger.debug(`--Audit Trail  update error-- ${err.stack}`)
  //pgClient2.end()
  } else {
    logger.debug(`--Audit Trail update success-- `)
  }
})
}


module.exports = auditTrail

