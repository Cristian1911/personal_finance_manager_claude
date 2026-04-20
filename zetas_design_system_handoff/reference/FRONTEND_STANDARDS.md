# Zeta Frontend Standards

> The authoritative reference for all frontend decisions in the Zeta project.
> Agents and developers should consult this before writing or reviewing UI code.

---

## 1. Architecture

### 1.1 Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.x |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| Component Primitives | Radix UI | 1.4.x |
| Component Library | shadcn/ui (copy-paste, not npm) | 3.8.x |
| Forms | React Hook Form + Zod | RHF 7.x, Zod 4.x |
| Charts | Recharts | 2.15.x |
| Animation | Framer Motion (minimal) + Tailwind keyframes | FM 12.x |
| Icons | Lucide React | 0.563.x |
| Toasts | Sonner | 2.x |
| Dates | date-fns (Spanish locale) | 4.x |
| State | None — RSC + useActionState + URL params | — |
| Testing | Vitest (unit), Playwright (E2E) | Vitest 4.x, PW 1.58.x |

### 1.2 Rendering Strategy

- **Server Components by default**. Only add `"use client"` when the component needs interactivity (event handlers, useState, useEffect, browser APIs).
- **Data fetching in Server Components**. Use `"use cache"` + `cacheTag()` + `cacheLife("zeta")` for cached queries.
- **Parallel data loading**. Always `Promise.all()` independent queries — never waterfall.
- **Suspense boundaries** around async sections. Use skeleton loaders per-widget, not per-page.
- **Dynamic imports** for heavy client components that aren't needed on first paint.

### 1.3 Directory Structure

```
webapp/src/
├── app/                    # Routes (App Router)
│   ├── (auth)/             # Login, signup, password reset
│   ├── (dashboard)/        # Authenticated routes
│   ├── layout.tsx          # Root layout (fonts, toaster, providers)
│   └── globals.css         # Design tokens + Tailwind config
├── components/
│   ├── ui/                 # shadcn/ui primitives (34 components)
│   ├── {feature}/          # Feature components (accounts/, debt/, dashboard/, etc.)
│   ├── mobile/             # Mobile-specific components
│   ├── charts/             # Chart wrapper components
│   └── layout/             # Global layout components
├── actions/                # Server Actions (one file per feature)
├── lib/
│   ├── supabase/           # Client factories (client, server, middleware, auth)
│   ├── utils/              # Utilities (currency, date, idempotency, etc.)
│   ├── validators/         # Zod schemas per entity
│   └── constants/          # Enums, navigation, currencies
├── types/                  # TypeScript types (database, domain, actions)
└── hooks/                  # Custom React hooks (if any)
```

**Rules:**
- Feature components go in `components/{feature}/`, not in `app/` route folders.
- Server Actions go in `actions/{feature}.ts` with clear named exports.
- Shared utilities go in `lib/utils/`. Cross-platform utilities go in `packages/shared/`.
- No barrel files (`index.ts`). Import directly from source: `from "@/components/ui/button"`.

### 1.4 File & Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Component files | PascalCase | `AccountCard.tsx`, `BurnRateCard.tsx` |
| Utility/action files | kebab-case | `currency.ts`, `server-action-recovery.ts` |
| Directory names | kebab-case | `components/debt/`, `lib/utils/` |
| Component names | PascalCase | `export function AccountCard()` |
| Props types | `{ComponentName}Props` | `type AccountCardProps = { ... }` |
| Server actions | camelCase verbs | `createAccount`, `updateTransaction` |
| CSS variables | `--z-{name}` | `--z-sage`, `--z-income`, `--z-surface` |
| Data attributes | `data-slot="{name}"` | `data-slot="card-header"` |

---

## 2. Design Tokens

### 2.1 Color System

Zeta uses a dark-mode-first design with a branded palette. All colors are CSS custom properties defined in `globals.css`.

#### Brand Colors
| Token | Value | Usage |
|---|---|---|
| `--z-ink` | `#0A0E14` | Deepest background |
| `--z-sage` | `#C5BFAE` | Primary text, brand accent |
| `--z-white` | `#F0EDE6` | Headings, primary emphasis |
| `--z-sage-light` | `#D4CFC0` | Secondary text |
| `--z-sage-dark` | `#8A8477` | Tertiary text, labels |
| `--z-sage-muted` | `#6B665D` | Disabled text, placeholders |

