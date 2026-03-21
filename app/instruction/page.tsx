"use client";

export default function InstructionPage() {
  return (
    <div
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "48px 24px",
        fontFamily: "monospace",
        color: "#fff",
        background: "#111",
        minHeight: "100dvh",
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 32, borderBottom: "1px solid #444", paddingBottom: 16 }}>
        Scratch &amp; Build — QR Light Switch
      </h1>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, color: "#aaa", marginBottom: 12 }}>About this performance</h2>
        <p style={{ lineHeight: 1.8, fontSize: 15 }}>
          これは参加型のパフォーマンスです。<br />
          来場者の皆さんに、ネットワークの「ノード」になっていただきます。
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, color: "#aaa", marginBottom: 12 }}>How to participate</h2>
        <p style={{ lineHeight: 1.8, fontSize: 15 }}>
          まもなく指示書が配布されます。<br />
          3つの役割があります：<strong>カメラマン</strong>、<strong>マスター</strong>、<strong>ノード</strong>。<br />
          指示書に書かれた内容に沿って行動してください。
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, color: "#aaa", marginBottom: 12 }}>Rules</h2>
        <ul style={{ lineHeight: 2, fontSize: 15, paddingLeft: 20 }}>
          <li>指示書は他の人に渡すことができます</li>
          <li>接続するとき、前の人と「シェイクハンド」してください</li>
          <li>ネットワークを広げてください</li>
        </ul>
      </section>

      <section>
        <p style={{ color: "#666", fontSize: 13, marginTop: 48 }}>
          Waiting for instructions...
        </p>
      </section>
    </div>
  );
}
