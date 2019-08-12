const path = require('path');

module.exports = {
    root: "data",
    // dbPath: ".db",
    // configPath: "config",
    port: "8443",
        serverUri: 'https://example.com:8443',
    mount: "/",
    multiuser: true,
    enforceToc: false,
    sslKey: path.resolve('config/cert/server.key'),
    sslCert: path.resolve('config/cert/server.crt'),
    webid: true,
    disablePasswordChecks: true,
    server: {
        name: "example.com"
    },
    email: {
        host: 'example.com',
        port: 25,
        secure: false,
        tls: {
            rejectUnauthorized: false
        }
    },
};