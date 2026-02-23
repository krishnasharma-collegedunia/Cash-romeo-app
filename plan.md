# Cash Dunia — Development Plan

## 1) Objectives
- Deliver an Android-ready React Native + Expo app implementing the full rewards loop: **play → earn gems → open offer gate → complete offer → earn coins → level advance → withdraw via UPI**.
- Use **Supabase Postgres + RLS** as the only backend (no mocks), with **all Supabase calls isolated to `lib/api.js`**.
- Ensure stable UX on slow networks with loading/skeleton states and clear error handling.

## 2) Implementation Steps

### Phase 1 — Core Flow POC (Isolation) (required)
Goal: Prove the hardest integration/business logic works end-to-end with real Supabase (no UI complexity).

**POC scope (minimal):**
- Create Supabase schema + RLS for: `users`, `offer_history`, `withdrawals` (plus any minimal columns needed for level/gems/coins).
- Implement RPCs (or SQL functions) for: `increment_gems`, `open_offer_gate`, `advance_level`, `increment_coins`.
- Write a **Node script** (since we’re in JS/Expo stack) in `/app/cashdunia/scripts/poc_core_flow.js` that:
  1) creates a test user (email/pass) OR signs in
  2) reads user state (coins/gems/level)
  3) increments gems for a round
  4) attempts offer gate open (should fail until requirement met)
  5) after required gems, opens gate, simulates offer completion, advances level, increments coins
  6) verifies level cycle after 4 and coin totals update
- Iterate until POC passes reliably.

**User stories (POC):**
1. As a user, I can be created/logged in and have a persistent profile row in Supabase.
2. As a user, when I earn a gem, my gem count updates in the database.
3. As a user, I cannot open an offer gate until I meet the gem requirement.
4. As a user, once I complete an offer, I receive the correct coin reward and my level advances.
5. As a user, after Level 4 my level cycle restarts at Level 1 with correct requirements.

**Exit criteria (must meet before Phase 2):**
- POC script runs end-to-end without manual DB edits.
- RLS blocks cross-user reads/writes.
- Rewards math matches spec for Levels 1–4 and cycling.

---

### Phase 2 — V1 App Development (MVP)
Goal: Build the app around the proven POC core.

**Project setup (Expo):**
- Create `/app/cashdunia` with Expo, install:
  - `@supabase/supabase-js`, `zustand`, `@react-navigation/*`, `react-native-screens`, `react-native-safe-area-context`
  - `expo-google-fonts/poppins`, `@expo/vector-icons`
- Implement folder structure exactly as specified.
- Add `constants/theme.js` with dark + neon palette and shared spacing/typography tokens.

**Data + state architecture:**
- `lib/supabase.js`: Supabase client init only.
- `lib/api.js`: **all** DB/auth/RPC calls (auth, profile fetch, streak, offers, withdrawals, referrals, leaderboard).
- Zustand stores:
  - `authStore` (session/user)
  - `userStore` (coins/gems/level/streak)
  - `uiStore` (toasts, global loading)

**Navigation:**
- Root Stack: `Auth` → `MainTabs` (no headers).
- Tabs: Home (stack), Invite, Board, Profile.
- HomeStack routes: Home → Game → SpecialOffer → Verify → Streak → Withdrawal → Offers.

**Reusable components (must be used across screens):**
- `MockAdOverlay`: modal + 3s timer + progress bar, store timer IDs in `useRef`, clear on unmount.
- `CoinAnimation`: 8 coin emojis burst from center.
- `GemToast`: toast when gem earned.
- `SkeletonBox`: loading placeholders.

**Screen implementation (MVP focus):**
- `AuthScreen`: email/password signup+login; on success create/ensure `users` row.
- `HomeScreen`: show coins/gems/level requirements + progress, streak summary, daily tasks list from `tasks`.
- `GameScreen`: “Play Round” button → calls `increment_gems` → shows `GemToast` + optional `CoinAnimation`.
- `SpecialOfferScreen`: shows current offer (based on level); start → `MockAdOverlay` → after 3s allow proceed.
- `VerifyScreen`: checklist of steps; submit → `advance_level` (+ coin reward) and record `offer_history`.
- `StreakScreen`: read/update `user_streaks`, claim daily bonus via RPC.
- `WithdrawalScreen`: form (UPI ID + amount) + validation: requires **>=1200 coins**; create row in `withdrawals` and deduct coins via RPC.
- `OffersScreen`: list offers available (based on gate/level), with skeleton while loading.
- `InviteScreen`: show referral code, submit friend code (writes to `referrals`).
- `LeaderboardScreen`: top earners query (read-only with RLS-safe view/policy).
- `ProfileScreen`: stats + offer/withdrawal history + logout.

**User stories (V1):**
1. As a user, I can sign up/login and stay logged in across app restarts.
2. As a user, I can play rounds to earn gems and instantly see my progress.
3. As a user, once I meet gem requirements, I can start an offer, verify completion, and earn coins.
4. As a user, I can track my daily streak and claim a bonus when eligible.
5. As a user, I can request a UPI withdrawal once I reach 1200 coins.

**Phase 2 testing (1 round E2E):**
- Run app via `npx expo start` (user runs on device/Expo Go).
- Test the full funnel: Auth → Game (gems) → Offer gate → Verify → coins/level update → Streak → Withdrawal validation.
- Fix crashes, navigation issues, and RLS/API errors before moving on.

---

### Phase 3 — Add More Features + Hardening
Goal: Improve reliability and complete remaining spec depth.

**Add/complete:**
- Ads-for-extra-coins flow (reusing `MockAdOverlay`) with daily cap in DB.
- Robust tasks: streak tasks, play tasks, offer tasks; claim rewards.
- Referrals: reward logic (first successful withdraw or first offer completion triggers bonus).
- Leaderboard optimization: create a read-only view + index for top coins.
- Offline/slow-network UX: retries, skeletons, and explicit error toasts.

**User stories (Phase 3):**
1. As a user, I can watch an ad to earn bonus coins with clear cooldown/cap feedback.
2. As a user, I can complete daily tasks and claim rewards.
3. As a user, I can invite friends and see referral progress.
4. As a user, I can see a stable leaderboard that loads quickly.
5. As a user, I can review my offer and withdrawal history without missing entries.

**Phase 3 testing (1 round E2E):**
- Verify caps/cooldowns enforced by RPC/RLS (not client-only).
- Multi-user sanity: ensure no cross-user data access.

---

### Phase 4 — Release Readiness
- EAS build config (`eas.json`), app icons/splash, permissions.
- Final QA checklist + basic performance pass.

## 3) Next Actions
1. Create `/app/cashdunia` Expo project and install dependencies.
2. Author Supabase SQL: tables, indexes, RLS policies, and RPC functions.
3. Implement `scripts/poc_core_flow.js` and run until green.
4. Only after POC passes: scaffold navigation, theme, Zustand stores, and `lib/api.js`.

## 4) Success Criteria
- POC script proves: gems/coins/levels/offer gate/withdrawal rules work with RLS enforced.
- In-app core loop works on device: **Auth → Play → Offer → Verify → Coins → Level cycle → Withdrawal eligibility**.
- No Supabase calls exist outside `lib/api.js`.
- All timers are cleaned up on unmount; no stuck overlays.
- App meets theme, navigation, and reusable component requirements.