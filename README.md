# matrix-appservice-rocketchat
A Rocket Chat application service

This is currently a very barebones bridge, it just does basic text in pre-enumerated channels.

To install:

```bash
$ npm install
```

Generate a registration file by running:

```bash
$ node app.js -r -u "http://localhost:9000"```
```

You might want to restrict the AS to a room. This is done by adding the following to the config::

  rooms:
    - exclusive: false
      regex: "!xxx:matrix.org"

Reference the registration yaml file from your homeserver's homeserver.yaml config and restart the server to pick it up.

Start your application service:

```bash
$ node app.js -p 9000
```

To set up on the Rocket Chat side:
 * Add inbound & outbound webhook integrations to the room you want to bridge.
 * For the inbound webhook, note down the URL that Rocket Chat provisions for you - e.g. http://matrix.org:3000/hooks/xxx/yyy
 * For the outbound webhook, you'll need to expose your bridge to the internet and hand the URL to Rocket Chat - e.g. http://rocketchatbridge.matrix.org:9000
 * Add the Matrix Room ID, port, homeserver details and Rocket Chat webhook URL to the app.js (this will be moved to the config file shortly) and restart.

See also https://github.com/matrix-org/matrix-appservice-bridge/blob/master/HOWTO.md for the general theory of all this :)

