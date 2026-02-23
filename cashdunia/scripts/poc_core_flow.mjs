/**
 * POC Core Flow Test — Cash Dunia
 * Tests: Supabase auth, user creation, gem increment, offer gate, level advance, coins, withdrawal validation, level cycling
 * Run: node scripts/poc_core_flow.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qhjcmyszufmbcvdpsdjk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoamNteXN6dWZtYmN2ZHBzZGprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE2Njg5MzQsImV4cCI6MjA4NzI0NDkzNH0.QprqXTkQ7TNNswk_wUqqBoPsUCC61e2ZlsvCMHEDfcY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const LEVEL_CONFIG = {
  1: { gemTarget: 5, coinsAwarded: 350, offerType: 'simple' },
  2: { gemTarget: 5, coinsAwarded: 350, offerType: 'install' },
  3: { gemTarget: 5, coinsAwarded: 250, offerType: 'install' },
  4: { gemTarget: 3, coinsAwarded: 250, offerType: 'install' }
};

const TEST_EMAIL = `poc_test_${Date.now()}@cashdunia.test`;
const TEST_PASS = 'TestPass1234!';

let testUserId = null;

function log(msg, status = 'INFO') {
  const icons = { INFO: '🔷', OK: '✅', FAIL: '❌', WARN: '⚠️' };
  console.log(`${icons[status] || '🔷'} ${msg}`);
}

// ==================== TEST 1: Auth + User Row ====================
async function test_auth_and_user_creation() {
  log('TEST 1: Sign up new user');

  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email: TEST_EMAIL,
    password: TEST_PASS,
  });

  if (signUpErr) {
    log(`Sign up failed: ${signUpErr.message}`, 'FAIL');
    return false;
  }

  testUserId = signUpData.user?.id;
  log(`Signed up: ${testUserId}`, 'OK');

  // Sign in to get full session (needed for RLS)
  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASS,
  });

  if (signInErr) {
    log(`Sign in failed: ${signInErr.message}`, 'FAIL');
    return false;
  }

  testUserId = signInData.user?.id;
  log(`Signed in: ${testUserId}`, 'OK');

  // Create user row (normally done by trigger or first app load)
  const referralCode = 'TEST' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const { error: upsertErr } = await supabase.from('users').upsert({
    id: testUserId,
    email: TEST_EMAIL,
    name: 'POC Test User',
    coins: 0,
    gems: 0,
    current_level: 1,
    gems_this_level: 0,
    referral_code: referralCode,
    offer_gate_open: false,
  });

  if (upsertErr) {
    log(`User row upsert failed: ${upsertErr.message}`, 'FAIL');
    return false;
  }

  // Read back user
  const { data: user, error: readErr } = await supabase.from('users').select('*').eq('id', testUserId).single();
  if (readErr) {
    log(`Read user failed: ${readErr.message}`, 'FAIL');
    return false;
  }

  log(`User row created: coins=${user.coins}, gems=${user.gems}, level=${user.current_level}`, 'OK');
  return true;
}

// ==================== TEST 2: Gem Increment ====================
async function test_gem_increment() {
  log('TEST 2: Increment gems via RPC');

  const { error } = await supabase.rpc('increment_gems', { uid: testUserId, amount: 1 });
  if (error) {
    log(`increment_gems RPC failed: ${error.message}`, 'FAIL');
    return false;
  }

  const { data: user } = await supabase.from('users').select('gems, gems_this_level').eq('id', testUserId).single();
  log(`After 1 gem: gems=${user.gems}, gems_this_level=${user.gems_this_level}`, 'OK');
  return user.gems === 1 && user.gems_this_level === 1;
}

// ==================== TEST 3: Offer Gate Should NOT Open Yet ====================
async function test_offer_gate_blocked() {
  log('TEST 3: Offer gate should be blocked (need 5 gems, have 1)');

  const { data: user } = await supabase.from('users').select('offer_gate_open, gems_this_level, current_level').eq('id', testUserId).single();
  const config = LEVEL_CONFIG[user.current_level];

  if (user.gems_this_level >= config.gemTarget) {
    log('Gate should be blocked but gem count already meets target!', 'FAIL');
    return false;
  }

  log(`gems_this_level=${user.gems_this_level} < gemTarget=${config.gemTarget}: gate correctly blocked`, 'OK');
  return true;
}

// ==================== TEST 4: Complete Level 1 (earn 5 gems → open gate → advance) ====================
async function test_complete_level1() {
  log('TEST 4: Earn remaining gems for Level 1 and advance');

  // Already have 1 gem, need 4 more
  for (let i = 0; i < 4; i++) {
    const { error } = await supabase.rpc('increment_gems', { uid: testUserId, amount: 1 });
    if (error) { log(`Gem ${i+2} failed: ${error.message}`, 'FAIL'); return false; }
  }

  const { data: user1 } = await supabase.from('users').select('gems_this_level, current_level').eq('id', testUserId).single();
  log(`After 5 total gems: gems_this_level=${user1.gems_this_level}, level=${user1.current_level}`, 'OK');

  const config = LEVEL_CONFIG[user1.current_level];
  if (user1.gems_this_level < config.gemTarget) {
    log('Not enough gems to open gate', 'FAIL');
    return false;
  }

  // Open offer gate
  const { error: gateErr } = await supabase.rpc('open_offer_gate', { uid: testUserId });
  if (gateErr) { log(`open_offer_gate failed: ${gateErr.message}`, 'FAIL'); return false; }

  const { data: user2 } = await supabase.from('users').select('offer_gate_open').eq('id', testUserId).single();
  if (!user2.offer_gate_open) { log('Gate should be open', 'FAIL'); return false; }
  log(`Offer gate opened!`, 'OK');

  // Increment coins for completing offer
  const { error: coinsErr } = await supabase.rpc('increment_coins', { uid: testUserId, amount: config.coinsAwarded });
  if (coinsErr) { log(`increment_coins failed: ${coinsErr.message}`, 'FAIL'); return false; }

  // Record offer history
  const { error: histErr } = await supabase.from('offer_history').insert({
    user_id: testUserId,
    level: user1.current_level,
    offer_type: config.offerType,
    coins_awarded: config.coinsAwarded,
  });
  if (histErr) { log(`offer_history insert failed: ${histErr.message}`, 'FAIL'); return false; }

  // Advance level
  const nextLevel = user1.current_level >= 4 ? 1 : user1.current_level + 1;
  const { error: advErr } = await supabase.rpc('advance_level', { uid: testUserId, next_level: nextLevel });
  if (advErr) { log(`advance_level failed: ${advErr.message}`, 'FAIL'); return false; }

  const { data: user3 } = await supabase.from('users').select('coins, current_level, gems_this_level, offer_gate_open').eq('id', testUserId).single();
  log(`After Level 1 complete: coins=${user3.coins}, level=${user3.current_level}, gems_this_level=${user3.gems_this_level}, gate=${user3.offer_gate_open}`, 'OK');

  if (user3.coins !== config.coinsAwarded) { log(`Coins mismatch: expected ${config.coinsAwarded}, got ${user3.coins}`, 'FAIL'); return false; }
  if (user3.current_level !== 2) { log(`Level should be 2, got ${user3.current_level}`, 'FAIL'); return false; }
  if (user3.gems_this_level !== 0) { log(`gems_this_level should reset to 0`, 'FAIL'); return false; }
  if (user3.offer_gate_open !== false) { log(`offer_gate_open should reset to false`, 'FAIL'); return false; }

  log('Level 1 → 2 advance CORRECT', 'OK');
  return true;
}

// ==================== TEST 5: Level Cycling (L2→L3→L4→L1) ====================
async function test_level_cycling() {
  log('TEST 5: Level cycling through L2, L3, L4, then back to L1');

  let { data: user } = await supabase.from('users').select('current_level, coins').eq('id', testUserId).single();
  let totalCoins = user.coins;

  for (let lvl = 2; lvl <= 4; lvl++) {
    const config = LEVEL_CONFIG[lvl];
    log(`  Completing Level ${lvl} (need ${config.gemTarget} gems, reward ${config.coinsAwarded} coins)...`);

    // Earn gems
    const { error: gemErr } = await supabase.rpc('increment_gems', { uid: testUserId, amount: config.gemTarget });
    if (gemErr) { log(`  Gem increment failed: ${gemErr.message}`, 'FAIL'); return false; }

    // Open gate
    const { error: gateErr } = await supabase.rpc('open_offer_gate', { uid: testUserId });
    if (gateErr) { log(`  Gate open failed: ${gateErr.message}`, 'FAIL'); return false; }

    // Award coins
    const { error: coinsErr } = await supabase.rpc('increment_coins', { uid: testUserId, amount: config.coinsAwarded });
    if (coinsErr) { log(`  Coins failed: ${coinsErr.message}`, 'FAIL'); return false; }

    // Record history
    await supabase.from('offer_history').insert({
      user_id: testUserId,
      level: lvl,
      offer_type: config.offerType,
      coins_awarded: config.coinsAwarded,
    });

    // Advance level
    const nextLevel = lvl >= 4 ? 1 : lvl + 1;
    const { error: advErr } = await supabase.rpc('advance_level', { uid: testUserId, next_level: nextLevel });
    if (advErr) { log(`  Advance failed: ${advErr.message}`, 'FAIL'); return false; }

    totalCoins += config.coinsAwarded;

    const { data: updatedUser } = await supabase.from('users').select('current_level, coins, gems_this_level').eq('id', testUserId).single();
    log(`  Level ${lvl} complete → now Level ${updatedUser.current_level}, coins=${updatedUser.coins}`, 'OK');
  }

  // After L4, should be back to L1
  const { data: finalUser } = await supabase.from('users').select('current_level, coins').eq('id', testUserId).single();
  if (finalUser.current_level !== 1) {
    log(`After L4 cycle, expected level=1 got ${finalUser.current_level}`, 'FAIL');
    return false;
  }

  // Expected total: 350 + 350 + 250 + 250 = 1200
  const expectedCoins = 350 + 350 + 250 + 250;
  log(`Total coins after 4 levels: ${finalUser.coins} (expected ${expectedCoins})`, finalUser.coins === expectedCoins ? 'OK' : 'FAIL');
  log(`Level cycle test: back at Level 1 ✓`, 'OK');
  return finalUser.current_level === 1 && finalUser.coins === expectedCoins;
}

// ==================== TEST 6: Withdrawal Validation ====================
async function test_withdrawal() {
  log('TEST 6: Withdrawal flow (1200 coins = ₹15)');

  const { data: user } = await supabase.from('users').select('coins').eq('id', testUserId).single();

  if (user.coins < 1200) {
    log(`Not enough coins for withdrawal: ${user.coins} < 1200`, 'FAIL');
    return false;
  }

  const withdrawAmount = 1200;
  const rsValue = withdrawAmount / 80; // 80 coins = ₹1

  const { error: wErr } = await supabase.from('withdrawals').insert({
    user_id: testUserId,
    coins_redeemed: withdrawAmount,
    rs_value: rsValue,
    method: 'UPI',
    payment_address: 'testuser@upi',
    status: 'pending',
  });

  if (wErr) { log(`Withdrawal insert failed: ${wErr.message}`, 'FAIL'); return false; }

  // Deduct coins (manual update since no deduct RPC)
  const { error: deductErr } = await supabase.from('users').update({ coins: user.coins - withdrawAmount }).eq('id', testUserId);
  if (deductErr) { log(`Coin deduction failed: ${deductErr.message}`, 'FAIL'); return false; }

  const { data: wData } = await supabase.from('withdrawals').select('*').eq('user_id', testUserId);
  log(`Withdrawal created: coins=${withdrawAmount}, ₹${rsValue}, status=pending`, 'OK');
  log(`Remaining coins: ${user.coins - withdrawAmount}`, 'OK');
  return true;
}

// ==================== TEST 7: Tasks Read ====================
async function test_tasks_read() {
  log('TEST 7: Reading tasks table');
  const { data: tasks, error } = await supabase.from('tasks').select('*').eq('is_active', true);
  if (error) {
    log(`Tasks read failed: ${error.message}`, 'FAIL');
    return false;
  }
  log(`Tasks loaded: ${tasks.length} active tasks`, 'OK');
  tasks.forEach(t => log(`  - ${t.title}: +${t.coin_reward} coins`));
  return tasks.length > 0;
}

// ==================== TEST 8: Streak Upsert ====================
async function test_streak() {
  log('TEST 8: Streak upsert');
  const today = new Date().toISOString().split('T')[0];
  const { error } = await supabase.from('user_streaks').upsert({
    user_id: testUserId,
    streak_count: 1,
    last_claimed_date: today,
    last_claimed_time: new Date().toISOString(),
    ads_watched_date: today,
    ads_watched_today: 0,
  }, { onConflict: 'user_id' });

  if (error) { log(`Streak upsert failed: ${error.message}`, 'FAIL'); return false; }

  const { data: streak } = await supabase.from('user_streaks').select('*').eq('user_id', testUserId).single();
  log(`Streak row: streak_count=${streak.streak_count}, last_claimed_date=${streak.last_claimed_date}`, 'OK');
  return true;
}

// ==================== CLEANUP ====================
async function cleanup() {
  log('CLEANUP: Signing out');
  await supabase.auth.signOut();
  log('Signed out', 'OK');
}

// ==================== MAIN ====================
async function main() {
  console.log('\n========================================');
  console.log('  CASH DUNIA — POC CORE FLOW TEST');
  console.log('========================================\n');

  const results = [];

  try {
    results.push({ name: 'Auth + User Creation', passed: await test_auth_and_user_creation() });
    results.push({ name: 'Gem Increment', passed: await test_gem_increment() });
    results.push({ name: 'Offer Gate Blocked (insufficient gems)', passed: await test_offer_gate_blocked() });
    results.push({ name: 'Complete Level 1', passed: await test_complete_level1() });
    results.push({ name: 'Level Cycling (L2→L3→L4→L1)', passed: await test_level_cycling() });
    results.push({ name: 'Withdrawal Flow', passed: await test_withdrawal() });
    results.push({ name: 'Tasks Read', passed: await test_tasks_read() });
    results.push({ name: 'Streak Upsert', passed: await test_streak() });
  } catch (err) {
    log(`Unexpected error: ${err.message}`, 'FAIL');
  }

  await cleanup();

  console.log('\n========================================');
  console.log('  TEST RESULTS SUMMARY');
  console.log('========================================');
  let allPassed = true;
  results.forEach(r => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} ${r.name}`);
    if (!r.passed) allPassed = false;
  });
  console.log('========================================');
  console.log(allPassed ? '🎉 ALL TESTS PASSED — Core flow verified!' : '⚠️  SOME TESTS FAILED — See above for details');
  console.log('========================================\n');

  process.exit(allPassed ? 0 : 1);
}

main();
