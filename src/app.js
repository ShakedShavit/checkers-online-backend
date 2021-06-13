const express = require('express');
const cors = require('cors');
const path = require('path');
require('./db/mongoose');
const userRouter = require('./routes/user');
const initiateSockets = require('./socketio');

const app = express();
const server = require('http').createServer(app);

const io = require('socket.io')(server, {
   cors: {
     origin: "http://localhost:3000",
     credentials: true
   }
});

initiateSockets(io);

const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());
app.use(userRouter);

if (process.env.NODE_ENV === 'production') {
   app.use(express.static('client/build'));

   app.get('*', (req, res) => {
       res.sendFile(path.resolve(__dirname, '../', 'client', 'build', 'index.html'));
   });
}


let onlineUsersCounter = 0;
io.on('connection', (socket) => {
   onlineUsersCounter++;
   io.emit('onlineUsersCounter', onlineUsersCounter)
});

server.listen(port, () => {
   console.log('server connected, port:', port);
});
