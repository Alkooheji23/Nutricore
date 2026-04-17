# NutriCore - AI Fitness Application

## Overview
NutriCore is a full-stack AI fitness application offering personalized workout plans, progress tracking, and AI-powered guidance. It aims to provide affordable and accessible elite coaching, continuously learning from research and adapting to user needs. The application currently focuses on strength/gym training and running, with ambitions to measure progress, detect plateaus, and offer actionable support.

## User Preferences
STRICT MODE ENABLED - All development must adhere to mandatory guidelines in `DEVELOPMENT_RULES.md`. State-based regression checks are mandatory before any changes. Theme consistency for light/dark mode must be verified. Feature gating safeguards via single source of truth are required. A change confirmation protocol must be followed, documenting what changed, remained unchanged, and was verified. In case of failure, the agent should pause and ask for clarification instead of proceeding.

## System Architecture
The application uses a client-server architecture with a premium dark theme UI/UX, adhering to a strict 3-color system (near-black, white/gray, warm amber gold) and specific fonts (Outfit, Inter). UI elements incorporate glass morphism, subtle gradients, and hover animations. Dark mode is permanently locked.

Core features include an AI Coaching Engine for volume tracking, RPE adjustments, progressive overload, and deload detection. A Nutrition Engine provides BMR/TDEE calculations, auto macro calculations, and integrates a GCC foods database with Ramadan meal plans. A Weekly Adaptive Plan Generator creates personalized plans based on recovery metrics. User communication styles with the AI are customizable.

A centralized permissions system (`shared/permissions.ts`) manages user roles (GUEST/WAITLIST/ACTIVE) and feature gating. A centralized theme system (`client/src/styles/theme.ts`) ensures consistent styling. The AI acts as an agent, capable of logging food/workouts, updating metrics, and setting goals with user approval. Onboarding is streamlined, prioritizing immediate coaching and collecting detailed information conversationally within the AI Trainer chat. The AI Trainer is the sole authority for proposing plans, with Diet and Activities tabs serving as read-only displays of confirmed decisions.

A Unified Decision Layer (`server/coaching/unifiedDecisionLayer.ts`) acts as a single authority for training load, recovery, and nutrition, ensuring consistency and resolving decisions based on physiological readiness, performance trajectory, sustainability, and aesthetic goals. It issues unified verdicts, automatically rebalancing domains without user intervention or exposing internal logic.

The system employs a weekly coaching cadence (`server/coaching/weeklyCadenceEngine.ts`), adjusting plans based on aggregated weekly trends (e.g., workout completion, RPE, sleep) rather than daily fluctuations. Adjustments are applied to the upcoming week only, with limited exceptions for mid-week changes.

A sport-agnostic activity classification system categorizes activities (STRENGTH, ENDURANCE, MIXED, SKILL, RECOVERY, PASSIVE) with specific metrics and UI behaviors. A Multi-Device Data Integrity System (`shared/deviceConflictResolver.ts`) resolves conflicts from multiple connected wearables, prioritizing a primary device. PWA session persistence uses local storage to maintain user sessions.

AI cost optimization (`selectAIModel()`, `summarizeOlderMessages()`) intelligently switches between OpenAI models and summarizes older messages to reduce token usage. An RP Hypertrophy-Style Workout Feedback System adapts plans based on post-workout difficulty ratings. A Trainer-Mediated Workout Confirmation Flow uses agent tools to confirm/enrich smartwatch workouts, ensuring the AI never fabricates details. Garmin FIT File Auto-Sync (`server/garminFitParser.ts`) automatically parses and confirms structured strength workouts from Garmin.

A Workout Logging Mode System supports Auto-Tracked, Structured Strength, and Hybrid logging. The Workout Execution Model allows for flexible logging, either live set-by-set coaching or post-workout bulk entry, ensuring data integrity while offering user choice. The Trainer Context Hydration Layer (`server/coaching/contextBuilder.ts`) provides the AI with comprehensive, up-to-date user state on every message, making database data the authoritative source of truth and preventing reliance on chat history for current data.

