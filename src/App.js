import { useRef, useState } from "react";

import firebase from "firebase/app";

import "firebase/firestore";

import { ReactComponent as HangupIcon } from "./icons/hangup.svg";
import { ReactComponent as MoreIcon } from "./icons/more-vertical.svg";
import { ReactComponent as CopyIcon } from "./icons/copy.svg";
import { ReactComponent as Shareicon } from "./icons/screenshare.svg";

import axios from "axios";
import "./App.css";

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCEu6-S9Xbd2yjx9HwEIiKw08YOTyUEqNA",
  authDomain: "door-bell-7cd61.firebaseapp.com",
  projectId: "door-bell-7cd61",
  storageBucket: "door-bell-7cd61.appspot.com",
  messagingSenderId: "781618282766",
  appId: "1:781618282766:web:5ee11fa359ed3bf905175f",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();

// Initialize WebRTC
const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

const pc = new RTCPeerConnection(servers);

function App() {
  const [currentPage, setCurrentPage] = useState("home");
  const [joinCode, setJoinCode] = useState("");

  const [isTokenFound, setTokenFound] = useState(false);

  return (
    <div className="app">
      {currentPage === "home" ? (
        <Menu
          joinCode={joinCode}
          setJoinCode={setJoinCode}
          setPage={setCurrentPage}
        />
      ) : (
        <Videos mode={currentPage} callId={joinCode} setPage={setCurrentPage} />
      )}
    </div>
  );
}

function Menu({ joinCode, setJoinCode, setPage }) {
  return (
    <div className="home">
      <div className="create box">
        <button onClick={() => setPage("create")}>Create Call</button>
      </div>

      <div className="answer box">
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          placeholder="Join with code"
        />
        <button onClick={() => setPage("join")}>Answer</button>
      </div>
    </div>
  );
}

