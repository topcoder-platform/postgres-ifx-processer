/**
 * This module defines a winston logger instance for the application.
 */
const { createLogger, format, transports } = require('winston')

const config = require('config')

const logger = createLogger({
  format: format.combine(
    format.json(),
    format.colorize(),
    format.printf((data) => `${new Date().toISOString()} - ${data.level}: ${JSON.stringify(data.message, null, 4)}`)
  ),
  transports: [
    new transports.Console({ // Log to console
      stderrLevels: ['error'],
      level: config.get('LOG_LEVEL')
    }),
    new transports.File({ // Log to file
      filename: config.get('LOG_FILE'),
      level: config.get('LOG_LEVEL')
    })
  ]
})

/**
 * Logs complete error message with stack trace if present
 */
logger.logFullError = (err) => {
  if (err && err.stack) {
    logger.error(err.stack)
  } else {
    logger.error(JSON.stringify(err))
  }
}
module.exports = logger
