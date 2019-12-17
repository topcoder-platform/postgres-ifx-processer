const config = require('config')
const logger = require('../common/logger')
const _ = require('lodash')
var AWS = require("aws-sdk");
async function pushToDynamoDb(payload) {
  try { console.log('----Inside DynomoDB code -------');
          console.log(payload)
	   p_dd_payloadseqid = payload.payload.payloadseqid;
	    var params = {
	    TableName: 'test_pg_ifx_payload_sync',
    	    Item: {
       		payloadseqid: payload.payload.payloadseqid,
       		pl_document: payload.payload,
		pl_table: payload.payload.table,
		pl_uniquecolumn: payload.payload.Uniquecolumn,
		pl_operation: payload.payload.operation,
		pl_time: payload.timestamp, 
		timestamp: Date.now()
    		}
  		}
	  var docClient = new AWS.DynamoDB.DocumentClient({region: 'us-east-1'});
	  docClient.put(params, function(err, data) {
    	if (err) console.log(err);
    	else console.log(data);
  	});

  } catch (e) {
          console.log(e)
  }
}

console.log("hello from DD")
module.exports = pushToDynamoDb
