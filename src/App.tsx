// import { Socket } from "dgram";
import { Server } from "http";
import React, { useState, useRef, useEffect, useCallback } from "react";
import {io, Socket} from "socket.io-client";
import Video from "./Components/Video";
import { WebRTCUser } from "./types";
import {v4 as uuidv4} from "uuid";

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
    // {
    //   "username":"u-SD8l77k-U-ItC6MMVo1aoAOHVCcmZOIHbHrfiRLkOsw1GF_J-uILRGV7TAGUYpAAAAAGOQon1yb2JpbmpvbzEwMTU=",
    //   "urls":[
    //     "stun:ntk-turn-1.xirsys.com",
    //     "turn:ntk-turn-1.xirsys.com:80?transport=udp",
    //     "turn:ntk-turn-1.xirsys.com:3478?transport=udp",
    //     "turn:ntk-turn-1.xirsys.com:80?transport=tcp",
    //     "turn:ntk-turn-1.xirsys.com:3478?transport=tcp",
    //     "turns:ntk-turn-1.xirsys.com:443?transport=tcp",
    //     "turns:ntk-turn-1.xirsys.com:5349?transport=tcp"
    //   ],
    //   "credential":"15c61834-763b-11ed-8083-0242ac120004"
    // }
    
  ],
};

/*
{"v":{
  "iceServers":{
    "username":"u-SD8l77k-U-ItC6MMVo1aoAOHVCcmZOIHbHrfiRLkOsw1GF_J-uILRGV7TAGUYpAAAAAGOQon1yb2JpbmpvbzEwMTU=",
    "urls":[
      "stun:ntk-turn-1.xirsys.com",
      "turn:ntk-turn-1.xirsys.com:80?transport=udp",
      "turn:ntk-turn-1.xirsys.com:3478?transport=udp",
      "turn:ntk-turn-1.xirsys.com:80?transport=tcp",
      "turn:ntk-turn-1.xirsys.com:3478?transport=tcp",
      "turns:ntk-turn-1.xirsys.com:443?transport=tcp",
      "turns:ntk-turn-1.xirsys.com:5349?transport=tcp"
    ],
    "credential":"15c61834-763b-11ed-8083-0242ac120004"
  }
},"s":"ok"}%
*/

// const SOCKET_SERVER_URL = "http://localhost:8080";
// const SOCKET_SERVER_URL = "http://ec2-52-79-240-198.ap-northeast-2.compute.amazonaws.com:8080"
// const SOCKET_SERVER_URL = "https://webrtc-sfu-server-js.herokuapp.com/"
const SOCKET_SERVER_URL = "https://port-0-webrtc-sfu-server-js-11er1a24lb9hvht5.gksl2.cloudtype.app/"
const socketRef = io(SOCKET_SERVER_URL, {
  withCredentials: true,
  transports: ['websocket', 'polling'] //######
});
// const socketuuid = uuidv4()

// interface ServerToClientEvents {
//   userEnter: ( data: {id: string} ) => void;
//   allUsers: ( data: {users: Array<{ id: string }>} ) => void;
//   userExit: ( data: {id: string} ) => void;
//   getSenderAnswer: ( data: {sdp: RTCSessionDescription} ) => void;
//   getSenderCandidate: ( data: {candidate: RTCIceCandidateInit} ) => void;
//   getReceiverAnswer: ( data: {id: string, sdp: RTCSessionDescription} ) => void;
//   getReceiverCandidate: ( data: {id: string, candidate: RTCIceCandidateInit} ) => void;
// }

// interface ClientToServerEvents {
//   receiverOffer: ( data: {
//     sdp: RTCSessionDescriptionInit,
//     receiverSocketID: string,
//     senderSocketID: string,
//     roomID: string,
//   }) => void;
//   receiverCandidate: ( data: {
//     candidate: RTCPeerConnectionIceEvent['candidate'],
//     receiverSocketID: string,
//     senderSocketID: string,
//   }) => void;
//   senderOffer: ( data: {
//     sdp: RTCSessionDescriptionInit,
//     senderSocketID: string,
//     roomID: string,
//   }) => void;
//   senderCandidate: ( data: {
//     candidate: RTCPeerConnectionIceEvent['candidate'],
//     senderSocketID: string,
//   }) => void;
//   joinRoom: ( data: {
//     id: string,
//     roomID: string,
//   }) => void;
// }
// let socketRef: Socket<ServerToClientEvents, ClientToServerEvents> = null;

