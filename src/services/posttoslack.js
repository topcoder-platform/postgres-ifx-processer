const config = require('config');
const zlib = require('zlib');
const url = require('url');
const https = require('https');
hookUrl = config.SLACK.URL
slackChannel = config.SLACK.SLACKCHANNEL
async function postMessage(message, callback) {
    var slackMessage = {
        channel: `${slackChannel}`,
        text: `${message}`,
    }
    const body = JSON.stringify(slackMessage);
    const options = url.parse(hookUrl);
    options.method = 'POST';
    options.headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
    };
    return new Promise(function (resolve, reject) {	
    const postReq = https.request(options, (res) => {
        const chunks = [];
        res.setEncoding('utf8');
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
            if (callback) {
                callback({
                    body: chunks.join(''),
                    statusCode: res.statusCode,
                    statusMessage: res.statusMessage,
                });
            }
         resolve(res)		
        });
       // return res;
    });

    postReq.write(body);
    postReq.end();
    }) 
}

module.exports = postMessage
