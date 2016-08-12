// Usage:
// Generate a registration file by running:
// node app.js -r -u "http://localhost:9000" 
// add the registration file to the app_service_config_files array in your synapse config
// start the bridge by running:
// node app.js -p 9000

/*var http = require("http");
var https = require("https");
var qs = require('querystring');
var rp = require('request-promise');
const fs = require('fs');
var bridge;
*/
var qs = require("querystring");
var requestLib = require("request");
var rp = require('request-promise');
//var Rooms = require("./lib/rooms");
//var SlackHookHandler = require("./lib/slack-hook-handler");
//var MatrixHandler = require("./lib/matrix-handler");
var bridgeLib = require("matrix-appservice-bridge");
var bridge;

function startServer(config, callback) {
    var createServer;
    if (config.tls) {
        var fs = require("fs");
        var tls_options = {
            key: fs.readFileSync(config.tls.key_file),
            cert: fs.readFileSync(config.tls.crt_file)
        };
        createServer = function(cb) {
            return require("https").createServer(tls_options, cb);
        };
    }
    else {
        createServer = require("http").createServer;
    }
 
    createServer(function(request, response) {
        console.log(request.method + " " + request.url);

        var body = "";
        request.on("data", function(chunk) {
            body += chunk;
        });

        request.on("end", function() {
            var params = qs.parse(body);
            rocket_chat_event = JSON.parse(body);

            console.log("RC event: " + rocket_chat_event);

            // avoid echoing
            if (rocket_chat_event.user_id !== config.bot_username) {
                var intent = bridge.getIntent("@" + config.username_prefix + rocket_chat_event.user_name + ":" + config.homeserver.server_name);
                intent.sendText(config.rooms[0].matrix_room_id, rocket_chat_event.text);
            }
            response.writeHead(200, {"Content-Type": "application/json"});
            response.write(JSON.stringify({}));
            response.end();
        });
    }).listen(config.rocket_chat_webhook_port, function() {
        var protocol = config.tls ? "https" : "http";
        console.log("Rocket Chat-side listening on port " +
            config.rocket_chat_webhook_port + " over " + protocol);
        callback();
    });
}


var Cli = bridgeLib.Cli;
var Bridge = bridgeLib.Bridge;
var AppServiceRegistration = bridgeLib.AppServiceRegistration;

var cli = new Cli({
    registrationPath: "rocket-chat-registration.yaml",
    bridgeConfig: {
        schema: "config/rocket-chat-config-schema.yaml",
        affectsRegistration: true
    },
    generateRegistration: function(reg, callback) {
        var config = cli.getConfig();
        reg.setId(AppServiceRegistration.generateToken());
        reg.setHomeserverToken(AppServiceRegistration.generateToken());
        reg.setAppServiceToken(AppServiceRegistration.generateToken());
        reg.setSenderLocalpart(config.bot_username);
        reg.addRegexPattern("users", "@" + config.username_prefix + ".*", true);
        callback(reg);
    },
    run: function(port, config) {
        bridge = new Bridge({
            homeserverUrl: config.homeserver.url,
            domain: config.homeserver.server_name,
            registration: "rocket-chat-registration.yaml",

            controller: {
                onUserQuery: function(queriedUser) {
                    console.log("query from " + queriedUser);
                    return {}; // auto-provision users with no additional data
                },

                onEvent: function(request, context) {
                    var event = request.getData();
                    console.log("event recieved: " + JSON.stringify(event));
                    if (event.type !== "m.room.message" || !event.content || event.room_id !== config.rooms[0].matrix_room_id) {
                        return;
                    }
                    var getProfileParams = {
                        uri: config.homeserver.url + "/_matrix/client/r0/profile/" + qs.escape(event.user_id),
                        method: "GET",
                        json: true
                    };
                    var sendMessageParams = {
                        method: "POST",
                        json: true,
                        uri: config.rooms[0].webhook_url,
                        body: {
                            text: event.content.body
                        }
                    };

                    // attempt to look up displayname and avatar_url - then send the message
                    rp(getProfileParams).then(function(res) {
                        if (res) {
                            if (res.displayname) {
                                sendMessageParams.body.username = res.displayname;
                                console.log("found displayname: " + res.displayname);
                            }
                            if (res.avatar_url && res.avatar_url.indexOf("mxc://") === 0) {
                                console.log("found avatar_url: " + res.avatar_url);
                                sendMessageParams.body.icon_url = config.homeserver.url + "/_matrix/media/v1/download/" + res.avatar_url.substring("mxc://".length);
                            }
                        }
                    }).finally(function() {
                        sendMessage(sendMessageParams)
                    });
               }
            }
        });
        startServer(config, function() {
            console.log("Matrix-side listening on port %s", port);
            bridge.run(port, config);
        });
    }
});
cli.run();


var sendMessage = function(options) {
    rp(options).then(function(res) {
        if (!res) {
            console.log("HTTP Error: %s", res);
        }
        else {
            console.log("HTTP Msg sent!  %s", res);
        }
    });
};