#### Financial Semantics
| Token | Value | Usage |
|---|---|---|
| `--z-income` | `#5CB88A` | Income, positive values, success |
| `--z-expense` | `#E8875A` | Expenses, spending |
| `--z-debt` | `#E05545` | Debt, destructive actions, errors |
| `--z-alert` | `#D4A843` | Warnings, attention needed |
| `--z-excellent` | `#3D9E6E` | Excellent health, achievements |

#### Surfaces
| Token | Value | Usage |
|---|---|---|
| `--z-surface` | `#131720` | Primary card backgrounds |
| `--z-surface-2` | `#1C1F28` | Secondary surfaces, inputs |
| `--z-surface-3` | `#262A34` | Elevated surfaces, hover states |

#### Semantic Surface Classes
For status indicators on timelines and cards, use the predefined surface classes (inline styles to avoid Tailwind specificity issues):

```css
.surface-income   /* green tint: text, border, bg */
.surface-expense  /* orange tint */
.surface-debt     /* red tint */
.surface-alert    /* yellow tint */
.surface-neutral  /* gray tint */
```

### 2.2 Typography

| Level | Size | Weight | Usage |
|---|---|---|---|
| Hero | clamp(56px, 8vw, 96px) | 900 | Landing page hero numbers |
| Display | 52px | 800 | Dashboard primary KPIs |
| H1 | 28px | 700 | Page titles |
| H2 | 22px | 600 | Section headers |
| H3 | 18px | 600 | Card titles |
| Body | 15px | 400 | Default text |
| Body Small | 13px | 400 | Secondary information |
| Label | 11px | 500 | Form labels, small tags |
| Caption | 10px | 500 | Timestamps, micro-text |

**Font**: Geist Sans (loaded via Next.js `next/font/google`).

### 2.3 Spacing

| Token | Value | Usage |
|---|---|---|
| `--space-xs` | 6px | Tight gaps (icon-to-text) |
| `--space-sm` | 8px | Compact spacing (within cards) |
| `--space-md` | 16px | Standard gaps (card padding, form fields) |
| `--space-lg` | 20px | Section gaps |
| `--space-xl` | 28px | Major section separation |
| `--space-2xl` | 40px | Page-level spacing |
| `--space-3xl` | 64px | Hero spacing |

### 2.4 Border Radii

Base: `0.75rem` (12px). Scale uses `calc()` offsets from the base.

| Token | Approx Value | Usage |
|---|---|---|
| `--radius-sm` | 8px | Small inputs, tags |
| `--radius-md` | 12px | Cards, dialogs |
| `--radius-lg` | 14px | Large cards, panels |
| `--radius-xl` | 16px | Hero cards |
| `--radius-2xl` | 20px | Modal overlays |

---

## 3. Component Standards

### 3.1 shadcn/ui Components

All base UI components are from shadcn/ui, built on Radix UI primitives. **Never install a separate UI library** (no MUI, no Ant Design, no Chakra) — extend shadcn components instead.

**Standard pattern for every UI component:**

```tsx
"use client"

import * as React from "react"
import { SomePrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

function MyComponent({ className, ...props }: React.ComponentProps<typeof SomePrimitive.Root>) {
  return (
    <SomePrimitive.Root
      data-slot="my-component"
      className={cn("base-classes", className)}
      {...props}
    />
  )
}

export { MyComponent }
```

**Rules:**
- Always include `data-slot` attribute on the root element.
- Always use `cn()` (clsx + tailwind-merge) for class composition.
- Always spread `...props` last for override flexibility.
- Use named exports, never default exports.
- Use CVA (class-variance-authority) for variant components (Button, Badge).

### 3.2 Feature Components

Feature components compose UI primitives with business logic.

```tsx
// Good: clear props, composition of UI primitives
function AccountCard({ account, showBalance = true }: AccountCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{account.name}</CardTitle>
      </CardHeader>
      <CardContent>
        {showBalance && (
          <span className="text-z-white font-semibold">
            {formatCurrency(account.current_balance, account.currency_code)}
          </span>
        )}
      </CardContent>
    </Card>
  )
}
```

