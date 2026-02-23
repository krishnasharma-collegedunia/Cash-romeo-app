# Cash Dunia — Development Plan (Updated)

## 1) Objectives
- Deliver an Android-ready **React Native + Expo** app implementing the full rewards loop: **play → earn gems → open offer gate → complete offer → earn coins → level advance → withdraw via UPI**.
- Use **Supabase Postgres + RLS** as the only backend (no mocks), with **all Supabase calls isolated to `lib/api.js`**.
- Ensure stable UX on slow networks with **loading/skeleton states**, clear error handling, and safe timer cleanup.
- Current status: **Phase 1 and Phase 2 complete**. Next focus is **Phase 3 hardening + feature completion** and/or user E2E testing on device.

## 2) Implementation Steps

### Phase 1 — Core Flow POC (Isolation) (required) ✅ COMPLETE
Goal: Prove the hardest integration/business logic works end-to-end with real Supabase (no UI complexity).

**What was delivered:**
- ✅ Expo project created at `/app/cashdunia` with all required dependencies installed.
- ✅ Supabase schema deployed (run via SQL Editor):
  - Tables: `users`, `user_streaks`, `offer_history`, `withdrawals`, `referrals`, `tasks`
  - RPCs: `increment_coins`, `increment_gems`, `open_offer_gate`, `advance_level`
  - RLS policies enabled (including public `tasks` read and public-ish leaderboard read policy).
  - Seeded **3 active tasks**.
- ✅ POC script created and verified: `/app/cashdunia/scripts/poc_core_flow.mjs`
  - Passed **8 tests**:
    1) Auth + user row creation
    2) Gem increment
    3) Offer gate blocking (insufficient gems)
    4) Level 1 completion
    5) Level cycling (1→2→3→4→1)
    6) Withdrawal creation + coin deduction path
    7) Tasks read
    8) Streak upsert

**Notes / assumptions validated during Phase 1:**
- Email confirmation had to be disabled in Supabase Auth settings for smooth dev testing.

**Exit criteria (met):**
- ✅ POC script runs end-to-end without manual DB edits.
- ✅ RLS is enabled and core tables exist.
- ✅ Rewards math matches spec for Levels 1–4 and cycling.

---

### Phase 2 — V1 App Development (MVP) ✅ COMPLETE
Goal: Build the full app around the proven POC core.

**What was delivered:**
- ✅ Full app implemented with **23 source files** and required folder structure:
  - `/navigation/index.js`
  - `/screens`: `AuthScreen`, `HomeScreen`, `GameScreen`, `SpecialOfferScreen`, `VerifyScreen`, `StreakScreen`, `WithdrawalScreen`, `OffersScreen`, `InviteScreen`, `LeaderboardScreen`, `ProfileScreen`
  - `/components`: `MockAdOverlay`, `CoinAnimation`, `GemToast`, `SkeletonBox`
  - `/lib`: `supabase.js`, `api.js`
  - `/store`: `authStore`, `userStore`, `uiStore`
  - `/constants/theme.js`
- ✅ Navigation implemented:
  - Root Stack: Auth → MainTabs
  - Tabs: Home (stack), Invite, Leaderboard, Profile
  - HomeStack: Home → Game → SpecialOffer → Verify → Streak → Withdrawal → Offers
- ✅ Reusable components implemented and used:
  - `MockAdOverlay`: full-screen, **no skip**, **3-second timer**, progress bar; timers stored in refs + cleanup.
  - `CoinAnimation`: **8 coin emojis burst** from center.
  - `GemToast`: gem reward toast.
  - `SkeletonBox`: skeleton loading.
- ✅ Zustand state:
  - `authStore`: session bootstrap + auth state changes
  - `userStore`: profile caching + loading flags
  - `uiStore`: simple toasts + global loading (available for future hardening)
- ✅ Theme: dark + neon palette tokens in `constants/theme.js`.
- ✅ Project archived for delivery: `/app/cashdunia_app.zip` (~176K, excludes node_modules).

