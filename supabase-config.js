// supabase-config.js
const SUPABASE_URL = 'https://zoqsgvgbmxrkemcwxwus.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcXNndmdibXhya2VtY3d4d3VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3ODc5NTAsImV4cCI6MjA4MTM2Mzk1MH0.Nj2xXSphPHXROxaVf_hYw_iqFgnXU1r-GzFHMet9YMk';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcXNndmdibXhya2VtY3d4d3VzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTc4Nzk1MCwiZXhwIjoyMDgxMzYzOTUwfQ.hxIxYP66EhjZyjU_DYquUjci_qYmCATNFkwA3s22ZJU';

// ایجاد کلاینت Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

// کلاینت ادمین
const supabaseAdmin = window.supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('✅ Supabase Client Initialized');

// ==================== توابع اصلی ====================

// تابع برای ایجاد کاربر جدید (ثبت نام)
async function signUpUser(email, password, fullName) {
    try {
        console.log('🔄 Starting signup for:', email);
        
        // 1. ایجاد کاربر در احراز هویت
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });
        
        if (authError) {
            console.error('❌ Auth Error:', authError.message);
            return { success: false, error: authError.message };
        }
        
        console.log('✅ Auth created, creating database records...');
        
        // 2. ایجاد رکورد در جدول users
        const { error: userError } = await supabaseAdmin
            .from('users')
            .insert([{
                id: authData.user.id,
                email: email,
                full_name: fullName,
                referral_code: generateReferralCode(),
                is_admin: email === 'hamyarhf@gmail.com',
                created_at: new Date().toISOString()
            }]);
        
        if (userError) {
            console.error('❌ User creation error:', userError.message);
            return { success: false, error: 'خطا در ایجاد پروفایل کاربر' };
        }
        
        console.log('✅ User created, setting up game data...');
        
        // 3. ایجاد اطلاعات اولیه بازی
        await setupInitialGameData(authData.user.id);
        
        console.log('🎉 Signup completed successfully!');
        
        return {
            success: true,
            user: authData.user,
            message: `ثبت نام موفق! خوش آمدید ${fullName}. 1,000,000 SOD هدیه دریافت کردید.`
        };
        
    } catch (error) {
        console.error('🔥 Unexpected error in signUpUser:', error);
        return { 
            success: false, 
            error: 'خطای سیستمی. لطفاً دوباره تلاش کنید.' 
        };
    }
}

// تابع ایجاد اطلاعات اولیه بازی
async function setupInitialGameData(userId) {
    try {
        console.log('🔄 Setting up game data for user:', userId);
        
        // 1. ایجاد پروفایل بازی
        const { error: profileError } = await supabaseAdmin
            .from('user_profiles')
            .insert([{
                user_id: userId,
                user_level: 1,
                mining_power: 10,
                total_mined: 1000000,
                last_active: new Date().toISOString()
            }]);
        
        if (profileError) throw profileError;
        
        // 2. ایجاد موجودی
        const { error: balanceError } = await supabaseAdmin
            .from('user_balances')
            .insert([{
                user_id: userId,
                sod_balance: 1000000,
                usdt_balance: 0.00,
                last_update: new Date().toISOString()
            }]);
        
        if (balanceError) throw balanceError;
        
        // 3. ثبت تراکنش هدیه
        const { error: transactionError } = await supabaseAdmin
            .from('transactions')
            .insert([{
                user_id: userId,
                transaction_type: 'registration_bonus',
                amount: 1000000,
                currency: 'SOD',
                description: 'هدیه ثبت نام در SODmAX Pro',
                created_at: new Date().toISOString()
            }]);
        
        if (transactionError) throw transactionError;
        
        // 4. ایجاد رکورد فعالیت روزانه
        const today = new Date().toISOString().split('T')[0];
        const { error: activityError } = await supabaseAdmin
            .from('daily_activities')
            .insert([{
                user_id: userId,
                activity_date: today,
                mined_today: 0,
                clicks_today: 0
            }]);
        
        if (activityError) throw activityError;
        
        console.log('✅ Game data setup completed');
        return { success: true };
        
    } catch (error) {
        console.error('❌ Error setting up game data:', error.message);
        return { success: false, error: error.message };
    }
}

// تابع ورود کاربر
async function signInUser(email, password) {
    try {
        console.log('🔄 Attempting sign in for:', email);
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            console.error('❌ Sign in error:', error.message);
            return { 
                success: false, 
                error: 'ایمیل یا رمز عبور نادرست است. لطفاً بررسی کنید.' 
            };
        }
        
        console.log('✅ Sign in successful');
        
        // آپدیت زمان آخرین فعالیت
        await updateLastActive(data.user.id);
        
        return {
            success: true,
            user: data.user,
            message: 'ورود موفق! به SODmAX Pro خوش آمدید.'
        };
        
    } catch (error) {
        console.error('🔥 Unexpected sign in error:', error);
        return { 
            success: false, 
            error: 'خطا در ارتباط با سرور. لطفاً دوباره تلاش کنید.' 
        };
    }
}

