const config = require('config')
const pg = require('pg')
var AWS = require("aws-sdk");
const logger = require('./common/logger')
const pushToKafka = require('./services/pushToKafka')
const kafkaService = require('./services/pushToDirectKafka')
const pgOptions = config.get('POSTGRES')
const postMessage = require('./services/posttoslack')
const pgConnectionString = `postgresql://${pgOptions.user}:${pgOptions.password}@${pgOptions.host}:${pgOptions.port}/${pgOptions.database}`
//const pgClient = new pg.Client(pgConnectionString)
const auditTrail = require('./services/auditTrail');
const port = 3000
//----------------------------Calling reconsiler 1 Audit log script ----------
async function setupPgClient() {
  var payloadcopy
  try {
    const pgClient = new pg.Client(pgConnectionString)
    if (!pgClient.connect()) {
        await pgClient.connect()
    }
    //rec_d_start = 10
    //rec_d_end = 1
    rec_d_start = config.RECONSILER.RECONSILER_START
    rec_d_end = config.RECONSILER.RECONSILER_END
    rec_d_type = config.RECONSILER.RECONSILER_DURATION_TYPE
    var paramvalues = ['push-to-kafka',rec_d_start,rec_d_end];
    sql1 = "select pgifx_sync_audit.seq_id, pgifx_sync_audit.payloadseqid,pgifx_sync_audit.auditdatetime ,pgifx_sync_audit.syncstatus, pgifx_sync_audit.payload from common_oltp.pgifx_sync_audit where pgifx_sync_audit.syncstatus =($1)"
    sql2 = " and pgifx_sync_audit.tablename not in ('sync_test_id') and pgifx_sync_audit.syncstatus not in ('Informix-updated') and pgifx_sync_audit.producer_err <> 'Reconsiler1' and pgifx_sync_audit.auditdatetime between (timezone('utc',now())) - interval '1"+ rec_d_type + "' * ($2)"
    sql3 = " and  (timezone('utc',now())) - interval '1"+ rec_d_type + "' * ($3)"
    sql = sql1 + sql2 + sql3
    logger.info(`${sql}`)
    await pgClient.query(sql,paramvalues, async (err,result) => {
      if (err) {
        var errmsg0 = `error-sync: Audit Reconsiler1 query  "${err.message}"`
        logger.debug (errmsg0)
        await callposttoslack(errmsg0)
    }
      else{
        console.log("Reconsiler1 : Rowcount = ", result.rows.length)
        for (var i = 0; i < result.rows.length; i++) {
            for(var columnName in result.rows[i]) {
            logger.debug(`reconsiler record details : ${result.rows[i][columnName]}`)
                if ((columnName === 'payload')){
                var reconsiler_payload = result.rows[i][columnName]
                }
              }//column for loop
          try {
	     if (reconsiler_payload != ""){
	     //original code
             let s_payload =  reconsiler_payload. 
             let  payload = JSON.parse(s_payload)
             let  payload1 = payload.payload
             // await pushToKafka(payload1) 
		     
		 /*  let s_payload =  reconsiler_payload 
		   let s_payload1 = JSON.stringify(s_payload)
		   let payload1
		   let payload 
		   if (s_payload1.includes("processId"))
		   {
		    console.log("here1")
		    payload = JSON.parse(s_payload)
		    //payload1 = JSON.parse(payload.payload)
		     payload1 = payload.payload
		    console.log(payload1)
		   } else
		   {console.log("here2")
		    payload = JSON.parse(s_payload1)
		    payload1 = payload
		    console.log(payload1)
		   } */
		//s_payload = JSON.stringify(s_payload)
		//let payload = JSON.parse(s_payload)
                //payload1 = payload.payload
                 //await pushToKafka(payload1) 
		 await kafkaService.pushToKafka(payload1)
		     
              logger.info('Reconsiler1 Push to kafka and added for audit trail')
             // await audit(s_payload,0) //0 flag means reconsiler 1. 1 flag reconsiler 2 i,e dynamodb
	      await audit(payload1,0) //0 flag means reconsiler 1. 1 flag reconsiler 2 i,e dynamodb
	    // }
            } }catch (error) {
              logger.error('Reconsiler1 : Could not parse message payload')
              logger.debug(`error-sync: Reconsiler1 parse message : "${error.message}"`)
              const errmsg1 = `error-sync: Reconsiler1 : Error Parse or payload : "${error.message}" `
              logger.logFullError(error)
             // await audit(error,0)
             await callposttoslack(errmsg1)
		    terminate()
            }
	}//result for loop
      }
       pgClient.end()
        terminate()
    })
  }catch (err) {
    const errmsg = `postgres-ifx-processor: Reconsiler1 : Error in setting up postgres client: "${err.message}"`
    logger.error(errmsg)
    logger.logFullError(err)
    await callposttoslack(errmsg)
    terminate()
  }
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

async function audit(message,reconsileflag) {
   var pl_producererr
   if (reconsileflag === 1)
   {
    	const jsonpayload = (message)
    	const payload = (jsonpayload.payload)
    	pl_producererr= "Reconsiler2"
    }else {
    	const jsonpayload = JSON.parse(message)
    	// payload = JSON.parse(jsonpayload.payload) //original
	  payload = jsonpayload
    	pl_producererr= "Reconsiler1"
    }
	  const pl_processid = 5555
    //const jsonpayload = JSON.parse(message)
    //payload = JSON.parse(jsonpayload.payload)
    payload1 = (payload.payload)
    const pl_seqid = payload1.payloadseqid
    const pl_topic = payload1.topic // TODO can move in config ?
    const pl_table = payload1.table
    const pl_uniquecolumn = payload1.Uniquecolumn
    const pl_operation = payload1.operation
    const pl_timestamp = payload1.timestamp
    const pl_payload = JSON.stringify(message)
	const logMessage = `${pl_seqid} ${pl_processid} ${pl_table} ${pl_uniquecolumn} ${pl_operation} ${payload.timestamp}`
    logger.debug(`${pl_producererr} : ${logMessage}`);
   await auditTrail([pl_seqid, 4444, pl_table, pl_uniquecolumn, pl_operation, "push-to-kafka", "", "", "Reconsiler1", pl_payload, new Date(), ""], 'producer')
	return
}

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
   kafkaService.init().catch((e) => {
   logger.error(`Kafka producer intialization error: "${e}"`)
   terminate()
    })
  //logger.debug("Initialising Reconsiler2 setup...")
  //callReconsiler2()
 // terminate()
}
//execute
run()
