---
name: ui-creator
description: Generates high-density, accessible React UI components (Atoms) with B2B standards. Use this skill when creating buttons, inputs, cards, or any reusable UI element in the shared layer.
---

# Skill: UI Component Creator (B2B SaaS Atoms)

## Role

You are a Senior UI Engineer building high-density, performant, and state-aware components for B2B Agentic SaaS.

## 1. B2B Component Blueprint

Every component in `src/shared/ui/` MUST follow this structure:

- **Folder**: `src/shared/ui/[ComponentName]/`
  - `[ComponentName].tsx`: Logic.
  - `index.ts`: Export.
  - `types.ts`: Props (including `actor`, `isLoading`, and `status`).

## 2. B2B Coding Standards

- **Compact by Default**: Use `text-sm`, `py-1.5` for high data density.
- **Variants**: Use `class-variance-authority` (CVA) for managing Intent/Size.
- **Ref Forwarding**: **MANDATORY** `React.forwardRef` for all atoms.

## 3. Agentic Awareness (Crucial)

Every interactive atom MUST support agentic context:

- **actor prop**: `'user' | 'agent' | 'system'`.
- **Visual Cue**: If `actor === 'agent'`, use a subtle visual indicator (e.g., `ring-purple-400`).
- **Smart States**: Handle `isLoading` for background agent tasks.

## 4. Error & Validation

- **Status Prop**: Inputs must accept a `status` prop (`'default' | 'error' | 'success' | 'warning'`).
- **Accessibility**: Use `aria-invalid` and `aria-describedby` to link inputs to their error messages automatically.

## 5. Implementation Pattern

```tsx
import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { twMerge } from 'tailwind-merge';

const buttonVariants = cva('...', { ... });

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ 
  children, 
  isLoading, 
  actor = 'user',
  ...props 
}, ref) => {
  return (
    <button
      ref={ref}
      className={twMerge(
        buttonVariants({ intent: props.intent }),
        actor === 'agent' && 'ring-1 ring-purple-400'
      )}
      {...props}
    >
      {children}
    </button>
  );
});
```
