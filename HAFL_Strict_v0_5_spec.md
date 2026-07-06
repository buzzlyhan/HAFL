# HAFL Strict Spec v0.5

## 0. v0.4からの変更点(サマリ)

| # | 変更内容 | 理由 |
|---|---|---|
| 1 | `path` を JSON Pointer (RFC 6901) に統一。例外なし | 実装者間の解釈揺れを排除 |
| 2 | `@override` を `replace` パッチの糖衣構文として意味論を確定 | 二重の意味論を持たせない |
| 3 | JSON/YAML/TOML → 共通内部モデル(HIM: HAFL Internal Model)への変換規則を規定 | フォーマット間の型不整合を解消 |
| 4 | エラーコード体系(`HAFL-Exxx`)を導入 | ツール連携・安定した契約 |
| 5 | 有効/無効テストケースを機能×正常異常のマトリクスで最低20個規定 | カバレッジの偏りを防止 |
| 6 | `readonly` の意味を「合成ビュー」と「出力ファイル生成」に分離し、伝播規則を規定 | ネスト参照時の曖昧さを解消 |
| 7 | `schema` の対応方言を JSON Schema 2020-12 に固定、検証対象を明記 | 方言不一致・`$ref`と`@ref`の混同を防止 |
| 8 | `@ref`は`path`ではなく専用フィールド`ref`を使い、RFC 6901 §6のURI Fragment Identifier Representationでファイル参照とJSON Pointerを結合 | `path`をJSON Pointerに統一した結果、`@ref`のファイルパスと衝突していたため |
| 9 | ディレクティブに専用テキスト構文を持たせず、ホストフォーマット(JSON/YAML/TOML)のマッピング構文にそのまま委譲。HIM変換後の抽象オブジェクト形状のみをABNF風に規定 | 独自字句解析器を書く必要をなくし、「パーサーを書こうとした瞬間に迷子」問題を解消 |
| 10 | `@patch`の`move`/`copy`必須引数、`test`失敗コード、ブロック内原子性、未知メンバー拒否、複数ブロックの適用順を明記 | RFC 6902準拠を名乗るための未決定事項を解消 |
| 11 | HIMの`DateTime`型はスキーマ検証前にISO 8601文字列へ正規化してから検証する方式(Option A)を採用 | HAFL独自スキーマ語彙を発明せず、JSON Schema標準の`format`語彙だけで完結させるため |
| 12 | TOMLのfloat/integerに関する記述を訂正(TOML仕様上、integerは64bit符号付き整数、floatはIEEE754 binary64として実装される) | 「arbitrary precision」という誤った記述の訂正 |
| 13 | `readonly`の伝播規則を「許可のAND」ではなく「禁止フラグ(`deny_view`/`deny_emit`)のOR」として再定義 | 実装者に伝わりやすい表現に修正(内容は同値) |

破壊的変更を含むため、v0.4以前の文書は本仕様書のパーサーでは**そのままでは動作しない**(§10 移行ガイド参照)。

---

## 1. スコープ

HAFLは3つの意味論プリミティブのみを定義する:

- `@ref` — 他ファイル/他ノードの値を参照する
- `@override` — 参照した値の一部を置換する(`@patch` の糖衣構文、§3参照)
- `@patch` — RFC 6902 (JSON Patch) に準拠した操作列を適用する

補完・ホバー・診断UIなどのエディタ機能は本仕様のスコープ外とし、LSP等の別レイヤーに委譲する。この境界は v0.4 から変更しない。

### 1.1 ディレクティブの構文モデル(ホスト文法への委譲)

HAFLは**独自のテキスト構文を持たない**。`@ref`/`@override`/`@patch`は、ホストフォーマット(JSON/YAML/TOML)自身のマッピング(object/table)構文で表現される**予約キー**であり、インデント・区切り文字・改行の扱いといった字句規則は、すべてホストフォーマット自身の文法にそのまま従う。YAMLならYAMLのインデント規則、TOMLならTOMLのテーブル構文がそのまま適用され、HAFLが新たに字句規則を追加することはない。

HAFLが規定するのは、HIMへの変換後に現れる**抽象オブジェクトとしての形(shape)**のみである。これを値レベルのABNF風文法で示す(text-levelではなくvalue-levelの文法であることに注意):

