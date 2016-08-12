# matrix-appservice-rocketchat
A Rocket Chat application service

This is currently a very barebones bridge, it just does basic text in pre-enumerated channels.

To install:

```bash
$ npm install
```

To set up on the Rocket Chat side:
 * Add inbound & outbound webhook integrations to the room you want to bridge.
 * For the inbound webhook, note down the webhook URL that Rocket Chat provisions for you - e.g. http://matrix.org:3000/hooks/xxx/yyy
 * For the outbound webhook, you'll need to expose your bridge to the internet and hand the URL to Rocket Chat - e.g. https://rocketchatbridge.matrix.org

To set up on the Matrix side:
Create a config.yaml file (there's a skeleton one in config/config.sample.yaml). Add the homeserver details, the port of the listener, the Matrix Room ID and the Rocket Chat webhook URL to this file.

You might want to restrict the AS to a room. This is done by adding the following to the config::

  rooms:
    - exclusive: false
      regex: "!xxx:matrix.org"

Then generate a registration file by running:

```bash
$ node app.js -r -c config.yaml -u "http://localhost:9000"```
```

Reference the registration yaml file from your homeserver's homeserver.yaml config and restart the server to pick it up.

Start your application service:

```bash
$ node app.js -c config.yaml -p 9000
```

See also https://github.com/matrix-org/matrix-appservice-bridge/blob/master/HOWTO.md for the general theory of all this :)

