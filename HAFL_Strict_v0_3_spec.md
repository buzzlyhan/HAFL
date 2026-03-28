# HAFL Strict v0.3 仕様書

**HAFL = Human and AI Friendly Language**  
**Strict モード = 人間とAIの共同運用よりも、AIによる安定解釈と機械処理を強めた運用仕様**

---

## 1. 目的

HAFL Strict v0.3 は、HAFL の「人間とAIに優しい」という思想を保ちつつ、次の課題を改善するための厳格仕様である。

- セクション名や属性名の揺れを減らす
- 同じ内容を別表現で書いてしまう問題を抑える
- AIが安定して抽出・分解・更新しやすくする
- 差分管理しやすい構造にする
- コードや長文を安全に埋め込めるようにする
- 将来的なパーサー実装・バリデーションを容易にする

HAFL v0.2 が「やさしい共通記述」なら、HAFL Strict v0.3 は「やさしさを残した厳格運用」である。

---

## 2. 設計思想

### 2.1 人間に優しい
- 見出しベースで構造が読める
- 1行1意味を基本にする
- 深いネストを避ける
- テキストエディタでそのまま編集できる

### 2.2 AIに優しい
- 標準セクション語彙を固定する
- キー名を固定する
- 同名セクションの扱いを明確にする
- 生テキスト領域の境界を明示する
- ルール違反を検出しやすくする

### 2.3 壊れにくい
- インデント依存を弱くする
- 予約語を最小限に保つ
- 多義的な記述を禁止または非推奨にする

---

## 3. HAFL と HAFL Strict の違い

| 項目 | HAFL v0.2 | HAFL Strict v0.3 |
|---|---|---|
| セクション名 | 比較的自由 | 標準語彙を強く推奨、一部固定 |
| キー名 | 比較的自由 | 固定または推奨語彙へ制限 |
| 同名セクション | 曖昧 | 順序保持の配列として扱う |
| コードブロック | 可 | 構文と属性を固定 |
| 検証 | ゆるい | strict ルールで検証可能 |
| 用途 | メモ・指示・共有 | AI処理・自動更新・構造運用 |

---

## 4. 予約語

### 4.1 強い予約記号

| 記号 | 役割 |
|---|---|
| `@` | セクション開始 |
| `:` | キーと値の区切り |
| `-` | リスト項目 |
| `#` | コメント |

### 4.2 強い予約キーワード

| キーワード | 役割 |
|---|---|
| `true` | 真 |
| `false` | 偽 |
| `null` | 空値 |
| `@begin` | 生テキストブロック開始 |
| `@end` | 生テキストブロック終了 |

### 4.3 Strong Standard Sections

HAFL Strict では以下を**標準セクション語彙**とする。

- `@meta`
- `@project`
- `@task`
- `@goal`
- `@rules`
- `@step`
- `@memory`
- `@avoid`
- `@code`
- `@data`
- `@layout`
- `@note`
- `@schema`

これ以外のセクション名も使用できるが、**拡張セクション**として扱う。

---

## 5. 識別子ルール

### 5.1 セクション名
- 英字開始
- 英数字、`_`、`-` を使用可
- 空白不可
- 予約キーワードとの衝突禁止

### 5.2 キー名
- 英字開始を推奨
- 英数字、`_`、`-` を使用可
- 空白不可
- 1つのセクション内で同一キーの重複は禁止

### 5.3 値
- 文字列
- 数値
- 真偽値
- `null`
- リスト要素
- ブロックテキスト

---

## 6. セクション属し方ルール

HAFL Strict では、**次のセクションが始まるまで、行は現在のセクションに属する。**

例:

```hafl
@project
name: OCHub
version: 0.3

@goal
target: creators
```

この場合、`name` と `version` は `@project` に属し、`target` は `@goal` に属する。

---

## 7. 同名セクションの扱い

同名セクションが複数回出現した場合、**順序保持された配列**として扱う。

例:

```hafl
@step
name: install
command: npm install

@step
name: build
command: npm run build
```

これは `@step` の配列とみなす。

### 規則
- 上書きではない
- 出現順を保持する
- AIは順番を意味情報として扱ってよい

---

## 8. 1行1意味ルール

Strict モードでは、1行には原則として1つの意味だけを書く。

### 良い例

```hafl
name: OCHub
mode: strict
```

### 悪い例

```hafl
name: OCHub, mode: strict
```

---

## 9. 標準キー語彙

HAFL Strict では、頻出キーとして以下を推奨する。

- `name`
- `id`
- `type`
- `title`
- `version`
- `target`
- `tone`
- `purpose`
- `status`
- `command`
- `language`
- `content_type`
- `description`
- `ref`

用途が重なる同義語の乱立は避ける。

### 非推奨例
- `goal_name`
- `goalTitle`
- `purpose_text`
- `tmp_name`

---

## 10. リスト規則

リストは `-` で始める。