```abnf
directive        = ref-directive / override-directive / patch-directive

ref-directive     = object-with-single-key("@ref", ref-object)
override-directive = object-with-single-key("@override", override-object)
patch-directive   = object-with-single-key("@patch", patch-op-list)

ref-object        = "{" "ref" ":" ref-value
                         [ "," "readonly" ":" readonly-value ] "}"
override-object   = "{" "path" ":" json-pointer "," "value" ":" any-value "}"
patch-op-list     = "[" patch-op *( "," patch-op ) "]"
patch-op          = "{" "op" ":" op-name "," "path" ":" json-pointer
                        [ "," "from" ":" json-pointer ]
                        [ "," "value" ":" any-value ] "}"

op-name           = "add" / "remove" / "replace" / "move" / "copy" / "test"
readonly-value    = "true" / "false" / "view" / "emit"
json-pointer      = ; RFC 6901準拠の文字列
ref-value         = ; §2.4準拠の文字列(URI参照 + フラグメント)
```

補足:
- `object-with-single-key(K, V)` は「唯一のキー`K`を持ち、その値が文法`V`に従うオブジェクト」を意味する非終端記号。
- 同一オブジェクトが `@ref`/`@override`/`@patch` のうち2つ以上を同時に持つことは禁止し、検出時は `HAFL-E102` とする(ディレクティブは排他的)。
- `ref-object`/`override-object`/`patch-op` に上記で定義されていない余分なキーが含まれる場合の扱いは、§3.3(`@patch`)・§2.4(`@ref`)にそれぞれ規定する。

この設計により、HAFL用の独自字句解析器(トークナイザ)を書く必要がなくなる。実装者は既存のJSON/YAML/TOMLパーサーでホスト文書をパースし、その結果得られたHIM上のオブジェクトが上記の形状(shape)に合致するかを検証するだけでよい。

---

## 2. `path`: JSON Pointer への統一

### 2.1 規則

すべての `path` フィールドは **RFC 6901 (JSON Pointer)** 形式の文字列でなければならない。例外は認めない。

```
"/a/b/0/c"      // OK: a.b[0].c 相当
"/a/b~1c"       // OK: キーに '/' を含む場合は ~1 でエスケープ
"/a/b~0c"       // OK: キーに '~' を含む場合は ~0 でエスケープ
"a.b.c"         // NG: ドット記法は受理しない(v0.4形式は移行ガイド参照)
```

### 2.2 パース失敗時の扱い

- 先頭が `/` でない、またはエスケープ規則(`~0`, `~1`)に違反する `path` は **`HAFL-E101`** で即時エラーとする。警告への降格は認めない。

### 2.3 存在しないパスの参照

- `@ref` の解決先が存在しない場合 → `HAFL-E201`
- `@patch`(および糖衣構文としての`@override`)の `replace`/`remove` 対象が存在しない場合 → `HAFL-E202`(RFC 6902 の `replace` 仕様に準拠し、暗黙の `add` へのフォールバックは行わない)

### 2.4 `@ref` におけるファイル参照との衝突の解消

**問題**: `@override`/`@patch`は常に同一文書(解決済みの合成ビュー)内で完結するため`path`が純粋なJSON Pointerで十分だが、`@ref`は「どのファイルか」と「そのファイル内のどこか」という2つの情報を同時に表現する必要がある。両者とも`/`区切りであるため、単一の`path`フィールドに両方を詰め込むと構文的に一意に分割できない。

**解決**: `@ref`は`path`フィールドを使わず、`ref`という別フィールド名を用いる。値は **RFC 6901 §6 (URI Fragment Identifier Representation)** に従い、`[ ファイル参照 ] "#" [ JSON Pointer ]` の形式とする。

```
grammar (informal):
  ref-value    = [ file-locator ] [ "#" json-pointer ]
  file-locator = URI-reference (RFC 3986準拠、相対/絶対どちらも可)
  json-pointer = RFC 6901準拠のJSON Pointer(パーセントデコード後の値として解釈)
```

例:

```yaml
@ref: { ref: "#/a/b/c" }            # 同一文書内、/a/b/c
@ref: { ref: "other.yaml#/a/b" }    # other.yaml の /a/b
@ref: { ref: "other.yaml" }         # other.yaml 全体(フラグメント省略 = ドキュメントルート)
```

