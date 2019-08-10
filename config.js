const path = require('path');

module.exports = {
    root: "data",
    // dbPath: ".db",
    // configPath: "config",
    port: "8433",
        serverUri: 'https://example.com:8433',
    mount: "/",
    multiuser: true,
    enforceToc: false,
    sslKey: path.resolve('config/cert/new.key'),
    sslCert: path.resolve('config/cert/new.cert'),
    webid: true,
    disablePasswordChecks: true,
    server: {
        name: "example.com"
    }
};