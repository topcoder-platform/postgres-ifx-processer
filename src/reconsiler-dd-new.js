const logger = require('./common/logger')
const config = require('config')
const pg = require('pg')
const pgOptions = config.get('POSTGRES')
const pgConnectionString = `postgresql://${pgOptions.user}:${pgOptions.password}@${pgOptions.host}:${pgOptions.port}/${pgOptions.database}`
const pgClient = new pg.Client(pgConnectionString)
const kafkaService = require('./services/pushToDirectKafka')
const postMessage = require('./services/posttoslack')
const pushToDynamoDb = require('./services/pushToDynamoDb')
const auditTrail = require('./services/auditTrail');

const AWS = require("aws-sdk");

const documentClient = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-1',
  convertEmptyValues: true
});

async function setupPgClient() {
    var payloadcopy
    try {
      const pgClient = new pg.Client(pgConnectionString)
      if (!pgClient.connect()) {
          await pgClient.connect()
      }
      rec_d_start = config.RECONSILER.RECONSILER_START
      rec_d_end = config.RECONSILER.RECONSILER_END
      rec_d_type = config.RECONSILER.RECONSILER_DURATION_TYPE
      var paramvalues = [rec_d_start,rec_d_end];
      sql1 =  "select a.payloadseqid from common_oltp.producer_audit_dd a  where not exists (select from common_oltp.pgifx_sync_audit "
      sql2 =  " where pgifx_sync_audit.payloadseqid = a.payloadseqid) and a.auditdatetime "
      sql3 =  " between (timezone('utc',now())) - interval '1"+ rec_d_type + "' * ($1)"
      sql4 =  " and (timezone('utc',now())) - interval '1"+ rec_d_type + "' * ($2)"

      sql = sql1 + sql2 + sql3 + sql4
      logger.info(`${sql}`)
      const res = await pgClient.query(sql,paramvalues, async (err,result) => {
        if (err) {
          var errmsg0 = `error-sync: Audit Reconsiler1 query  "${err.message}"`
          logger.debug (errmsg0)
          await callposttoslack(errmsg0)
      }
        else{
          console.log("Reconsiler_dd_2 : Rowcount = ", result.rows.length)
          if (result.rows.length > 0)
          {
                Promise.all(result.rows.map(async (row) => {
                console.log(row.payloadseqid)     
                const x  =  await calldynamodb(row.payloadseqid)
                console.log("val of x",x)
            }   
        //))
        )).then(result => { if (typeof result.rows == "undefined") 
        {
            console.log("terminating after posting to kafka")
            pgClient.end()
            process.exit(1)
        }
        })          
          }
          else { 
                console.log("terminate due to 0 rows")
                pgClient.end()
                process.exit(1)
            }
        }
    })
    }
    catch(err)
    {
        console.log(err)
        process.exit(1)
    }
}


async function calldynamodb(payloadseqid)
{
    console.log("At dynamoc function")
    var params = {
      TableName : config.DYNAMODB.DYNAMODB_TABLE,
      KeyConditionExpression: 'payloadseqid = :hkey',
      ExpressionAttributeValues: {
        ':hkey': payloadseqid    
  }} 

    return new Promise(async function (resolve, reject) {
    await documentClient.query(params, async function(err, data) {
    if (err) console.log(err);
    else {
        var s_payload = (data.Items[0].pl_document)
       // console.log("s_payload",s_payload)
        await kafkaService.pushToKafka(s_payload)
        await audit(s_payload, 1)
        logger.info(`Reconsiler2 Posted Payload : ${s_payload}`)
    };
    resolve("done"); 
  }); 
}) 
}

async function audit(message, reconsileflag) {
    var pl_producererr = "Reconsiler2"
    const pl_processid = 5555
    payload1 = (message.payload)
    const pl_seqid = payload1.payloadseqid
    const pl_topic = payload1.topic // TODO can move in config ?
    const pl_table = payload1.table
    const pl_uniquecolumn = payload1.Uniquecolumn
    const pl_operation = payload1.operation
    const pl_timestamp = payload1.timestamp
    //const pl_payload = JSON.stringify(message)
    const pl_payload = message
    const logMessage = `${pl_seqid} ${pl_processid} ${pl_table} ${pl_uniquecolumn} ${pl_operation}`
    logger.debug(`${pl_producererr} : ${logMessage}`);
    await auditTrail([pl_seqid, pl_processid, pl_table, pl_uniquecolumn, pl_operation, "push-to-kafka", "", "", "Reconsiler2", pl_payload, new Date(), ""], 'producer')
    return
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
            const errmsg1 = `Slack Error: Reconsiler1: posting message to Slack API: ${response.statusCode} - ${response.statusMessage}`
            logger.debug(`error-sync: ${errmsg1}`)
          } else {
            logger.debug(`Reconsiler1: Server error when processing message: ${response.statusCode} - ${response.statusMessage}`);
            //callback(`Server error when processing message: ${response.statusCode} - ${response.statusMessage}`);
          }
          resolve("done")
        });
      }) //end
    }
    return
  }

  //=================BEGIN HERE =======================
const terminate = () => process.exit()

async function run() {
  logger.debug("Initialising Reconsiler2 setup...")
  kafkaService.init().catch((e) => {
    logger.error(`Kafka producer intialization error: "${e}"`)
    terminate()
  })
  setupPgClient()
}

run()
