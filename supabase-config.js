const SUPABASE_URL = 'https://zoqsgvgbmxrkemcwxwus.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcXNndmdibXhya2VtY3d4d3VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3ODc5NTAsImV4cCI6MjA4MTM2Mzk1MH0.Nj2xXSphPHXROxaVf_hYw_iqFgnXU1r-GzFHMet9YMk';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcXNndmdibXhya2VtY3d4d3VzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTc4Nzk1MCwiZXhwIjoyMDgxMzYzOTUwfQ.hxIxYP66EhjZyjU_DYquUjci_qYmCATNFkwA3s22ZJU';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
});
const supabaseAdmin = window.supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ==================== توابع اصلی ====================
async function signUpUser(email, password, fullName) {
    try {
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: { data: { full_name: fullName } }
        });
        if (authError) throw authError;

        const { error: dbError } = await supabaseAdmin.from('users').insert([{
            id: authData.user.id, email: email, full_name: fullName,
            referral_code: 'REF-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
            is_admin: email === 'hamyarhf@gmail.com', created_at: new Date().toISOString()
        }]);
        if (dbError) throw dbError;

        // ایجاد اطلاعات اولیه بازی
        await supabaseAdmin.from('user_profiles').insert([{
            user_id: authData.user.id, user_level: 1, mining_power: 10,
            total_mined: 1000000, last_active: new Date().toISOString()
        }]);
        await supabaseAdmin.from('user_balances').insert([{
            user_id: authData.user.id, sod_balance: 1000000,
            usdt_balance: 0, last_update: new Date().toISOString()
        }]);
        await supabaseAdmin.from('transactions').insert([{
            user_id: authData.user.id, transaction_type: 'registration_bonus',
            amount: 1000000, currency: 'SOD', description: 'هدیه ثبت‌نام',
            created_at: new Date().toISOString()
        }]);

        return { success: true, user: authData.user };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function signInUser(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: 'ایمیل یا رمز عبور نادرست است' };
    return { success: true, user: data.user };
}

async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

async function recordMining(userId, amount) {
    try {
        const { data: balance } = await supabase.from('user_balances')
            .select('sod_balance').eq('user_id', userId).single();
        const newBalance = balance.sod_balance + amount;

        await supabase.from('user_balances')
            .update({ sod_balance: newBalance }).eq('user_id', userId);

        await supabase.from('transactions').insert([{
            user_id: userId, transaction_type: 'mining', amount: amount,
            currency: 'SOD', description: 'استخراج دستی',
            created_at: new Date().toISOString()
        }]);

        // آپدیت فعالیت روزانه
        const today = new Date().toISOString().split('T')[0];
        const { data: activity } = await supabase.from('daily_activities')
            .select('mined_today').eq('user_id', userId).eq('activity_date', today).single();

        if (activity) {
            await supabase.from('daily_activities').update({
                mined_today: activity.mined_today + amount
            }).eq('user_id', userId).eq('activity_date', today);
        }

        return { success: true, newBalance };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function getUserGameData(userId) {
    try {
        const { data, error } = await supabase.from('user_balances')
            .select('*').eq('user_id', userId).single();
        if (error) throw error;
        return data;
    } catch (error) {
        return null;
    }
}

async function getUserFullProfile(userId) {
    try {
        const { data, error } = await supabase.from('users')
            .select('*, user_profiles(*), user_balances(*)')
            .eq('id', userId).single();
        if (error) throw error;
        return data;
    } catch (error) {
        return null;
    }
}

window.SupabaseAPI = {
    supabase, supabaseAdmin, signUpUser, signInUser,
    getCurrentUser, recordMining, getUserGameData, getUserFullProfile
};
console.log('✅ SupabaseAPI آماده است');
