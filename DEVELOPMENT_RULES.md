# NutriCore Development Manifesto - STRICT MODE

**MANDATORY GUIDELINES** - All changes must comply with these rules. No exceptions.

---

## 1. State-Based Regression Checks (MANDATORY)

Before finalizing ANY change, verify behavior for all 4 user states:

| State | Access | UI Behavior |
|-------|--------|-------------|
| **ANONYMOUS** | 50 messages, no memory | Shows intentional limitations, upgrade prompts |
| **TRIAL** (7-day) | Full access | **IDENTICAL to PAID** - no trial indicators |
| **PAID** | Full access | Premium experience |
| **EXPIRED** | 50 messages, memory paused | Limited access, calm expiration notice (once) |

### Critical Rule
TRIAL users must see the **exact same UI** as PAID users:
- No countdown timers
- No "trial" badges
- No "days remaining" labels
- Use `hasFullAccess(user)` from `@shared/permissions` for access checks

### Verification Checklist
- [ ] Anonymous user cannot access gated features
- [ ] Anonymous user sees upgrade prompts appropriately
- [ ] Trial user has full feature access
- [ ] Trial user sees NO trial indicators
- [ ] Paid user experience identical to trial
- [ ] Expired user has limited access enforced
- [ ] Expired user sees calm, non-aggressive messaging

**Any mismatch = change must be rejected.**

---

## 2. Centralized Permissions (MANDATORY)

- All role and feature-access logic must come from: `shared/permissions.ts`
- No component may define its own permissions
- All restricted features must use: `<RequiresPermission />`
- Server routes must use `requireActiveUser` middleware for premium features

```typescript
// CORRECT
import { getUserState, getPermissions, hasFullAccess } from "@shared/permissions";
import { RequiresPermission } from "@/components/RequiresPermission";

// Get user state
const state = getUserState(user); // 'anonymous' | 'trial' | 'paid' | 'expired'

// Check full access (trial OR paid)
if (hasFullAccess(user)) { ... }

// WRONG - Never do this
const isPremium = user.subscriptionType === 'premium'; // NO
if (user.subscriptionType === 'trial') { showTrialBadge(); } // NO
```

---

## 3. Theme Consistency Checks (MANDATORY)

For EVERY UI change, verify in both light and dark mode:

### Light Mode
- Background: `#F7F5F0` (off-white)
- Text: `#1A1A1A` (charcoal)
- Primary: `#4A5D4A` (olive)
- Cards: `#FFFFFF`

### Dark Mode
- Background: `#000000` (pure black)
- Text: `#FFFFFF` (white)
- Primary: `#4A5D4A` (olive)
- Cards: `#111111`

### Verification Checklist
- [ ] Colors match brand palette
- [ ] No contrast issues (text readable)
- [ ] No layout shifts between modes
- [ ] Components use CSS variables, not hardcoded colors

**Dark mode must NEVER be altered unless explicitly requested.**

---

## 4. Centralized Theme (MANDATORY)

- All colors, spacing, fonts must come from: `client/src/styles/theme.ts`
- No inline colors
- No custom spacing
- No style overrides outside theme

```typescript
// CORRECT - Use CSS variables via Tailwind
<div className="bg-background text-foreground">

// CORRECT - Use theme constants
import { theme } from "@/styles/theme";
<div style={{ color: theme.colors.gold, padding: theme.spacing.md }}>

// WRONG - Never do this
<div style={{ color: "#D4AF37", padding: 16 }}> // NO
<div style={{ background: '#000' }}> // NO
```

---

## 5. Branding Lock (IMMUTABLE)

The following are **LOCKED** and cannot be modified without explicit instruction:

### Colors
```
Primary Olive:    #4A5D4A
Brand Gold:       #D4AF37
Charcoal:         #1A1A1A
Off-White:        #F7F5F0
Pure Black:       #000000
Pure White:       #FFFFFF
```

### Assets
- Logo: `heartbeat_mountain_gold_glow.png`
- Social assets in `attached_assets/generated_images/`

