const express = require('express')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)
const session = require('express-session')
const flash=require('express-flash-messages') 
const router = express.Router();
var admin = require("firebase-admin");

var serviceAccount = require("./solaboratetask-firebase-adminsdk-3uyjp-7b0da45549.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://solaboratetask-default-rtdb.firebaseio.com"
});
var db = admin.database();
var ref = db.ref();

var path = require('path');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'public'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(flash());
app.use(session({
  secret: 'secret',
  resave: true,
  saveUninitialized: true
}))

app.get('/', function(req, res) {
  ref.once("value", function(snapshot) {
    res.render('index', {
      jsonArr: JSON.stringify(snapshot.val())
    });
  });
});

app.get('/call/:caller/:calleeId', function(req, res) {
  var callRef = ref.child( req.params.calleeId);
  callRef.update({
    "caller" : req.params.caller
  });
});

app.get('/answer/:caller/:calleeId', function(req, res) {
  var key;
  ref.orderByChild('username').equalTo(req.params.caller).on("value", function(snapshot) {
    console.log(snapshot.val());
    snapshot.forEach(function(data) {
        key = data.key;
    });
  });

  var answerRef = ref.child(key);
  answerRef.update({
    "caller" : req.params.caller
  });
});

app.get('/clearcaller/:loginID/', function(req, res) {
  var callerClearRef = ref.child(req.params.loginID);
  callerClearRef.update({
    "caller" : ""
  });
});

io.on('connection', (socket) => {

  // socket.on('clear_user', (ID) => {

  // });

  socket.on('create_call', (caller, calleeId) => {
    var callRef = ref.child(calleeId);
    callRef.update({
      "caller" : caller
    });
  });

  socket.on('answer_call', (caller, calleeId) => {
    var key;
    ref.orderByChild('username').equalTo(caller).on("value", function(snapshot) {
      console.log(snapshot.val());
      snapshot.forEach(function(data) {
          key = data.key;
      });
    });

    var answerRef = ref.child(key);
    answerRef.update({
      "caller" : caller
    });
  });

  socket.on('join', (roomId) => {
  
    const roomClients = io.sockets.adapter.rooms[roomId] || { length: 0 }
    const numberOfClients = roomClients.length

    ref.on("child_changed", function(snapshot) {
      player = snapshot.val();
      io.sockets.emit('broadcast', { username: player.username, caller: player.caller, id : player.id});
    });

    if (numberOfClients == 0) {
      socket.join(roomId)
      socket.emit('room_created', roomId)
    } else if (numberOfClients == 1) {
      socket.join(roomId)
      socket.emit('room_joined', roomId)
    } else {
      socket.emit('full_room', roomId)
    }
  })

  socket.on('start_call', (roomId) => {
    socket.broadcast.to(roomId).emit('start_call')
  })
  socket.on('webrtc_offer', (event) => {
    socket.broadcast.to(event.roomId).emit('webrtc_offer', event.sdp)
  })
  socket.on('webrtc_answer', (event) => {
    socket.broadcast.to(event.roomId).emit('webrtc_answer', event.sdp)
  })
  socket.on('webrtc_ice_candidate', (event) => {
    socket.broadcast.to(event.roomId).emit('webrtc_ice_candidate', event)
  })
})

const port = process.env.PORT || 3000
server.listen(port, () => {
  console.log(`Express server listening on port ${port}`)
})
module.exports = router;