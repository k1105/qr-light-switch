"use client";

import { useEffect, useRef, useState } from "react";
import { startCameraStream } from "../lib/webrtc";

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"connecting" | "streaming" | "error">("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let pc: RTCPeerConnection | null = null;

    const init = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        setStatus("streaming");
        pc = await startCameraStream(stream);

        pc.onconnectionstatechange = () => {
          if (pc?.connectionState === "disconnected" || pc?.connectionState === "failed") {
            setStatus("error");
            setError("接続が切れました。再読み込みしてください / Connection lost. Refresh to reconnect.");
          }
        };
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "カメラへのアクセスが拒否されました / Camera access denied");
      }
    };

    init();

    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (pc) pc.close();
    };
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100dvh",
        background: "#111",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "monospace",
        position: "relative",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 1,
          padding: "8px 12px",
          background: "rgba(0,0,0,0.6)",
          borderRadius: 4,
          fontSize: 13,
          color: status === "streaming" ? "#99f" : status === "error" ? "#f44" : "#00f",
        }}
      >
        {status === "connecting" && "● CONNECTING..."}
        {status === "streaming" && "● LIVE"}
        {status === "error" && `● ERROR: ${error}`}
      </div>
    </div>
  );
}
