import {
  doc,
  setDoc,
  onSnapshot,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase";

const ROOM_ID = "camera-stream";
const servers: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

/**
 * Camera side: start streaming video to Firestore-signaled WebRTC
 */
export async function startCameraStream(
  stream: MediaStream
): Promise<RTCPeerConnection> {
  const roomRef = doc(db, "rooms", ROOM_ID);
  const callerCandidatesRef = collection(roomRef, "callerCandidates");
  const calleeCandidatesRef = collection(roomRef, "calleeCandidates");

  // Clean up old room data
  const oldCallerSnap = await getDocs(callerCandidatesRef);
  for (const d of oldCallerSnap.docs) await deleteDoc(d.ref);
  const oldCalleeSnap = await getDocs(calleeCandidatesRef);
  for (const d of oldCalleeSnap.docs) await deleteDoc(d.ref);

  const pc = new RTCPeerConnection(servers);

  // Add tracks
  stream.getTracks().forEach((track) => pc.addTrack(track, stream));

  // ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      addDoc(callerCandidatesRef, event.candidate.toJSON());
    }
  };

  // Create offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await setDoc(roomRef, {
    offer: { type: offer.type, sdp: offer.sdp },
    createdAt: Date.now(),
  });

  // Listen for answer
  onSnapshot(roomRef, (snap) => {
    const data = snap.data();
    if (data?.answer && !pc.currentRemoteDescription) {
      pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
  });

  // Listen for callee ICE candidates
  onSnapshot(calleeCandidatesRef, (snap) => {
    snap.docChanges().forEach((change) => {
      if (change.type === "added") {
        pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
      }
    });
  });

  return pc;
}

/**
 * Viewer side: watch for camera streams and reconnect automatically
 * when a new camera person starts streaming.
 * Returns an unsubscribe function.
 */
export function watchCameraStream(
  onStream: (stream: MediaStream) => void
): () => void {
  const roomRef = doc(db, "rooms", ROOM_ID);
  let currentPc: RTCPeerConnection | null = null;
  let lastCreatedAt: number | null = null;
  let candidatesUnsub: (() => void) | null = null;

  const unsubscribe = onSnapshot(roomRef, async (snap) => {
    const data = snap.data();
    if (!data?.offer) return;

    // Skip if we already handled this offer
    if (lastCreatedAt !== null && data.createdAt === lastCreatedAt) return;
    lastCreatedAt = data.createdAt;

    // Clean up previous connection and listeners
    if (candidatesUnsub) {
      candidatesUnsub();
      candidatesUnsub = null;
    }
    if (currentPc) {
      currentPc.close();
      currentPc = null;
    }

    const callerCandidatesRef = collection(roomRef, "callerCandidates");
    const calleeCandidatesRef = collection(roomRef, "calleeCandidates");

    // Clean old callee candidates before reconnecting
    const oldSnap = await getDocs(calleeCandidatesRef);
    for (const d of oldSnap.docs) await deleteDoc(d.ref);

    const pc = new RTCPeerConnection(servers);
    currentPc = pc;
    const remoteStream = new MediaStream();

    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
      onStream(remoteStream);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(calleeCandidatesRef, event.candidate.toJSON());
      }
    };

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await setDoc(
        roomRef,
        { ...data, answer: { type: answer.type, sdp: answer.sdp } },
        { merge: true }
      );

      candidatesUnsub = onSnapshot(callerCandidatesRef, (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === "added" && pc.signalingState !== "closed") {
            pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
          }
        });
      });
    } catch (e) {
      console.error("WebRTC connection error:", e);
    }
  });

  return () => {
    unsubscribe();
    if (candidatesUnsub) candidatesUnsub();
    if (currentPc) currentPc.close();
  };
}