### Typography
- Display: Outfit (headings)
- Body: Inter (text)
- Scale: xs(12) sm(14) md(16) lg(20) xl(28) xxl(36)

### Spacing
- xs(4) sm(8) md(16) lg(24) xl(32) xxl(48)

### Files
- `client/src/styles/theme.ts` - TypeScript theme constants
- `client/src/index.css` - CSS variables and base styles

---

## 6. Feature Gating Safeguards

### Rules
- No feature may be accidentally enabled
- No feature may be partially usable
- No feature may be UI-visible but backend-blocked
- Disabled features must show intentional UI state

### Permission Functions
```typescript
import { getUserState, getPermissions, hasFullAccess } from '@shared/permissions';

// Get user state
const state = getUserState(user); // 'anonymous' | 'trial' | 'paid' | 'expired'

// Check specific permission
const perms = getPermissions(user);
if (perms.canAccessTracking) { ... }

// Check full access (trial OR paid)
if (hasFullAccess(user)) { ... }
```

---

## 7. AI Behavior Rules

"My Trainer" must use two knowledge layers:

### A. User Memory Layer
Store and update for each user:
- goals, habits, injuries
- preferences, progress
- communication style (tone personalization)
- nationality, dietary restrictions

Every AI response must reference this memory. Located in `server/coaching/contextBuilder.ts`.

### B. Global Knowledge Layer
Continuously updated from legal, public sources only:
- Open-access research
- ACSM, NSCA, ISSN, WHO, NIH guidelines
- Creative Commons educational content
- GCC/Bahrain-specific nutrition guidance

No scraping or quoting copyrighted sources.

### AI Tone Standards
"My Trainer" must sound:
- Calm, confident, expert
- Tailored to user's communication style
- Rooted in real science
- Never gimmicky or robotic
- Premium human coach, not casual chatbot

---

## 8. Change Confirmation Protocol

After completing ANY task, document:

### What Was Changed
- Files modified
- Features added/updated
- Logic changes

### What Was Intentionally Left Unchanged
- Existing behavior preserved
- Files not touched

### What Was Verified
- User states tested
- Theme modes checked
- Features validated

**No silent changes allowed.**

---

## 9. Failure Handling

If a requested change would:
- Break existing behavior
- Cause ambiguity
- Require assumptions

**STOP and ask for clarification instead of proceeding.**

### Red Flags
- Modifying permissions without full state audit
- Changing colors without explicit request
- Adding trial indicators to UI
- Removing features without confirmation

---

## 10. Premium Brand Standards

NutriCore must always look and feel premium, high-end, and prestigious.

### Visual Standards
- Dark luxury UI (default dark mode)
- Olive green: `#4A5D4A`
- Champagne gold: `#D4AF37`
- Clean typography (Outfit for headings, Inter for body)
- Spacious, uncluttered layouts
- Smooth transitions with Framer Motion
- No cheap-looking or default UI elements

### Interaction Quality
- Smooth animations on all state changes
- Polished loading states (Loader2 with animate-spin)
- Consistent spacing using theme values
- No janky UI behavior

---

## Quick Reference Card

| Check | Source File |
|-------|-------------|
| User permissions | `shared/permissions.ts` |
| Theme variables | `client/src/index.css` |
| Theme constants | `client/src/styles/theme.ts` |
| Theme hook | `client/src/hooks/useTheme.ts` |

| User State | `hasFullAccess()` | UI Treatment |
|------------|-------------------|--------------|
| ANONYMOUS | false | Limited, upgrade prompts |
| TRIAL | **true** | Premium (no trial labels) |
| PAID | **true** | Premium |
| EXPIRED | false | Limited, calm notice |

---

## Zero Drift Rule

No new feature, screen, component, style, or AI behavior may bypass:
- The permissions system (`shared/permissions.ts`)
- The theme system (`client/src/styles/theme.ts`)
- The premium design rules
- The dual-layer AI architecture

Reject or correct anything that breaks these rules.

---

**Apply globally. No exceptions.**

*Last updated: December 14, 2025*
