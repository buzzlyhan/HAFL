"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzeDocument, buildSectionLabel } = require("../src/document-structure");

test("document structure collects sections, keys and blocks", () => {
  const source = [
    "@project",
    "name: HAFL",
    "status: draft",
    "",
    "@code",
    "language: js",
    "@begin",
    "console.log('ok')",
    "@end"
  ].join("\n");

  const { sections } = analyzeDocument(source);

  assert.equal(sections.length, 2);
  assert.equal(buildSectionLabel(sections[0]), "@project HAFL");
  assert.equal(sections[0].detail, "status: draft");
  assert.deepEqual(
    sections[0].keys.map((key) => key.name),
    ["name", "status"]
  );
  assert.equal(sections[1].blocks.length, 1);
  assert.deepEqual(sections[1].blocks[0], {
    startLine: 6,
    endLine: 8,
    unterminated: false
  });
});

test("block content does not create nested sections", () => {
  const source = [
    "@code",
    "@begin",
    "@project",
    "name: not-a-section",
    "@end",
    "@note",
    "title: tail"
  ].join("\n");

  const { sections } = analyzeDocument(source);

  assert.equal(sections.length, 2);
  assert.equal(sections[0].name, "code");
  assert.equal(sections[1].name, "note");
  assert.equal(buildSectionLabel(sections[1]), "@note tail");
});
