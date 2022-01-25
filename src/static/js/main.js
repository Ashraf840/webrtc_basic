//console.log('Hello!')

// get the location of the current client(browser)
//console.log(location)
//console.log(document.location)
//console.log(window.location)

// get all the HTML DOM element
var label_Username = document.querySelector('#label-username');
var input_Username = document.querySelector('#input-username');
var btn_Join = document.querySelector('#btn-join');

// store the value from the username-input-field
var username;

// empty js-obj to add the each RTCPeerConnection to this js-obj
var mapPeers = {}


btn_Join.addEventListener('click', () => {
    username = input_Username.value;

    // if the username-input-field is empty, don't let the user to join the room.
    // by using the "return", the js will not execute the codes below.
    if (username == '') {
        return;
    }


    // if the username is not empty, then clear the username-input-field and disable that input-field as well.
    input_Username.value = '';
    input_Username.disabled = true;
    input_Username.style.visibility = 'hidden';

    // also disable the join-room btn
    btn_Join.disabled = true;
    btn_Join.style.visibility = 'hidden';

    label_Username.innerHTML = username;

    // fetch the current-url info using the window.location()
    var loc = window.location;
    // create the scheme of the websocket
    var wsStart = 'ws://';

    // check if the client-url protocol is secured 'https'
    if (loc.protocol == 'https:') {
        wsStart = 'wss://';
    }

    // generate the websocket-url
    var url = wsStart + loc.host + loc.pathname;

     console.log('Websocket endpoint: ', url);

    // instantiate a websocket-obj & pass the url inside
    let socket = new WebSocket(url);

    // -------complete the websocket life-cycle----------------------------------------------

    // connect the frontend websocket with the backend consumer
    socket.onopen = function (e) {
        console.log('Frontend Websocket: Connection Established!');
        //------------------------------------------------------------------------------------ (Instead of sending a dummy serialized-json-object, call the "sendSignal" function)
        // Construct a msg using the 'message'-key
        // var jsonMsg = JSON.stringify({'message': 'This a message'});
        // After constructing the msg & serialize that into json-format, we need to use the "websocket.send()" method to send that msg into the backend consumer.
        // socket.send( jsonMsg )
        //------------------------------------------------------------------------------------

        // call the "sendSignal" func to send signals to other peers, although an empty-dict will be provided while provoking the "sendSignal" function.
        sendSignal(
            'new-peer',
            {'signal-msg': 'This is a dummy signal message to other peers!'},
            socket=socket
        );
    }

    // receive any messages sent from the backend consumer as json-format
    socket.onmessage = function (e) {
        console.log('Frontend Websocket ("onmessage" function): Receive messages!')
    // console.log(JSON.parse(e.data));

        // de-serialize the json-string into js-object
        // [NOTE]: equivalent to "json.loads()" in python for de-serializing into the native format
        var parsedData = JSON.parse(e.data);

        // the backend-consumer is going to sent a payload along with the key 'message' (NB: The 'send_message()' method will sent that payload), so we need to extract that key-value ("message") from the parsed-js-object
        var payload = parsedData['payload'];
        var peerUsername = parsedData['payload']['peer'];
        var action = parsedData['payload']['action'];
        var receiver_channel_name = parsedData['payload']['message']['receiver_channel_name'];
        // console.log('Peer Username: ', peerUsername)


        // check if the username is equal to the peerUsername, then avoid displaying the payload to the current-client. (other clients will see the current-client's connection-message)
        // the "username" will get the value from the user-input-field for joining a room.
        // the "peerUsername" will be got from the backend-channel to frontend-websocket
        if (username == peerUsername) {
            return;   // won't allow the JS to execute anymore code
        }

        // since the current user gets avoided, the other existing users will now create an offer, which will later be sent to the new-peer.
        // The offer will consist of peerUsername & it's channel-name
        if (action == 'new-peer') {
            // offer-sdp will be created by other existing-peers
            createOffer(peerUsername, receiver_channel_name);
            console.log('payload: ', payload);
            return;     // won't allow the JS to execute anymore code
        }

    }

    // disconnect the frontend websocket from the backend consumer
    socket.onclose = function (e) {
        console.log('Frontend Websocket: Connection Closed!');
    }

    // handle any error due to the websocket connection with the backend consumer
    socket.onerror = function (e) {
        console.log('Frontend Websocket: Error occurred!');
    }
});



// >>>>>>>> Get the audio & video from the client's local machine <<<<<<<<
// Create an empty "MediaStream" object
var localStream = new MediaStream();

const constraints = {
    'audio': true,
    'video': true,
};


// access client's webcam

//  after finishing the execution, it's going to return a stream. For streaming the video from the local-machine,
//  we are calling the local-video streaming element from the DOM.
const localVideo = document.querySelector('#local-video');


// it's an asynchronous-func, thus we need to make sure the code is fully executed before moving on to the next part.
var userMedia = navigator.mediaDevices.getUserMedia(constraints)
    // as soon as the 'getUserMedia' finished its execution, it'll return a MediaStream object.
    .then(stream => {
        // assign the stream to our 'localStream' variable
        localStream = stream;
        // assign the 'localStream' as the source-object of our HTML-video-element
        localVideo.srcObject = localStream;
        // also mute ourselves, since we don't want to listen to ourselves.
        localVideo.muted = true;
    })
    // In case we encounter an error, then we should handle that wrror using the catch-codeBlock
    .catch(error => {
        // the error will be console logged
        console.log('Error accessing media devices!', error);
    });



