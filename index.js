const fs = require('fs');
const express = require('express');
const solid = require('solid-server');
const path = require('path');
const config = require('./config');
const logging = require('./middleware/logging');
const PORT = process.env.PORT || 8443;
const logger = logging.logger;
const https = require('https');
const hbs = require('express-handlebars');

// Ignore error if self signed certificate
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;


// Starting our express app
const app = express();

// Init winston logger
app.use(logging.expressWinston);

// Static files
app.use("/static", express.static('static'));
app.use(express.static(__dirname));

// Set handlebars template engine
app.engine('.hbs', hbs({
    extname: '.hbs',
    layoutsDir: 'views/base',
    defaultLayout: 'base'
}));
app.set('view engine', '.hbs');


// **************************************
// My routes
// **************************************
app.get('/doctore', function (req, res) {
    logger.info(req);
    let context = {
        patients: [
            'Luka',
            'Jan',
            'Bob',
        ],
        title: "First Post",
        story:
            {
                intro: "Before the jump",
                body: "After the jump"
            }
    };

    res.render('doctor', context);
});

app.get('/patiente', function (req2, res2) {
    logger.info("GER REQ");
    const options = {
        host: 'https://patient4.example.com',
        path: '/health',
        port:8443
    };

    const url = options.host + options.path;

    // let req = https.get(options, function(res) {
    //     console.log('STATUS: ' + res.statusCode);
    //     console.log('HEADERS: ' + JSON.stringify(res.headers));
    //
    //     // Buffer the body entirely for processing as a whole.
    //     var bodyChunks = [];
    //     res.on('data', function(chunk) {
    //         // You can process streamed parts here...
    //         bodyChunks.push(chunk);
    //     }).on('end', function() {
    //         var body = Buffer.concat(bodyChunks);
    //         console.log('BODY: ' + body);
    //         // ...and/or process the entire body here.
    //     })
    // });
    const options2 = {
        host: 'https://patient4.example.com',
        path: '/health',
        port: 8443
    };
    https.get('https://lukatavcer.example.com:8443/private/health/', (resp) => {
        let data = '';

        // A chunk of data has been recieved.
        resp.on('data', (chunk) => {
            data += chunk;
        });

        // The whole response has been received. Print out the result.
        resp.on('end', () => {
            console.log(JSON.parse(data).explanation);
        });

    }).on("error", (err) => {
        console.log("Error: " + err.message);
    });

    res2.send('patient');
});


// Mount Solid on /
const ldp = solid(config);
app.use('/', ldp);

// const http = require('http')
// var httpServer = http.createServer(app);
// httpServer.listen(3000);

// Starting server
const credentials = {
    key: fs.readFileSync(config.sslKey, 'utf8'),
    cert: fs.readFileSync(config.sslCert, 'utf8')
};

const httpsServer = https.createServer(credentials, app);
httpsServer.listen(PORT);