```hafl
@rules
- keep structure simple
- use standard section names
- avoid duplicate keys
```

### Strict ルール
- リスト要素と通常プロパティを曖昧に混在させない
- 項目は短く保つ
- 長文はブロックを使う

---

## 11. ブロック構文

複数行コードや長文には `@begin` と `@end` を用いる。

### 11.1 基本構文

```hafl
@code
language: javascript
purpose: click handler
@begin
button.addEventListener("click", () => {
  console.log("clicked")
})
@end
```

### 11.2 Strict ルール
- `@begin` は `@code` または `@note` など、ブロック許可セクション内で使う
- ブロックは必ず `@end` で閉じる
- ブロック内はHAFL構文として解釈しない
- `@begin` の複数ネストは禁止

### 11.3 `@begins` について
`@begins` は予約語ではない。  
Strict では **`@begin` のみ有効** とする。  
誤記 `@begins` は構文エラーまたはバリデーションエラー扱いにする。

---

## 12. Strict バリデーションルール

HAFL Strict v0.3 では、少なくとも以下を検証対象にできる。

### 12.1 エラー
- セクション外にリストだけが出現する
- 重複キーがある
- `@begin` に対する `@end` がない
- `@end` が単独で出現する
- `@begins` など未定義予約語もどきが出現する
- 空白を含むセクション名
- 空キー

### 12.2 警告
- 標準語彙外セクションの多用
- 曖昧なセクション名（例: `@misc`）
- 曖昧なキー名（例: `tmp`）
- 長すぎるリスト項目
- 同義語の混在（例: `goal`, `purpose`, `objective` を同じ意味で乱用）

---

## 13. 推奨セクションテンプレート

### 13.1 `@project`
推奨キー:
- `name`
- `type`
- `version`
- `status`

### 13.2 `@task`
推奨キー:
- `name`
- `id`
- `status`
- `purpose`

### 13.3 `@goal`
推奨キー:
- `target`
- `tone`
- `description`

### 13.4 `@step`
推奨キー:
- `name`
- `command`
- `status`
- `ref`

### 13.5 `@code`
推奨キー:
- `language`
- `purpose`
- `content_type`

---

## 14. 簡易文法（BNF風）

```text
document          ::= { element }
element           ::= blank_line
                    | comment_line
                    | section

section           ::= section_line { section_body_line }
section_line      ::= "@" identifier
section_body_line ::= property_line
                    | list_line
                    | comment_line
                    | block
                    | blank_line

property_line     ::= identifier ":" value
list_line         ::= "-" value
block             ::= "@begin" newline { block_content_line } "@end"

identifier        ::= letter { letter | digit | "_" | "-" }
value             ::= quoted_text | boolean | null | number | bare_text
boolean           ::= "true" | "false"
null              ::= "null"
```

---

## 15. パース上の意味

### 15.1 ドキュメント
文書はセクション列として扱う。

### 15.2 セクション
各セクションは以下を持つ。
- `section_name`
- `properties`
- `list_items`
- `blocks`
- `comments`

### 15.3 同名セクション
同名セクションは ordered array として保持する。

---

## 16. 例: Strict 仕様に沿った文書

```hafl
@meta
name: HAFL Strict Example
version: 0.3
status: draft

@project
name: OCHub
type: creator platform
version: 0.3
status: active

@task
id: build-flow
name: standard build flow
status: active
purpose: stable project setup

@goal
target: repeatable local build
description: reduce setup mistakes and make AI execution safer

@rules
- use standard section names
- avoid duplicate keys
- keep one meaning per line
- use @begin and @end for multiline content

@step
name: install dependencies
command: npm install
status: ready

@step
name: run build
command: npm run build
status: ready

@code
language: bash
purpose: sample build script
content_type: shell
@begin
npm install
npm run build
@end
```

---

## 17. AI運用上の利点

HAFL Strict v0.3 は次の点で AI に有利である。

- セクション境界が明確
- 語彙の揺れを抑えやすい
- 同名セクションを配列として扱える
- ブロック境界が明示される
- バリデーションしやすい
- 差分更新しやすい
- 人間にもまだ読める

---

## 18. 制約と弱点

正直に言うと、Strict 化には代償もある。

- 柔軟さは少し減る
- 自由記述の気楽さは落ちる
- 推奨語彙を守らないと美しさが崩れる
- パーサーやバリデータの実装判断がまだ少し残る

つまり、HAFL Strict は「自由なメモ」より「運用できる共通記述」に寄せた仕様である。

---

## 19. 一行定義

**HAFL Strict v0.3 は、人間可読性を保ちながら、AIによる安定解釈・検証・更新を可能にするための厳格化された HAFL 運用仕様である。**

---

## 20. 次の拡張候補

- `ref` の正式仕様
- section ID の正式仕様
- type hint の正式仕様
- import / include
- strict schema 定義
- JSON / YAML 変換ルール
- validator 実装用の canonical form
