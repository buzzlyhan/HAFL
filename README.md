# HAFL

HAFL stands for **Human and AI Friendly Language**.  
This repository contains **HAFL Strict v0.3** and the next extension draft **v0.4**.

- v0.3: stable interpretation, validation, and structured updates
- v0.4: external structured data orchestration via `@ref`, `@override`, and `@patch`

## Overview

HAFL Strict v0.3 keeps HAFL readable while tightening the format for more reliable machine processing.

- Reduce variation in section names and keys
- Preserve ordering for repeated sections
- Improve diff-friendly structure
- Support safe embedding of long text and code
- Make future parser and validator implementation easier

## Included Files

- `HAFL_Strict_v0_3_spec.md`: Japanese specification document for v0.3
- `HAFL_Strict_v0_4_spec.md`: Japanese specification document for v0.4
- `HAFL_Strict_v0_3.hafl`: HAFL version of the specification content
- `HAFL_Strict_v0_3_ja.hafl`: Japanese HAFL version
- `vscode-hafl/`: minimal VS Code extension for validation and suggestions

## Basic Structure

HAFL Strict v0.3 is organized around `@section` blocks.

- Section start: `@project`, `@task`, `@note`, and others
- Key-value line: `name: HAFL`
- List item: `- keep one meaning per line`
- Block content: `@begin` to `@end`

Repeated sections with the same name are treated as **ordered arrays**, not overwrite targets.

## Mental Model

A practical way to think about HAFL is:

**lightweight section tags with flexible key/value fields**

It is similar to a document made of simple tags, but with fewer reserved words and no closing tag for each section. A section continues until the next `@section` appears.

## Short Example

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

## Example: One Blog Post

The following example shows how one blog article can be written in HAFL.

```hafl
@article
id: blog-001
title: Why HAFL Works Well for Humans and AI
author: Leo
status: published
published_at: 2026-03-28

@summary
@begin
HAFL can be treated like a document made of lightweight tags.
Each section gives a role, and each key adds structured fields.
@end

@body
@begin
When I write in HAFL, I do not think in nested JSON first.
I think in sections.

That keeps the text readable in a plain editor while still giving AI
stable boundaries for extraction and updates.
@end

@tag
name: hafl

@tag
name: documentation
```

This sample uses extension sections such as `@article`, `@summary`, `@body`, and `@tag`.
In stricter operational workflows, the standard section vocabulary is still preferred when it fits.

## Core Strict Rules

- Keep one meaning per line
- Do not duplicate keys inside a single section
- Always close `@begin` with `@end`
- Do not nest `@begin` blocks
- Treat `@begins` as invalid
- Prefer the standard section vocabulary

## Status

This repository currently provides **v0.3** and includes the **v0.4 specification draft**.  
v0.4 introduces official external references and local override layering while keeping completion behavior in LSP/editor tooling.
