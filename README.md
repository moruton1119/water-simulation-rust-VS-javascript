# Water Simulation - Rust vs JavaScript

Stable Fluids アルゴリズムに基づく、ブラウザベースのリアルタイム流体シミュレーション。

## 概要

このプロジェクトは、Jos Stam 氏の "Real-Time Fluid Dynamics for Games" 論文に基づく Stable Fluids アルゴリズムを実装し、JavaScript と Rust (WebAssembly) のパフォーマンス比較を行うことを目的としています。

## 特徴

- リアルタイム流体シミュレーション
- 川の流れ（定常流）の再現
- 障害物（石）の配置と流体との相互作用
- インタラクティブな操作（マウスドラッグで流体を操作）
- 解像度の動的変更

## 技術スタック

| カテゴリ | 技術 |
|----------|------|
| ビルドツール | Vite 5.0 |
| 計算エンジン (現在) | JavaScript |
| 計算エンジン (計画中) | Rust + WebAssembly |
| 描画 | Canvas 2D API |

## クイックスタート

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# ビルド
npm run build
```

## 操作方法

| 操作 | 説明 |
|------|------|
| マウスドラッグ | 流体を追加し、流れを起こす |
| クリック (Stoneモード) | 障害物を配置/削除 |
| Water / Stone ボタン | ブラシモードの切り替え |
| Resolution スライダー | シミュレーション解像度の変更 |

## プロジェクト構成

```
water-simulation/
├── src/
│   ├── main.js         # メインロジック
│   ├── fluid_js.js     # JavaScript計算エンジン
│   └── style.css       # スタイリング
├── src-rust/
│   └── lib.rs          # Rust計算エンジン (未統合)
├── docs/
│   ├── ARCHITECTURE.md # アーキテクチャ詳細
│   └── DEVELOPMENT_LOG.md
├── index.html
├── package.json
└── Cargo.toml
```

## ロードマップ

- [x] JavaScript版 Stable Fluids 実装
- [x] 障害物システム
- [x] UI/UX 完成
- [ ] Rust/Wasm 統合
- [ ] JS/Rust 切り替え機能
- [ ] パフォーマンス比較UI

## ライセンス

MIT

## 参考資料

- [Jos Stam - Real-Time Fluid Dynamics for Games](https://www.dgp.toronto.edu/~stam/reality/Research/pdf/GDC03.pdf)