- `file-locator` 部分に `#` を文字として含めたい場合は `%23` でパーセントエンコードする(RFC 3986準拠)。
- `file-locator` を省略した場合(`#`で始まる場合)、同一文書内参照とみなす。
- `json-pointer` 部分を省略した場合(`#`自体もない場合)、参照先ファイルの**ドキュメントルート全体**を指す。
- `ref-value` が上記文法に違反する場合(不正なURI参照、フラグメント部のJSON Pointer構文違反など)は **`HAFL-E103`** とする。

この結果、`@override`/`@patch`の`path`(常に文書内のみ・`ref`フィールドは使わない)と、`@ref`の`ref`(文書跨ぎ・ファイル参照+フラグメント)は明確に別物として区別される。両者を混同して`@override`に`ref`を使う、あるいは`@ref`に`path`を使うことは構文エラー(`HAFL-E102`)とする。

---

## 3. `@override` = `replace` パッチの糖衣構文

### 3.1 展開規則

```yaml
# 入力(糖衣構文)
@override:
  path: /config/timeout
  value: 30

# 展開後(内部的に以下と完全に等価)
@patch:
  - op: replace
    path: /config/timeout
    value: 30
```

### 3.2 意味論の確定事項

| 論点 | 決定 |
|---|---|
| 対象パスが存在しない場合 | エラー(`HAFL-E202`)。`add` への暗黙フォールバックはしない |
| 暗黙の `test` 事前条件 | **含めない**。`@override` は無条件 `replace` のみ。事前条件を課したい場合はユーザーが明示的に `@patch` で `test` → `replace` の2ステップを書く |
| 複数の `@override` が同一 `path` に競合した場合 | v0.4 同様 last-write-wins。解決順序は §6 に従う |

`@override` は「値を置き換える」以上の意味を持たない、という単純さを維持する。条件付き置換が必要な場合は `@patch` を直接使うこと。

### 3.3 `@patch` のRFC 6902準拠に関する未確定事項の解消

v0.4では「`@patch`はRFC 6902準拠」と述べたが、以下の論点が未決定だった。ここで確定する。

| 論点 | 決定 |
|---|---|
| `move`/`copy` の `from` 必須規則 | RFC 6902と同様、`op: move` および `op: copy` は `from`(JSON Pointer)を必須のメンバーとする。欠如時は `HAFL-E204` |
| `test` 失敗時のエラーコード | `HAFL-E205`。「解決できたが期待値と一致しなかった」ことを示す専用コードとし、参照解決失敗系(E2xx中の他コード)とは区別する |
| パッチ適用の原子性(部分失敗時の巻き戻し) | 同一 `@patch` ブロック内の操作列は**原子的**に適用する。列中のいずれか1操作が失敗した場合、そのブロック内で既に適用済みの操作はすべてロールバックし、ブロック適用前の状態に戻す。RFC 6902が想定する「patch documentは全体として成功/失敗のいずれか」という前提に整合させる |
| 余分なメンバーの扱い | RFC 6902は未知メンバーの許容を実装依存としているが、HAFLは「Strict」を名乗る以上**エラーとする**(`HAFL-E206`)。`op`/`path`/`from`/`value` 以外のキーを含む操作オブジェクトは拒否する |
| 複数 `@patch` ブロックの適用順序 | 単一文書内に複数の `@patch` ブロックが存在する場合、§6で定義する解決順序(文書内の出現順)に従って**逐次**適用する。ブロック単位の原子性(上記)とは区別し、ブロック間の原子性は保証しない(あるブロックが失敗しても、それより前に成功した別ブロックの結果は残る) |

---

## 4. 共通内部モデル(HIM)への変換規則

HAFLはJSON/YAML/TOMLいずれの入力も、以下の**HAFL Internal Model (HIM)** に変換してから解決・検証・出力を行う。`@ref` を介した異フォーマット間参照は、常にHIM上で行われる。

### 4.1 型マッピング表

