

const config = require('config')
const pg = require('pg')
var AWS = require("aws-sdk");
const logger = require('./common/logger')
const pushToKafka = require('./services/pushToKafka')
const kafkaService = require('./services/pushToDirectKafka')
const postMessage = require('./services/posttoslack')
const auditTrail = require('./services/auditTrail');
const pgOptions = config.get('POSTGRES')
const pgConnectionString = `postgresql://${pgOptions.user}:${pgOptions.password}@${pgOptions.host}:${pgOptions.port}/${pgOptions.database}`


const port = 3000
var pgClient = null
//===============RECONSILER2 DYNAMODB CODE STARTS HERE ==========================

var docClient = new AWS.DynamoDB.DocumentClient({
  region: 'us-east-1',
  convertEmptyValues: true
});
//ElapsedTime = 094600000
ElapsedTime = config.DYNAMODB.DD_ElapsedTime
var params = {
  TableName: config.DYNAMODB.DYNAMODB_TABLE,
  FilterExpression: "#timestamp between :time_1 and :time_2",
  ExpressionAttributeNames: {
    "#timestamp": "timestamp",
  },
  ExpressionAttributeValues: {
    ":time_1": Date.now() - ElapsedTime,
    ":time_2": Date.now()
  }
}

async function callReconsiler2() {
  console.log("inside 2");
  await docClient.scan(params, onScan);
  return
}
async function onScan(err, data) {
  if (err) {
    logger.error("Unable to scan the table. Error JSON:", JSON.stringify(err, null, 2));
    terminate()
  } else {
    try {
      console.log("Scan succeeded.");
      await Promise.all(data.Items.map(async (items) => {
    //  data.Items.forEach(async function (item) {
        //console.log(item.payloadseqid);
        let retval;
        try {
          retval = await verify_pg_record_exists(item.payloadseqid)
        } catch (e) {
          logger.error(`${e}`)
        }
        //console.log("retval", retval);
        var s_payload = (item.pl_document)
        payload = s_payload
        payload1 = (payload.payload)
        logger.info(`Checking for  : ${item.payloadseqid} ${payload1.table}`)
        logger.info(`retval : ${retval}`)
        if (retval === false && `"${payload1.table}"` !== "sync_test_id") {
          //await pushToKafka(item.pl_document)
          logger.info(`Inside retval condition`)
          await kafkaService.pushToKafka(s_payload)
          await audit(s_payload, 1) //0 flag means reconsiler 1. 1 flag reconsiler 2 i,e dynamodb
          logger.info(`Reconsiler2 Posted Payload : ${JSON.stringify(item.pl_document)}`)
        }
        logger.info(`after retval condition`)
      }));
      if (typeof data.LastEvaluatedKey != "undefined") {
        console.log("Scanning for more...");
       // logger.info(`params.ExclusiveStartKey : ${params.ExclusiveStartKey}`)
       // logger.info(`data.LastEvaluatedKey: ${data.LastEvaluatedKey}`)
        params.ExclusiveStartKey = data.LastEvaluatedKey;
        await docClient.scan(params, onScan);
      }
      else {
        logger.info("Need to terminate.")
        terminate()
        //return
        
      }
    }
    catch (err) {
      const errmsg = `error-sync: Reconsiler2 : Error during dynamodb scan/kafka push: "${err.message}"`
      logger.error(errmsg)
      logger.logFullError(err)
      callposttoslack(errmsg)
      //terminate()
    }
  }
  //terminate()
}

async function verify_pg_record_exists(seqid) {
  return new Promise(async function (resolve, reject) {
    try {
      var paramvalues = [seqid]
      let sql = "select * from common_oltp.pgifx_sync_audit where pgifx_sync_audit.payloadseqid = ($1)"
      logger.info(`sql and params : ${sql} ${paramvalues}`)
      pgClient.query(sql, paramvalues, (err, result) => {
        if (err) {
          var errmsg0 = `error-sync: Audit reconsiler2 query  "${err.message}"`
          logger.error(errmsg0)
          reject(errmsg0);
        } else {
          logger.info(`Query result for ${paramvalues} : ${result.rowCount}`)
          if (result.rows.length > 0) {
            //console.log("row length > 0 ")
            resolve(true);
          } else {
            //console.log("0")
            resolve(false);
          }
        }
        //pgClient.end()
      })
    } catch (err) {
      const errmsg = `error-sync: Reconsiler2 : Error in setting up postgres client: "${err.message}"`
      logger.error(errmsg)
      logger.logFullError(err)
      await callposttoslack(errmsg)
      reject(errmsg)
      terminate()
    }
  });
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
  //logger.debug("Initialising Reconsiler1 setup...")
  //await setupPgClient()
  logger.debug("Initialising Reconsiler2 setup...")
  kafkaService.init().catch((e) => {
    logger.error(`Kafka producer intialization error: "${e}"`)
    terminate()
  })
  pgClient = new pg.Client(pgConnectionString)
  pgClient.connect(err => {
    if (err) {
      logger.error(`connection error, ${err.stack}`)
    } else {
      logger.info('pg connected.')
    }
  })
  callReconsiler2()
  // terminate()
}
//execute
run()
