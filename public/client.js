
// DOM elements.
const roomSelectionContainer = document.getElementById('room-selection-container');
const roomInput = document.getElementById('room-input');
const roomInputId = document.getElementById('room-input-id');
const answerBtn = document.getElementById('answerBtn');
const declineBtn = document.getElementById('declineBtn');
const videoChatContainer = document.getElementById('video-chat-container');
const localVideoComponent = document.getElementById('local-video');
const remoteVideoComponent = document.getElementById('remote-video');

const socket = io();

window.onload = function() {
  joinRoom(localStorage.getItem('loginUsername'));
  if(localStorage.getItem('loginUsername') == null || localStorage.getItem('loginID') == null){
    return;
  }
  if(localStorage.getItem('loginUsername') != "" && localStorage.getItem('loginID') != ""){
    location.href = '/clearcaller/' + localStorage.getItem('loginID');
    // socket.emit('connect_user', localStorage.getItem('loginID'));
  }
}

// window.onbeforeunload = function () {
//   socket.emit('disconnect_user', localStorage.getItem('loginID'));
// };

function startCall(calleeId){
  socket.emit('create_call', localStorage.getItem('loginUsername'), calleeId);
}

const mediaConstraints = {
  audio: true,
  video: { width: 1280, height: 720 },
}
var localStream;
var remoteStream;
var isRoomCreator;
var rtcPeerConnection;
var roomId;

const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
}

var caller;
socket.on('broadcast',function(data) {
  if(data.caller != localStorage.getItem('loginUsername') 
      && data.caller != "" 
      && data.caller != null 
      && data.caller != data.username
      && data.username == localStorage.getItem('loginUsername')){
    $('#myModal').modal('show');
    $('.modal-title').html(data.caller + " is calling you...  " + data.username );

    roomInput.value = data.caller;
    roomInputId.value = data.id;
  } else if(data.caller == localStorage.getItem('loginUsername')) {
    location.reload();
  }
});

answerBtn.addEventListener('click', () => {
  joinRoom(roomInput.value);
  //location.href = '/answer/' + roomInput.value + "/" + roomInputId.value;
  socket.emit('answer_call', roomInput.value, roomInputId.value)
});

declineBtn.addEventListener('click', () => {
  location.href = '/clearcaller/' + localStorage.getItem('loginID');
});

socket.on('room_created', async () => {
  await setLocalStream(mediaConstraints)
  isRoomCreator = true
})

socket.on('room_joined', async () => {
  await setLocalStream(mediaConstraints)
  socket.emit('start_call', roomId)
})

socket.on('full_room', () => {
  alert('The room is full, please try another one')
})

socket.on('start_call', async () => {
  if (isRoomCreator) {
    rtcPeerConnection = new RTCPeerConnection(iceServers)
    addLocalTracks(rtcPeerConnection)
    rtcPeerConnection.ontrack = setRemoteStream
    rtcPeerConnection.onicecandidate = sendIceCandidate
    await createOffer(rtcPeerConnection)
  }
})

socket.on('webrtc_offer', async (event) => {
  if (!isRoomCreator) {
    rtcPeerConnection = new RTCPeerConnection(iceServers)
    addLocalTracks(rtcPeerConnection)
    rtcPeerConnection.ontrack = setRemoteStream
    rtcPeerConnection.onicecandidate = sendIceCandidate
    rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event))
    await createAnswer(rtcPeerConnection)
  }
})

socket.on('webrtc_answer', (event) => {
  rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event))
})

socket.on('webrtc_ice_candidate', (event) => {
  // ICE candidate configuration.
  var candidate = new RTCIceCandidate({
    sdpMLineIndex: event.label,
    candidate: event.candidate,
  })
  rtcPeerConnection.addIceCandidate(candidate)
})

function joinRoom(room) {
  if (room === '') {
    alert('Please type a room ID')
  } else {
    roomId = room
    socket.emit('join', room)
  }
}

async function setLocalStream(mediaConstraints) {
  let stream
  try {
    stream = await navigator.mediaDevices.getUserMedia(mediaConstraints)
  } catch (error) {
    console.error('Could not get user media', error)
  }

  localStream = stream
  localVideoComponent.srcObject = stream
}

function addLocalTracks(rtcPeerConnection) {
  localStream.getTracks().forEach((track) => {
    rtcPeerConnection.addTrack(track, localStream)
  })
}

async function createOffer(rtcPeerConnection) {
  let sessionDescription
  try {
    sessionDescription = await rtcPeerConnection.createOffer()
    rtcPeerConnection.setLocalDescription(sessionDescription)
  } catch (error) {
    console.error(error)
  }

  socket.emit('webrtc_offer', {
    type: 'webrtc_offer',
    sdp: sessionDescription,
    roomId,
  })
}

async function createAnswer(rtcPeerConnection) {
  let sessionDescription
  try {
    sessionDescription = await rtcPeerConnection.createAnswer()
    rtcPeerConnection.setLocalDescription(sessionDescription)
  } catch (error) {
    console.error(error)
  }

  socket.emit('webrtc_answer', {
    type: 'webrtc_answer',
    sdp: sessionDescription,
    roomId,
  })
}

function setRemoteStream(event) {
  remoteVideoComponent.srcObject = event.streams[0]
  remoteStream = event.stream
}

function sendIceCandidate(event) {
  if (event.candidate) {
    socket.emit('webrtc_ice_candidate', {
      roomId,
      label: event.candidate.sdpMLineIndex,
      candidate: event.candidate.candidate,
    })
  }
}