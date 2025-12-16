// =============================================
// فایل اتصال به Supabase - SODmAX Pro
// آدرس پروژه: https://qacsoynvoypcwnttfpwh.supabase.co
// =============================================

import { createClient } from '@supabase/supabase-js'

// تنظیمات Supabase با اطلاعات شما
const supabaseUrl = 'https://qacsoynvoypcwnttfpwh.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhY3NveW52b3lwY3dudHRmcHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4Mjk0NTYsImV4cCI6MjA4MTQwNTQ1Nn0.uvg5O4i89m2w6D0v2YZ7-l7YuERy94j83sSVt-b4uoA'

// ایجاد کلاینت
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// =============================================
// توابع اصلی برای SODmAX
// =============================================

// 🔐 ثبت نام کاربر جدید
export async function registerUser(email, password, fullName) {
    try {
        console.log('🔄 در حال ثبت نام کاربر:', email)
        
        // 1. ثبت نام در احراز هویت
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName,
                    created_at: new Date().toISOString()
                }
            }
        })

        if (authError) {
            console.error('❌ خطا در ثبت نام Auth:', authError.message)
            // اگر کاربر قبلاً ثبت نام کرده، واردش کن
            if (authError.message.includes('already registered')) {
                const loginResult = await loginUser(email, password)
                return loginResult
            }
            throw authError
        }

        console.log('✅ ثبت نام Auth موفق:', authData.user?.id)

        // 2. ایجاد پروفایل در جدول users (با شرط عدم وجود)
        const { error: profileError } = await supabase
            .from('users')
            .upsert({
                id: authData.user.id,
                email: email,
                full_name: fullName,
                referral_code: 'REF' + Math.random().toString(36).substr(2, 8).toUpperCase(),
                created_at: new Date().toISOString()
            }, {
                onConflict: 'id',
                ignoreDuplicates: true
            })

        if (profileError && !profileError.message.includes('duplicate key')) {
            console.error('❌ خطا در ایجاد پروفایل:', profileError.message)
            throw profileError
        }

        // 3. ایجاد موجودی اولیه (1,000,000 SOD)
        const { error: balanceError } = await supabase
            .from('user_balances')
            .upsert({
                user_id: authData.user.id,
                sod_balance: 1000000,
                usdt_balance: 0,
                last_update: new Date().toISOString()
            }, {
                onConflict: 'user_id',
                ignoreDuplicates: true
            })

        if (balanceError && !balanceError.message.includes('duplicate key')) {
            console.error('❌ خطا در ایجاد موجودی:', balanceError.message)
            throw balanceError
        }

        // 4. ایجاد پروفایل بازی
        const { error: gameProfileError } = await supabase
            .from('user_profiles')
            .upsert({
                user_id: authData.user.id,
                user_level: 1,
                mining_power: 10,
                total_mined: 0,
                last_active: new Date().toISOString()
            }, {
                onConflict: 'user_id',
                ignoreDuplicates: true
            })

        if (gameProfileError && !gameProfileError.message.includes('duplicate key')) {
            console.error('❌ خطا در ایجاد پروفایل بازی:', gameProfileError.message)
            throw gameProfileError
        }

        // 5. ثبت تراکنش هدیه ثبت نام
        await supabase
            .from('transactions')
            .insert({
                user_id: authData.user.id,
                transaction_type: 'registration_bonus',
                amount: 1000000,
                currency: 'SOD',
                description: 'هدیه ۱,۰۰۰,۰۰۰ SOD برای ثبت نام',
                created_at: new Date().toISOString()
            })

        console.log('🎉 ثبت نام کامل موفق')
        return {
            success: true,
            user: authData.user,
            message: 'ثبت‌نام موفق! ۱,۰۰۰,۰۰۰ SOD هدیه دریافت کردید.'
        }

    } catch (error) {
        console.error('🔥 خطای کلی ثبت نام:', error)
        return {
            success: false,
            error: error.message || 'خطای ناشناخته در ثبت نام'
        }
    }
}