| HIM型 | JSON | YAML | TOML | 変換規則 |
|---|---|---|---|---|
| `Integer` | number(整数) | int | integer | TOML仕様上、integerは64bit符号付き整数としてロスレスに扱われる(TOML側の入力でこの範囲を超える値はTOMLパーサー自身の仕様違反としてHAFL層に到達する前にエラーになる)。JSON/YAML側から64bit範囲を超える整数が入力された場合のみ `HAFL-E301` とする |
| `Float` | number(小数) | float | float | TOML仕様上、floatはIEEE 754 binary64として実装される。HIMでは全フォーマット共通でIEEE754 binary64に統一するため、TOML由来のfloatに限った追加の丸め処理は発生しない。JSON/YAMLの数値リテラルがbinary64の精度を超える桁数を持つ場合にのみ丸めが発生し、`HAFL-W301` warningとする |
| `String` | string | str | string | そのまま |
| `Boolean` | true/false | true/false | true/false | そのまま |
| `Null` | null | `null`/`~`/空値 | (非対応、下記参照) | TOMLはnull非対応のため、TOML側での「キー欠如」は HIM上で「キー不在」として扱い、`Null`型には変換しない。TOML文書内でnull相当を表現しようとする記法(例: コメントで代用)はサポート対象外 |
| `DateTime` | 非対応(文字列扱い) | `!!timestamp` | native datetime | HIM内部では専用の `DateTime` 型として保持し、ISO 8601文字列を正準形とする。スキーマ検証時の扱いはOption A(§7.4)を採用し、検証直前にISO 8601文字列へ正規化する。型情報はHAFLメタデータとして保持され、`@override` 等で型不一致の値を代入しようとすると `HAFL-E302` |
| `Array` | array | sequence | array | そのまま |
| `Object` | object | mapping | table | そのまま |

### 4.2 重複キー

パース時に同一階層で重複するキーが検出された場合、フォーマットに関わらず **`HAFL-E303`(エラー)** とする。暗黙のlast-win採用はしない(YAML/TOMLパーサーの既知の非決定性論点を踏まえ、HAFLは常に明示的エラーを選ぶ)。

### 4.3 YAMLアンカー・エイリアス・マージキー

- アンカー(`&`)・エイリアス(`*`)は、HIMへの変換段階で展開(インライン化)してから処理する。展開後の構造に対して `@ref`/`@patch` が適用される。
- マージキー(`<<`)はサポート対象外とし、使用された場合 `HAFL-E304` とする。

### 4.4 検証タイミング

型変換(§4.1〜4.3)は `@ref`/`@override`/`@patch` の解決より**前**に行う。したがって循環参照検出・スキーマ検証は常にHIM上の値に対して行われる。

---

## 5. `readonly` の意味論

### 5.1 二つの意味を分離する

| モード | 意味 |
|---|---|
| `readonly: view` | 合成ビュー(resolve済みのメモリ上表現、あるいはIDE上のプレビュー)への書き戻しのみを禁止する。元ファイルはそもそも別ファイルなので影響なし |
| `readonly: emit` | 出力ファイル生成(`hafl build` 等によるファイル書き出し)自体を禁止する。ビューとしての参照・表示は許可 |
| `readonly: true` | 後方互換のためのエイリアス。`view` + `emit` の両方を意味する(= 最も厳しいモード) |
| `readonly: false` | デフォルト。両方とも許可 |

### 5.2 伝播規則

「許可のAND」という表現は直感に反しやすいため、**禁止フラグのOR**として再定義する(意味内容は同じで、表現のみの修正)。

各ノードについて次の2つの真偽値を定義する:

- `deny_view`: このノードの合成ビューへの書き戻しを禁止するか
- `deny_emit`: このノードの出力ファイル生成を禁止するか

`readonly` フィールドの指定値との対応:

| readonly値 | deny_view | deny_emit |
|---|---|---|
| (未指定, デフォルト = `false`) | false | false |
| `view` | true | false |
| `emit` | false | true |
| `true` | true | true |

`@ref` チェーン上のノード N について、最終的な `deny_view`/`deny_emit` は、N自身の指定値と、Nが辿る参照チェーン上の全ノードの値との**論理OR**で決まる:

```
N.deny_view = N.own_deny_view OR any(ref.deny_view for ref in N.ref_chain)
N.deny_emit = N.own_deny_emit OR any(ref.deny_emit for ref in N.ref_chain)
```

すなわち、チェーン中のどこか一箇所でも該当する禁止フラグが立っていれば、最終結果でもそのフラグは立つ。内側(参照先)の指定によって外側(参照元)の禁止を上書きして緩和することはできない。

- 参照元で明示的に `readonly` を指定した場合、それはOR式の一項として加わるのみで、参照先の制約を緩和する方向には作用しない。

---

## 6. エラーコード体系

### 6.1 命名空間

