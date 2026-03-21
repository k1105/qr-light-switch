"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { getUserId } from "../lib/userId";
import { registerNode, updateState } from "../lib/relay";

type LightState = "on" | "off";

const APP_ORIGIN = "https://qr-light-switch.vercel.app";

export default function MasterPage() {
  const [lightState, setLightState] = useState<LightState>("off");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const myId = useRef("");

  useEffect(() => {
    myId.current = getUserId();
    registerNode(myId.current, null);
  }, []);

  useEffect(() => {
    const id = myId.current || getUserId();
    const qrValue = `${APP_ORIGIN}/?parent=${id}&state=${lightState}`;
    QRCode.toDataURL(qrValue, {
      width: 512,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    }).then(setQrDataUrl);
  }, [lightState]);

  const toggle = () => {
    setLightState((prev) => {
      const next = prev === "on" ? "off" : "on";
      if (myId.current) {
        updateState(myId.current, next);
      }
      return next;
    });
  };

  return (
    <div
      onClick={toggle}
      style={{
        width: "100vw",
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: lightState === "on" ? "#fff" : "#111",
        cursor: "pointer",
        transition: "background 0.2s",
        userSelect: "none",
      }}
    >
      {qrDataUrl && (
        <img
          src={qrDataUrl}
          alt={`QR: ${lightState}`}
          style={{
            width: "min(80vw, 80vh)",
            height: "auto",
            imageRendering: "pixelated",
          }}
        />
      )}
      <p
        style={{
          marginTop: 24,
          fontFamily: "monospace",
          fontSize: 24,
          color: lightState === "on" ? "#000" : "#fff",
        }}
      >
        {lightState.toUpperCase()}
      </p>
      <p
        style={{
          marginTop: 8,
          fontFamily: "monospace",
          fontSize: 13,
          color: lightState === "on" ? "#999" : "#666",
        }}
      >
        tap to toggle
      </p>
    </div>
  );
}
