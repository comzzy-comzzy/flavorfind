---
name: "clone-website"
description: "Use when the user wants to clone, replicate, rebuild, reverse-engineer, or copy a website into a modern Next.js codebase."
---

# Clone Website

Use this skill when the user wants to clone, replicate, rebuild, reverse-engineer, or copy a website into a modern Next.js codebase.

Invocation: `/clone-website <target-url1> [<target-url2> ...]`

Recommended runtime: Claude Code with browser automation available. Codex and OpenCode can use the same cloned source instructions when their local skill/command support is installed.

The workflow expects a Next.js + shadcn/ui + Tailwind scaffold and browser automation. It inspects the target site, extracts assets, CSS, interactions, responsive behavior, and real content, then writes component specs under `docs/research/` and rebuilds the page section by section.

Safety policy: only clone websites the user owns or has permission to reproduce. Do not use this for phishing, impersonation, terms-of-service violations, or passing off another site's design, brand assets, or copy as original work.
