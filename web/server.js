process.env.NODE_LOGGER_SHOWLINES = 0;

var express = require('express'),
    app = express(),
    server = require('http').Server(app),
    io = require('socket.io').listen(server),
    bodyParser = require('body-parser'),
    sql = require('mssql'),
    confidential = require('./confidential'),
    log = require('metalogger')(),
    port = process.env.PORT || 5000;

var config = {
    user: confidential.databaseUserName,
    password: confidential.databasePassword,
    server: confidential.databaseServer,
    database: confidential.databaseName,
    requestTimeout: 60000,
    options: {
        encrypt: true // Use this if you're on Windows Azure
    }
};

var dataTypeConfig = {
    summary: {
        name: 'summary',
        storedProc: '[GetSummary]',
        refreshInterval: 10                     // Refresh every 10 seconds
    },
    lastHour: {
        name: 'lastHour',
        storedProc: '[GetDataLastHour]',
        refreshInterval: 30                     // Refresh every 30 seconds
    },
    Last24Hours: {
        name: 'last24Hours',
        storedProc: '[GetDataLast24h]',
        refreshInterval: 5 * 60                 // Refresh every 5 minutes
    },
    Last7Days: {
        name: 'last7Days',
        storedProc: '[GetDataLast7Days]',
        refreshInterval: 30 * 60                // Refresh every 30 minutes
    },
    Last30Days: {
        name: 'last30Days',
        storedProc: '[GetDataLast30Days]',
        refreshInterval: 30 * 60                // Refresh every 30 minutes
    },
    Last365Days: {
        name: 'last365Days',
        storedProc: '[GetDataLast365Days]',
        refreshInterval: 60 * 60 * 24           // Refresh every 1 day
    }
};

function refreshData(whichData) {
    log.info('Refresh data: ' + whichData.name);

    var connection = new sql.Connection(config, function(err) {
        if (err) {
            log.error('Oops, something went wrong\r\n' + err);
        }
        else {
            var request = new sql.Request(connection);
            request.execute(whichData.storedProc, function(err, recordsets, returnValue) {
                if (err) {
                    log.error(err);
                }
                else if (returnValue !== 0) {
                    log.error('Return value: ' + returnValue);
                }
                else if (recordsets.length !== 1) {
                    log.error('Expecting 1 recordset, got ' + recordsets.length);
                }
                else {
                    whichData.lastData = recordsets[0];
                    emitData(whichData);
                }
            });
        }
    });

    setTimeout(function() {
        refreshData(whichData);
    }, whichData.refreshInterval * 1000);
}

function emitData(whichData, socket) {
    if (whichData.lastData) {
        log.info('Emit data: ' + whichData.name);

        if (socket !== undefined) {
            socket.emit(whichData.name, whichData.lastData);
        }
        else {
            io.emit(whichData.name, whichData.lastData);
        }
    }
}

app.use(bodyParser.json());

app.use(express.static(__dirname + '/public'));

server.listen(port, function () {
    log.info('Listening on port ' + port);
});

io.sockets.on('connection', function (socket) {
    log.info('Client is connected.');

    emitLatestData(socket);
});

function emitLatestData(socket) {
    for (var whichData in dataTypeConfig) {
        if (dataTypeConfig.hasOwnProperty(whichData)) {
            emitData(dataTypeConfig[whichData], socket);
        }
    }
}

for (var whichData in dataTypeConfig) {
    if (dataTypeConfig.hasOwnProperty(whichData)) {
        refreshData(dataTypeConfig[whichData]);
    }
}
