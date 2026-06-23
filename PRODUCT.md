# PRODUCT.md

## Product Identity

This project is a Fatal Frame style content workbench: a local-first toolbox for maintaining atmospheric media, lyrics, notes, quiz banks, and museum-style reference content inside one dark crimson interface.

The product is not a generic SaaS dashboard or marketing site. It is a focused operating surface for content editing and preservation, where the visual identity supports concentration without slowing down the task.

## Users

- Primary user: the project owner and content maintainer.
- Secondary users: trusted local users who need to browse or maintain the same media/content collections.

Users are expected to value direct control, predictable editing, and a coherent visual atmosphere over onboarding copy or broad public-product conventions.

## Core Jobs

- Browse and maintain video and music collections.
- Edit and synchronize lyrics or subtitle-like timed text.
- Manage Markdown notes and long-form reference material.
- Maintain external quiz-bank CSV/manifest data through structured forms.
- Organize Fatal Frame style museum/reference content.
- Keep local runtime data readable by the existing static or server-backed pages.

## Experience Principles

- Tools first: each page should open directly into the working surface, not a landing page.
- Immersive but usable: old-house, crimson, butterfly, and viewfinder motifs are atmosphere, not obstacles.
- Low explanation density: prefer clear controls, labels, states, and direct affordances over instructional prose.
- Local-file clarity: when a tool edits external or generated files, the UI should make save/delete scope clear.
- Consistency over novelty: new tools should reuse the established shell, typography, panels, buttons, inputs, and selection controls.
- Dense but legible: tool pages may contain many controls, but spacing, scrolling, and hierarchy must keep editing comfortable.

## Interface Rules

- Follow `DESIGN.md` for colors, spacing, typography, surface treatment, form controls, and responsive behavior.
- Product pages should feel like workbenches, editors, libraries, or inspectors, not promotional pages.
- Avoid native white browser controls that clash with the theme. Selects, textareas, scrollable panels, buttons, and toggles should use the project component vocabulary.
- Do not add visible feature explanations, shortcut lists, or tutorial blocks unless the user explicitly asks for them.
- Cards are for repeated items, panels, and framed tools. Avoid decorative nested cards and marketing-style hero layouts.
- Mobile views should preserve access to the same tools through compact navigation and theme-consistent controls.

## Scope Boundaries

- Do not add authentication, roles, databases, cloud sync, Electron/Tauri, or external CMS behavior unless explicitly requested.
- Do not turn the project into a general-purpose public toolbox.
- Do not replace existing file formats or external project data contracts without a specific migration request.
- Prefer small local helpers and existing patterns over new frameworks or broad architectural rewrites.
- Preserve current runtime assumptions: React + Vite frontend, small Node server, and local file-backed data where already used.
