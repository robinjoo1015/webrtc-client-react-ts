// import { Socket } from "dgram";
import React, { useState, useRef, useEffect, useCallback } from "react";
import {io} from "socket.io-client";
import Video from "./Components/Video";
import { WebRTCUser } from "./types";

const pc_config = {
  iceServers: [
    // {
    //   urls: 'stun:[STUN_IP]:[PORT]',
    //   'credentials': '[YOR CREDENTIALS]',
    //   'username': '[USERNAME]'
    // },
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun3.l.google.com:19302",
        "stun:stun4.l.google.com:19302",
    ]
    },
    
  ],
};
// const SOCKET_SERVER_URL = "http://localhost:8080";
// const SOCKET_SERVER_URL = "http://192.168.1.120:8080";
const SOCKET_SERVER_URL = "https://webrtc-sfu-server-js.herokuapp.com/"
const socketRef = io(SOCKET_SERVER_URL, {
  withCredentials: true,
  transports: ['websocket', 'polling']
});

const App = () => {
  // const socketRef = useRef();
  // const [socketRef, setSocketRef] = useState(io(SOCKET_SERVER_URL));
  // const socketRef = io(SOCKET_SERVER_URL);

  const localStreamRef = useRef<MediaStream>();
  const sendPCRef = useRef<RTCPeerConnection>();
  const receivePCsRef = useRef<{ [socketId: string]: RTCPeerConnection }>({});
  const [users, setUsers] = useState<Array<WebRTCUser>>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);

  // closeReceivePC
  const closeReceivePC = useCallback((id: string) => {
    console.log('closeReceivePC', id)

    if (!receivePCsRef.current[id]) return;
    receivePCsRef.current[id].close();
    console.log('closeReceivePC closed', id);
    delete receivePCsRef.current[id];
  }, []);

  // createReceiverOffer
  const createReceiverOffer = useCallback(
    async (pc: RTCPeerConnection, senderSocketID: string) => {
      console.log('createReceiverOffer', senderSocketID);

      try {
        const sdp = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        console.log("create receiver offer success");

        await pc.setLocalDescription(new RTCSessionDescription(sdp));

        if (!socketRef) return;
        socketRef.emit("receiverOffer", {
          sdp: sdp,
          receiverSocketID: socketRef.id,
          senderSocketID: senderSocketID,
          roomID: "1234", //
        });
        console.log("emitted receiverOffer", senderSocketID, socketRef.id);
      } catch (error) {
        console.log(error);
      }
    },
    []
  );

  // createReceiverPeerConnection
  const createReceiverPeerConnection = useCallback((socketID: string) => {
    console.log('createReceiverPeerConnection', socketID);

    try {
      const pc = new RTCPeerConnection(pc_config);
      // add pc to peerConnections object
      receivePCsRef.current = { ...receivePCsRef.current, [socketID]: pc };
      // console.log(receivePCsRef);

      pc.onicecandidate = (e) => {
        if (!(e.candidate && socketRef)) return;
        console.log("receiver PC onicecandidate");

        socketRef.emit("receiverCandidate", {
          candidate: e.candidate,
          receiverSocketID: socketRef.id,
          senderSocketID: socketID,
        });
        console.log("emitted receiverCandidate", socketID, socketRef.id)
      };

      pc.oniceconnectionstatechange = (e) => {
        console.log("ReceiverPeerConnection IceConnectionStateChange");
      };

      pc.ontrack = (e) => {
        console.log("ontrack success");

        setUsers((oldUsers) =>
          oldUsers
            .filter((user) => user.id !== socketID)
            .concat({
              id: socketID,
              stream: e.streams[0],
            })
        );
      };

      return pc;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }, []);

  // createReceivePC
  const createReceivePC = useCallback(
    (id: string) => {
      console.log('createReceivePC', id);

      try {
        console.log(`socketID(${id}) user entered`);
        const pc = createReceiverPeerConnection(id);
        // console.log(pc);
        if (!(socketRef && pc)) return;
        createReceiverOffer(pc, id);
      } catch (error) {
        console.log(error);
      }
    },
    [createReceiverOffer, createReceiverPeerConnection]
  );

  // createSenderOffer
  const createSenderOffer = useCallback(async () => {
    console.log("createSenderOffer");

    try {
      if (!sendPCRef.current) return;
      const sdp = await sendPCRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      // console.log("create sender offer success");

      await sendPCRef.current.setLocalDescription(
        new RTCSessionDescription(sdp)
      );
      await console.log("createSenderOffer setLocalDescription");

      if (!socketRef) return;
      await socketRef.emit("senderOffer", {
        sdp: sdp,
        senderSocketID: socketRef.id,
        roomID: "1234", // uuid
      });
      console.log("emitted senderOffer", socketRef.id);
    } catch (error) {
      console.log(error);
    }
  }, []);

  // createSenderPeerConnection
  const createSenderPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(pc_config);

    console.log('createSenderPeerConnection');

    pc.onicecandidate = (e) => {
      if (!(e.candidate && socketRef)) return;
      console.log("sender PC onicecandidate", socketRef.id, e);

      socketRef.emit("senderCandidate", {
        candidate: e.candidate,
        senderSocketID: socketRef.id,
      });
      console.log("emitted senderCandidate", socketRef.id)
    };

    pc.oniceconnectionstatechange = (e) => {
      console.log("SenderPeerConnection IceConnectionStateChange");
    };

    if (localStreamRef.current) {
      console.log("add local stream");

      localStreamRef.current.getTracks().forEach((track) => {
        if (!localStreamRef.current) return;
        console.log("pc addTrack");
        pc.addTrack(track, localStreamRef.current);
      });
    } else {
      console.log("no local stream");
    }

    sendPCRef.current = pc;
  }, []);

  // getLocalStream
  const getLocalStream = useCallback(async () => {
    console.log('getLocalStream');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          width: 240,
          height: 240,
        },
      });
      // console.log(stream);

      localStreamRef.current = stream;

      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      if (!socketRef) return;

      await createSenderPeerConnection();
      await createSenderOffer();

      await socketRef.emit("joinRoom", {
        id: socketRef.id,
        roomID: "1234", // 
      });
      console.log("emitted joinRoom", socketRef.id);
    } catch (e) {
      console.log(`getUserMedia error: ${e}`);
    }
  }, [createSenderOffer, createSenderPeerConnection]);

  // useEffect
  useEffect(() => {
    // socketRef.current = io(SOCKET_SERVER_URL);
    // socketRef = io(SOCKET_SERVER_URL);
    // setSocketRef(io(SOCKET_SERVER_URL));

    getLocalStream();

    // userEnter
    socketRef.on("userEnter", (data: { id: string }) => {
      console.log('on userEnter', data.id);

      createReceivePC(data.id);
    });

    // allUsers
    socketRef.on(
      "allUsers",
      (data: { users: Array<{ id: string }> }) => {
        console.log('on allUsers', data.users);
        data.users.forEach((user) => createReceivePC(user.id));
      }
    );

    // userExit
    socketRef.on("userExit", (data: { id: string }) => {
      console.log('on userExit', data.id)
      closeReceivePC(data.id);
      setUsers((users) => users.filter((user) => user.id !== data.id));
    });

    // getSenderAnswer
    socketRef.on(
      "getSenderAnswer",
      async (data: { sdp: RTCSessionDescription }) => {
        console.log('on getSenderAnswer');

        try {
          if (!sendPCRef.current) return;
          await sendPCRef.current.setRemoteDescription(
            new RTCSessionDescription(data.sdp)
          );
          console.log("getSenderAnswer setRemoteDesciption");
        } catch (error) {
          console.log(error);
        }
      }
    );

    // getSenderCandidate
    socketRef.on(
      "getSenderCandidate",
      async (data: { candidate: RTCIceCandidateInit }) => {
        console.log('on getSenderCandidate');

        try {
          if (!(data.candidate && sendPCRef.current)) return;
          console.log("get sender candidate");
          await sendPCRef.current.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
          console.log("candidate add success");
        } catch (error) {
          console.log(error);
        }
      }
    );

    // getReceiverAnswer
    socketRef.on(
      "getReceiverAnswer",
      async (data: { id: string; sdp: RTCSessionDescription }) => {
        console.log('on getReceiverAnswer', data.id);

        try {
          console.log(`get socketID(${data.id})'s answer`);
          const pc: RTCPeerConnection = receivePCsRef.current[data.id];
          if (!pc) return;
          await pc.setRemoteDescription(data.sdp);
          console.log(`socketID(${data.id})'s set remote sdp success`);
        } catch (error) {
          console.log(error);
        }
      }
    );

    // getReceiverCandidate
    socketRef.on(
      "getReceiverCandidate",
      async (data: { id: string; candidate: RTCIceCandidateInit }) => {
        console.log('on getReceiverCandidate', data.id);

        try {
          console.log(data);
          console.log(`get socketID(${data.id})'s candidate`);
          const pc: RTCPeerConnection = receivePCsRef.current[data.id];
          if (!(pc && data.candidate)) return;
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          console.log(`socketID(${data.id})'s candidate add success`);
        } catch (error) {
          console.log(error);
        }
      }
    );

    return () => {
      if (socketRef) {
        socketRef.disconnect();
      }
      if (sendPCRef.current) {
        sendPCRef.current.close();
      }
      users.forEach((user) => closeReceivePC(user.id));
    };
    // eslint-disable-next-line
  }, [
    closeReceivePC,
    createReceivePC,
    createSenderOffer,
    createSenderPeerConnection,
    getLocalStream,
  ]);

  return (
    <div>
      <video
        style={{
          // width: 240,
          // height: 240,
          width: 360,
          height: 360,
          margin: 5,
          backgroundColor: "black",
        }}
        muted
        ref={localVideoRef}
        autoPlay
      />
      {users.map((user, index) => (
        <Video key={index} stream={user.stream} />
      ))}
    </div>
  );
};

export default App;