# Vestoro Architecture

## Overview

Vestoro is an offline-first wealth management application built with:

- React
- TypeScript
- Vite

The application is organized into clear architectural layers.

---

# High Level Structure

```
UI

↓

Views

↓

Business Logic

↓

Database

↓

Persistence
```

---

# Folder Structure

## src/app

Application bootstrap.

Contains:

- App
- Setup Wizard
- Error Boundary

Responsible for application initialization.

---

## src/views

Top-level screens.

Examples:

- Dashboard
- Accounts
- Transactions
- Settings
- Import

Views should orchestrate components.

Views should not contain business logic.

---

## src/components

Reusable UI components.

Components should remain generic whenever possible.

Business logic should never live here.

---

## src/lib

Core business logic.

Examples:

- calculations
- analytics
- money
- transfers
- rules
- backup
- import helpers

This folder represents the heart of the application.

Always extend existing modules before creating new ones.

---

## src/db

Persistence layer.

Contains:

- schema
- repositories

Database access should stay isolated here.

---

## tests

Unit and regression tests.

Every significant feature should include tests.

Bug fixes should include regression tests whenever practical.

---

## docs

Planning and product documentation.

Important files:

- TOP-20-TASKS.md
- PLAN.md
- BACKLOG.md
- DECISIONS.md
- SPEC-ALPHA.md

AI agents should use these documents as product context.

---

# Design Principles

## Separation of Concerns

UI

↓

Business Logic

↓

Persistence

Never mix these responsibilities.

---

## Reuse

Before creating:

- utility
- service
- hook
- component

always search for an existing implementation.

---

## Simplicity

Prefer:

small modules

small functions

clear names

explicit logic

---

## Naming

Functions should describe actions.

Variables should describe data.

Avoid abbreviations.

---

# Feature Development Workflow

When implementing a feature:

1. Read the related view.
2. Locate the business logic.
3. Extend existing modules.
4. Add tests.
5. Run validation.
6. Update documentation if architecture changes.

---

# Quality Checklist

Every completed feature should:

- compile
- pass tests
- avoid duplicated logic
- follow existing architecture
- keep performance acceptable

---

# Performance Goals

- fast startup
- minimal rerenders
- lazy loading where useful
- avoid unnecessary allocations
- avoid repeated calculations

---

# Long-Term Vision

Vestoro should evolve into a robust offline-first investment platform.

Maintainability is more important than rapid feature delivery.

Architectural consistency should always take precedence over short-term convenience.