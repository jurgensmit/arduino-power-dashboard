module.exports = function () {

    var productionweb = '../arduino-power-dashboard-production/';

    var config = {

        // all javascript files
        alljs: [
            './*.js',
            './web/public/*.js',
            './web/public/lib/app.js',
            './web/*.js',
        ],

        // all web server files
        allwebserverfiles: [
            'web/*.*',
            '!web/confidential.js',
            'web/public/**/*'
        ],

        // all production web server files that should not bedeleted or touched
        staticproductionfiles: [
            productionweb + 'confidential.js'
        ],

        // sftp options
        sftpOptions: {
            host: '192.168.178.35',
            remotePath: '/root/',
            auth: 'keyMain'
        },

        // node settings
        defaultPort: 5000,
        nodeServer: './web/server.js',

        browserSyncOptions: {
            // watch the following files; changes will be injected (css & images) or cause browser to refresh
            files: ['./**/*.*'],

            // informs browser-sync to proxy our expressjs app which would run at the following location
            proxy: 'http://localhost:5000',

            // open the proxied app in chrome
            browser: ['chrome']
        }
    };

    return config;
};