```
HAFL-E1xx  … 構文・パース系(path形式、ブロック構文など)
HAFL-E2xx  … 解決系(@ref/@override/@patch の解決失敗、循環参照)
HAFL-E3xx  … 型変換・HIM系
HAFL-E4xx  … スキーマ検証系
HAFL-W3xx  … warning(丸め発生など、処理は継続するが記録すべき事象)
```

### 6.2 主要コード一覧(抜粋)

| コード | 意味 | 重大度 |
|---|---|---|
| HAFL-E101 | `path` がJSON Pointer形式に違反 | error |
| HAFL-E102 | ブロック構文エラー(インデント不整合、`@ref`に`path`使用/`@override`に`ref`使用など) | error |
| HAFL-E103 | `@ref`の`ref`値がURI参照+フラグメント文法(§2.4)に違反 | error |
| HAFL-E201 | `@ref` 解決先が存在しない | error |
| HAFL-E202 | `@patch`(`@override`含む)の対象パスが存在しない | error |
| HAFL-E203 | 循環参照検出 | error |
| HAFL-E204 | `move`/`copy`オペレーションに`from`が欠如 | error |
| HAFL-E205 | `test`オペレーション失敗(値は解決できたが期待値と不一致) | error |
| HAFL-E206 | `@patch`操作オブジェクトに未定義の余分なメンバーが含まれる | error |
| HAFL-E301 | 整数が64bit符号付き範囲を超過 | error |
| HAFL-E302 | 型不一致(例: DateTime型フィールドへの非DateTime値の代入) | error |
| HAFL-E303 | 重複キー検出 | error |
| HAFL-E304 | YAMLマージキー使用(非対応構文) | error |
| HAFL-E401 | JSON Schema 2020-12 検証失敗 | error |
| HAFL-W301 | JSON/YAML由来のFloatリテラルがIEEE754 binary64精度を超え丸めが発生 | warning |

### 6.3 安定性契約

一度公開したエラーコードの**意味は変更しない**。仕様上の理由でコードの意味を変える必要が生じた場合は、新規コードを採番し旧コードは `deprecated` として維持する(削除・再利用はしない)。

---

## 7. スキーマ検証

### 7.1 対応方言

`schema` フィールドが指定する検証方言は **JSON Schema Draft 2020-12** に固定する。他方言(Draft-07等)は本バージョンでは非対応とし、指定された場合は `HAFL-E401` とする。

### 7.2 検証対象

スキーマ検証は **HIM変換後の内部モデルに対して**行う(§4.4)。YAMLアンカー展開前の構造やTOML固有の日時リテラルに対して直接検証が行われることはない。

### 7.3 `$ref` と `@ref` の混同回避

JSON Schema 2020-12 は `$ref` を予約語として使用する。HAFLの `@ref` とは名前空間上は衝突しないが、同一文書内で両者が混在すると読み手が混乱しやすいため、次を推奨する(強制ではない):

- `schema` ブロック内で `$ref` を使う場合、コメントで「これはJSON Schemaの`$ref`であり、HAFLの`@ref`とは無関係」と明記する。

### 7.4 HIM `DateTime` 型とスキーマ検証の整合(Option A採用)

HIMは`DateTime`という独自型を持つ(§4.1)一方、JSON Schemaは基本的にJSONインスタンス(≒ HIMの`String`/`Number`/`Boolean`/`Null`/`Array`/`Object`に相当する値)を検証する仕組みであり、`DateTime`という追加の型を直接検証することはできない。この不整合の解消として、次の2案を検討した。

- **案A**: スキーマ検証の直前に、HIMの`DateTime`値をISO 8601文字列に正規化してから検証する
- 案B: `DateTime`型を検証できるよう、HAFL独自のJSON Schema拡張語彙(vocabulary)を正式に定義する

**採用: 案A**。理由は次の通り:

- JSON Schema 2020-12の`format`語彙にはすでに`date-time`(RFC 3339準拠)が定義されており、正規化さえすれば標準の`{"type": "string", "format": "date-time"}`でそのまま検証できる。独自語彙を発明する必要がない。
- 独自語彙(案B)を採用すると、汎用のJSON Schemaバリデータ実装がそのまま使えなくなり(HAFL専用のバリデータ拡張が必要になる)、「既存標準にできるだけ乗る」というHAFL全体の設計方針(§2.4のRFC 6901流用などと同様)に反する。

