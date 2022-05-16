// We make use of this 'server' variable to provide the address of the
// REST Janus API. By default, in this example we assume that Janus is
// co-located with the web server hosting the HTML pages but listening
// on a different port (8088, the default for HTTP in Janus), which is
// why we make use of the 'window.location.hostname' base address. Since
// Janus can also do HTTPS, and considering we don't really want to make
// use of HTTP for Janus if your demos are served on HTTPS, we also rely
// on the 'window.location.protocol' prefix to build the variable, in
// particular to also change the port used to contact Janus (8088 for
// HTTP and 8089 for HTTPS, if enabled).
// In case you place Janus behind an Apache frontend (as we did on the
// online demos at http://janus.conf.meetecho.com) you can just use a
// relative path for the variable, e.g.:
//
// 		var server = "/janus";
//
// which will take care of this on its own.
//
//
// If you want to use the WebSockets frontend to Janus, instead, you'll
// have to pass a different kind of address, e.g.:
//
// 		var server = "ws://" + window.location.hostname + ":8188";
//
// Of course this assumes that support for WebSockets has been built in
// when compiling the server. WebSockets support has not been tested
// as much as the REST API, so handle with care!
//
//
// If you have multiple options available, and want to let the library
// autodetect the best way to contact your server (or pool of servers),
// you can also pass an array of servers, e.g., to provide alternative
// means of access (e.g., try WebSockets first and, if that fails, fall
// back to plain HTTP) or just have failover servers:
//
//		var server = [
//			"ws://" + window.location.hostname + ":8188",
//			"/janus"
//		];
//
// This will tell the library to try connecting to each of the servers
// in the presented order. The first working server will be used for
// the whole session.
//
var server = null;
if(window.location.protocol === 'http:')
	server = "http://" + window.location.hostname + ":8088/janus";
else
	server = "https://" + window.location.hostname + ":8089/janus";


server = 'http://3.36.125.123:8088/janus';	
var janus = null;
var streaming = null;
var opaqueId = "streamingtest-"+Janus.randomString(12);


var spinner = null;

var selectedStream = null;
var getStreamInterval = null;


$(document).ready(function() {
	// Initialize the library (all console debuggers enabled)
	Janus.init({debug: "all", callback: function() {
		
        // Make sure the browser supports WebRTC
        if(!Janus.isWebrtcSupported()) {
            bootbox.alert("No WebRTC support... ");
            return;
        }
        // Create session
        janus = new Janus(
            {
                server: server,
                success: function() {
                    // Attach to Streaming plugin
                    janus.attach(
                        {
                            plugin: "janus.plugin.streaming",
                            opaqueId: opaqueId,
                            success: function(pluginHandle) {
                                console.log("Streaming plugin established");
                                Janus.debug("Streaming plugin established");
                                streaming = pluginHandle;
                                getStreamInterval = setInterval(getStreamInfo(99),2000);
                            },
                            error: function(error) {
                                Janus.error("  -- Error attaching plugin... ", error);
                                bootbox.alert("Error attaching plugin... " + error);
                            },
                            iceState: function(state) {
                                Janus.log("ICE state changed to " + state);
                            },
                            webrtcState: function(on) {
                                Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
                            },
                            onmessage: function(msg, jsep) {
                                Janus.debug(" ::: Got a message :::", msg);
                                var result = msg["result"];
                                if(result) {
                                    if(result["status"]) {
                                        var status = result["status"];
                                        if(status === 'starting')
                                            Janus.log("Event Starting");
                                        else if(status === 'started')
                                            Janus.log("Event Starting");
                                        else if(status === 'stopped')
                                            stopStream();
                                    } 
                                }
                                if(jsep) {
                                    Janus.debug("Handling SDP as well...", jsep);
                                    var stereo = (jsep.sdp.indexOf("stereo=1") !== -1);
                                    // Offer from the plugin, let's answer
                                    streaming.createAnswer(
                                        {
                                            jsep: jsep,
                                            media: { audioSend: false, videoSend: false, data: true },
                                            customizeSdp: function(jsep) {
                                                if(stereo && jsep.sdp.indexOf("stereo=1") == -1) {
                                                    jsep.sdp = jsep.sdp.replace("useinbandfec=1", "useinbandfec=1;stereo=1");
                                                }
                                            },
                                            success: function(jsep) {
                                                Janus.debug("Got SDP!", jsep);
                                                var body = { request: "start" };
                                                streaming.send({ message: body, jsep: jsep });
                                            },
                                            error: function(error) {
                                                Janus.error("WebRTC error:", error);
                                                bootbox.alert("WebRTC error... " + error.message);
                                            }
                                        });
                                }
                            },
                            onremotestream: function(stream) {
                                Janus.debug(" ::: Got a remote stream :::", stream);

                                Janus.attachMediaStream($('#remoteVideo').get(0), stream);
                                var videoTracks = stream.getVideoTracks();
                                if(!videoTracks || videoTracks.length === 0) {
                                    // No remote video
                                    // $('#remoteVideo').hide();
                                } else {
                                    $('#remoteVideo').removeClass('hide').show();
                                }
                            },
                            ondataopen: function(data) {
                                Janus.log("The DataChannel is available!");
                            },
                            ondata: function(data) {
                                Janus.debug("We got data from the DataChannel!", data);
                            },
                            oncleanup: function() {
                                Janus.log(" ::: Got a cleanup notification :::");
                            }
                        });
                },
                error: function(error) {
                    Janus.error(error);
                    bootbox.alert(error, function() {
                        window.location.reload();
                    });
                },
                destroyed: function() {
                    window.location.reload();
                }
            });
		
	}});
});


function getStreamInfo(selectedStream) {
	
	var body = { request: "info", id: selectedStream };
	streaming.send({ message: body, success: function(result) {
		if(result["info"]) {
			Janus.log("Got info about stream with id: "+result["info"]["id"]);
            startStream(result["info"]["id"]);
            getStreamInterval.clearInterval();
		}
	}});
}

function startStream(selectedStream) {
	Janus.log("Selected video id " + selectedStream);
	if(!selectedStream) return;
	var body = { request: "watch", id: selectedStream};
	streaming.send({ message: body,});
}

function stopStream() {
	var body = { request: "stop" };
	streaming.send({ message: body });
	streaming.hangup();
}
