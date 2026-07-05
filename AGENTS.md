# AGENTS.md

# Vestoro AI Development Guide

This document defines the permanent engineering rules for AI coding agents working on Vestoro.

---

# Mission

Vestoro is an offline-first personal finance application focused on:

- portfolio tracking
- dividend investing
- wealth visualization
- privacy
- long-term maintainability
- performance

The goal is not to ship features as quickly as possible.

The goal is to produce clean, maintainable code that could realistically be maintained for many years.

Always prefer readability over clever implementations.

---

# Working Process

For every task:

1. Understand the existing implementation.
2. Reuse existing code whenever possible.
3. Avoid duplicate logic.
4. Implement the requested feature.
5. Run validation.
6. Fix all errors.
7. Summarize the changes.

Never skip these steps.

---

# Development Rules

Always:

- reuse existing services
- reuse utility functions
- reuse existing UI components
- keep files small
- keep functions focused
- prefer composition over inheritance

Avoid:

- duplicated business logic
- unnecessary abstractions
- overengineering
- dead code
- commented-out code

---

# Architecture Rules

Business logic belongs inside:

src/lib

Database logic belongs inside:

src/db

UI components belong inside:

src/components

Views belong inside:

src/views

Application wiring belongs inside:

src/app

Never mix UI with business logic.

---

# React Guidelines

Use:

- functional components
- hooks
- composition

Avoid:

- class components
- unnecessary useEffect
- unnecessary state

Prefer derived state whenever possible.

---

# TypeScript Rules

Always:

- use strict typing
- avoid any
- avoid unknown casts
- use readonly where appropriate

Prefer small interfaces.

Prefer discriminated unions.

---

# UI Rules

The UI should feel:

- clean
- modern
- lightweight
- fast

Never introduce visual clutter.

Prefer whitespace instead of borders.

Prefer simple layouts.

---

# Performance

Avoid unnecessary rerenders.

Memoize only when profiling indicates benefit.

Avoid expensive loops during rendering.

Prefer lazy loading for large features.

---

# Database

Database changes must:

- preserve existing user data
- be backwards compatible
- avoid destructive migrations

---

# Testing

Before finishing a task always execute:

npm run check

If applicable also run:

npm run build

Never finish with failing tests.

---

# Git

After a completed task:

- create a meaningful commit
- explain what changed

Do not modify unrelated files.

---

# Documentation

Whenever architecture changes:

update

- README.md
- ARCHITECTURE.md

if necessary.

---

# Task Execution

The development roadmap is located in:

docs/TOP-20-TASKS.md

Always complete exactly one task unless explicitly instructed otherwise.

Never start the next task automatically.

Wait for confirmation.

---

# Priorities

1. Correctness
2. Maintainability
3. Performance
4. UX
5. Simplicity

Always optimize in that order.