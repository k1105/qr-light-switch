"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { getUserId } from "../lib/userId";
import { registerNode } from "../lib/relay";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

const APP_ORIGIN = "https://qr-light-switch.vercel.app";
const GOAL_COUNT = 3;

export default function GoalPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanningRef = useRef(false);
  const cooldownRef = useRef(false);
  const myId = useRef("");

  const [hitCount, setHitCount] = useState(0);
  const [lightState, setLightState] = useState<"on" | "off">("off");
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    myId.current = getUserId();
    registerNode(myId.current, null, { isGoal: true });
  }, []);

  // Sync hitCount and completion to Firestore
  useEffect(() => {
    const goalRef = doc(db, "meta", "goal");
    const data: Record<string, unknown> = { hitCount };
    if (hitCount >= GOAL_COUNT && !completed) {
      setCompleted(true);
      data.completed = true;
    }
    updateDoc(goalRef, data).catch(() => {
      import("firebase/firestore").then(({ setDoc }) => {
        setDoc(goalRef, { hitCount, ...(data.completed ? { completed: true } : {}) });
      });
    });
  }, [hitCount, completed]);

  const handleQRValue = useCallback((value: string) => {
    try {
      const url = new URL(value);
      if (!url.origin.includes("qr-light-switch")) return;
      const state = url.searchParams.get("state");
      if (state !== "on" && state !== "off") return;
      const parentId = url.searchParams.get("parent");

      if (cooldownRef.current) return;
      cooldownRef.current = true;
      setTimeout(() => {
        cooldownRef.current = false;
      }, 1500);

      if (myId.current && parentId) {
        registerNode(myId.current, parentId);
        registerNode(parentId, null);
      }

      if (state === "on") {
        setLightState("on");
        setHitCount((prev) => prev + 1);
        setTimeout(() => setLightState("off"), 800);
      }
    } catch {
      // ignore
    }
  }, []);

  const startScanning = useCallback(
    (video: HTMLVideoElement) => {
      if (scanningRef.current) return;
      scanningRef.current = true;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      const tick = () => {
        if (!scanningRef.current) return;
        if (video.readyState >= video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, canvas.width, canvas.height, {
            inversionAttempts: "dontInvert",
          });
          if (code?.data) {
            handleQRValue(code.data);
          }
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    [handleQRValue]
  );

  useEffect(() => {
    let stream: MediaStream | null = null;
    const init = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        startScanning(video);
      } catch {
        // camera error
      }
    };
    init();
    return () => {
      scanningRef.current = false;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [startScanning]);

  const remaining = GOAL_COUNT - hitCount;

  return (
    <div
      style={{
        width: "100vw",
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: lightState === "on" ? "#fff" : "#111",
        transition: "background 0.15s",
        fontFamily: "monospace",
        position: "relative",
      }}
    >
      {completed ? (
        <p style={{ fontSize: 14, color: "#0f0" }}>ゴール達成 / GOAL REACHED</p>
      ) : (
        <>
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
              opacity: 0.3,
            }}
          />
          <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
            <p style={{ fontSize: 96, fontWeight: "bold", color: lightState === "on" ? "#000" : "#fff" }}>
              {remaining}
            </p>
            <p style={{ fontSize: 14, color: lightState === "on" ? "#999" : "#666", marginTop: 8 }}>
              のこり / remaining
            </p>
          </div>
        </>
      )}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
