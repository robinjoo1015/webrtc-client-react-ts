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
        "stun:openrelay.metered.ca:80",
      ]
    },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    { urls: 'turn:numb.viagenie.ca', credential: 'muazkh', username: 'webrtc@live.com' },
    { urls: 'turn:relay.backups.cz', credential: 'webrtc', username: 'webrtc' },
    { urls: 'turn:relay.backups.cz?transport=tcp', credential: 'webrtc', username: 'webrtc' },
    { urls: 'turn:192.158.29.39:3478?transport=udp', credential: 'JZEOEt2V3Qb0y27GRntt2u2PAYA=', username: '28224511:1379330808' },
    {
      urls: 'turn:turn.bistri.com:80',
      credential: 'homeo',
      username: 'homeo'
    },
    {
      urls: 'turn:turn.anyfirewall.com:443?transport=tcp',
      credential: 'webrtc',
      username: 'webrtc'
    }
  ],
};
// const SOCKET_SERVER_URL = "http://localhost:8080";
// const SOCKET_SERVER_URL = "http://192.168.0.4:8080";
const SOCKET_SERVER_URL = "https://webrtc-sfu-server-js.herokuapp.com/"
const socketRef = io(SOCKET_SERVER_URL, {
  withCredentials: true,
  transports: ['websocket', 'polling']
});
// const socketuuid = uuidv4()