// 🔑 ورود کاربر
export async function loginUser(email, password) {
    try {
        console.log('🔄 در حال ورود کاربر:', email)
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        })

        if (error) throw error

        console.log('✅ ورود موفق:', data.user.id)
        return {
            success: true,
            user: data.user,
            message: 'خوش آمدید!'
        }

    } catch (error) {
        console.error('❌ خطا در ورود:', error.message)
        return {
            success: false,
            error: 'ایمیل یا رمز عبور نادرست است'
        }
    }
}

// 👤 دریافت کاربر فعلی
export async function getCurrentUser() {
    try {
        const { data: { user } } = await supabase.auth.getUser()
        return user
    } catch (error) {
        console.error('خطا در دریافت کاربر:', error)
        return null
    }
}

// 💰 دریافت موجودی کاربر
export async function getUserBalance(userId) {
    try {
        const { data, error } = await supabase
            .from('user_balances')
            .select('*')
            .eq('user_id', userId)
            .single()

        if (error) {
            // اگر رکورد موجودی وجود نداشت، ایجاد کن
            if (error.code === 'PGRST116') {
                await supabase
                    .from('user_balances')
                    .insert({
                        user_id: userId,
                        sod_balance: 1000000,
                        usdt_balance: 0,
                        last_update: new Date().toISOString()
                    })
                return {
                    success: true,
                    balance: { sod_balance: 1000000, usdt_balance: 0 }
                }
            }
            throw error
        }

        return {
            success: true,
            balance: data
        }

    } catch (error) {
        return {
            success: false,
            error: error.message
        }
    }
}

