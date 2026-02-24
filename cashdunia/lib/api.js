import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── AUTH ───────────────────────────────────────────────────────
export const signUp = async (email, password, name) => {
  try {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    if (data.user) {
      await ensureUserRow(data.user.id, email, name);
    }
    return data;
  } catch (e) {
    throw new Error('Sign up failed: ' + e.message);
  }
};

export const signIn = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (data.user) {
      await ensureUserRow(data.user.id, email);
    }
    return data;
  } catch (e) {
    throw new Error('Sign in failed: ' + e.message);
  }
};

export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  } catch (e) {
    throw new Error('Sign out failed: ' + e.message);
  }
};

export const getSession = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  } catch (e) {
    return null;
  }
};

// ─── USER ────────────────────────────────────────────────────────
export const ensureUserRow = async (uid, email, name = '') => {
  try {
    const { data: existing } = await supabase.from('users').select('id').eq('id', uid).single();
    if (!existing) {
      const referralCode = 'CD' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const { error } = await supabase.from('users').insert({
        id: uid,
        email,
        name: name || email.split('@')[0],
        coins: 0,
        gems: 0,
        current_level: 1,
        gems_this_level: 0,
        offer_gate_open: false,
        referral_code: referralCode,
      });
      if (error) throw new Error(error.message);
    }
  } catch (e) {
    // User row may already exist — not fatal
  }
};

export const getUser = async (uid) => {
  try {
    const { data, error } = await supabase.from('users').select('*').eq('id', uid).single();
    if (error) throw new Error(error.message);
    return data;
  } catch (e) {
    throw new Error('Get user failed: ' + e.message);
  }
};

export const updateUser = async (uid, updates) => {
  try {
    const { data, error } = await supabase.from('users').update(updates).eq('id', uid).select().single();
    if (error) throw new Error(error.message);
    return data;
  } catch (e) {
    throw new Error('Update user failed: ' + e.message);
  }
};

export const incrementCoins = async (uid, amount) => {
  try {
    const { error } = await supabase.rpc('increment_coins', { uid, amount });
    if (error) throw new Error(error.message);
  } catch (e) {
    throw new Error('Increment coins failed: ' + e.message);
  }
};

export const incrementGems = async (uid, amount) => {
  try {
    const { error } = await supabase.rpc('increment_gems', { uid, amount });
    if (error) throw new Error(error.message);
  } catch (e) {
    throw new Error('Increment gems failed: ' + e.message);
  }
};

export const openOfferGate = async (uid) => {
  try {
    const { error } = await supabase.rpc('open_offer_gate', { uid });
    if (error) throw new Error(error.message);
  } catch (e) {
    throw new Error('Open offer gate failed: ' + e.message);
  }
};

export const advanceLevel = async (uid, nextLevel) => {
  try {
    const { error } = await supabase.rpc('advance_level', { uid, next_level: nextLevel });
    if (error) throw new Error(error.message);
  } catch (e) {
    throw new Error('Advance level failed: ' + e.message);
  }
};

export const deductCoins = async (uid, amount) => {
  try {
    const user = await getUser(uid);
    const newCoins = Math.max(0, user.coins - amount);
    const { error } = await supabase.from('users').update({ coins: newCoins }).eq('id', uid);
    if (error) throw new Error(error.message);
    return newCoins;
  } catch (e) {
    throw new Error('Deduct coins failed: ' + e.message);
  }
};

// ─── STREAKS ─────────────────────────────────────────────────────
export const getStreak = async (uid) => {
  try {
    const { data, error } = await supabase.from('user_streaks').select('*').eq('user_id', uid).single();
    if (error && error.code === 'PGRST116') return null; // not found
    if (error) throw new Error(error.message);
    return data;
  } catch (e) {
    throw new Error('Get streak failed: ' + e.message);
  }
};

export const upsertStreak = async (uid, updates) => {
  try {
    const { data, error } = await supabase
      .from('user_streaks')
      .upsert({ user_id: uid, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  } catch (e) {
    throw new Error('Upsert streak failed: ' + e.message);
  }
};

// ─── OFFERS ──────────────────────────────────────────────────────
export const insertOffer = async (offerData) => {
  try {
    const { data, error } = await supabase.from('offer_history').insert(offerData).select().single();
    if (error) throw new Error(error.message);
    return data;
  } catch (e) {
    throw new Error('Insert offer failed: ' + e.message);
  }
};

export const getOffers = async (uid) => {
  try {
    const { data, error } = await supabase
      .from('offer_history')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  } catch (e) {
    throw new Error('Get offers failed: ' + e.message);
  }
};

// ─── WITHDRAWALS ─────────────────────────────────────────────────
export const insertWithdrawal = async (withdrawalData) => {
  try {
    const { data, error } = await supabase.from('withdrawals').insert(withdrawalData).select().single();
    if (error) throw new Error(error.message);
    return data;
  } catch (e) {
    throw new Error('Insert withdrawal failed: ' + e.message);
  }
};

export const getWithdrawals = async (uid) => {
  try {
    const { data, error } = await supabase
      .from('withdrawals')
      .select('*')
      .eq('user_id', uid)
      .order('requested_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  } catch (e) {
    throw new Error('Get withdrawals failed: ' + e.message);
  }
};

// ─── TASKS ───────────────────────────────────────────────────────
export const getTasks = async () => {
  try {
    const { data, error } = await supabase.from('tasks').select('*').eq('is_active', true);
    if (error) throw new Error(error.message);
    return data;
  } catch (e) {
    throw new Error('Get tasks failed: ' + e.message);
  }
};

// ─── REFERRALS ───────────────────────────────────────────────────
export const getReferrals = async (uid) => {
  try {
    const { data, error } = await supabase
      .from('referrals')
      .select('*, referred:referred_id(name, email)')
      .eq('referrer_id', uid)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  } catch (e) {
    throw new Error('Get referrals failed: ' + e.message);
  }
};

export const applyReferralCode = async (uid, referralCode) => {
  try {
    // Find referrer by code
    const { data: referrer, error: findErr } = await supabase
      .from('users')
      .select('id')
      .eq('referral_code', referralCode.toUpperCase())
      .single();
    if (findErr || !referrer) throw new Error('Invalid referral code');
    if (referrer.id === uid) throw new Error('Cannot use your own referral code');

    // Check not already referred
    const { data: existing } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_id', uid)
      .single();
    if (existing) throw new Error('You have already used a referral code');

    // Insert referral
    const { error: refErr } = await supabase.from('referrals').insert({
      referrer_id: referrer.id,
      referred_id: uid,
      bonus_paid: false,
      coins_awarded: 50,
    });
    if (refErr) throw new Error(refErr.message);

    // Update referred_by on user
    await supabase.from('users').update({ referred_by: referrer.id }).eq('id', uid);

    // Give bonus coins to referrer
    await incrementCoins(referrer.id, 50);

    return true;
  } catch (e) {
    throw new Error(e.message);
  }
};

// ─── LEADERBOARD ─────────────────────────────────────────────────
// Ranked by daily_coins (resets at midnight) per v4 spec
export const getLeaderboard = async (limit = 50) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, coins, daily_coins, current_level')
      .order('daily_coins', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data;
  } catch (e) {
    throw new Error('Get leaderboard failed: ' + e.message);
  }
};

// ─── REFERRAL COUNT ───────────────────────────────────────────────
export const getReferralCount = async (uid) => {
  try {
    const { count, error } = await supabase
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('referrer_id', uid);
    if (error) throw new Error(error.message);
    return count ?? 0;
  } catch (e) {
    return 0;
  }
};