/*
// interface ServerToClientEvents {
//   userEnter: ( data: {id: string} ) => void;
//   allUsers: ( data: {users: Array<{ id: string }>} ) => void;
//   userExit: ( data: {id: string} ) => void;
//   getSenderAnswer: ( data: {sdp: RTCSessionDescription} ) => void;
//   getSenderCandidate: ( data: {candidate: RTCIceCandidateInit} ) => void;
//   getReceiverAnswer: ( data: {id: string, sdp: RTCSessionDescription} ) => void;
//   getReceiverCandidate: ( data: {id: string, candidate: RTCIceCandidateInit} ) => void;
// }
*/
/*
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
*/
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
  const closeReceivePC = useCallback(async (id: string) => {
    console.log('closeReceivePC', id)

    if (!receivePCsRef.current[id]) return;
    await receivePCsRef.current[id].close();
    console.log('closeReceivePC closed', id);
    await delete receivePCsRef.current[id];
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

        await pc.setLocalDescription(await new RTCSessionDescription(sdp));

        if (!socketRef) return;
        await socketRef.emit("receiverOffer", {
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
  const createReceiverPeerConnection = useCallback(async (socketID: string) => {
    console.log('createReceiverPeerConnection', socketID);

    try {
      const pc = await new RTCPeerConnection(pc_config);
      // add pc to peerConnections object
      // receivePCsRef.current = await { ...receivePCsRef.current, [socketID]: pc };
      // console.log(receivePCsRef);

      pc.onicecandidate = async (e) => {
        console.log("receiver PC onicecandidate");
        if (!(e.candidate && socketRef)) return;
        // console.log("receiver PC onicecandidate");
        await socketRef.emit("receiverCandidate", {
          candidate: e.candidate,
          receiverSocketID: socketRef.id,
          // receiverSocketID: socketuuid,
          senderSocketID: socketID,
        });
        console.log("emitted receiverCandidate", socketID, socketRef.id)
        // console.log("emitted receiverCandidate", socketID, socketuuid)
      };

      pc.oniceconnectionstatechange = (e) => {
        // console.log(e)
        console.log("ReceiverPeerConnection IceConnectionStateChange", pc.iceConnectionState);
      };

      pc.ontrack = async (e) => {
        console.log("ontrack success");

        await setUsers((oldUsers) =>
          oldUsers
            .filter((user) => user.id !== socketID)
            .concat({
              id: socketID,
              stream: e.streams[0],
            })
        );
      };

      receivePCsRef.current = await { ...receivePCsRef.current, [socketID]: pc };

      return pc;
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }, []);

  // createReceivePC
  const createReceivePC = useCallback(
    async (id: string) => {
      console.log('createReceivePC', id);

      try {
        console.log(`socketID(${id}) user entered`);
        const pc = await createReceiverPeerConnection(id);
        // console.log(pc);
        if (!(socketRef && pc)) return;
        await createReceiverOffer(pc, id);
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
      const timer = (ms: number) => new Promise(res => setTimeout(res, ms))
      let seconds = new Date().getTime() / 1000
      while (!sendPCRef.current && ((new Date().getTime() / 1000)-seconds<10)) {
        await timer(1)
      }
      
      if(!sendPCRef.current) return;

      const sdp = await sendPCRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      // console.log("create sender offer success");

      await sendPCRef.current.setLocalDescription(
        await new RTCSessionDescription(sdp)
      );
      await console.log("createSenderOffer setLocalDescription");

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
  const createSenderPeerConnection = useCallback(async() => {
    const pc = await new RTCPeerConnection(pc_config);

    console.log('createSenderPeerConnection');

    pc.onicecandidate = async (e) => {
      // console.log("sender PC onicecandidate", uuid.current, e);
      if (!(e.candidate && socketRef)) return;
      console.log("sender PC onicecandidate", socketRef.id, e);
      // console.log("sender PC onicecandidate", socketuuid, e);

      await socketRef.emit("senderCandidate", {
        candidate: e.candidate,
        senderSocketID: socketRef.id,
        // senderSocketID: socketuuid,
      });
      console.log("emitted senderCandidate", socketRef.id)
      // console.log("emitted senderCandidate", socketuuid)
    };

    pc.oniceconnectionstatechange = (e) => {
      // console.log(e)
      console.log("SenderPeerConnection IceConnectionStateChange", pc.iceConnectionState);
    };

    if (localStreamRef.current) {
      console.log("add local stream");

      await localStreamRef.current.getTracks().forEach(async (track) => {
        if (!localStreamRef.current) return;
        console.log("pc addTrack");
        await pc.addTrack(track, localStreamRef.current);
      });
    } else {
      console.log("no local stream");
    }

    sendPCRef.current = await pc;
    return;
  }, []);

  // getLocalStream
  const getLocalStream = useCallback(async () => {
    console.log('getLocalStream');
    
    // wait for socket connection!!!
    const timer = (ms: number) => new Promise(res => setTimeout(res, ms))
    while (socketRef.id === undefined){
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

      createSenderPeerConnection();
      await createSenderOffer();

      await socketRef.emit("joinRoom", {
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
    socketRef.on("userEnter", async (data: { id: string }) => {
      console.log('on userEnter', data.id);

      await createReceivePC(data.id);
    });

    // allUsers
    socketRef.on(
      "allUsers",
      async (data: { users: Array<{ id: string }> }) => {
        console.log('on allUsers', data.users);
        await data.users.forEach(async (user) => await createReceivePC(user.id));
      }
    );

    // userExit
    socketRef.on("userExit", async (data: { id: string }) => {
      console.log('on userExit', data.id)
      await closeReceivePC(data.id);
      await setUsers((users) => users.filter((user) => user.id !== data.id));
    });

    // getSenderAnswer
    socketRef.on(
      "getSenderAnswer",
      async (data: { sdp: RTCSessionDescription }) => {
        console.log('on getSenderAnswer');

        try {
          const timer = (ms: number) => new Promise(res => setTimeout(res, ms))
          let seconds = new Date().getTime() / 1000
          while (!sendPCRef.current && ((new Date().getTime() / 1000)-seconds<10)) {
            await timer(1)
          }
          if (!sendPCRef.current) return;
          await sendPCRef.current.setRemoteDescription(
            await new RTCSessionDescription(data.sdp)
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
            await new RTCIceCandidate(data.candidate)
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
          const pc: RTCPeerConnection = await receivePCsRef.current[data.id];
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
          const pc: RTCPeerConnection = await receivePCsRef.current[data.id];
          if (!(pc && data.candidate)) return;
          await pc.addIceCandidate(await new RTCIceCandidate(data.candidate));
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