
const config = require('config')
const pg = require('pg')
const logger = require('../common/logger')
const postMessage = require('./posttoslack')
const pgOptions = config.get('POSTGRES')
const pgpool = require('./db.js');

const terminate = () => process.exit()

async function pushToAuditDD(message)
{
try
{
   const pl_channel = message.channel
   const pl_processid = message.processId
   const payload = JSON.parse(message.payload)
   const pl_seqid = payload.payload.payloadseqid
   const pl_topic = payload.topic 
   const pl_table = payload.payload.table
   const pl_uniquecolumn = payload.payload.Uniquecolumn
   const pl_operation = payload.payload.operation
   const pl_timestamp = payload.timestamp
   const pl_payload = JSON.stringify(payload.payload)
   const logMessage = `${pl_channel} ${pl_processid} ${pl_seqid} ${pl_processid} ${pl_table} ${pl_uniquecolumn} ${pl_operation} ${payload.timestamp}`

  let paramval = [pl_seqid,pl_timestamp,pl_channel,pl_table,pl_operation,JSON.stringify(message),pl_topic,pl_uniquecolumn,pl_processid]
    sql0 = "INSERT INTO common_oltp.producer_audit_dd(payloadseqid,auditdatetime,channelname,tablename,dboperation,payload,topicname,uniquecolumn,processid) "
    sql1=  " VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)  on conflict (payloadseqid) DO nothing ";
    sql = sql0 + sql1

  pgpool.on('error', (err, client) => {
    logger.debug(`producer_audit_dd: Unexpected error on idle client : ${err}`)
  })
	
 pgpool.connect((err, client, release) => {
    if (err) {
      return logger.debug(`producer_audit_dd : Error acquiring client : ${err.stack}`)
    }
      client.query(sql, paramval, (err, res) => {
      release()
      if (err) {
        return logger.debug(`producer_audit_dd :Error executing Query : ${err.stack}`)
      }
      logger.debug(`producer_audit_dd : Audit Trail update : ${res.rowCount}`)
    })
  })
}
catch(err)
{
  logger.debug(`pushToAuditDD : ${err}`)
  callposttoslack(`pushToAuditDD : ${err}`)
  process.exit(1)
}

}


async function callposttoslack(slackmessage) {
  if (config.SLACK.SLACKNOTIFY === 'true') {
    return new Promise(function (resolve, reject) {
      postMessage(slackmessage, (response) => {
        console.log(`respnse : ${response}`)
        if (response.statusCode < 400) {
          logger.debug('Message posted successfully');
          //callback(null);
        } else if (response.statusCode < 500) {
          const errmsg1 = `Slack Error: posting message to Slack API: ${response.statusCode} - ${response.statusMessage}`
          logger.debug(`error-sync: ${errmsg1}`)
        }
        else {
          logger.debug(`Server error when processing message: ${response.statusCode} - ${response.statusMessage}`);
          //callback(`Server error when processing message: ${response.statusCode} - ${response.statusMessage}`);
        }
        resolve("done")
      });
    }) //end
  }
}


module.exports = { pushToAuditDD }
