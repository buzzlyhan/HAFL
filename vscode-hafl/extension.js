"use strict";

const vscode = require("vscode");
const {
  BOOLEAN_VALUES,
  SECTION_DETAILS,
  SECTION_KEYS,
  SECTION_NAMES,
  getDocumentContext,
  getKeySuggestions,
  validateText
} = require("./src/validator");
const { analyzeDocument, buildSectionLabel } = require("./src/document-structure");

function activate(context) {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection("hafl");
  context.subscriptions.push(diagnosticCollection);
  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      { language: "hafl" },
      {
        provideDocumentSemanticTokens(document) {
          return provideSemanticTokens(document);
        }
      },
      semanticLegend
    ),
    vscode.languages.registerDocumentSymbolProvider({ language: "hafl" }, {
      provideDocumentSymbols(document) {
        return provideDocumentSymbols(document);
      }
    }),
    vscode.languages.registerFoldingRangeProvider({ language: "hafl" }, {
      provideFoldingRanges(document) {
        return provideFoldingRanges(document);
      }
    }),
    vscode.commands.registerCommand("hafl.goToSection", () => goToSection())
  );

  const refreshDiagnostics = (document) => {
    if (document.languageId !== "hafl") {
      return;
    }

    const issues = validateText(document.getText());
    const diagnostics = issues.map((issue) => toDiagnostic(issue));
    diagnosticCollection.set(document.uri, diagnostics);
  };

  if (vscode.window.activeTextEditor) {
    refreshDiagnostics(vscode.window.activeTextEditor.document);
  }

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(refreshDiagnostics),
    vscode.workspace.onDidChangeTextDocument((event) => refreshDiagnostics(event.document)),
    vscode.workspace.onDidSaveTextDocument(refreshDiagnostics),
    vscode.workspace.onDidCloseTextDocument((document) => {
      if (document.languageId === "hafl") {
        diagnosticCollection.delete(document.uri);
      }
    })
  );

  const completionProvider = vscode.languages.registerCompletionItemProvider(
    { language: "hafl" },
    {
      provideCompletionItems(document, position) {
        return provideCompletionItems(document, position);
      }
    },
    "@",
    ":"
  );

  context.subscriptions.push(completionProvider);
}

function deactivate() {}

const TOKEN_TYPES = [
  "type",
  "property",
  "keyword",
  "string",
  "number",
  "operator",
  "comment"
];
const semanticLegend = new vscode.SemanticTokensLegend(TOKEN_TYPES);

function toDiagnostic(issue) {
  const range = new vscode.Range(
    new vscode.Position(issue.line, issue.startChar),
    new vscode.Position(issue.line, Math.max(issue.endChar, issue.startChar + 1))
  );
  const severity =
    issue.severity === "warning"
      ? vscode.DiagnosticSeverity.Warning
      : vscode.DiagnosticSeverity.Error;
  const diagnostic = new vscode.Diagnostic(range, issue.message, severity);

  diagnostic.code = issue.code;
  diagnostic.source = "HAFL";
  return diagnostic;
}

