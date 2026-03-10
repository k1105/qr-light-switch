"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

type LightState = "on" | "off";

export default function QRScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const scanningRef = useRef(false);
  const cooldownRef = useRef(false);

  const [lightState, setLightState] = useState<LightState>("off");
  const [status, setStatus] = useState("カメラを起動中...");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [torchSupported, setTorchSupported] = useState(true);

  const applyTorch = useCallback(async (on: boolean) => {
    const track = trackRef.current;
    if (!track) return;

    try {
      await track.applyConstraints({
        advanced: [{ torch: on } as MediaTrackConstraintSet],
      });
    } catch {
      setTorchSupported(false);
    }
  }, []);

  const handleQRValue = useCallback(
    async (value: string) => {
      const normalized = value.trim().toUpperCase();
      if (normalized !== "ON" && normalized !== "OFF") return;
      if (cooldownRef.current) return;

      const wantOn = normalized === "ON";

      setLightState((prev) => {
        if ((prev === "on") === wantOn) return prev;

        cooldownRef.current = true;
        setTimeout(() => {
          cooldownRef.current = false;
        }, 1200);

        applyTorch(wantOn);

        setFlash(true);
        setTimeout(() => setFlash(false), 250);

        const next: LightState = wantOn ? "on" : "off";
        setStatus(
          wantOn
            ? 'ライト点灯中 - "OFF" で消灯'
            : 'ライト消灯中 - "ON" で点灯'
        );
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
        setStatus("QRコードをスキャンしてください");
        startScanning(video);
      } catch {
        setError(
          "カメラへのアクセスが拒否されました。ブラウザの設定からカメラの許可を有効にしてください。"
        );
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

  const isOn = lightState === "on";

  return (
    <div className="flex flex-col h-[100dvh] bg-[#111] text-white overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1a1a1a] z-10">
        <span
          className={`text-lg font-bold transition-colors duration-300 ${
            isOn ? "text-yellow-400" : "text-gray-500"
          }`}
        >
          {isOn ? "ON" : "OFF"}
        </span>
        <div className="flex items-center gap-2">
          {!torchSupported && (
            <span className="text-xs text-gray-500">
              Torch N/A
            </span>
          )}
          <div
            className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
              isOn
                ? "bg-yellow-400 shadow-[0_0_10px_theme(colors.yellow.400),0_0_20px_rgba(250,204,21,0.4)]"
                : "bg-gray-600"
            }`}
          />
        </div>
      </div>

      {/* Camera view */}
      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="flex items-center justify-center h-full p-8 text-center">
            <p className="text-gray-400 text-[15px] leading-relaxed">
              {error}
            </p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Scan overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[220px] h-[220px] border-2 border-white/40 rounded-2xl relative">
                {/* Corner accents */}
                <div className="absolute -top-px -left-px w-[30px] h-[30px] border-t-[3px] border-l-[3px] border-white rounded-tl-xl" />
                <div className="absolute -top-px -right-px w-[30px] h-[30px] border-t-[3px] border-r-[3px] border-white rounded-tr-xl" />
                <div className="absolute -bottom-px -left-px w-[30px] h-[30px] border-b-[3px] border-l-[3px] border-white rounded-bl-xl" />
                <div className="absolute -bottom-px -right-px w-[30px] h-[30px] border-b-[3px] border-r-[3px] border-white rounded-br-xl" />

                {/* Scan line */}
                <div
                  className="absolute left-[10px] right-[10px] h-0.5 bg-yellow-400/70"
                  style={{
                    animation: "scanLine 2s ease-in-out infinite",
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Message bar */}
      <div className="px-4 py-3.5 text-center text-sm text-gray-400 bg-[#1a1a1a]">
        {error ? "エラーが発生しました" : status}
      </div>

      {/* Flash feedback */}
      <div
        className={`fixed inset-0 bg-yellow-400/15 pointer-events-none z-50 transition-opacity duration-150 ${
          flash ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Hidden canvas for QR scanning */}
      <canvas ref={canvasRef} className="hidden" />

      <style jsx>{`
        @keyframes scanLine {
          0%, 100% { top: 10px; }
          50% { top: calc(100% - 12px); }
        }
      `}</style>
    </div>
  );
}
