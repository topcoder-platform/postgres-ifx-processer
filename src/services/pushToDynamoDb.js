const config = require('config')
const logger = require('../common/logger')
const _ = require('lodash')
var AWS = require("aws-sdk");
async function pushToDynamoDb(payload) {
  try { console.log('----Push To DynomoDB  -------');
	    var params = {
	    TableName: config.DYNAMODB.DYNAMODB_TABLE,
    	    Item: {
       		payloadseqid: payload.payload.payloadseqid,
       		pl_document: payload,
		pl_table: payload.payload.table,
		pl_uniquecolumn: payload.payload.Uniquecolumn,
		pl_operation: payload.payload.operation,
		pl_time: payload.timestamp, 
		timestamp: Date.now()
    		}
  		}
	  var docClient = new AWS.DynamoDB.DocumentClient({region: 'us-east-1',convertEmptyValues: true});
	  docClient.put(params, function(err, data) {
    	if (err) logger.error(err);
    	else logger.info(data);
  	});

  } catch (e) {
          logger.error(`error-sync: Error at PushToDynamoDB "${e}"`)
  }
}

module.exports = pushToDynamoDb