// تابع آپدیت آخرین فعالیت
async function updateLastActive(userId) {
    try {
        const { error } = await supabaseAdmin
            .from('user_profiles')
            .update({ last_active: new Date().toISOString() })
            .eq('user_id', userId);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Error updating last active:', error);
        return false;
    }
}

// تابع دریافت کاربر جاری
async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
            return null;
        }
        return user;
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
}

// تابع خروج کاربر
async function signOutUser() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        return { success: true };
    } catch (error) {
        console.error('Sign out error:', error);
        return { success: false, error: error.message };
    }
}

// تابع ثبت استخراج
async function recordMining(userId, amount) {
    try {
        console.log(`⛏️ Recording mining: ${amount} SOD for user: ${userId}`);
        
        // 1. دریافت موجودی فعلی
        const { data: currentBalance, error: fetchError } = await supabase
            .from('user_balances')
            .select('sod_balance')
            .eq('user_id', userId)
            .single();
        
        if (fetchError) throw fetchError;
        
        // 2. محاسبه موجودی جدید
        const newBalance = currentBalance.sod_balance + amount;
        
        // 3. آپدیت موجودی
        const { error: updateError } = await supabase
            .from('user_balances')
            .update({
                sod_balance: newBalance,
                last_update: new Date().toISOString()
            })
            .eq('user_id', userId);
        
        if (updateError) throw updateError;
        
        // 4. آپدیت کل استخراج در پروفایل
        const { error: profileError } = await supabase
            .from('user_profiles')
            .update({
                total_mined: supabase.raw('total_mined + ' + amount)
            })
            .eq('user_id', userId);
        
        if (profileError) throw profileError;
        
        // 5. ثبت تراکنش
        const { error: txError } = await supabase
            .from('transactions')
            .insert([{
                user_id: userId,
                transaction_type: 'mining',
                amount: amount,
                currency: 'SOD',
                description: 'استخراج دستی',
                created_at: new Date().toISOString()
            }]);
        
        if (txError) throw txError;
        
        // 6. آپدیت فعالیت روزانه
        const today = new Date().toISOString().split('T')[0];
        const { data: activityData } = await supabase
            .from('daily_activities')
            .select('mined_today')
            .eq('user_id', userId)
            .eq('activity_date', today)
            .single();
        
        if (activityData) {
            await supabase
                .from('daily_activities')
                .update({
                    mined_today: activityData.mined_today + amount,
                    clicks_today: supabase.raw('clicks_today + 1')
                })
                .eq('user_id', userId)
                .eq('activity_date', today);
        }
        
        console.log(`✅ Mining recorded successfully. New balance: ${newBalance}`);
        
        return { 
            success: true, 
            newBalance: newBalance,
            message: `+${amount} SOD به موجودی شما اضافه شد!`
        };
        
    } catch (error) {
        console.error('❌ Error recording mining:', error);
        return { 
            success: false, 
            error: 'خطا در ثبت استخراج. لطفاً دوباره تلاش کنید.' 
        };
    }
}

// تابع دریافت اطلاعات بازی کاربر
async function getUserGameData(userId) {
    try {
        console.log('🔄 Fetching game data for user:', userId);
        
        const { data, error } = await supabase
            .from('user_balances')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        if (error) {
            console.error('❌ Error fetching game data:', error.message);
            return null;
        }
        
        console.log('✅ Game data fetched successfully');
        return data;
        
    } catch (error) {
        console.error('🔥 Unexpected error in getUserGameData:', error);
        return null;
    }
}

// تابع دریافت پروفایل کامل کاربر
async function getUserFullProfile(userId) {
    try {
        const { data, error } = await supabase
            .from('users')
            .select(`
                *,
                user_profiles(*),
                user_balances(*)
            `)
            .eq('id', userId)
            .single();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error getting user profile:', error);
        return null;
    }
}

// تابع تولید کد ارجاع
function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return 'REF-' + code;
}

// صادر کردن توابع برای استفاده در صفحات دیگر
window.SupabaseAPI = {
    supabase,
    supabaseAdmin,
    signUpUser,
    signInUser,
    getCurrentUser,
    getUserGameData,
    getUserFullProfile,
    signOutUser,
    recordMining,
    updateLastActive
};

console.log('🎯 SODmAX Pro Supabase API Ready!');
