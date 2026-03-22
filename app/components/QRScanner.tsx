"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import QRCode from "qrcode";
import { getUserId } from "../lib/userId";
import { registerNode, updateState } from "../lib/relay";

type LightState = "on" | "off";

const APP_ORIGIN = "https://qr-light-switch.vercel.app";

function parseStateFromUrl(
  value: string
): { state: LightState; parentId: string | null } | null {
  try {
    const url = new URL(value);
    if (!url.origin.includes("qr-light-switch")) return null;
    const state = url.searchParams.get("state");
    if (state !== "on" && state !== "off") return null;
    const parentId = url.searchParams.get("parent");
    return { state, parentId };
  } catch {
    return null;
  }
}

export default function QRScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const scanningRef = useRef(false);
  const cooldownRef = useRef(false);

  // Read initial state from URL search params
  const [lightState, setLightState] = useState<LightState>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const state = params.get("state");
      if (state === "on" || state === "off") return state;
    }
    return "off";
  });
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [parentConnected, setParentConnected] = useState(false);
  const [hasParent, setHasParent] = useState(false);
  const lastQrSeenRef = useRef<number>(0);
  const connectionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const myId = useRef("");
  useEffect(() => {
    myId.current = getUserId();
    // Register self as root node if arrived without parent
    const params = new URLSearchParams(window.location.search);
    const parentId = params.get("parent");
    if (myId.current) {
      registerNode(myId.current, parentId);
      if (parentId) {
        registerNode(parentId, null);
        setHasParent(true);
      }
    }
  }, []);

  // Monitor connection status: check if parent QR is still being scanned
  useEffect(() => {
    if (!hasParent) return;
    connectionTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastQrSeenRef.current;
      setParentConnected(lastQrSeenRef.current > 0 && elapsed < 1500);
    }, 500);
    return () => {
      if (connectionTimerRef.current) clearInterval(connectionTimerRef.current);
    };
  }, [hasParent]);

  // Generate QR code as URL with state param + parent
  useEffect(() => {
    const id = myId.current || getUserId();
    const qrValue = `${APP_ORIGIN}/?parent=${id}&state=${lightState}`;
    QRCode.toDataURL(qrValue, {
      width: 256,
      margin: 2,
      color: {
        dark: lightState === "on" ? "#000000" : "#ffffff",
        light: lightState === "on" ? "#ffffff" : "#000000",
      },
    }).then(setQrDataUrl);
  }, [lightState]);

  const applyTorch = useCallback(async (on: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ torch: on } as MediaTrackConstraintSet],
      });
    } catch {
      // torch not supported
    }
  }, []);

  const handleQRValue = useCallback(
    async (value: string) => {
      const parsed = parseStateFromUrl(value.trim());
      if (!parsed) return;

      // Track that we're seeing a valid QR from our parent (before cooldown check)
      if (parsed.parentId) {
        lastQrSeenRef.current = Date.now();
      }

      if (cooldownRef.current) return;

      const { state: targetState, parentId } = parsed;

      // Register relay: scanned QR means parentId created this QR
      if (myId.current && parentId) {
        registerNode(myId.current, parentId);
        registerNode(parentId, null);
      }

      const wantOn = targetState === "on";

      setLightState((prev) => {
        if ((prev === "on") === wantOn) return prev;

        cooldownRef.current = true;
        setTimeout(() => {
          cooldownRef.current = false;
        }, 1200);

        applyTorch(wantOn);

        const next = wantOn ? "on" : "off";
        if (myId.current) {
          updateState(myId.current, next);
        }

        return next;
      });
    },
    [applyTorch]
  );

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
            inversionAttempts: "attemptBoth",
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
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        trackRef.current = stream.getVideoTracks()[0];

        await video.play();
        startScanning(video);
      } catch {
        setError("カメラへのアクセスが拒否されました。");
      }
    };

    init();

    return () => {
      scanningRef.current = false;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [startScanning]);

  return (
    <div id="app">
      {error ? (
        <p id="error">{error}</p>
      ) : (
        <>
          {qrDataUrl && (
            <img id="qr-image" src={qrDataUrl} alt={`QR: ${lightState}`} />
          )}

          <div id="camera-display">
            <video ref={videoRef} autoPlay playsInline muted />
            <p id="state-label">{lightState.toUpperCase()}</p>
          </div>

          {hasParent && (
            <div id="connection-status" className={parentConnected ? "connected" : "lost"}>
              {parentConnected ? (
                <span>Connecting</span>
              ) : (
                <span>Connection lost — 前の人のQRを読み取り続けてください</span>
              )}
            </div>
          )}
        </>
      )}

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
