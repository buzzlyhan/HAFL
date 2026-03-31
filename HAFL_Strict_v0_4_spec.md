# HAFL Strict v0.4 仕様書

**HAFL = Human and AI Friendly Language**  
**Strict モード = 安定解釈と機械処理を重視した運用仕様**

---

## 1. 目的

HAFL Strict v0.4 は v0.3 を拡張し、**外部構造化データ（JSON/YAML/TOML）を安全に参照し、HAFL から差分意図を管理する**ことを目的とする。

v0.4 の主眼は次の 2 点である。

- 文書意味としての参照（`@ref`）を言語仕様に含める
- 編集体験としての補完を言語仕様から分離し、LSP/拡張に委譲する

---

## 2. 設計境界

### 2.1 言語仕様に含めるもの
- 外部参照宣言（`@ref`）
- 差分宣言（`@override` / `@patch`）
- 解決順序
- 循環参照禁止
- 参照ポリシー（ローカル優先、ネットワーク既定禁止）

### 2.2 言語仕様に含めないもの
- エディタ補完仕様
- UI 依存の診断表示仕様
- IDE 固有のコードアクション仕様

補完や型ヒントの提示は、`schema` 参照を利用して LSP/拡張側で実装する。

---

## 3. v0.3 からの追加要素

- 新規標準セクション: `@ref`
- 新規標準セクション: `@override`
- 新規標準セクション: `@patch`
- 新規標準キー: `format`, `path`, `uri`, `schema`, `readonly`, `target`, `value`

---

## 4. `@ref` 仕様

`@ref` は外部データソースを明示参照する。

### 4.1 必須キー
- `id`: 参照識別子（文書内で一意）
- `format`: `json` | `yaml` | `toml`

### 4.2 条件付き必須キー
- `path` または `uri` のどちらか一方を必須
- `path` と `uri` の同時指定は禁止

### 4.3 任意キー
- `schema`: スキーマ参照（`path` または `uri` 形式）
- `readonly`: `true` | `false`（既定値は `true`）

### 4.4 `readonly` の意味
`readonly: true` は、参照元ファイル自体への直接書き戻しを禁止する。  
`@override` / `@patch` による合成ビュー上の差分適用は許可される。

---

## 5. `@override` 仕様

`@override` は参照済みデータに対し、**局所的な値置換**を宣言する。

### 5.1 必須キー
- `target`: 対象 `@ref.id`
- `path`: 対象パス（ドット記法）
- `value`: 上書き値

### 5.2 任意キー
- `type`: 値型ヒント（`string` | `number` | `boolean` | `null` | `object` | `array`）

### 5.3 例

```hafl
@override
target: app_config
path: features.ai.enabled
value: true
type: boolean
```

---

## 6. `@patch` 仕様

`@patch` は複数操作を含む構造差分を宣言する。

### 6.1 必須キー
- `target`: 対象 `@ref.id`
- `op`: `add` | `replace` | `remove`
- `path`: 対象パス

### 6.2 任意キー
- `value`: `op` が `add` または `replace` のとき必須

### 6.3 運用指針
- 単純な値変更は `@override` を優先
- 構造操作（配列追加・削除など）は `@patch` を使用

---

## 7. 解決順序（固定）

v0.4 では解決順序を固定する。

1. `@ref` を解決し、参照元データを読み込む
2. `@override` を文書出現順に適用
3. `@patch` を文書出現順に適用

優先順位は **imported < local override < local patch** とする。

同一 `target + path` に対する複数指定は、後勝ち（last write wins）とする。

---

## 8. 循環参照と参照制約

### 8.1 循環参照
- 参照グラフの循環を禁止
- 循環検出時はエラー

### 8.2 参照解決失敗
- `target` 未解決はエラー
- 参照先未存在はエラー
- `format` 不一致はエラー

---

## 9. ネットワーク参照ポリシー

初期段階の既定動作ではネットワーク参照を禁止する。

- 許可: 相対 `path`、絶対 `path`、`file://` URI
- 禁止（既定）: `http://`、`https://`

将来拡張として、明示許可キー（例: `allow_network_ref: true`）と許可リストを導入可能とする。

---

## 10. 補完とスキーマ利用

補完は言語本体ではなく、LSP/拡張の責務とする。

- `@ref.schema` がある場合、LSP はそのスキーマを使って補完・型診断を提供できる
- HAFL 本体仕様は、補完の UI/挙動まで規定しない

---

## 11. 最小構成プロファイル

実務導入の最小構成は次とする。

- `@ref`
- `@override` または `@patch`
- `schema`
- 解決順序
- 循環禁止

---

## 12. 推奨例

```hafl
@ref
id: app_config
format: json
path: ./config/app.json
schema: ./schema/app.schema.json
readonly: true

@override
target: app_config
path: features.ai.enabled
value: true
type: boolean
```

---

## 13. 非推奨パターン

- 暗黙 import
- 自動マージ規則の過剰化
- JSON/YAML/TOML の差異吸収を HAFL 本体で過剰に行う設計
- 補完仕様を言語コアへ混在させる設計

---

## 14. バリデーション追加項目（v0.4）

### 14.1 エラー
- `@ref.id` 重複
- `path` と `uri` の同時指定
- 未対応 `format`
- `@override.target` 未解決
- `@patch.op` 未対応
- 循環参照

### 14.2 警告
- `schema` 未指定の `@ref`
- `readonly: false` の多用
- 過剰な `@override` 連打（構造差分に `@patch` が適するケース）

---

## 15. まとめ

HAFL Strict v0.4 は、HAFL を「外部構造化データのオーケストレーション層」として拡張する。  
これにより、次の責務分離が明確になる。

- HAFL: 意図、運用ルール、差分宣言
- JSON/YAML/TOML: 厳密データ本体
- LSP/拡張: 補完と編集支援
