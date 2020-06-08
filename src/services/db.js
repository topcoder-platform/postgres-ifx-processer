const config = require('config')
const pg = require('pg')
 const pgOptions = config.get('POSTGRES')
 var pool = new pg.Pool(pgOptions);
module.exports = pool;
