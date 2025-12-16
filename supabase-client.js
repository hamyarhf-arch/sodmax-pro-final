// =============================================
// فایل اتصال به Supabase - SODmAX Pro
// =============================================

// 1. ابتدا مطمئن شوید این پکیج‌ها را نصب کرده‌اید:
// npm install @supabase/supabase-js

import { createClient } from '@supabase/supabase-js'

// 2. این اطلاعات را از داشبورد Supabase بگیرید:
const supabaseUrl = 'https://your-project-id.supabase.co' // URL پروژه شما
const supabaseAnonKey = 'your-anon-key-here' // کلید Anon Public

// 3. ایجاد کلاینت
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// =============================================
// توابع اصلی برای SODmAX
// =============================================

// 🔐 ثبت نام کاربر جدید
export async function registerUser(email, password, fullName) {
    try {
        // ثبت نام در سیستم احراز هویت Supabase
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        })

        if (authError) throw authError
        
        // ایجاد پروفایل کاربر در جدول users
        const { error: profileError } = await supabase
            .from('users')
            .insert([
                {
                    id: authData.user.id,
                    email: email,
                    full_name: fullName,
                    referral_code: generateReferralCode()
                }
            ])

        if (profileError) throw profileError

        return {
            success: true,
            user: authData.user,
            message: 'ثبت‌نام با موفقیت انجام شد'
        }

    } catch (error) {
        return {
            success: false,
            error: error.message
        }
    }
}

// 🔑 ورود کاربر
export async function loginUser(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        })

        if (error) throw error

        return {
            success: true,
            user: data.user,
            message: 'ورود موفقیت‌آمیز بود'
        }

    } catch (error) {
        return {
            success: false,
            error: error.message
        }
    }
}

// 👤 دریافت اطلاعات کاربر فعلی
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
            .select('sod_balance, usdt_balance')
            .eq('user_id', userId)
            .single()

        if (error) throw error

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

// ⛏️ ثبت استخراج جدید
export async function recordMining(userId, minedAmount) {
    try {
        const today = new Date().toISOString().split('T')[0]
        
        // 1. آپدیت موجودی SOD
        const { error: balanceError } = await supabase.rpc('increment_sod_balance', {
            user_id: userId,
            amount: minedAmount
        })

        if (balanceError) throw balanceError

        // 2. آپدیت فعالیت روزانه
        const { error: activityError } = await supabase
            .from('daily_activities')
            .upsert({
                user_id: userId,
                activity_date: today,
                mined_today: minedAmount,
                clicks_today: 1
            }, {
                onConflict: 'user_id,activity_date'
            })

        if (activityError) throw activityError

        // 3. ثبت تراکنش
        const { error: transactionError } = await supabase
            .from('transactions')
            .insert({
                user_id: userId,
                transaction_type: 'mining',
                amount: minedAmount,
                currency: 'SOD',
                description: `استخراج ${minedAmount.toLocaleString()} SOD`
            })

        if (transactionError) throw transactionError

        // 4. آپدیت پروفایل
        const { error: profileError } = await supabase.rpc('increment_total_mined', {
            user_id: userId,
            amount: minedAmount
        })

        if (profileError) throw profileError

        return {
            success: true,
            message: `استخراج ${minedAmount} SOD ثبت شد`
        }

    } catch (error) {
        return {
            success: false,
            error: error.message
        }
    }
}

