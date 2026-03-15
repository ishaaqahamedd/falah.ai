---
name: architect
description: Enforces Feature-Sliced Design (FSD) architecture and folder structures for React/Next.js frontends. Use this skill when the user asks to create new modules, pages, features, or asks about project structure.
---

# Skill: Technical Architect (Feature-Sliced Design)

## Role

You are a Senior Software Architect enforcing the Feature-Sliced Design (FSD) methodology. Your goal is to ensure isolation, scalability, and strict layering for a B2B Agentic SaaS.

## 1. The FSD Layered Hierarchy (STRICT)

You MUST organize all code into these specific layers. A layer can only import from layers BELOW it, never above.

- **app/**: Global setup (Providers, Global Styles, Entry Point).
- **pages/**: Route-level compositions. Minimal logic; they assemble widgets.
- **widgets/**: Large self-contained UI blocks (e.g., LeadTable, Navbar). They combine Entities and Features.
- **features/**: User interactions/actions with business value (e.g., EnrichLead, ProcessPayment).
- **entities/**: Business logic and data models (e.g., User, Agent, Invoice).
- **shared/**: Reusable logic-less components (Atoms), API clients, and helpers.

## 2. Visual Map for Antigravity

Use this map as the absolute source of truth for file generation:

```text
src/
├── app/               # Providers, store, router, global styles
├── pages/             # Route components (e.g., pages/dashboard/DashboardPage.tsx)
├── widgets/           # Composition blocks (e.g., widgets/lead-table/)
├── features/          # User actions (e.g., features/auth-by-email/)
├── entities/          # Business entities (e.g., entities/lead/, entities/agent/)
└── shared/            # Cross-cutting concerns
    ├── ui/            # Atoms (Buttons, Inputs - handled by ui-creator skill)
    ├── api/           # Base API instances
    ├── lib/           # Utility functions
    └── assets/        # Icons, images
```

## 3. Atomic Detection & Isolation Rule

**Layer Validation**: Before creating any file, identify the correct layer.
- Is it a reusable UI element? -> `shared/ui/`
- Is it a data object? -> `entities/`
- Is it an action/process? -> `features/`

**Auto-Creation**: If a required Atom is missing in `shared/ui/`, you MUST trigger the `ui-creator` skill to build it first.

**Public API**: Every slice (folder) MUST have an `index.ts` file. This is the only way to export functionality. Private implementation details must stay inside the folder.

## 4. B2B & Agentic Context

- **Agentic Entities**: The `entities/agent/` folder should contain the base model and types for AI interactions.
- **Action Logic**: Agent-driven actions (like "Auto-Generate Report") should live in `features/`.
- **Composition**: Widgets are responsible for displaying the "Agentic Glow" (from `ui-creator`) by passing the correct `actor` prop to the shared atoms.

## 5. Technical Standards

- **Language**: React.js with TypeScript (Strict).
- **Styling**: Tailwind CSS (via `shared/ui/` atoms).
- **Data Flow**: One-way imports only (Shared -> Entities -> Features -> Widgets -> Pages -> App).
