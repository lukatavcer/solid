const { createLogger, format, transports } = require('winston');
const expressWinston = require('express-winston');

const loggerOptions = {
    transports: [
        new transports.Console()
    ],
    format: format.combine(
        format.colorize(),
        format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
    ignoreRoute: function (req, res) {
        return (req.url.startsWith('/static'));  // skip logging if accessing static files
    }
};

module.exports = {
    logger: createLogger(loggerOptions),
    expressWinston: expressWinston.logger(loggerOptions),
};