function provideSemanticTokens(document) {
  const builder = new vscode.SemanticTokensBuilder(semanticLegend);
  const lines = document.getText().split(/\r?\n/);
  let inBlock = false;

  for (const [lineIndex, line] of lines.entries()) {
    const trimmed = line.trim();

    if (trimmed === "") {
      continue;
    }

    if (inBlock) {
      const endMatch = /^\s*(@end)\s*$/.exec(line);
      if (endMatch) {
        builder.push(lineIndex, line.indexOf("@end"), "@end".length, tokenTypeIndex("keyword"), 0);
        inBlock = false;
        continue;
      }

      const contentStart = line.search(/\S/);
      if (contentStart >= 0) {
        builder.push(
          lineIndex,
          contentStart,
          line.length - contentStart,
          tokenTypeIndex("string"),
          0
        );
      }
      continue;
    }

    const commentMatch = /^\s*#.*$/.exec(line);
    if (commentMatch) {
      const startChar = line.indexOf("#");
      builder.push(lineIndex, startChar, line.length - startChar, tokenTypeIndex("comment"), 0);
      continue;
    }

    const invalidBlockMatch = /^\s*(@begins)\b/.exec(line);
    if (invalidBlockMatch) {
      builder.push(lineIndex, line.indexOf("@begins"), "@begins".length, tokenTypeIndex("keyword"), 0);
      continue;
    }

    const beginMatch = /^\s*(@begin)\s*$/.exec(line);
    if (beginMatch) {
      builder.push(lineIndex, line.indexOf("@begin"), "@begin".length, tokenTypeIndex("keyword"), 0);
      inBlock = true;
      continue;
    }

    const sectionMatch = /^\s*(@)([A-Za-z][A-Za-z0-9_-]*)\s*$/.exec(line);
    if (sectionMatch) {
      builder.push(lineIndex, line.indexOf("@"), 1, tokenTypeIndex("keyword"), 0);
      builder.push(
        lineIndex,
        line.indexOf(sectionMatch[2]),
        sectionMatch[2].length,
        tokenTypeIndex("type"),
        0
      );
      continue;
    }

    const propertyMatch = /^(\s*)([A-Za-z][A-Za-z0-9_-]*)(\s*:)(\s*)(.*)$/.exec(line);
    if (propertyMatch) {
      const keyStart = propertyMatch[1].length;
      const separatorStart = keyStart + propertyMatch[2].length;
      const valueStart = separatorStart + propertyMatch[3].length + propertyMatch[4].length;
      const value = propertyMatch[5];

      builder.push(lineIndex, keyStart, propertyMatch[2].length, tokenTypeIndex("property"), 0);
      builder.push(lineIndex, separatorStart, propertyMatch[3].length, tokenTypeIndex("operator"), 0);

      if (value.length > 0) {
        const valueType = getValueTokenType(value);
        builder.push(lineIndex, valueStart, value.length, tokenTypeIndex(valueType), 0);
      }
      continue;
    }

    const listMatch = /^(\s*)(-)(\s+)(.+)$/.exec(line);
    if (listMatch) {
      builder.push(lineIndex, listMatch[1].length, 1, tokenTypeIndex("operator"), 0);
      builder.push(
        lineIndex,
        listMatch[1].length + 1 + listMatch[3].length,
        listMatch[4].length,
        tokenTypeIndex("string"),
        0
      );
    }
  }

  return builder.build();
}

function provideCompletionItems(document, position) {
  const line = document.lineAt(position.line).text;
  const prefix = line.slice(0, position.character);
  const trimmedPrefix = prefix.trimStart();
  const context = getDocumentContext(document.getText(), position.line);

  if (context.inBlock) {
    return [];
  }

  if (/^\s*$/.test(prefix)) {
    if (context.currentSection) {
      return [
        ...buildKeyItems(document, position, context.currentSection),
        ...buildSectionItems(document, position, context.currentSection)
      ];
    }
    return buildSectionItems(document, position, context.currentSection);
  }

  if (/^\s*@[\w-]*$/.test(prefix)) {
    return buildSectionItems(document, position, context.currentSection);
  }

  if (/:\s*[\w-]*$/.test(prefix)) {
    return buildValueItems(document, position);
  }

  if (trimmedPrefix.startsWith("-") || trimmedPrefix.startsWith("#")) {
    return [];
  }

  if (/^\s*[A-Za-z0-9_-]*$/.test(prefix) && context.currentSection) {
    return buildKeyItems(document, position, context.currentSection);
  }

  return [];
}

function buildSectionItems(document, position, currentSection) {
  const range = getIndentRange(document, position);
  const items = SECTION_NAMES.map((sectionName, index) => {
    const item = new vscode.CompletionItem(`@${sectionName}`, vscode.CompletionItemKind.Module);
    const templateKeys = SECTION_KEYS[sectionName] || [];

    item.detail = SECTION_DETAILS[sectionName] || "標準セクション";
    item.documentation = new vscode.MarkdownString(
      templateKeys.length > 0
        ? `推奨キー: \`${templateKeys.join("`, `")}\``
        : "標準セクション"
    );
    item.insertText = new vscode.SnippetString(buildSectionSnippet(sectionName, templateKeys));
    item.range = range;
    item.sortText = `${String(index).padStart(2, "0")}-${sectionName}`;
    return item;
  });

  if (currentSection) {
    const blockItem = new vscode.CompletionItem("@begin ... @end", vscode.CompletionItemKind.Snippet);
    blockItem.detail = "複数行ブロック";
    blockItem.insertText = new vscode.SnippetString("@begin\n$1\n@end");
    blockItem.range = range;
    blockItem.sortText = "00-@begin";
    items.unshift(blockItem);
  }

  return items;
}

