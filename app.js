// Usage:
// Generate a registration file by running:
// node app.js -r -u "http://localhost:9000" 
// add the registration file to the app_service_config_files array in your synapse config
// start the bridge by running:
// node app.js -p 9000
var http = require("http");
var https = require("https");
var qs = require('querystring');
var rp = require('request-promise');
const fs = require('fs');
var bridge;

// the port that the rocket chat outgoing webhook is set up to send to
var PORT = 8003;

 // Room ID in Matrix. This room must have join_rules: public 
var ROOM_ID = "!xxx:matrix.org";

// the incoming webhook in the rocket chat instance we are bridging
var WEBHOOK_URL = "http://example.com:3000/hooks/xxx/yyy";

// the name of the rocket chat bot so we can avoid echoing messages (usually "rocket.cat")
var ROCKETCHATBOT = "rocket.cat";

// users bridged from rocket chat to matrix will appear as USER_PREFIX + rocket_chat_event.user_name + ":" + HOMESERVER_DOMAIN
var USER_PREFIX = "@_rocketchat_"; 
var HOMESERVER_DOMAIN = "example.com";
var HOMESERVER = "https://example.com:8448";

var REGISTRATION_FILE = "rocketchat-registration.yaml";

var TLS_PRIVATE_KEY_PATH = "/path/to/privkey.pem";
var TLS_FULL_CHAIN_CERTIFICATE_PATH = "/path/to/fullchain.pem";

const TLS_DETAILS = {
  key: fs.readFileSync(TLS_PRIVATE_KEY_PATH),
  cert: fs.readFileSync(TLS_FULL_CHAIN_CERTIFICATE_PATH)
};

https.createServer(TLS_DETAILS, function(request, response) {
// alternatively, run the bridge without TLS: 
// http.createServer(function(request, response) {
    console.log(request.method + " " + request.url);

    var body = "";
    request.on("data", function(chunk) {
        body += chunk;
    });

    request.on("end", function() {
        var params = qs.parse(body);

        rocket_chat_event = JSON.parse(body);

        // avoid echoing
        if (rocket_chat_event.user_id !== ROCKETCHATBOT) {
            var intent = bridge.getIntent(USER_PREFIX + rocket_chat_event.user_name + ":" + HOMESERVER_DOMAIN);
            intent.sendText(ROOM_ID, rocket_chat_event.text);
        }
        response.writeHead(200, {"Content-Type": "application/json"});
        response.write(JSON.stringify({}));
        response.end();
    });
}).listen(PORT);

var Cli = require("matrix-appservice-bridge").Cli;
var Bridge = require("matrix-appservice-bridge").Bridge;
var AppServiceRegistration = require("matrix-appservice-bridge").AppServiceRegistration;

new Cli({
    registrationPath: REGISTRATION_FILE,
    generateRegistration: function(reg, callback) {
        reg.setId(AppServiceRegistration.generateToken());
        reg.setHomeserverToken(AppServiceRegistration.generateToken());
        reg.setAppServiceToken(AppServiceRegistration.generateToken());
        reg.setSenderLocalpart(ROCKETCHATBOT);
        reg.addRegexPattern("users", USER_PREFIX + ".*", true);
        callback(reg);
    },
    run: function(port, config) {
        bridge = new Bridge({
            homeserverUrl: HOMESERVER,
            domain: HOMESERVER_DOMAIN,
            registration: REGISTRATION_FILE,

            controller: {
                onUserQuery: function(queriedUser) {
                    console.log("query from " + queriedUser);
                    return {}; // auto-provision users with no additional data
                },

                onEvent: function(request, context) {
                    var event = request.getData();
                    if (event.type !== "m.room.message" || !event.content || event.room_id !== ROOM_ID) {
                        return;
                    }
                    var getProfileParams = {
                        uri: HOMESERVER + "/_matrix/client/r0/profile/" + qs.escape(event.user_id),
                        method: "GET",
                        json: true
                    };
                    var sendMessageParams = {
                        method: "POST",
                        json: true,
                        uri: WEBHOOK_URL,
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
                                sendMessageParams.body.icon_url = HOMESERVER + "/_matrix/media/v1/download/" + res.avatar_url.substring("mxc://".length);
                            }
                        }
                    }).finally(function() {
                        sendMessage(sendMessageParams)
                    });
               }
            }
        });
        console.log("Matrix-side listening on port %s", port);
        bridge.run(port, config);
    }
}).run();


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

