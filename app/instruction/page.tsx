"use client";

export default function InstructionPage() {
  return (
    <div
      style={{
        margin: "0 auto",
        padding: "10vh 20vw",
        fontFamily: "monospace",
        color: "#fff",
        background: "#0000ff",
        minHeight: "100dvh",
      }}
    >
      <section style={{marginBottom: 32}}>
        <p style={{lineHeight: 1.8, fontSize: "1.5rem"}}>
          今から行われるのは、参加型のパフォーマンスです。
          <br />
          皆さんのスマートフォンと身体を使って、
          「人間ネットワーク」を作ります。
        </p>
        <p
          style={{
            lineHeight: 1.8,
            fontSize: "1.2rem",
            color: "#ccc",
            marginTop: 12,
          }}
        >
          What follows is a participatory performance.
          <br />
          Using your smartphones and your bodies, you will build a &quot;human
          network.&quot;
        </p>
      </section>

      <section style={{marginBottom: 32}}>
        <h2 style={{fontSize: 18, color: "#aaa", marginBottom: 12}}>
          参加方法 / How to participate
        </h2>
        <p style={{lineHeight: 1.8, fontSize: "1.5rem"}}>
          難しくはありません。このあと、簡単な指示の書かれた紙が渡されます。
          <br />
          指示書に書かれた内容のとおりに行動するだけで、
          <br />
          ネットワークが自然と出来上がります。
        </p>
        <p
          style={{
            lineHeight: 1.8,
            fontSize: "1.2rem",
            color: "#ccc",
            marginTop: 12,
          }}
        >
          It&apos;s simple. You will receive a sheet with brief instructions.
          <br />
          Just follow them, and the network will form naturally.
        </p>
      </section>

      <section style={{marginBottom: 32}}>
        <h2 style={{fontSize: 18, color: "#aaa", marginBottom: 12}}>
          注意事項 / Notes
        </h2>
        <ul style={{lineHeight: 2, fontSize: 15, paddingLeft: 20}}>
          <li>指示書は他の人に渡すことができます。</li>
          <li>
            指示書があれば、好きなときにパフォーマンスから離脱したり、別の役割を担うことができます。
          </li>
          <li>周りの人と「シェイクハンド（握手）」をすることがあります。</li>
          <li>ネットワークを広げてください</li>
        </ul>
        <ul
          style={{
            lineHeight: 2,
            fontSize: 14,
            paddingLeft: 20,
            color: "#ccc",
            marginTop: 8,
          }}
        >
          <li>You may pass your instruction sheet to someone else.</li>
          <li>
            With an instruction sheet, you can leave the performance or take on
            a different role at any time.
          </li>
          <li>You may shake hands with people around you.</li>
          <li>Extend the network!</li>
        </ul>
      </section>

      <section>
        <p style={{color: "#666", fontSize: 13, marginTop: 48}}>
          Waiting for instructions...
        </p>
      </section>
    </div>
  );
}
