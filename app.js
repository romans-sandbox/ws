const WebSocket = require('ws');

const wss = new WebSocket.Server({
  port: 8081
});

wss.on('connection', function (ws) {
  console.log('client connected');

  ws.on('message', function (message) {
    console.log('received: %s', message);
  });

  ws.send('server says ping');
});