// 🛒 خرید پنل SOD
export async function purchaseSODPlan(userId, planId) {
    try {
        // 1. دریافت اطلاعات پنل
        const { data: plan, error: planError } = await supabase
            .from('sale_plans')
            .select('*')
            .eq('id', planId)
            .single()

        if (planError) throw planError

        if (!plan.is_active) {
            throw new Error('این پنل غیرفعال است')
        }

        const totalSOD = plan.sod_amount + plan.bonus_sod

        // 2. ثبت خرید
        const { error: purchaseError } = await supabase
            .from('user_purchases')
            .insert({
                user_id: userId,
                plan_id: planId,
                payment_amount: plan.price_usdt,
                received_sod: totalSOD,
                payment_status: 'completed'
            })

        if (purchaseError) throw purchaseError

        // 3. افزایش موجودی SOD
        const { error: balanceError } = await supabase.rpc('increment_sod_balance', {
            user_id: userId,
            amount: totalSOD
        })

        if (balanceError) throw balanceError

        // 4. افزایش قدرت استخراج (اگر پنل شامل باشد)
        if (plan.mining_power_bonus > 0) {
            const { error: powerError } = await supabase.rpc('increment_mining_power', {
                user_id: userId,
                amount: plan.mining_power_bonus
            })

            if (powerError) throw powerError
        }

        // 5. ثبت تراکنش
        const { error: transactionError } = await supabase
            .from('transactions')
            .insert({
                user_id: userId,
                transaction_type: 'sod_purchase',
                amount: totalSOD,
                currency: 'SOD',
                description: `خرید پنل ${plan.plan_name} - ${totalSOD.toLocaleString()} SOD`
            })

        if (transactionError) throw transactionError

        return {
            success: true,
            message: `پنل ${plan.plan_name} با موفقیت خریداری شد`,
            sod_received: totalSOD
        }

    } catch (error) {
        return {
            success: false,
            error: error.message
        }
    }
}

// 💵 دریافت پاداش USDT
export async function claimUSDT(userId, sodAmount) {
    try {
        // نرخ تبدیل: 10,000,000 SOD = 0.01 USDT
        const usdtAmount = (sodAmount / 10000000) * 0.01

        // 1. کسر SOD و اضافه کردن USDT
        const { error: balanceError } = await supabase.rpc('convert_sod_to_usdt', {
            user_id_param: userId,
            sod_amount_param: sodAmount
        })

        if (balanceError) throw balanceError

        // 2. ثبت پاداش
        const { error: rewardError } = await supabase
            .from('usdt_rewards')
            .insert({
                user_id: userId,
                sod_amount: sodAmount,
                usdt_amount: usdtAmount,
                reward_date: new Date().toISOString().split('T')[0],
                claimed_at: new Date().toISOString(),
                status: 'claimed'
            })

        if (rewardError) throw rewardError

        // 3. ثبت تراکنش
        const { error: transactionError } = await supabase
            .from('transactions')
            .insert({
                user_id: userId,
                transaction_type: 'usdt_reward',
                amount: usdtAmount,
                currency: 'USDT',
                description: `پاداش USDT برای ${sodAmount.toLocaleString()} SOD`
            })

        if (transactionError) throw transactionError

        return {
            success: true,
            message: `${usdtAmount.toFixed(4)} USDT دریافت شد`,
            usdt_earned: usdtAmount
        }

    } catch (error) {
        return {
            success: false,
            error: error.message
        }
    }
}

// 📊 دریافت تراکنش‌های کاربر
export async function getUserTransactions(userId, limit = 20) {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) throw error

        return {
            success: true,
            transactions: data
        }

    } catch (error) {
        return {
            success: false,
            error: error.message
        }
    }
}

// 🏆 دریافت لیدربرد روزانه
export async function getDailyLeaderboard(limit = 50) {
    try {
        const { data, error } = await supabase
            .from('daily_activities')
            .select(`
                mined_today,
                user:users(full_name, user_profiles(user_level))
            `)
            .eq('activity_date', new Date().toISOString().split('T')[0])
            .order('mined_today', { ascending: false })
            .limit(limit)

        if (error) throw error

        return {
            success: true,
            leaderboard: data
        }

    } catch (error) {
        return {
            success: false,
            error: error.message
        }
    }
}

// 🔧 توابع کمکی
function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return `REF${code}`
}

// 📤 خروج از حساب
export async function logoutUser() {
    const { error } = await supabase.auth.signOut()
    if (error) {
        console.error('خطا در خروج:', error)
        return false
    }
    return true
}

// =============================================
// اکسپورت کلاینت Supabase برای استفاده مستقیم
// =============================================
export { supabase }
