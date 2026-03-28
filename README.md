# HAFL

HAFL は **Human and AI Friendly Language** の略です。  
このリポジトリでは、AI による安定解釈、検証、更新を重視した **HAFL Strict v0.3** の初期版を管理します。

## 概要

HAFL Strict v0.3 は、HAFL の可読性を保ちながら、次の点を強化するための仕様です。

- セクション名やキー名の揺れの抑制
- 同名セクションの順序保持
- 差分管理しやすい構造
- 長文やコードの安全な埋め込み
- 将来的なパーサー実装とバリデーションの容易化

## 同梱ファイル

- `HAFL_Strict_v0_3_spec.md`: 日本語の仕様書
- `HAFL_Strict_v0_3.hafl`: 仕様内容を HAFL 形式で表した原文
- `HAFL_Strict_v0_3_ja.hafl`: 上記の日本語版 HAFL

## 基本構造

HAFL Strict v0.3 は、`@section` を基準に文書を構成します。

- セクション開始: `@project`, `@task`, `@note` など
- キーと値: `name: HAFL`
- リスト: `- keep one meaning per line`
- ブロック: `@begin` から `@end`

同名セクションは上書きせず、**順序付き配列**として扱います。

## 短い例

```hafl
@project
name: HAFL
version: 0.3
status: draft

@goal
target: stable parsing
description: keep documents readable and machine-friendly

@note
title: one line definition
@begin
HAFL Strict v0.3 is a stricter operational form of HAFL.
@end
```

## Strict ルールの要点

- 1行に1つの意味だけを書く
- 1つのセクション内で同一キーを重複させない
- `@begin` は必ず `@end` で閉じる
- `@begin` のネストは禁止
- `@begins` は無効
- 標準セクション語彙の使用を推奨する

## ステータス

現在は **初期版 v0.3** です。  
今後の候補として、`ref` の正式仕様、section ID、type hint、import/include、JSON/YAML 変換ルールなどを想定しています。