// ⛏️ ثبت استخراج جدید (بهینه‌شده)
export async function recordMining(userId, minedAmount) {
    try {
        console.log(`⛏️ ثبت استخراج برای کاربر ${userId}: ${minedAmount} SOD`)
        
        const today = new Date().toISOString().split('T')[0]
        
        // 1. دریافت قدرت استخراج کاربر
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('mining_power')
            .eq('user_id', userId)
            .single()

        if (profileError) throw profileError

        // 2. آپدیت موجودی SOD
        const { error: balanceError } = await supabase.rpc('increment_sod_balance', {
            user_id: userId,
            amount: minedAmount
        })

        if (balanceError) {
            // اگر تابع وجود ندارد، دستی آپدیت کن
            await supabase
                .from('user_balances')
                .update({
                    sod_balance: supabase.raw('sod_balance + ' + minedAmount),
                    last_update: new Date().toISOString()
                })
                .eq('user_id', userId)
        }

        // 3. آپدیت فعالیت روزانه
        const { error: activityError } = await supabase
            .from('daily_activities')
            .upsert({
                user_id: userId,
                activity_date: today,
                mined_today: supabase.raw('COALESCE(mined_today, 0) + ' + minedAmount),
                clicks_today: supabase.raw('COALESCE(clicks_today, 0) + 1')
            }, {
                onConflict: 'user_id,activity_date'
            })

        if (activityError) throw activityError

        // 4. آپدیت پروفایل (کل استخراج)
        await supabase
            .from('user_profiles')
            .update({
                total_mined: supabase.raw('COALESCE(total_mined, 0) + ' + minedAmount),
                last_active: new Date().toISOString()
            })
            .eq('user_id', userId)

        // 5. ثبت تراکنش
        await supabase
            .from('transactions')
            .insert({
                user_id: userId,
                transaction_type: 'mining',
                amount: minedAmount,
                currency: 'SOD',
                description: `استخراج ${minedAmount.toLocaleString('fa-IR')} SOD`,
                created_at: new Date().toISOString()
            })

        // 6. ثبت لاگ استخراج
        await supabase
            .from('mining_logs')
            .insert({
                user_id: userId,
                mined_amount: minedAmount,
                mining_power: profile.mining_power,
                created_at: new Date().toISOString()
            })

        console.log('✅ استخراج ثبت شد')
        return {
            success: true,
            message: `+${minedAmount.toLocaleString('fa-IR')} SOD استخراج شد`,
            mined_amount: minedAmount
        }

    } catch (error) {
        console.error('❌ خطا در ثبت استخراج:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

// 🛒 خرید پنل SOD (ساده‌شده)
export async function purchaseSODPlan(userId, planId) {
    try {
        console.log(`🛒 خرید پنل ${planId} توسط کاربر ${userId}`)
        
        // اطلاعات پنل‌ها (مستقیم از کد JS شما)
        const plans = {
            1: { name: 'پنل استارتر', sod: 5000000, bonus: 500000, price: 1, power: 5 },
            2: { name: 'پنل پرو', sod: 30000000, bonus: 3000000, price: 5, power: 15, featured: true },
            3: { name: 'پنل پلاتینیوم', sod: 100000000, bonus: 10000000, price: 15, power: 30 }
        }

        const plan = plans[planId]
        if (!plan) throw new Error('پنل مورد نظر یافت نشد')

        const totalSOD = plan.sod + plan.bonus

        // 1. ثبت خرید
        await supabase
            .from('user_purchases')
            .insert({
                user_id: userId,
                plan_id: planId,
                payment_amount: plan.price,
                received_sod: totalSOD,
                payment_status: 'completed',
                created_at: new Date().toISOString()
            })

        // 2. افزایش موجودی
        await supabase
            .from('user_balances')
            .update({
                sod_balance: supabase.raw('sod_balance + ' + totalSOD),
                last_update: new Date().toISOString()
            })
            .eq('user_id', userId)

        // 3. افزایش قدرت استخراج
        if (plan.power > 0) {
            await supabase
                .from('user_profiles')
                .update({
                    mining_power: supabase.raw('mining_power + ' + plan.power)
                })
                .eq('user_id', userId)
        }

        // 4. ثبت تراکنش
        await supabase
            .from('transactions')
            .insert({
                user_id: userId,
                transaction_type: 'sod_purchase',
                amount: totalSOD,
                currency: 'SOD',
                description: `خرید ${plan.name} - ${totalSOD.toLocaleString('fa-IR')} SOD`,
                created_at: new Date().toISOString()
            })

        console.log('✅ خرید ثبت شد')
        return {
            success: true,
            message: `پنل ${plan.name} خریداری شد! ${totalSOD.toLocaleString('fa-IR')} SOD دریافت کردید.`,
            sod_received: totalSOD,
            power_bonus: plan.power
        }

    } catch (error) {
        console.error('❌ خطا در خرید:', error)
        return {
            success: false,
            error: 'خطا در خرید پنل'
        }
    }
}

// 💵 دریافت پاداش USDT
export async function claimUSDT(userId, sodAmount = 10000000) {
    try {
        console.log(`💰 درخواست USDT برای کاربر ${userId}: ${sodAmount} SOD`)
        
        // نرخ تبدیل
        const usdtAmount = (sodAmount / 10000000) * 0.01
        
        // 1. بررسی موجودی کافی
        const { data: balance, error: balanceCheckError } = await supabase
            .from('user_balances')
            .select('sod_balance')
            .eq('user_id', userId)
            .single()

        if (balanceCheckError) throw balanceCheckError

        if (balance.sod_balance < sodAmount) {
            throw new Error(`موجودی SOD کافی نیست. نیاز: ${sodAmount.toLocaleString('fa-IR')}، موجود: ${balance.sod_balance.toLocaleString('fa-IR')}`)
        }

        // 2. آپدیت موجودی‌ها
        await supabase
            .from('user_balances')
            .update({
                sod_balance: supabase.raw('sod_balance - ' + sodAmount),
                usdt_balance: supabase.raw('usdt_balance + ' + usdtAmount),
                last_update: new Date().toISOString()
            })
            .eq('user_id', userId)

        // 3. ثبت پاداش USDT
        await supabase
            .from('usdt_rewards')
            .insert({
                user_id: userId,
                sod_amount: sodAmount,
                usdt_amount: usdtAmount,
                reward_date: new Date().toISOString().split('T')[0],
                claimed_at: new Date().toISOString(),
                status: 'claimed'
            })

        // 4. ثبت تراکنش
        await supabase
            .from('transactions')
            .insert({
                user_id: userId,
                transaction_type: 'usdt_reward',
                amount: usdtAmount,
                currency: 'USDT',
                description: `پاداش USDT برای ${sodAmount.toLocaleString('fa-IR')} SOD`,
                created_at: new Date().toISOString()
            })

        console.log('✅ USDT پرداخت شد')
        return {
            success: true,
            message: `${usdtAmount.toFixed(4)} USDT دریافت کردید!`,
            usdt_earned: usdtAmount,
            sod_used: sodAmount
        }

    } catch (error) {
        console.error('❌ خطا در دریافت USDT:', error)
        return {
            success: false,
            error: error.message
        }
    }
}

// 📊 دریافت اطلاعات کاربر
export async function getUserData(userId) {
    try {
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', userId)
            .single()

        if (profileError && !profileError.message.includes('No rows found')) {
            throw profileError
        }

        const { data: balance, error: balanceError } = await supabase
            .from('user_balances')
            .select('*')
            .eq('user_id', userId)
            .single()

        if (balanceError && !balanceError.message.includes('No rows found')) {
            throw balanceError
        }

        // فعالیت امروز
        const today = new Date().toISOString().split('T')[0]
        const { data: todayActivity } = await supabase
            .from('daily_activities')
            .select('mined_today, clicks_today')
            .eq('user_id', userId)
            .eq('activity_date', today)
            .single()

        // تراکنش‌های اخیر
        const { data: recentTransactions } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10)

        return {
            success: true,
            data: {
                profile: profile || { user_level: 1, mining_power: 10, total_mined: 0 },
                balance: balance || { sod_balance: 1000000, usdt_balance: 0 },
                today: todayActivity || { mined_today: 0, clicks_today: 0 },
                transactions: recentTransactions || []
            }
        }

    } catch (error) {
        return {
            success: false,
            error: error.message
        }
    }
}

// 🏆 دریافت لیدربرد
export async function getLeaderboard(limit = 20) {
    try {
        const today = new Date().toISOString().split('T')[0]
        
        const { data, error } = await supabase
            .from('daily_activities')
            .select(`
                mined_today,
                user:users(full_name)
            `)
            .eq('activity_date', today)
            .order('mined_today', { ascending: false })
            .limit(limit)

        if (error) throw error

        return {
            success: true,
            leaderboard: data.map((item, index) => ({
                rank: index + 1,
                name: item.user?.full_name || 'کاربر ناشناس',
                mined: item.mined_today
            }))
        }

    } catch (error) {
        return {
            success: false,
            error: error.message
        }
    }
}

// 🔧 توابع کمکی
export function formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B'
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toLocaleString('fa-IR')
}

// 📤 خروج از حساب
export async function logoutUser() {
    try {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
        return { success: true, message: 'با موفقیت خارج شدید' }
    } catch (error) {
        return { success: false, error: error.message }
    }
}

// =============================================
// فایل SQL برای ایجاد توابع دیتابیس
// =============================================
const databaseFunctionsSQL = `
-- 🔧 توابع دیتابیس SODmAX Pro
-- در SQL Editor کپی کنید

-- 1. افزایش موجودی SOD
CREATE OR REPLACE FUNCTION increment_sod_balance(user_id UUID, amount BIGINT)
RETURNS VOID AS $$
BEGIN
    UPDATE user_balances 
    SET sod_balance = sod_balance + amount, 
        last_update = NOW() 
    WHERE user_id = user_id;
END;
$$ LANGUAGE plpgsql;

-- 2. افزایش قدرت استخراج
CREATE OR REPLACE FUNCTION increment_mining_power(user_id UUID, amount INT)
RETURNS VOID AS $$
BEGIN
    UPDATE user_profiles 
    SET mining_power = mining_power + amount 
    WHERE user_id = user_id;
END;
$$ LANGUAGE plpgsql;

-- 3. دریافت خلاصه کاربر
CREATE OR REPLACE FUNCTION get_user_summary(user_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'profile', jsonb_build_object(
            'user_level', COALESCE(up.user_level, 1),
            'mining_power', COALESCE(up.mining_power, 10),
            'total_mined', COALESCE(up.total_mined, 0)
        ),
        'balance', jsonb_build_object(
            'sod_balance', COALESCE(ub.sod_balance, 1000000),
            'usdt_balance', COALESCE(ub.usdt_balance, 0)
        ),
        'today', jsonb_build_object(
            'mined_today', COALESCE(da.mined_today, 0),
            'clicks_today', COALESCE(da.clicks_today, 0)
        )
    ) INTO result
    FROM users u
    LEFT JOIN user_profiles up ON u.id = up.user_id
    LEFT JOIN user_balances ub ON u.id = ub.user_id
    LEFT JOIN daily_activities da ON u.id = da.user_id 
        AND da.activity_date = CURRENT_DATE
    WHERE u.id = user_id;
    
    RETURN COALESCE(result, '{"error": "کاربر یافت نشد"}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- 4. جدول‌های اصلی (اگر وجود ندارند)
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    referral_code TEXT UNIQUE,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    user_level INT DEFAULT 1,
    mining_power INT DEFAULT 10,
    total_mined BIGINT DEFAULT 0,
    last_active TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_balances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    sod_balance BIGINT DEFAULT 1000000,
    usdt_balance DECIMAL(10,4) DEFAULT 0,
    last_update TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL,
    amount DECIMAL(20,4) NOT NULL,
    currency TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    activity_date DATE DEFAULT CURRENT_DATE,
    mined_today BIGINT DEFAULT 0,
    clicks_today INT DEFAULT 0,
    UNIQUE(user_id, activity_date)
);

CREATE TABLE IF NOT EXISTS sale_plans (
    id SERIAL PRIMARY KEY,
    plan_name VARCHAR(100) NOT NULL,
    price_usdt DECIMAL(10,2) NOT NULL,
    sod_amount BIGINT NOT NULL,
    bonus_sod BIGINT DEFAULT 0,
    mining_power_bonus INT DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. درج پنل‌های پیش‌فرض
INSERT INTO sale_plans (plan_name, price_usdt, sod_amount, bonus_sod, mining_power_bonus, is_featured, sort_order) 
VALUES 
    ('پنل استارتر', 1.00, 5000000, 500000, 5, false, 1),
    ('پنل پرو', 5.00, 30000000, 3000000, 15, true, 2),
    ('پنل پلاتینیوم', 15.00, 100000000, 10000000, 30, false, 3)
ON CONFLICT DO NOTHING;

-- 6. فعال کردن RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activities ENABLE ROW LEVEL SECURITY;

-- 7. پالیسی‌های امنیتی
CREATE POLICY "Users can view own data" ON users FOR SELECT USING (auth.uid() = id OR is_admin = true);
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own balance" ON user_balances FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own activities" ON daily_activities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "All users can view sale plans" ON sale_plans FOR SELECT USING (true);

SELECT '✅ دیتابیس SODmAX Pro آماده شد!' as message;
`

// اکسپورت کلاینت Supabase
export { supabase }

// اکسپورت SQL برای اجرا در Supabase
export { databaseFunctionsSQL }
