# HAFL

HAFL stands for **Human and AI Friendly Language**.  
This repository contains the initial **HAFL Strict v0.3** release, focused on stable interpretation, validation, and structured updates by both humans and AI systems.

## Overview

HAFL Strict v0.3 keeps HAFL readable while tightening the format for more reliable machine processing.

- Reduce variation in section names and keys
- Preserve ordering for repeated sections
- Improve diff-friendly structure
- Support safe embedding of long text and code
- Make future parser and validator implementation easier

## Included Files

- `HAFL_Strict_v0_3_spec.md`: Japanese specification document
- `HAFL_Strict_v0_3.hafl`: HAFL version of the specification content
- `HAFL_Strict_v0_3_ja.hafl`: Japanese HAFL version

## Basic Structure

HAFL Strict v0.3 is organized around `@section` blocks.

- Section start: `@project`, `@task`, `@note`, and others
- Key-value line: `name: HAFL`
- List item: `- keep one meaning per line`
- Block content: `@begin` to `@end`

Repeated sections with the same name are treated as **ordered arrays**, not overwrite targets.

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

## Core Strict Rules

- Keep one meaning per line
- Do not duplicate keys inside a single section
- Always close `@begin` with `@end`
- Do not nest `@begin` blocks
- Treat `@begins` as invalid
- Prefer the standard section vocabulary

## Status

This repository currently holds the **initial v0.3 release**.  
Planned future areas include formal `ref` rules, section IDs, type hints, import/include support, and JSON/YAML conversion rules.