// Construct a msg using the 'message'-key
// When a new peer joins the room, it's going to set the 'action' -key to 'new-peer' &
// all the other peers will use the 'action' -key as received object, &
// when they see the 'action' -key as "new-peer", they'll understand that they've to send
// an offer to this new-peer. And the existing peers will change the 'action' -key to 'new-offer'.
// The new peers sends response to the existing peers & set the dictionary-key ("action") to "new-answer" followed by receiving the dictionary which contains the 'action' -key as "new-offer".


// function to send signal (msg-dict & action) to other peers;
// [NOTE]:  This is invoked (called) inside the "websocket.onopen()" function.
function sendSignal(action, message, socket) {
    var jsonMsg = JSON.stringify({
        'peer': username,   // it'll contain the value fetched from the user for joining the room
        'action': action, // regarding the "Scheme to Build P2P Connection"
        'message': message,  // dict-type
    });

    // let socket = new WebSocket(url);

    // After constructing the msg & serialize that into json-format, we need to use the "websocket.send()" method to send that msg into the backend consumer.
    socket.send( jsonMsg );
}



// function to create RTCPeerConncetion
function createOffer(peerUsername, channelName) {
    var peer_conn = new RTCPeerConnection(null);

    // add local-tracks; pass the "peer_conn" object
    addLocalTracks(peer_conn);

    // instantiate a dataChannel using the "peer_conn" obj
    var dc = peer_conn.createDataChannel('channel');

    // open the data-channel connection
    dc.onopen = e => {
        console.log('Connection Opened!');
    }

    // create an "onmessage" func to receive any message/dict/packet from the other client
    dc.onmessage = e => {
        console.log("New Message: " + e.data);
    }

    // create a new video-element in the HTML file for the remote-peer using a function ("createRemoteVideo");
    // pass the peerUserName of the remote-peer through the function ("createRemoteVideo"), cause the video-elem will contain the peerUsername in it's id.
    // it'll create the video-element along with the video-container & the video-wrapper. Lately, return the video-elem to the "remoteVideo" variable.
    // [NB]:  "peerUsername" is got from the dispatched "payload" from the backend-dj-channel.
    var remoteVideo = createRemoteVideo(peerUsername);

    // set the "peer_conn" obj along with the remoteVideo using the "setOnTrack()" function.
    // the media-stream of the new remote peer will be added to the "RTCPeerConnection" object.
    // So that the existing peer window will be able to stream the media of the remote new peer.
    setOnTrack(peer_conn, remoteVideo);


    // add each RTCPeerConnection of each peer to the "mapPeers" js-obj.
    // The key will be the peerUsername & the value will be stored as a
    // list consisting of the "RTCPeerConnection" obj & the second elem will be the associating dataChannel.
    mapPeers[peerUserName] = [peer_conn, dc]

    // if any user leaves the room, or cannot connect for some reason, then we need to handle the scenario using the "oniceconnectionstatechange" event-listener.
    peer_conn.oniceconnectionstatechange = () => {
        // store the iceconnectionstate of the
    };
}


// create video-element (w/ video-container) of the remotePeer in the existing peers window (HTML).
// Any new-peer which gets connected create a new video-element underneath the primary video-element in the HTML file of the other existing peers.
function createRemoteVideo(peerUsername) {
    // get the video-container elem from the HTML file & store that into a variable ("video_container")
    var video_container = document.querySelector('.video-container');

    // create remote-video elem
    var remoteVideo = document.createElement('video');
    // set the id of the newly-created remote-video using the "peerUsername"+ "-video"
    remoteVideo.id = peerUsername + "-video";
    remoteVideo.autoplay = true;   // as soon as the remoteVideo gets created, it'll start streaming automatically
    remoteVideo.playsInline = true    // it'll prohibit the browser to play the video in fullscreen by default, it'll start streaming the video from where the video-elem got created

    // since the video-element resides inside a div, thus create another element which returns a "div"
    var video_wrapper = document.createElement('div');

    video_container.appendChild(video_wrapper);
    video_wrapper.appendChild(remoteVideo);

    return remoteVideo;    // this "remoteVideo" elem will be saved into a var where the func gets called
}





// function to get the local-media stream & later add those tracks to the "RTCPeerConnection" Obj
function addLocalTracks(peer_conn) {
    // make a for-each loop on the localMedia stream obj to get all the tracks from the local machine of the existing peers.
    // Use the foreach-loop on the "getTracks()" func of the local-media-obj and this will return and event as track and will be added each track to the "peer_conn" object we found from making a foreach-loop on the "localStream" obj.
    localStream.getTracks().foreach(track => {
        peer_conn.addTrack(track, localStream);     // adding each available tracks of the existing peers to the "RTCPeerConnection" object.
    });
}




// get the media stream of the new remote peer
function setOnTrack(peer_conn, remoteVideo) {
    // Instantiate the "MediaStream" obj
    var remote_stream = new MediaStream();

    // assign the remote-video-stream of the new peer inside the new remote-video-element.
    // [NB]: The "remoteVideo" elem is called by the "createRemoteVideo()" func & stored inside the "remoteVideo" variable.
    remoteVideo.srcObject = remote_stream;

    // create an "ontrack" function on the "peer_conn" object, whose event will be asynchronous & add the tracks to the "remote_stream" object.
    // [NB]:  Whenever a remote-media-track is found in the RTCPeerConnection ("peer_conn") obj, it'll add the track asynchronously to the
    // "remoteVideo" elem which is meant to be created for any new peer joined to the room, thus other existing peers will create a "remoteVideo" elem
    // in their window and start adding tracks of the newly joined peer to their "remoteVideo" elem.
    peer_conn.ontrack = async (e) => {
        remote_stream.addTrack(e.track, remote_stream);
    };
}