### Goal-Driven Metrics & Adjustment Logic
Each user has one primary goal that determines which metrics matter and how adjustments are made.

**Governing Principle**: Goals define metrics. Trends drive changes. Patience beats precision.

**Goal Hierarchy (Single Source of Truth)**:
- Weight Loss
- Muscle Gain
- Performance
- Health / Maintenance

**Metric Stack by Goal**:
- **Weight Loss**: Primary = weekly average weight trend. Secondary = waist measurements, calorie adherence. Ignore = single weigh-ins, water fluctuations.
- **Muscle Gain**: Primary = strength progression. Secondary = body weight trend, training volume completion. Ignore = short-term scale stagnation.
- **Performance**: Primary = sport-specific markers (pace, power, volume, load). Secondary = recovery trends, consistency. Ignore = cosmetic body changes.
- **Health/Maintenance**: Primary = consistency (training, steps, sleep). Secondary = stable weight range, subjective energy. Ignore = maximal performance.

**Evaluation Window (Hard Rule)**:
- Weekly rolling basis
- Minimum data: ≥5 days of inputs OR ≥70% adherence
- No decisions on single data points

**Adjustment Logic**:
- Only if trends persist ≥2 consecutive weeks
- One adjustment axis at a time (calories ±5-10%, volume ±10-20%, cardio emphasis, recovery bias)
- Adjustments apply next week only
- If data insufficient/noisy: hold steady, flag adherence

**Implementation**: `server/coaching/goalMetricsEngine.ts` with `runGoalEvaluation()` as entry point. Integrated with WeeklyCadenceEngine.

**Database Table**: `goal_evaluations`

### Trainer Authority & Unified Decision Layer
The Trainer is the single decision authority across training, recovery, diet, and activity. No part of the system operates independently or contradicts another.

**Single Brain Rule (Non-Negotiable)**:
The Trainer is the ONLY entity allowed to:
- Adjust workout plans
- Adjust calorie targets
- Interpret recovery and readiness

All other sections (tabs, features, integrations) are execution or display layers ONLY.

**Unified Decision Considerations**:
All decisions must consider together:
- Training load & performance
- Recovery signals (sleep, HRV, fatigue)
- Activity level (steps, cardio)
- Diet adherence and calorie targets
- User's primary goal

No domain may be adjusted in isolation. Example cross-domain impacts:
- Training volume increases → recovery & diet must be evaluated
- Recovery is compromised → training and diet must adapt
- Calories are reduced → training stress must be reassessed

**Decision Application Rules**:
- Decisions made on weekly cadence
- Changes apply forward only (no retroactive edits)
- No mid-week overhauls unless injury/illness detected

**Data Awareness**:
- Trainer reads from: logged workouts, synced smartwatch data, progress metrics
- Trainer never asks for data that already exists
- Missing data defaults to conservative assumptions

**User Interaction Boundary**:
- Trainer: Issues decisions, explains only when asked
- User: Executes plans, logs data
- System: Enforces coherence

**Governing Principle**: One Trainer. One Decision Layer. One Coherent System.

**Implementation**: `server/coaching/unifiedDecisionLayer.ts` with `resolveSystemState()` as entry point. Authority enforcement via `validateDecisionAuthority()`. Cross-domain impact assessment via `assessCrossDomainImpact()`.

## External Dependencies
- **Replit Auth**: User authentication and session management.
- **Grok (xAI) via OpenRouter**: AI trainer chat functionality using x-ai/grok-3 (full model) and x-ai/grok-3-mini (lightweight model) through Replit AI Integrations.
- **PostgreSQL**: Data storage for user profiles, fitness data, logs.
- **Fitbit API**: Syncing steps, calories, active minutes.
- **Garmin API**: Syncing workout data, including FIT files.
- **Stripe**: Subscription management and payment processing.
- **SendGrid**: User-related email notifications.