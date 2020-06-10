
  
const config = require('config')
const pg = require('pg')
var AWS = require("aws-sdk");
const logger = require('./common/logger')
const pushToKafka = require('./services/pushToKafka')
const postMessage = require('./services/posttoslack')
const auditTrail = require('./services/auditTrail');
const port = 3000
//===============RECONSILER2 DYNAMODB CODE STARTS HERE ==========================

async function callReconsiler2()
{console.log("inside 2");
    docClient.scan(params, onScan);
}

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

function onScan(err, data) {
   if (err) {
       logger.error("Unable to scan the table. Error JSON:", JSON.stringify(err, null, 2));
	terminate()
   } else {
	try
	   {
       console.log("Scan succeeded.");
        let total_dd_records = 0;
        let total_pushtokafka = 0;
         data.Items.forEach(async function(item) {
          //console.log(item.payloadseqid);
          var retval = await verify_pg_record_exists(item.payloadseqid)
          //console.log("retval", retval);
	  var s_payload =  (item.pl_document)
                payload = s_payload
                payload1 = (payload.payload)
              if (retval === false && `${payload1.table}` !== 'sync_test_id'){
               /* var s_payload =  (item.pl_document)
                payload = s_payload
                payload1 = (payload.payload)*/
                await pushToKafka(item.pl_document)
                await audit(s_payload,1) //0 flag means reconsiler 1. 1 flag reconsiler 2 i,e dynamodb
                logger.info(`Reconsiler2 : ${payload1.table} ${item.payloadseqid} posted to kafka: Total Kafka Count : ${total_pushtokafka}`)
                total_pushtokafka += 1
            }
          total_dd_records += 1
       });
          logger.info(`Reconsiler2 : count of total_dd_records  ${total_dd_records}`);
       if (typeof data.LastEvaluatedKey != "undefined") {
           console.log("Scanning for more...");
           params.ExclusiveStartKey = data.LastEvaluatedKey;
           docClient.scan(params, onScan);
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

async function verify_pg_record_exists(seqid)
{
    try {
	const pgClient = new pg.Client(pgConnectionString)
        if (!pgClient.connect()) {await pgClient.connect()}
        var paramvalues = [seqid]
        sql = 'select * from common_oltp.pgifx_sync_audit where pgifx_sync_audit.payloadseqid = ($1)'
              return new Promise(function (resolve, reject) {
            	pgClient.query(sql, paramvalues, async (err, result) => {
                if (err) {
                    var errmsg0 = `error-sync: Audit reconsiler2 query  "${err.message}"`
                    console.log(errmsg0)
                }
                else {
                    if (result.rows.length > 0) {
                        //console.log("row length > 0 ")
                        resolve(true);
                    }
                    else {
                        //console.log("0")
                        resolve(false);
                    }
                }
	    pgClient.end()
        })
        })}
    catch (err) {
    const errmsg = `error-sync: Reconsiler2 : Error in setting up postgres client: "${err.message}"`
    logger.error(errmsg)
    logger.logFullError(err)
    await callposttoslack(errmsg)
    terminate()
  }
}

//=================BEGIN HERE =======================
const terminate = () => process.exit()

async function run() {
  logger.debug("Initialising Reconsiler1 setup...")
   await setupPgClient()
  //logger.debug("Initialising Reconsiler2 setup...")
  //callReconsiler2()
 // terminate()
}
//execute
run()
