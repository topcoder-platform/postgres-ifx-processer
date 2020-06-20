const config = require('config')
const pgpool = require('./db.js');
const logger = require('../common/logger')
//const pg = require('pg')
//const pgOptions = config.get('POSTGRES')
//const pgConnectionString = `postgresql://${pgOptions.user}:${pgOptions.password}@${pgOptions.host}:${pgOptions.port}/${pgOptions.database}`
//let pgClient2
//console.log(`"${pgConnectionString}"`);
/*async function setupPgClient2 () {
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
}*/

async function auditTrail (data,sourcetype) {
/*if (!pgClient2) {
	await setupPgClient2()
}*/
if (sourcetype === 'producer'){
        sql0 = "INSERT INTO common_oltp.pgifx_sync_audit(payloadseqid,processId,tablename,uniquecolumn,dboperation,syncstatus,retrycount,consumer_err,producer_err,payload,auditdatetime,topicname) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) "
        sql1=  " on conflict (payloadseqid) DO UPDATE SET (syncstatus,producer_err) = ($6,$9) where pgifx_sync_audit.payloadseqid = $1 and pgifx_sync_audit.syncstatus not in ('Informix-updated')";
        sql = sql0 + sql1
	logger.debug(`--Audit Trail update producer--`)
} else {
	sql0 = 'INSERT INTO common_oltp.pgifx_sync_audit(payloadseqid,processId,tablename,uniquecolumn,dboperation,syncstatus,retrycount,consumer_err,producer_err,payload,auditdatetime,topicname) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)'
	sql1= ' on conflict (payloadseqid) DO UPDATE SET (syncstatus,consumer_err,retrycount) = ($6,$8,$7)';
	sql = sql0 + sql1
}
  /*return pgClient2.query(sql, data, (err, res) => {
  if (err) {
  logger.debug(`-- Audit Trail  update error-- ${err.stack}`)
  //pgClient2.end()
  } else {
  //  logger.debug(`--Audit Trail update success-- `)
  }
})
pgClient2.end() */

/*require('events').EventEmitter.prototype._maxListeners = 70;
require('events').defaultMaxListeners = 70;*/

 /* process.on('warning', function (err) {
    if ( 'MaxListenersExceededWarning' == err.name ) {
      console.log('o kurwa');
      // write to log function
      process.exit(1); // its up to you what then in my case script was hang
    }
  });*/
	
	
pgpool.on('error', (err, client) => {
    logger.debug(`Unexpected error on idle client : ${err}`)
    process.exit(-1)
  })
	


 pgpool.connect((err, client, release) => {
    if (err) {
      return logger.debug(`Error acquiring client : ${err.stack}`)
    }
      client.query(sql, data, (err, res) => {
      release()
      if (err) {
        return logger.debug(`Error executing Query : ${err.stack}`)
      }
      logger.debug(`Audit Trail update : ${res.rowCount}`)
    })
  })
}

module.exports = auditTrail