**Phase 2 testing status:**
- ⚠️ Code-level structure/sanity checks done (files present, basic checks).
- ⏳ Device E2E testing still recommended (Expo Go / emulator) because the container environment cannot run Android builds.

---

### Phase 3 — Add More Features + Hardening (Next) ⏳ PLANNED
Goal: Improve reliability, enforce anti-abuse rules server-side, and complete deeper spec items.

**3.1 Ads-for-extra-coins (daily cap enforced by DB/RPC)**
- Implement a dedicated RPC such as `watch_ad_reward(uid uuid)` that:
  - checks/updates `user_streaks.ads_watched_date` + `ads_watched_today`
  - enforces `MAX_ADS_PER_DAY` server-side
  - increments coins atomically
- Update `StreakScreen` to call this RPC instead of client-managed logic.
- Add UI feedback for cooldown/cap.

**3.2 Tasks: robust task completion + claiming**
- Add a join table for per-user task claims (example: `user_task_claims`), with unique constraint per user+task+date.
- Add RPC: `claim_task(uid, task_id)`:
  - validates task is active
  - enforces once-per-day (or defined frequency)
  - awards coins and records claim
- Update `HomeScreen` tasks section to include a **Claim** button and show claimed state.

**3.3 Referrals: harden and complete logic**
- Current state: `applyReferralCode` records referral and awards referrer 50 coins.
- Hardening additions:
  - Prevent multiple referrals per referred user (already checked client-side; enforce via DB constraint/policy).
  - Optionally change reward trigger to “first offer completion” or “first successful withdrawal” (requires DB events/RPC).
  - Add referral status UI (pending/qualified/paid).

**3.4 Leaderboard optimization + safety**
- Replace broad `users` select policy with a **read-only view** exposing only safe fields.
- Add indexes for leaderboard queries (`coins DESC`) for performance.

**3.5 Reliability / UX hardening**
- Standardize error handling and loading states (use `uiStore.showToast` consistently).
- Add safe retry patterns for Supabase calls and network failures.
- Audit timers/animations for cleanup (already addressed in reusable components; keep consistent).

**User stories (Phase 3):**
1. As a user, I can watch an ad to earn bonus coins with a clear daily cap enforced server-side.
2. As a user, I can complete daily tasks and claim rewards exactly once per time window.
3. As a user, referral rules are enforced consistently and can’t be exploited.
4. As a user, leaderboard loads quickly and does not leak sensitive user data.
5. As a user, the app remains stable on slow/unstable networks.

**Phase 3 testing (1 round E2E):**
- Validate ads cap enforcement using two devices/users.
- Validate tasks claim constraints.
- Multi-user sanity: ensure no cross-user writes; confirm leaderboard view exposure is minimal.

---

### Phase 4 — Release Readiness ⏳ PLANNED
- Add EAS config (`eas.json`) and production app metadata.
- Update icons/splash as needed.
- Permissions audit (minimal for this app).
- Final QA checklist + performance sanity.

## 3) Next Actions
1. **Run on device:**
   - `cd /app/cashdunia`
   - `npm install`
   - `npx expo start`
   - Test on Expo Go (Android): Auth → Play → Offer → Verify → Coins → Streak → Withdrawal.
2. If proceeding to Phase 3:
   - Add DB tables/RPCs for ad caps and task claims.
   - Update `lib/api.js` to expose new RPC calls.
   - Update relevant screens to use the server-enforced logic.
3. Optional: Set up EAS build for APK output.

## 4) Success Criteria
- ✅ Phase 1 POC proves: gems/coins/levels/offer gate/withdrawal rules work with RLS enforced.
- ✅ Phase 2 app implements the full UI flow with required navigation, theme, and reusable components.
- ✅ No Supabase calls exist outside `lib/api.js`.
- ✅ All timers cleaned up on unmount; no stuck overlays.
- ⏳ Phase 3 hardening: ads cap + tasks claiming + referral constraints enforced server-side.
- ⏳ Release readiness: EAS build produces an Android APK/AAB and passes final QA.
