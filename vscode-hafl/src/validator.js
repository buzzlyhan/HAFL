"use strict";

const STANDARD_SECTIONS = Object.freeze([
  "meta",
  "project",
  "task",
  "goal",
  "rules",
  "step",
  "memory",
  "avoid",
  "code",
  "data",
  "layout",
  "note",
  "schema"
]);

const SECTION_KEYS = Object.freeze({
  meta: ["name", "version", "status"],
  project: ["name", "type", "version", "status"],
  task: ["id", "name", "status", "purpose"],
  goal: ["target", "tone", "description"],
  rules: ["name", "description"],
  step: ["name", "command", "status", "ref"],
  memory: ["name", "description", "ref"],
  avoid: ["name", "description"],
  code: ["language", "purpose", "content_type"],
  data: ["name", "type", "description"],
  layout: ["name", "type", "description"],
  note: ["title", "description"],
  schema: ["name", "description", "version"]
});

const SECTION_DETAILS = Object.freeze({
  meta: "文書メタ情報",
  project: "プロジェクト定義",
  task: "タスク定義",
  goal: "目的や到達点",
  rules: "ルール一覧",
  step: "手順やコマンド",
  memory: "継続記憶",
  avoid: "避ける事項",
  code: "コードや複数行内容",
  data: "データ定義",
  layout: "レイアウト定義",
  note: "自由メモ",
  schema: "構造や仕様定義"
});

const COMMON_KEYS = Object.freeze([
  "name",
  "id",
  "type",
  "title",
  "version",
  "target",
  "tone",
  "purpose",
  "status",
  "command",
  "language",
  "content_type",
  "description",
  "ref"
]);

const BOOLEAN_VALUES = Object.freeze(["true", "false", "null"]);
const AMBIGUOUS_NAMES = new Set(["misc", "tmp", "temp", "final", "final2"]);
const AMBIGUOUS_KEYS = new Set(["tmp", "temp", "value1", "data1"]);
const SYNONYM_GROUPS = [["goal", "purpose", "objective"]];
const LONG_LIST_ITEM_LENGTH = 100;

function validateText(text) {
  const lines = splitLines(text);
  const issues = [];
  let currentSection = null;
  let openBlock = null;
  const synonymUsage = new Map();

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    const trimmed = rawLine.trim();

    if (openBlock) {
      if (trimmed === "@begin") {
        issues.push(
          createIssue(
            lineIndex,
            rawLine.indexOf("@begin"),
            rawLine.indexOf("@begin") + "@begin".length,
            "error",
            "nested-block",
            "@begin ブロックのネストは禁止です"
          )
        );
        continue;
      }

      if (trimmed === "@end") {
        openBlock = null;
      }
      continue;
    }

    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    if (/^@begins\b/.test(trimmed)) {
      issues.push(
        createLineIssue(rawLine, lineIndex, "error", "invalid-begins", "@begins は無効です。@begin を使ってください")
      );
      currentSection = null;
      continue;
    }

    if (trimmed === "@end") {
      issues.push(
        createLineIssue(rawLine, lineIndex, "error", "orphan-end", "@end が単独で出現しています")
      );
      continue;
    }

    if (trimmed === "@begin") {
      if (!currentSection) {
        issues.push(
          createLineIssue(rawLine, lineIndex, "error", "orphan-begin", "セクション外で @begin は使えません")
        );
        continue;
      }
      openBlock = { line: lineIndex };
      continue;
    }

    if (trimmed.startsWith("@")) {
      currentSection = parseSectionLine(rawLine, lineIndex, issues);
      continue;
    }

    if (!currentSection) {
      issues.push(
        createLineIssue(
          rawLine,
          lineIndex,
          "error",
          "content-outside-section",
          "セクション外に内容があります"
        )
      );
      continue;
    }

    if (trimmed.startsWith("-")) {
      if (trimmed.length > LONG_LIST_ITEM_LENGTH) {
        issues.push(
          createLineIssue(
            rawLine,
            lineIndex,
            "warning",
            "long-list-item",
            "リスト項目が長すぎます。長文は @begin と @end のブロックを検討してください"
          )
        );
      }
      continue;
    }

    const colonIndex = rawLine.indexOf(":");
    if (colonIndex >= 0) {
      const keyRangeEnd = rawLine.slice(0, colonIndex).length;
      const keyName = rawLine.slice(0, colonIndex).trim();

      if (keyName.length === 0) {
        issues.push(
          createIssue(
            lineIndex,
            0,
            Math.max(colonIndex + 1, 1),
            "error",
            "empty-key",
            "キー名が空です"
          )
        );
        continue;
      }

      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(keyName)) {
        issues.push(
          createIssue(
            lineIndex,
            0,
            keyRangeEnd,
            "error",
            "invalid-key",
            "キー名は英字開始で、英数字、_、- のみ使えます"
          )
        );
        continue;
      }

      if (currentSection.keys.has(keyName)) {
        issues.push(
          createIssue(
            lineIndex,
            0,
            keyRangeEnd,
            "error",
            "duplicate-key",
            `同じセクション内でキー "${keyName}" が重複しています`
          )
        );
      } else {
        currentSection.keys.add(keyName);
      }

      if (AMBIGUOUS_KEYS.has(keyName)) {
        issues.push(
          createIssue(
            lineIndex,
            0,
            keyRangeEnd,
            "warning",
            "ambiguous-key",
            `曖昧なキー "${keyName}" は避けてください`
          )
        );
      }

      recordSynonymUsage(synonymUsage, keyName, lineIndex, keyRangeEnd, issues);
      continue;
    }

    issues.push(
      createLineIssue(
        rawLine,
        lineIndex,
        "error",
        "unexpected-content",
        "セクション内では key: value、リスト、コメント、ブロックのみ使えます"
      )
    );
  }

  if (openBlock) {
    issues.push(
      createIssue(
        openBlock.line,
        0,
        "@begin".length,
        "error",
        "missing-end",
        "@begin に対応する @end がありません"
      )
    );
  }

  return issues;
}

