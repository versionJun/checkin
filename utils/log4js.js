const { dayjs } = require('./dayjs.js')
const log4js = require("log4js")
const recording = require('log4js/lib/appenders/recording')
const logger = log4js.getLogger()

log4js.addLayout("div", function (config) {
    return function (logEvent) {
        return log4jsLayoutDiv(logEvent, config)
    }
})

function log4jsLayoutDiv(log4jsEvent, log4jsConfig) {
    const msg = []
    msg.push(`[${dayjs.tz(log4jsEvent.startTime).format('YYYY-MM-DD HH:mm:ss')}]`)
    msg.push(`[${log4jsEvent.level.levelStr}]`)
    if (JSON.stringify(log4jsEvent.context) !== '{}') {
        Object.keys(log4jsEvent.context).forEach((key) => {    
            msg.push(`${key}:${log4jsEvent.context[key]}`)
        })  
    }
    msg.push(`${log4jsEvent.data.join('')}`)
    return msg.join(' ')
}

log4js.configure({
    appenders: {
        recording: {
            type: 'recording',
        },
        stdout: {
            type: "stdout",
            layout: {
                type: "div"
            }
        },
    },
    categories: {
        default: {
            appenders: [
                "recording",
                "stdout"
            ],
            level: "ALL",
            // enableCallStack: true
        },
    },
});

const levelStrArr = [ 'ALL', 'TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL', 'MARK', 'OFF' ]

const getLevelStrArrIndex = (levelStr) => { return levelStrArr.findIndex(value=>value == levelStr) }

function getLog4jsStr(levelStr = 'ALL') {
    let log4jsEvent = recording.replay()
    if (levelStr != 'ALL')
        log4jsEvent = log4jsEvent.filter(e => getLevelStrArrIndex(e.level.levelStr) >= getLevelStrArrIndex(levelStr))
    return log4jsEvent.map((e) => log4jsLayoutDiv(e)).join('\n')
}

exports.logger = logger
exports.recording = recording
exports.getLog4jsStr = getLog4jsStr