function buildKeyItems(document, position, currentSection) {
  const range = getIndentRange(document, position);
  return getKeySuggestions(currentSection).map((keyName, index) => {
    const item = new vscode.CompletionItem(keyName, vscode.CompletionItemKind.Field);

    item.detail = currentSection ? `@${currentSection} の候補キー` : "推奨キー";
    item.insertText = new vscode.SnippetString(`${keyName}: $1`);
    item.range = range;
    item.sortText = `${String(index).padStart(2, "0")}-${keyName}`;
    return item;
  });
}

function buildValueItems(document, position) {
  const line = document.lineAt(position.line).text;
  const valueStart = line.lastIndexOf(":") + 1;
  const leadingSpaces = line.slice(valueStart).match(/^\s*/);
  const startChar = valueStart + (leadingSpaces ? leadingSpaces[0].length : 0);
  const range = new vscode.Range(position.line, startChar, position.line, position.character);

  return BOOLEAN_VALUES.map((value, index) => {
    const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.Keyword);

    item.detail = "予約値";
    item.insertText = value;
    item.range = range;
    item.sortText = `${String(index).padStart(2, "0")}-${value}`;
    return item;
  });
}

function getIndentRange(document, position) {
  const line = document.lineAt(position.line).text;
  const indentLength = (line.match(/^\s*/) || [""])[0].length;
  return new vscode.Range(position.line, indentLength, position.line, position.character);
}

function getValueTokenType(value) {
  if (/^(true|false|null)$/.test(value)) {
    return "keyword";
  }

  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return "number";
  }

  return "string";
}

function tokenTypeIndex(tokenType) {
  return TOKEN_TYPES.indexOf(tokenType);
}

function buildSectionSnippet(sectionName, templateKeys) {
  if (templateKeys.length === 0) {
    return `@${sectionName}`;
  }

  const lines = [`@${sectionName}`];
  for (const [index, keyName] of templateKeys.entries()) {
    lines.push(`${keyName}: $${index + 1}`);
  }
  return lines.join("\n");
}

function provideDocumentSymbols(document) {
  const { sections } = analyzeDocument(document.getText());

  return sections.map((section) => {
    const endLineLength = document.lineAt(section.endLine).text.length;
    const sectionRange = new vscode.Range(section.line, 0, section.endLine, endLineLength);
    const selectionRange = new vscode.Range(
      section.line,
      0,
      section.line,
      document.lineAt(section.line).text.length
    );
    const symbol = new vscode.DocumentSymbol(
      buildSectionLabel(section),
      section.detail,
      vscode.SymbolKind.Module,
      sectionRange,
      selectionRange
    );

    symbol.children = section.keys.map((key) => {
      const lineText = document.lineAt(key.line).text;
      const keyEndChar = key.keyStartChar + key.name.length;
      const keyRange = new vscode.Range(key.line, key.keyStartChar, key.line, lineText.length);
      const keySelectionRange = new vscode.Range(key.line, key.keyStartChar, key.line, keyEndChar);

      return new vscode.DocumentSymbol(
        key.name,
        key.value,
        vscode.SymbolKind.Field,
        keyRange,
        keySelectionRange
      );
    });

    return symbol;
  });
}

function provideFoldingRanges(document) {
  const { sections } = analyzeDocument(document.getText());
  const ranges = [];

  for (const section of sections) {
    if (section.endLine > section.line) {
      ranges.push(
        new vscode.FoldingRange(section.line, section.endLine, vscode.FoldingRangeKind.Region)
      );
    }

    for (const block of section.blocks) {
      if (block.endLine > block.startLine) {
        ranges.push(
          new vscode.FoldingRange(block.startLine, block.endLine, vscode.FoldingRangeKind.Region)
        );
      }
    }
  }

  return ranges;
}

async function goToSection() {
  const editor = vscode.window.activeTextEditor;

  if (!editor || editor.document.languageId !== "hafl") {
    vscode.window.showInformationMessage("HAFL ファイルを開いてから使ってください");
    return;
  }

  const { sections } = analyzeDocument(editor.document.getText());
  if (sections.length === 0) {
    vscode.window.showInformationMessage("移動できるセクションがありません");
    return;
  }

  const picked = await vscode.window.showQuickPick(
    sections.map((section) => ({
      label: buildSectionLabel(section),
      description: section.detail || `line ${section.line + 1}`,
      detail: `line ${section.line + 1}`,
      line: section.line
    })),
    {
      matchOnDescription: true,
      matchOnDetail: true,
      placeHolder: "移動先のセクションを選択"
    }
  );

  if (!picked) {
    return;
  }

  const position = new vscode.Position(picked.line, 0);
  editor.selection = new vscode.Selection(position, position);
  editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
}

module.exports = {
  activate,
  deactivate
};