function getDocumentContext(text, targetLine) {
  const lines = splitLines(text);
  let currentSection = null;
  let inBlock = false;

  for (let lineIndex = 0; lineIndex < Math.min(targetLine, lines.length); lineIndex += 1) {
    const trimmed = lines[lineIndex].trim();

    if (inBlock) {
      if (trimmed === "@end") {
        inBlock = false;
      }
      continue;
    }

    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    if (trimmed === "@begin") {
      inBlock = true;
      continue;
    }

    if (trimmed.startsWith("@")) {
      const match = /^@([A-Za-z][A-Za-z0-9_-]*)$/.exec(trimmed);
      currentSection = match ? match[1] : null;
      continue;
    }
  }

  return { currentSection, inBlock };
}

function getKeySuggestions(sectionName) {
  const preferredKeys = SECTION_KEYS[sectionName] || [];
  return [...new Set([...preferredKeys, ...COMMON_KEYS])];
}

function parseSectionLine(rawLine, lineIndex, issues) {
  const trimmed = rawLine.trim();
  const validMatch = /^@([A-Za-z][A-Za-z0-9_-]*)$/.exec(trimmed);

  if (!validMatch) {
    let message = "無効なセクション宣言です";
    if (/\s/.test(trimmed.slice(1))) {
      message = "セクション名に空白は使えません";
    } else if (!/^[A-Za-z]/.test(trimmed.slice(1))) {
      message = "セクション名は英字で始めてください";
    }

    issues.push(createLineIssue(rawLine, lineIndex, "error", "invalid-section", message));
    return null;
  }

  const sectionName = validMatch[1];
  const startChar = rawLine.indexOf(`@${sectionName}`);
  const endChar = startChar + sectionName.length + 1;

  if (!STANDARD_SECTIONS.includes(sectionName)) {
    issues.push(
      createIssue(
        lineIndex,
        startChar,
        endChar,
        "warning",
        "non-standard-section",
        `標準外セクション "@${sectionName}" です`
      )
    );
  }

  if (AMBIGUOUS_NAMES.has(sectionName)) {
    issues.push(
      createIssue(
        lineIndex,
        startChar,
        endChar,
        "warning",
        "ambiguous-section",
        `曖昧なセクション名 "@${sectionName}" は避けてください`
      )
    );
  }

  return {
    name: sectionName,
    keys: new Set()
  };
}

function recordSynonymUsage(synonymUsage, keyName, lineIndex, keyRangeEnd, issues) {
  for (const synonymGroup of SYNONYM_GROUPS) {
    if (!synonymGroup.includes(keyName)) {
      continue;
    }

    const usage = synonymUsage.get(synonymGroup.join("|"));
    if (!usage) {
      synonymUsage.set(synonymGroup.join("|"), { key: keyName });
      return;
    }

    if (usage.key !== keyName) {
      issues.push(
        createIssue(
          lineIndex,
          0,
          keyRangeEnd,
          "warning",
          "mixed-synonyms",
          `同義キーの混在を避けてください: ${usage.key}, ${keyName}`
        )
      );
    }
  }
}

function splitLines(text) {
  return text.split(/\r?\n/);
}

function createLineIssue(rawLine, line, severity, code, message) {
  return createIssue(line, 0, Math.max(rawLine.length, 1), severity, code, message);
}

function createIssue(line, startChar, endChar, severity, code, message) {
  return {
    line,
    startChar,
    endChar,
    severity,
    code,
    message
  };
}

module.exports = {
  BOOLEAN_VALUES,
  COMMON_KEYS,
  SECTION_DETAILS,
  SECTION_KEYS,
  SECTION_NAMES: STANDARD_SECTIONS,
  getDocumentContext,
  getKeySuggestions,
  validateText
};
