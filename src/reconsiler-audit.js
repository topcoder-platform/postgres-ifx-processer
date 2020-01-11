const config = require('config')
const pg = require('pg')
const logger = require('./common/logger')
const pushToKafka = require('./services/pushToKafka')
const pgOptions = config.get('POSTGRES')
const postMessage = require('./services/posttoslack')
const pgConnectionString = `postgresql://${pgOptions.user}:${pgOptions.password}@${pgOptions.host}:${pgOptions.port}/${pgOptions.database}`
const pgClient = new pg.Client(pgConnectionString)
const auditTrail = require('./services/auditTrail');
const port = 3000

async function setupPgClient() {
  var payloadcopy
  try {
    await pgClient.connect()
    //sql1= "select * from pgifx_sync_audit where syncstatus in ('Informix-updated') 
    //and auditdatetime >= (now()::date - interval '10m') and auditdatetime <= (now()::date - interval '5m') ";
    //>= 12.53 and  <= 12.48
    rec_d_start = config.RECONSILER.RECONSILER_START
    rec_d_end = config.RECONSILER.RECONSILER_END
    rec_d_type = config.RECONSILER.RECONSILER_DURATION_TYPE
     var paramvalues = ['push-to-kafka',rec_d_start,rec_d_end];  
    //var paramvalues = ['push-to-kafka','60002027'];  
    //sql1 = 'select * from common_oltp.pgifx_sync_audit where pgifx_sync_audit.syncstatus =($1)'
    sql1 = " select seq_id, payloadseqid,auditdatetime at time zone 'utc' at time zone 'Asia/Calcutta',syncstatus, payload where pgifx_sync_audit.syncstatus =($1)"
    sql2 = " and pgifx_sync_audit.auditdatetime >= DATE(NOW()) - INTERVAL '1"+ rec_d_type + "' * ($2)"
    sql3 = " and pgifx_sync_audit.auditdatetime <= DATE(NOW()) - INTERVAL '1"+ rec_d_type + "' * ($3)"
    sql = sql1 + sql2 + sql3
    console.log('sql ', sql)
   // sql3 = ' select * from common_oltp.pgifx_sync_audit where pgifx_sync_audit.syncstatus =($1)'
   // sql4 = " and pgifx_sync_audit.payloadseqid = ($2)"
    
    //sql = sql3 + sql4
    //const result = await pgClient.query(sql1, (err, res) => {
    await pgClient.query(sql,paramvalues, async (err,result) => {
      if (err) {
        var errmsg0 = `error-sync: Audit reconsiler query  "${err.message}"`
        logger.debug (errmsg0)
        // await callposttoslack(errmsg0)
    }
      else{
        console.log("Reconsiler Rowcount = ", result.rows.length)    
        for (var i = 0; i < result.rows.length; i++) {
            for(var columnName in result.rows[i]) {
                // console.log('column "%s" has a value of "%j"', columnName, result.rows[i][columnName]);
                //if ((columnName === 'seq_id') || (columnName === 'payload')){
                if ((columnName === 'payload')){
                var reconsiler_payload = result.rows[i][columnName]
                }
              }//column for loop
          try {  
              var s_payload =  reconsiler_payload
              payload = JSON.parse(s_payload)
              payload1 = payload.payload
              await pushToKafka(payload1)
              logger.info('Reconsiler : Push to kafka and added for audit trail')
              audit(s_payload)
            } catch (error) {
              logger.error('Reconsiler: Could not parse message payload')
              logger.debug(`error-sync: Reconsiler parse message : "${error.message}"`)
              const errmsg1 = `postgres-ifx-processor: Reconsiler : Error Parse or payload : "${error.message}" \n payload : "${payloadcopy.payload}"`
              logger.logFullError(error)
              audit(error)
             await callposttoslack(errmsg1)
            } 
        }//result for loop
      }
       pgClient.end()
    })  
  }catch (err) {
    const errmsg = `postgres-ifx-processor: Reconsiler : Error in setting up postgres client: "${err.message}"`
    logger.error(errmsg)
    logger.logFullError(err)
    await callposttoslack(errmsg)
    terminate()
  }
}

const terminate = () => process.exit()

async function run() {
  logger.debug("Initialising Reconsiler setup...")
  await setupPgClient()
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
        } else {
          logger.debug(`Server error when processing message: ${response.statusCode} - ${response.statusMessage}`);
          //callback(`Server error when processing message: ${response.statusCode} - ${response.statusMessage}`);
        }
        resolve("done")
      });
    }) //end
  }

}
// execute  
run()

async function audit(message) {
    const pl_processid = 5555
    const jsonpayload = JSON.parse(message)
    payload = JSON.parse(jsonpayload.payload)
    payload1 = payload.payload
    const pl_seqid = payload1.payloadseqid
    const pl_topic = payload1.topic // TODO can move in config ? 
    const pl_table = payload1.table
    const pl_uniquecolumn = payload1.Uniquecolumn
    const pl_operation = payload1.operation
    const pl_timestamp = payload1.timestamp
    //const pl_payload = JSON.stringify(payload.payload)
    const logMessage = `${pl_seqid} ${pl_processid} ${pl_table} ${pl_uniquecolumn} ${pl_operation} ${payload.timestamp}`
    logger.debug(`reconsiler : ${logMessage}`);
   //await auditTrail([pl_seqid, pl_processid, pl_table, pl_uniquecolumn, pl_operation, "push-to-kafka-reconsiler", "", "reconsiler", "", "", new Date(), ""], 'producer')
}