この結果、スキーマ検証は常に「HIM上の`DateTime`値をISO 8601文字列へ正規化した後のJSON相当インスタンス」に対して行われる。`format: date-time` によるフォーマット検証(2020-12の`format`語彙はデフォルトでは注釈(annotation)としてのみ扱われ、アサーションとして機能させるには実装がvocabularyを有効にする必要がある点に注意)を使う場合は、その旨をスキーマ側で明示すること。

---

## 8. テストケース(最低20件、機能×正常異常マトリクス)

| # | 機能 | 種別 | 概要 |
|---|---|---|---|
| 1 | path | valid | 基本的なJSON Pointer解決 (`/a/b/0`) |
| 2 | path | invalid | ドット記法の使用 → HAFL-E101 |
| 3 | path | invalid | エスケープ規則違反(`~`の誤用) → HAFL-E101 |
| 4 | @ref | valid | 同一ファイル内参照 |
| 5 | @ref | valid | 他ファイル参照(`ref: "other.yaml#/a/b"`) |
| 5b | @ref | valid | フラグメント省略時に参照先ドキュメントルート全体を指す(`ref: "other.yaml"`) |
| 5c | @ref | invalid | `ref`値のURI参照/フラグメント文法違反 → HAFL-E103 |
| 5d | @ref | invalid | `@ref`に`path`フィールドを誤用、または`@override`に`ref`フィールドを誤用 → HAFL-E102 |
| 6 | @ref | invalid | 存在しないpathへの参照 → HAFL-E201 |
| 7 | @ref | invalid | 循環参照(A→B→A、`ref`のファイル参照を辿って検出) → HAFL-E203 |
| 8 | @override | valid | 単純な値の置換 |
| 9 | @override | invalid | 存在しないpathへのoverride → HAFL-E202 |
| 10 | @override | valid | @patchへの展開結果が意味的に一致することの確認 |
| 11 | @patch | valid | add/remove/replace/move/copy/test の全op種 |
| 11b | @patch | invalid | `move`/`copy`で`from`欠如 → HAFL-E204 |
| 11c | @patch | invalid | `test`失敗(値不一致) → HAFL-E205 |
| 11d | @patch | invalid | 操作オブジェクトに未定義メンバー → HAFL-E206 |
| 11e | @patch | valid | ブロック内の1操作が失敗した際、他の操作もロールバックされ状態が変化しないことの確認 |
| 12 | @patch | invalid | replace対象が存在しない → HAFL-E202 |
| 13 | HIM変換 | valid | TOML datetime → HIM DateTime → JSON文字列出力の往復 |
| 14 | HIM変換 | invalid | 64bit超過整数 → HAFL-E301 |
| 15 | HIM変換 | invalid | 重複キー(YAML) → HAFL-E303 |
| 16 | HIM変換 | invalid | YAMLマージキー使用 → HAFL-E304 |
| 17 | HIM変換 | valid | YAMLアンカー/エイリアスの展開が正しく行われる |
| 18 | readonly | valid | ネスト参照でのOR伝播(内側の`deny_emit`が外側の最終結果に反映される) |
| 19 | readonly | valid | `view`のみ指定時、ビルド(emit)は許可される |
| 20 | schema | valid | JSON Schema 2020-12 での検証成功 |
| 21 | schema | invalid | Draft-07指定 → HAFL-E401 |
| 22 | schema | invalid | HIM変換後の値がスキーマ違反 → HAFL-E401 |

---

## 9. 未解決事項(v0.6以降の課題として明記)

- パフォーマンス特性(大規模ファイルでの解決コスト)は本仕様の対象外。
- `@ref` の解決順序が複数ファイルにまたがる場合の並列解決の可否は未検討。
- エラーコードの多言語メッセージ化はスコープ外。

---

## 10. v0.4からの移行ガイド

- v0.4で書かれたドット記法の `path` は自動変換されない。移行スクリプト(別途提供予定)でJSON Pointer形式に変換する必要がある。
- v0.4時点で `readonly: true` だった指定は、v0.5では `readonly: true`(= view + emit両方禁止)としてそのまま解釈される。意味論の縮小はない。
- v0.4でYAMLマージキーを使用していた文書は、v0.5パーサーでは `HAFL-E304` となるため、マージキー展開済みの形に手動で書き換える必要がある。
