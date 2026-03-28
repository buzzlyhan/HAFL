"use strict";

function analyzeDocument(text) {
  const lines = splitLines(text);
  const sections = [];
  let currentSection = null;
  let openBlock = null;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    const trimmed = rawLine.trim();

    if (openBlock) {
      if (trimmed === "@end") {
        openBlock.endLine = lineIndex;
        currentSection.blocks.push(openBlock);
        openBlock = null;
      }
      continue;
    }

    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    if (trimmed === "@begin") {
      if (currentSection) {
        openBlock = {
          startLine: lineIndex,
          endLine: lineIndex,
          unterminated: false
        };
      }
      continue;
    }

    const sectionMatch = /^@([A-Za-z][A-Za-z0-9_-]*)$/.exec(trimmed);
    if (sectionMatch) {
      currentSection = {
        name: sectionMatch[1],
        line: lineIndex,
        endLine: lineIndex,
        keys: [],
        blocks: [],
        meta: Object.create(null),
        summary: "",
        detail: ""
      };
      sections.push(currentSection);
      continue;
    }

    if (!currentSection) {
      continue;
    }

    const propertyMatch = /^(\s*)([A-Za-z][A-Za-z0-9_-]*)(\s*:)(\s*)(.*)$/.exec(rawLine);
    if (!propertyMatch) {
      continue;
    }

    const keyName = propertyMatch[2];
    const value = propertyMatch[5].trim();
    const keyStartChar = propertyMatch[1].length;
    const valueStartChar =
      keyStartChar + propertyMatch[2].length + propertyMatch[3].length + propertyMatch[4].length;

    currentSection.keys.push({
      name: keyName,
      value,
      line: lineIndex,
      keyStartChar,
      valueStartChar
    });

    if (!(keyName in currentSection.meta) && value !== "") {
      currentSection.meta[keyName] = value;
    }
  }

  if (openBlock && currentSection) {
    currentSection.blocks.push({
      startLine: openBlock.startLine,
      endLine: Math.max(openBlock.startLine, lines.length - 1),
      unterminated: true
    });
  }

  for (const [index, section] of sections.entries()) {
    const nextSection = sections[index + 1];
    const endLine = nextSection ? nextSection.line - 1 : lines.length - 1;

    section.endLine = trimTrailingBlankLines(lines, Math.max(section.line, endLine), section.line);
    section.summary = buildSectionSummary(section);
    section.detail = buildSectionDetail(section);
  }

  return { lines, sections };
}

function buildSectionLabel(section) {
  return section.summary ? `@${section.name} ${section.summary}` : `@${section.name}`;
}

function buildSectionSummary(section) {
  return firstNonEmpty([
    section.meta.title,
    section.meta.name,
    section.meta.target,
    section.meta.id,
    section.meta.purpose
  ]);
}

function buildSectionDetail(section) {
  const details = [];

  if (section.meta.status) {
    details.push(`status: ${section.meta.status}`);
  }

  if (section.meta.type) {
    details.push(`type: ${section.meta.type}`);
  }

  return details.join(" | ");
}

function trimTrailingBlankLines(lines, endLine, minLine) {
  let adjusted = endLine;

  while (adjusted > minLine && lines[adjusted].trim() === "") {
    adjusted -= 1;
  }

  return adjusted;
}

function firstNonEmpty(values) {
  for (const value of values) {
    if (value) {
      return value;
    }
  }

  return "";
}

function splitLines(text) {
  return text.split(/\r?\n/);
}

module.exports = {
  analyzeDocument,
  buildSectionLabel
};