**Rules:**
- Props interface named `{ComponentName}Props` and defined above the component.
- Destructure props in the function signature.
- Use composition (Card + CardHeader + CardContent), not monolithic components.
- Keep components focused — one responsibility per component. Split when a component exceeds ~200 lines.
- Use `formatCurrency()` for any monetary display. Use `formatDate()` for any date display.
- Inline styles only when dynamic values depend on runtime data (e.g., `style={{ color: account.color }}`).

### 3.3 Component Vocabulary

Use correct component names when building UI. This improves code clarity, searchability, and AI-assisted development:

| Name | What It Is | Zeta Implementation |
|---|---|---|
| **Dialog** | Modal overlay with backdrop | Radix Dialog |
| **Sheet** | Side panel (slide from edge) | Radix Dialog + slide animation |
| **Drawer** | Bottom sheet (mobile) | Vaul |
| **Popover** | Floating content anchored to trigger | Radix Popover |
| **Tooltip** | Hover hint | Radix Tooltip |
| **Toast** | Temporary notification | Sonner |
| **Command** | Searchable command palette | cmdk |
| **Select** | Dropdown single-choice | Radix Select |
| **Combobox** | Searchable dropdown | Radix Popover + Command |
| **Tabs** | Horizontal content switcher | Radix Tabs |
| **Accordion** | Collapsible sections | Radix Accordion |
| **Badge** | Status label | CVA variants |
| **Skeleton** | Loading placeholder | Pulse animation div |
| **Separator** | Visual divider | Radix Separator |
| **Progress** | Determinate progress bar | Radix Progress |
| **Toggle** | On/off switch | Radix Toggle |
| **Avatar** | User image with fallback | Radix Avatar |

---

## 4. Forms

### 4.1 Pattern

All forms use **React Hook Form + Zod + useActionState**:

```tsx
"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useActionState } from "react"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
import { mySchema, type MyFormValues } from "@/lib/validators/my-entity"
import { myServerAction } from "@/actions/my-feature"

function MyForm() {
  const [state, formAction] = useActionState(myServerAction, { success: false, error: "" })

  const form = useForm<MyFormValues>({
    resolver: zodResolver(mySchema),
    defaultValues: { name: "", amount: 0 },
  })

  return (
    <Form {...form}>
      <form action={formAction}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </form>
    </Form>
  )
}
```

### 4.2 Validation Rules

- **Zod schemas** live in `lib/validators/{entity}.ts`.
- **UUID fields**: Use permissive regex `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`, NOT `z.string().uuid()` (Zod 4 rejects seed UUIDs).
- **Empty strings from Select**: Use `z.preprocess((val) => val === "" ? undefined : val, ...)` to normalize Radix Select empty values.
- **Coerced numbers**: `z.coerce.number().positive()` for numeric inputs.
- **Error messages**: Access via `.issues[0].message` (Zod 4), NOT `.errors[0].message`.
- **All validation messages in Spanish**.

### 4.3 Server Actions

```tsx
"use server"

export async function myAction(
  prevState: ActionResult<MyType>,
  formData: FormData
): Promise<ActionResult<MyType>> {
  const { supabase, user } = await getAuthenticatedClient()
  if (!user) return { success: false, error: "No autenticado" }

  const parsed = mySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message }

  const { data, error } = await supabase
    .from("my_table")
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single()

  if (error) return { success: false, error: "Error al crear" }

  revalidateTag("my-feature")
  return { success: true, data }
}
```