function Videos({ mode, callId, setPage }) {
  const [webcamActive, setWebcamActive] = useState(false);
  const [roomId, setRoomId] = useState(callId);

  const localRef = useRef();
  const remoteRef = useRef();

  const [isScreenSharing, setScreenSharing] = useState(false);

  const onShareScreen = async () => {
    if (isScreenSharing) {
      // Stop screen sharing
      if (localRef) {
        localRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      }
      setScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: "always",
          },
          audio: true,
        });

        localRef.current.srcObject = screenStream;
        localRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, screenStream);
        });

        setScreenSharing(true);
      } catch (error) {
        console.error("Error sharing screen:", error);
      }
    }
  };

  const setupSources = async () => {
    const localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    const remoteStream = new MediaStream();

    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
    };

    localRef.current.srcObject = localStream;
    remoteRef.current.srcObject = remoteStream;

    setWebcamActive(true);

    if (mode === "create") {
      const callDoc = firestore.collection("rooms").doc();
      const offerCandidates = callDoc.collection("callerCandidates");
      const answerCandidates = callDoc.collection("calleeCandidates");

      // let callTo = {
      //   id: 1,
      //   email: "ec.ioptime@gmail.com",
      //   email_verified: false,
      //   fcm_token:
      //     "c88_bfZhSPySuAJmh9B5uU:APA91bHZkCS9AZrXuK-3_Zg2PwV-hHvfb9FX9_IdesDxL3xUAF5Ydgog3qLCAo5Y6WmUL3EQy9q0ah1p1mSLGV8mRlucN45ByUPjSIChVtCpl78vwKkOA4y9sYaWi9T8ZfRwnD79z1Xj",

      //   profile:
      //     "https://kristalle.com/wp-content/uploads/2020/07/dummy-profile-pic-1.jpg",

      //   username: "EC IOPTIME",
      // };

      // let data = {
      //   to: callTo.fcm_token,
      //   content_available: true,
      //   priority: "high",
      //   data: {
      //     roomId: callDoc.id,
      //     callToName: callTo.username,
      //     callToId: callTo.id,
      //     callToProfile: callTo.profile,
      //     // callTo: callTo,
      //     callFromProfile:
      //       "https://kristalle.com/wp-content/uploads/2020/07/dummy-profile-pic-1.jpg",
      //     callFromName: "Anonymous",
      //     title: "Anonymous",
      //     body: "Video Calling",
      //   },
      // };
      // var config = {
      //   method: "post",
      //   url: "https://fcm.googleapis.com/fcm/send",
      //   headers: {
      //     Authorization:
      //       "Bearer AAAAtfwUgQ4:APA91bGzot7B2woEOVqZgl4akhd21nOzG17c3b-YQb732jq1_HMFZJmba-r7Px1r4XFqHhA-8dHyuH0e-kgSxh2XXi0B7PDs6TH_Wv1nux7mjFFDVaimXRWKXYNqexMnb6NsAzWZUWO2",
      //     "Content-Type": " application/json",
      //   },
      //   data: data,
      // };

      // axios(config)
      //   .then(function (response) {
      //     console.log(JSON.stringify(response.data));
      //   })
      //   .catch(function (error) {
      //     console.log(error);
      //   });

      setRoomId(callDoc.id);

      pc.onicecandidate = (event) => {
        event.candidate && offerCandidates.add(event.candidate.toJSON());
      };

      const offerDescription = await pc.createOffer();
      await pc.setLocalDescription(offerDescription);

      const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
      };

      await callDoc.set({ offer });

      callDoc.onSnapshot((snapshot) => {
        const data = snapshot.data();
        if (!pc.currentRemoteDescription && data?.answer) {
          const answerDescription = new RTCSessionDescription(data.answer);
          pc.setRemoteDescription(answerDescription);
        }
      });

      answerCandidates.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            const candidate = new RTCIceCandidate(change.doc.data());
            pc.addIceCandidate(candidate);
          }
        });
      });
    } else if (mode === "join") {
      const callDoc = firestore.collection("rooms").doc(callId);
      const offerCandidates = callDoc.collection("callerCandidates");
      const answerCandidates = callDoc.collection("calleeCandidates");

      pc.onicecandidate = (event) => {
        event.candidate && answerCandidates.add(event.candidate.toJSON());
      };

      const callData = (await callDoc.get()).data();

      const offerDescription = callData.offer;
      await pc.setRemoteDescription(
        new RTCSessionDescription(offerDescription)
      );

      const answerDescription = await pc.createAnswer();
      await pc.setLocalDescription(answerDescription);

      const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
      };

      await callDoc.update({ answer });

      offerCandidates.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added") {
            let data = change.doc.data();
            pc.addIceCandidate(new RTCIceCandidate(data));
          }
        });
      });
    }

    pc.onconnectionstatechange = (event) => {
      if (pc.connectionState === "disconnected") {
        hangUp();
      }
    };
  };

  const hangUp = async () => {
    pc.close();

    if (roomId) {
      let roomRef = firestore.collection("rooms").doc(roomId);
      await roomRef
        .collection("answerCandidates")
        .get()
        .then((querySnapshot) => {
          querySnapshot.forEach((doc) => {
            doc.ref.delete();
          });
        });
      await roomRef
        .collection("offerCandidates")
        .get()
        .then((querySnapshot) => {
          querySnapshot.forEach((doc) => {
            doc.ref.delete();
          });
        });

      await roomRef.delete();
    }

    window.location.reload();
  };

  return (
    <div className="videos">
      <video ref={localRef} autoPlay playsInline className="local" muted />
      <video ref={remoteRef} autoPlay playsInline className="remote" />

      <div className="buttonsContainer">
        <button
          onClick={hangUp}
          disabled={!webcamActive}
          className="hangup button"
        >
          <HangupIcon />
        </button>

        <button
          onClick={onShareScreen}
          disabled={false}
          className="hangup button"
        >
          <Shareicon />
        </button>
        <div tabIndex={0} role="button" className="more button">
          <MoreIcon />
          <div className="popover">
            <button
              onClick={() => {
                navigator.clipboard.writeText(roomId);
              }}
            >
              <CopyIcon /> Copy joining code
            </button>
          </div>
        </div>
      </div>

      {!webcamActive && (
        <div className="modalContainer">
          <div className="modal">
            <h3>Turn on your camera and microphone and start the call</h3>
            <div className="container">
              <button onClick={() => setPage("home")} className="secondary">
                Cancel
              </button>
              <button onClick={setupSources}>Start</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
