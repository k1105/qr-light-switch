# QR Light Switch — Scratch & Build @ 攻殻機動隊展

## 概要

参加型パフォーマンス作品。来場者がQRコードを読み取り合うことで「人間ネットワーク」を構築し、会場後方のGOAL端末に信号を届けてHello, World!を出力する。

## 技術スタック

- Next.js 16 (Turbopack)
- React 19
- Firebase Firestore（リアルタイム同期・シグナリング）
- D3.js（ネットワーク可視化）
- WebRTC（カメラ映像配信、Firestoreをシグナリングに使用）
- Vercelにデプロイ: qr-light-switch.vercel.app

## ページ構成

| パス | 用途 | 端末 |
|------|------|------|
| `/` | ノード用。QR読み取り＋自分のQR表示 | 来場者スマホ |
| `/master` | 信号発信源。タップでon/off切り替え | 指定スマホ |
| `/goal` | ゴール端末。on信号3回でHello, World! | iPad or スマホ |
| `/performance` | スクリーン表示。カメラ映像＋ネットワーク可視化 | PC（HDMI出力） |
| `/camera` | カメラ配信。WebRTCでperformanceに映像を送る | カメラマンのスマホ |
| `/instruction` | 参加案内テキスト | PC（HDMI出力） |
| `/admin` | データリセット | 管理用 |

## Firestoreデータ構造

```
nodes/{userId}
  - parentId: string | null
  - state: "on" | "off"
  - createdAt: Timestamp
  - isGoal?: boolean

meta/goal
  - completed: boolean

rooms/camera-stream
  - offer: { type, sdp }
  - answer: { type, sdp }
  - createdAt: number
  rooms/camera-stream/callerCandidates/{id}
  rooms/camera-stream/calleeCandidates/{id}
```

## 主要ライブラリ

- `app/lib/firebase.ts` — Firebase初期化
- `app/lib/relay.ts` — ノード登録・状態更新
- `app/lib/userId.ts` — ユーザーID生成（nanoid、localStorage保存）
- `app/lib/webrtc.ts` — WebRTCカメラ配信・受信

## 環境変数

`.env.local` に以下が必要：
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

## 開発

```bash
yarn dev
```

## 本番前チェックリスト

- `/admin` でFirestoreリセット
- `/goal` を先に開いてGOALノードを登録
- `/performance` でカメラ映像＋ネットワーク表示確認
- `/camera` で映像配信確認
