"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { validateText } = require("../src/validator");

test("duplicate keys, orphan list and missing end are reported", () => {
  const source = [
    "- orphan list",
    "@project",
    "name: HAFL",
    "name: Duplicate",
    "",
    "@code",
    "@begin",
    "console.log('x')"
  ].join("\n");

  const issues = validateText(source);
  const codes = issues.map((issue) => issue.code);

  assert.ok(codes.includes("duplicate-key"));
  assert.ok(codes.includes("content-outside-section"));
  assert.ok(codes.includes("missing-end"));
});

test("@begins and invalid section names are rejected", () => {
  const source = [
    "@project",
    "name: HAFL",
    "@begins",
    "@bad section"
  ].join("\n");

  const issues = validateText(source);
  const codes = issues.map((issue) => issue.code);

  assert.ok(codes.includes("invalid-begins"));
  assert.ok(codes.includes("invalid-section"));
});

test("warnings are emitted for non-standard sections and ambiguous keys", () => {
  const source = [
    "@custom",
    "tmp: value",
    "purpose: validate",
    "goal: strict parsing"
  ].join("\n");

  const issues = validateText(source);
  const warnings = issues.filter((issue) => issue.severity === "warning");
  const codes = warnings.map((issue) => issue.code);

  assert.ok(codes.includes("non-standard-section"));
  assert.ok(codes.includes("ambiguous-key"));
  assert.ok(codes.includes("mixed-synonyms"));
});
