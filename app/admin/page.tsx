"use client";

import { useState } from "react";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function AdminPage() {
  const [status, setStatus] = useState<string>("Ready");
  const [clearing, setClearing] = useState(false);

  const clearCollection = async (name: string) => {
    const snap = await getDocs(collection(db, name));
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
    }
    return snap.size;
  };

  const clearSubcollections = async (parentPath: string, subcollections: string[]) => {
    let count = 0;
    for (const sub of subcollections) {
      const snap = await getDocs(collection(db, parentPath, sub));
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
      count += snap.size;
    }
    return count;
  };

  const handleReset = async () => {
    if (!confirm("全データをリセットします。よろしいですか？")) return;

    setClearing(true);
    setStatus("Clearing...");

    try {
      const nodesCount = await clearCollection("nodes");
      setStatus(`nodes: ${nodesCount} deleted`);

      const metaCount = await clearCollection("meta");
      setStatus((s) => s + ` | meta: ${metaCount} deleted`);

      // rooms and subcollections
      const roomRef = doc(db, "rooms", "camera-stream");
      const subCount = await clearSubcollections("rooms/camera-stream", [
        "callerCandidates",
        "calleeCandidates",
      ]);
      await deleteDoc(roomRef).catch(() => {});
      setStatus((s) => s + ` | rooms: ${subCount + 1} deleted`);

      setStatus((s) => s + " | DONE");
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: "48px 24px",
        fontFamily: "monospace",
        color: "#fff",
        background: "#111",
        minHeight: "100dvh",
      }}
    >
      <h1 style={{ fontSize: 24, marginBottom: 32 }}>Admin</h1>

      <button
        onClick={handleReset}
        disabled={clearing}
        style={{
          padding: "16px 32px",
          fontSize: 18,
          fontFamily: "monospace",
          background: clearing ? "#333" : "#c00",
          color: "#fff",
          border: "none",
          borderRadius: 4,
          cursor: clearing ? "not-allowed" : "pointer",
          width: "100%",
        }}
      >
        {clearing ? "Clearing..." : "RESET ALL DATA"}
      </button>

      <p style={{ marginTop: 24, fontSize: 14, color: "#aaa" }}>{status}</p>

      <p style={{ marginTop: 48, fontSize: 12, color: "#666" }}>
        nodes, meta, rooms を全削除します。
        <br />
        本番前に実行してください。
      </p>
    </div>
  );
}
