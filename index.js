const express = require('express');
const solid = require('solid-server');
const path = require('path');
const logging = require('./middleware/logging');
const PORT = process.env.PORT || 3000;
const logger = logging.logger;
const hbs = require('express-handlebars');

// Starting our express app
const app = express();
// const asd = solid.createApp();

// app.engine('hbs', hbs({extname: 'hbs'}));
// const app = createApp();

// Init winston logger
app.use(logging.expressWinston);

// Mounting solid on /ldp
const ldp = solid({
  sslKey: path.resolve('../cert/key.pem'),
  sslCert: path.resolve('../cert/cert.pem'),
  webid: true
});

// My routes
app.get('/doctor', function(req, res) {
  logger.info("doctor");
  res.render('doctor');
});

// Static files
app.use("/static", express.static(path.join(__dirname, 'static')));
// app.use(express.static(__dirname));

app.use('/', ldp);

// Starting server
app.listen(PORT, function () {
  logger.info(`Server started on port ${PORT}!`);
});

// My routes
app.get('/patient', function(req, res) {
  logger.info("patient");
  res.send('patient route view');
});