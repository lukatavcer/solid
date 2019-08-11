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

process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;


// Starting our express app
const app = express();

// Set handlebars template engine
// app.engine('hbs', hbs({extname: 'hbs'}));
// app.set('views', 'views');

app.engine('.hbs', hbs({
    extname: '.hbs',
    layoutsDir: 'views/base',
    defaultLayout: 'base'
}));
app.set('view engine', '.hbs')

// Init winston logger
app.use(logging.expressWinston);

// My routes
app.get('/doctor', function (req, res) {
    logger.info("doctor");
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

app.get('/patient', function (req, res) {
    logger.info("patient");
    res.render('patient', {title: 'Pacient'});
});

// Static files
app.use("/static", express.static('static'));
// app.use(express.static(__dirname));

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