const App = () => {
  // const socketRef = useRef();
  // const [socketRef, setSocketRef] = useState(io(SOCKET_SERVER_URL));
  // const socketRef = io(SOCKET_SERVER_URL);

  const localStreamRef = useRef<MediaStream>();
  const sendPCRef = useRef<RTCPeerConnection>();
  const receivePCsRef = useRef<{ [socketId: string]: RTCPeerConnection }>({});
  const [users, setUsers] = useState<Array<WebRTCUser>>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  // const socketRef = useRef<Socket>();
  // const uuid = useRef<string>(uuidv4());

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

        pc.setLocalDescription(new RTCSessionDescription(sdp));
        console.log("create receiver offer success, set local description", sdp);

        if (!socketRef) return;
        socketRef.emit("receiverOffer", {
          sdp: sdp,
          receiverSocketID: socketRef.id,
          // receiverSocketID: socketuuid,
          senderSocketID: senderSocketID,
          roomID: "1234", //
        });
        console.log("emitted receiverOffer", senderSocketID, socketRef.id);
        // console.log("emitted receiverOffer", senderSocketID, socketuuid);
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
      // receivePCsRef.current = { ...receivePCsRef.current, [socketID]: pc };
      // console.log(receivePCsRef);

      pc.onicecandidate = (e) => {
        console.log("receiver PC onicecandidate", e.candidate);
        if (!(e.candidate && socketRef)) return;
        // console.log("receiver PC onicecandidate");
        socketRef.emit("receiverCandidate", {
          candidate: e.candidate,
          receiverSocketID: socketRef.id,
          // receiverSocketID: socketuuid,
          senderSocketID: socketID,
        });
        console.log("emitted receiverCandidate", socketID, socketRef.id)
        // console.log("emitted receiverCandidate", socketID, socketuuid)
      };

      pc.oniceconnectionstatechange = (e) => {
        console.log("ReceiverPeerConnection IceConnectionStateChange", pc.iceConnectionState);
      };

      pc.onicecandidateerror = (e) => {
        console.log(e)
      }

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

      receivePCsRef.current = { ...receivePCsRef.current, [socketID]: pc };

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

    try {
      // if (!sendPCRef.current) return;
      const timer = (ms: number) => new Promise(res => setTimeout(res, ms));
      while (!sendPCRef.current) {
        await timer(1);
      }
      console.log("createSenderOffer");

      const sdp = await sendPCRef.current.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      })
      // console.log("create sender offer success");

      sendPCRef.current.setLocalDescription(
        new RTCSessionDescription(sdp)
      );
      console.log("createSenderOffer setLocalDescription", sendPCRef.current.localDescription, sdp);

      if (!socketRef) return;
      await socketRef.emit("senderOffer", {
        sdp: sdp,
        senderSocketID: socketRef.id,
        // senderSocketID: socketuuid,
        roomID: "1234", // uuid
      });
      console.log("emitted senderOffer", socketRef.id);
      // console.log("emitted senderOffer", socketuuid);
    } catch (error) {
      console.log(error);
    }
  }, []);

  // createSenderPeerConnection
  const createSenderPeerConnection = useCallback(async () => {
    const pc = await new RTCPeerConnection(pc_config);

    console.log('createSenderPeerConnection');

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

    pc.onicecandidate = async(e) => {
      if (!(e.candidate && socketRef)) return;
      console.log("sender PC onicecandidate", socketRef.id, e.candidate);
      // console.log("sender PC onicecandidate", socketuuid, e);

      // const timer = (ms: number) => new Promise(res => setTimeout(res, ms));
      // while (pc.remoteDescription === null) {
      //   await timer(1);
      // }

      socketRef.emit("senderCandidate", {
        candidate: e.candidate,
        senderSocketID: socketRef.id,
        // senderSocketID: socketuuid,
      });
      console.log("emitted senderCandidate", socketRef.id)
      // console.log("emitted senderCandidate", socketuuid)
    };

    pc.oniceconnectionstatechange = (e) => {
      console.log("SenderPeerConnection IceConnectionStateChange", pc.iceConnectionState);
    };
    
    pc.onicecandidateerror = (e) => {
      console.log(e)
    }

    // save send peer connection to ref
    sendPCRef.current = pc;
  }, []);

  // getLocalStream
  const getLocalStream = useCallback(async () => {
    console.log('getLocalStream');
    
    const timer = (ms: number) => new Promise(res => setTimeout(res, ms))
    while (socketRef.id == undefined){
      await timer(1)
    }
    console.log(socketRef.id)
    
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

      socketRef.emit("joinRoom", {
        id: socketRef.id,
        // id: socketuuid,
        roomID: "1234", // 
      });
      console.log("emitted joinRoom", socketRef.id);
      // console.log("emitted joinRoom", socketuuid);
    } catch (e) {
      console.log(`getUserMedia error: ${e}`);
    }
  }, [createSenderOffer, createSenderPeerConnection]);

  // useEffect
  useEffect(() => {
    getLocalStream();

    if (!socketRef) return;
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

          // const timer = (ms: number) => new Promise(res => setTimeout(res, ms));
          // if (sendPCRef.current.iceGatheringState!=="complete") {
          //   await timer(1);
          // }

          // let newsdp = await new RTCSessionDescription(data.sdp)

          sendPCRef.current.setRemoteDescription(
            new RTCSessionDescription(data.sdp)
          );
          console.log("getSenderAnswer setRemoteDesciption", data.sdp);
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
          // const timer = (ms: number) => new Promise(res => setTimeout(res, ms));
          // while(sendPCRef.current.remoteDescription === null) {
          //   await timer(1);
          // }
          sendPCRef.current.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
          console.log("candidate add success", data.candidate);
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
          // let newsdp = await new RTCSessionDescription(data.sdp)
          pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          console.log(`socketID(${data.id})'s set remote sdp success`, pc.remoteDescription, pc.localDescription);
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
          // const timer = (ms: number) => new Promise(res => setTimeout(res, ms));
          // while(receivePCsRef.current[data.id].remoteDescription === null) {
          //   await timer(1)
          // }
          pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          console.log(`socketID(${data.id})'s candidate add success`, data.candidate);
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
          width: 240,
          height: 240,
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