**Rules:**
- Always return `ActionResult<T>` — never throw.
- Always validate with Zod on the server (don't trust client-only validation).
- Always use `getAuthenticatedClient()` — never call `createClient()` + `getUser()` separately.
- Always add `.eq("user_id", user.id)` even with RLS (defense in depth).
- Always call `revalidateTag()` after mutations.

---

## 5. Charts & Data Visualization

### 5.1 Library: Recharts

All charts use Recharts with the shadcn/ui `ChartContainer` wrapper.

```tsx
const chartConfig = {
  balance: { label: "Saldo", color: "var(--chart-1)" },
  projected: { label: "Proyectado", color: "var(--chart-2)" },
} satisfies ChartConfig

<ChartContainer config={chartConfig} className="h-[120px] w-full">
  <AreaChart data={data}>
    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
    <YAxis width={60} tickFormatter={(v) => formatCompact(v)} />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Area
      type="monotone"
      dataKey="balance"
      stroke="var(--chart-1)"
      fill="url(#gradient)"
      isAnimationActive={false}
    />
  </AreaChart>
</ChartContainer>
```

### 5.2 Chart Rules

- **No animation**: Always set `isAnimationActive={false}`. Speed is the priority.
- **Use CSS variable colors**: `var(--chart-1)` through `var(--chart-5)`, mapped to financial semantic colors.
- **Compact formatting**: Use `formatCompact()` for axis ticks on large numbers (1.5M, 500K).
- **Responsive height**: Use `className="h-[120px] w-full"` or `aspect-video`, not fixed pixel dimensions.
- **Gradient fills**: Use `<defs><linearGradient>` with `useId()` for unique gradient IDs.
- **Projected data**: Dashed lines (`strokeDasharray="4 3"`) for forecasted/projected values.
- **Reference lines**: `<ReferenceLine y={0} />` for zero-baselines on charts with positive and negative values.
- **Tooltips**: Always include `<ChartTooltip>` with `<ChartTooltipContent />` for hover detail.

### 5.3 Chart Type Selection

| Data | Chart Type | Component |
|---|---|---|
| Balance over time | Area chart with gradient | `<AreaChart>` |
| Income vs expenses trend | Stacked bar | `<BarChart>` |
| Category spending breakdown | Horizontal bar | `<BarChart layout="vertical">` |
| Budget pace (actual vs ideal) | Line chart with reference line | `<LineChart>` + `<ReferenceLine>` |
| Debt payoff projection | Multi-line (solid + dashed) | `<LineChart>` |
| Credit utilization | Single gauge | Custom component (not Recharts) |
| Sparkline in card | Tiny area chart | `<AreaChart>` minimal config |

---

## 6. Responsive & Mobile

### 6.1 Breakpoints

Tailwind defaults, mobile-first:

| Prefix | Min Width | Target |
|---|---|---|
| (none) | 0px | Mobile phones |
| `sm:` | 640px | Large phones, small tablets |
| `md:` | 768px | Tablets |
| `lg:` | 1024px | Desktop |
| `xl:` | 1280px | Wide desktop |

**Write base styles for mobile, then layer up:**

```tsx
// Good: mobile-first
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

// Good: responsive text
<h1 className="text-xl md:text-2xl lg:text-3xl">

// Good: responsive layout direction
<div className="flex flex-col sm:flex-row gap-4">
```

### 6.2 Mobile Components

Mobile-specific components live in `components/mobile/`:
- `BottomTabBar` — persistent bottom navigation
- `FAB` — floating action button menu
- `MobilePageHeader` — compact header with back navigation
- `MobileTopbar` — status bar context

**Rules:**
- Desktop and mobile share business logic (same Server Actions, same validators).
- UI components adapt via Tailwind breakpoints when possible.
- When mobile needs a fundamentally different layout (e.g., bottom sheet vs dialog), use a separate mobile component.
- Dialogs: `max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] sm:max-w-lg` for mobile-safe sizing.
- Touch targets: minimum 44x44px for interactive elements on mobile.

### 6.3 Mobile Design Source of Truth

The webapp's mobile UX is the canonical design. The React Native app (`mobile/`) will be rebuilt to match it. When designing responsive layouts, optimize for the webapp mobile experience first.

---

## 7. Animation & Transitions

### 7.1 Philosophy

**Speed is the #1 priority.** Animation exists only to provide spatial context and feedback, never for decoration. Keep durations under 200ms. Disable animations that delay content visibility.

### 7.2 Allowed Animations

| Context | Animation | Duration | Implementation |
|---|---|---|---|
| Page enter | Fade + slight translateY | 100ms | `animate-page-enter` CSS class |
| Dialog open/close | Fade + zoom | 150ms | Radix `data-state` + Tailwind |
| Dropdown/popover | Fade + slide from edge | 100ms | Radix `data-state` + Tailwind |
| Hover feedback | Color/shadow transition | 150ms | `transition-[color,box-shadow]` |
| Skeleton pulse | Opacity pulse | Infinite | `animate-pulse` |
| Toast enter/exit | Slide from bottom | 200ms | Sonner default |

### 7.3 Disallowed Animations

- Chart animations (Recharts `isAnimationActive={false}`)
- Page-level skeleton loaders (use per-widget Suspense)
- Complex choreographed sequences (Framer Motion layout animations)
- Scroll-triggered animations
- Loading spinners that block content

---

## 8. Accessibility (A11Y)

### 8.1 Minimum Standard: WCAG 2.1 AA

| Requirement | Implementation |
|---|---|
| **Color contrast** | >= 4.5:1 for text, >= 3:1 for large text. Verified on z-surface backgrounds. |
| **Focus indicators** | `focus-visible:ring-ring/50 focus-visible:ring-[3px]` on all interactive elements |
| **Keyboard navigation** | All Radix primitives handle Tab, Enter, Escape, Arrow keys |
| **Screen reader support** | `sr-only` class for visually hidden labels; `aria-label` on icon-only buttons |
| **Form errors** | `aria-invalid` + `aria-describedby` linking inputs to error messages |
| **Semantic HTML** | Use `<button>`, `<form>`, `<input>`, `<label>` — not `<div onClick>` |
| **Alt text** | All meaningful images need alt text. Decorative images: `alt=""` |
| **Color not sole indicator** | Use icons + text + color together for status (income, expense, debt) |
| **Alerts** | `role="alert"` on Alert component for screen reader announcement |

### 8.2 Radix Gives Us

Radix primitives provide WAI-ARIA compliant behavior out of the box for: Dialog, Select, Popover, Tooltip, Dropdown Menu, Tabs, Checkbox, Radio Group, Switch, Accordion. **Always use Radix primitives** for these patterns — never build custom versions.

---

## 9. Performance Rules

### 9.1 Core Principles

1. **Server-side first.** Render on the server. Only add `"use client"` when necessary.
2. **No waterfalls.** Parallel data fetching with `Promise.all()` in Server Components.
3. **Optimistic updates.** Use `useActionState` + `revalidateTag` for instant UI feedback.
4. **Cache aggressively.** `"use cache"` + granular `cacheTag()` for all read queries.
5. **Lazy load heavy components.** `dynamic(() => import(...))` for charts, modals not visible on initial load.
6. **No animation overhead.** Charts: `isAnimationActive={false}`. Pages: 100ms max transitions.

### 9.2 Bundle Hygiene

- No `import * as X` from large libraries. Import specific components: `import { AreaChart } from "recharts"`.
- No duplicate libraries for the same purpose (one charting lib, one form lib, one animation lib).
- Check bundle impact before adding any new dependency. Prefer tree-shakeable ESM packages.
- Icons: import individually from `lucide-react`, not the entire icon set.

### 9.3 Image & Asset Rules

- Use Next.js `<Image>` for all raster images (automatic optimization, lazy loading, responsive sizing).
- SVGs: inline for small icons (via Lucide), `<Image>` for larger SVG illustrations.
- No unoptimized `<img>` tags.

---

## 10. Localization

### 10.1 Language: Spanish (es-CO)

All user-facing strings are in Spanish. This includes:
- Page titles, headings, descriptions
- Button labels, form labels, placeholders
- Error messages, success messages
- Toast notifications
- Empty states, onboarding copy

### 10.2 Formatting

| Data | Utility | Format |
|---|---|---|
| Currency | `formatCurrency(amount, code)` | COP: $1.500.000, USD: $1,500.00 |
| Dates | `formatDate(date)` | "15 de marzo de 2026" |
| Relative dates | `formatRelativeDate(date)` | "hace 3 dias" |
| Percentages | `Intl.NumberFormat` | "15,3%" (comma decimal) |

**Rules:**
- Never hardcode date or number formats. Always use the utility functions.
- CurrencyInput uses Colombian format (period as thousands separator, comma as decimal).
- Category names stored with both `name` (English) and `name_es` (Spanish) in DB.

---

## 11. Error Handling

### 11.1 Server Actions

- Always return `ActionResult<T>`. Never throw exceptions.
- Structure: `{ success: true, data: T }` or `{ success: false, error: string }`.
- Duplicate inserts: catch Supabase error code `23505`, return user-friendly message.
- Auth failures: return `"No autenticado"` immediately.

### 11.2 Client-Side

- Use `toast.error()` (Sonner) for transient errors.
- Use inline `<FormMessage>` for field-level validation errors.
- Use `<Alert variant="destructive">` for persistent error states.
- Never show raw error messages or stack traces to users.
- `ServerActionRecovery` component in root layout catches unhandled server action failures.

### 11.3 Loading States

- **Per-widget Suspense** with `<Skeleton>` components, not page-level loading.
- **Optimistic UI** via `useActionState` — show the expected result immediately, revalidate in background.
- **Stale-while-revalidate** via Next.js cache — show cached data while fresh data loads.

---

## 12. Security

- **Auth**: Always use `getAuthenticatedClient()` from `@/lib/supabase/auth`. Never access Supabase without auth verification.
- **Defense in depth**: Always add `.eq("user_id", user.id)` to queries, even with RLS.
- **Input sanitization**: Zod validation on all Server Actions. Never trust raw FormData.
- **No secrets in client code**: Environment variables starting with `NEXT_PUBLIC_` are exposed to the browser. All other secrets stay server-side.
- **CSRF**: Server Actions have built-in CSRF protection via Next.js.
- **XSS prevention**: React auto-escapes JSX. Never inject raw HTML into the DOM. Always sanitize any user-provided content before rendering.

---

## 13. Dependency Policy

### 13.1 Adding Dependencies

Before adding a new dependency:

1. **Check if shadcn/ui or Radix already covers it.** Most UI patterns are handled.
2. **Check bundle size** on bundlephobia.com. Reject packages > 50KB gzipped unless critical.
3. **Prefer packages with ESM + tree-shaking support.**
4. **One library per purpose.** Don't add a second charting library, animation library, or form library.
5. **Use `pnpm add`**, never `npm install`.

### 13.2 Current Dependency Map

| Purpose | Package | Do NOT also add |
|---|---|---|
| UI Primitives | `radix-ui` | headlessui, react-aria, ariakit |
| Styled Components | `shadcn/ui` (copy-paste) | MUI, Ant Design, Chakra, Mantine |
| Charts | `recharts` | chart.js, nivo, victory, visx, d3 (directly) |
| Forms | `react-hook-form` + `zod` | formik, yup, valibot |
| Animation | `framer-motion` | react-spring, animejs, gsap |
| Icons | `lucide-react` | react-icons, heroicons, phosphor |
| Dates | `date-fns` | dayjs, moment, luxon |
| Toasts | `sonner` | react-toastify, react-hot-toast |
| Styling | `tailwindcss` | styled-components, emotion, css-modules |
| State | (none — RSC) | zustand, redux, jotai, recoil |
| Command palette | `cmdk` | kbar |
| Drawer | `vaul` | — |
| Class merging | `clsx` + `tailwind-merge` | classnames |

---

## 14. Code Quality Checklist

Before submitting frontend code, verify:

- [ ] **TypeScript**: No `any` types. All props typed. No `@ts-ignore`.
- [ ] **Components**: Composition over monolith. Single responsibility. < 200 lines.
- [ ] **Styling**: Tailwind classes only (no inline styles unless dynamic). Correct semantic colors.
- [ ] **Forms**: Zod validation on server. Accessible labels. Spanish error messages.
- [ ] **Responsive**: Looks correct on 375px (mobile) through 1440px (desktop).
- [ ] **Accessibility**: Focus rings visible. Keyboard navigable. Screen reader labels present.
- [ ] **Performance**: No animation on charts. No waterfalls. Server Components where possible.
- [ ] **Locale**: All visible text in Spanish. Dates and currencies use formatters.
- [ ] **Naming**: PascalCase components, kebab-case files, `data-slot` on UI primitives.
- [ ] **No new dependencies** without justification and bundle size check.
