"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import QRCode from "qrcode";

type LightState = "on" | "off";

const APP_ORIGIN = "https://qr-light-switch.vercel.app";

function parseStateFromUrl(value: string): LightState | null {
  try {
    const url = new URL(value);
    if (!url.origin.includes("qr-light-switch")) return null;
    const state = url.searchParams.get("state");
    if (state === "on" || state === "off") return state;
    return null;
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

  // Generate QR code as URL with state param
  useEffect(() => {
    const qrValue = `${APP_ORIGIN}/?state=${lightState}`;
    QRCode.toDataURL(qrValue, {
      width: 256,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
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
      // Support both plain "ON"/"OFF" and URL with ?state= param
      let targetState: LightState | null = null;

      const parsed = parseStateFromUrl(value.trim());
      if (parsed) {
        targetState = parsed;
      } else {
        const normalized = value.trim().toUpperCase();
        if (normalized === "ON") targetState = "on";
        else if (normalized === "OFF") targetState = "off";
      }

      if (!targetState) return;
      if (cooldownRef.current) return;

      const wantOn = targetState === "on";

      setLightState((prev) => {
        if ((prev === "on") === wantOn) return prev;

        cooldownRef.current = true;
        setTimeout(() => {
          cooldownRef.current = false;
        }, 1200);

        applyTorch(wantOn);

        return wantOn ? "on" : "off";
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
      <div id="qr-display">
        {error ? (
          <p id="error">{error}</p>
        ) : (
          <>
            <p id="state-label">{lightState.toUpperCase()}</p>
            {qrDataUrl && (
              <img id="qr-image" src={qrDataUrl} alt={`QR: ${lightState}`} />
            )}
          </>
        )}
      </div>

      {/* Hidden elements for camera scanning */}
      <video ref={videoRef} autoPlay playsInline muted style={{ display: "none" }} />
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
