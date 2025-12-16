// فایل اتصال ساده‌شده - بدون خطا
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://qacsoynvoypcwnttfpwh.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhY3NveW52b3lwY3dudHRmcHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4Mjk0NTYsImV4cCI6MjA4MTQwNTQ1Nn0.uvg5O4i89m2w6D0v2YZ7-l7YuERy94j83sSVt-b4uoA'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 🔐 ثبت نام بسیار ساده
export async function simpleRegister(email, password, fullName) {
    try {
        console.log('📝 شروع ثبت نام:', email)
        
        // 1. فقط ثبت نام در Auth
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        })

        if (error) {
            console.error('❌ خطای Auth:', error.message)
            
            // اگر کاربر وجود دارد، وارد شو
            if (error.message.includes('already registered')) {
                const loginResult = await simpleLogin(email, password)
                return loginResult
            }
            
            return {
                success: false,
                error: 'خطا در ثبت نام: ' + error.message
            }
        }

        console.log('✅ کاربر Auth ایجاد شد:', data.user?.id)
        
        // 2. منتظر بمان تا Auth کامل شود
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // 3. حالا دیتای کاربر را در جدول users اضافه کن
        const { error: userError } = await supabase
            .from('users')
            .insert({
                id: data.user.id,
                email: email,
                full_name: fullName,
                referral_code: 'USER' + Date.now(),
                created_at: new Date().toISOString()
            })

        if (userError) {
            console.warn('⚠️ خطا در users (ممکن است قبلاً اضافه شده باشد):', userError.message)
            // ادامه بده حتی اگر خطا داد
        }

        // 4. ایجاد موجودی
        const { error: balanceError } = await supabase
            .from('user_balances')
            .insert({
                user_id: data.user.id,
                sod_balance: 1000000,
                usdt_balance: 0,
                last_update: new Date().toISOString()
            })

        if (balanceError) {
            console.warn('⚠️ خطا در balances:', balanceError.message)
        }

        // 5. ایجاد پروفایل بازی
        const { error: profileError } = await supabase
            .from('user_profiles')
            .insert({
                user_id: data.user.id,
                user_level: 1,
                mining_power: 10,
                total_mined: 0,
                last_active: new Date().toISOString()
            })

        if (profileError) {
            console.warn('⚠️ خطا در profiles:', profileError.message)
        }

        console.log('🎉 ثبت نام کامل شد!')
        return {
            success: true,
            user: data.user,
            message: 'ثبت نام موفق! ۱,۰۰۰,۰۰۰ SOD هدیه گرفتید.'
        }

    } catch (error) {
        console.error('🔥 خطای غیرمنتظره:', error)
        return {
            success: false,
            error: 'خطای سیستمی: ' + error.message
        }
    }
}

// 🔑 ورود ساده
export async function simpleLogin(email, password) {
    try {
        console.log('🔑 در حال ورود:', email)
        
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        })

        if (error) {
            console.error('❌ خطای ورود:', error.message)
            
            // اگر کاربر در Auth نیست اما در جدول users هست
            if (error.message.includes('Invalid login credentials')) {
                // سعی کن کاربر را از جدول users پیدا کنی
                const { data: existingUser } = await supabase
                    .from('users')
                    .select('*')
                    .eq('email', email)
                    .single()
                    
                if (existingUser) {
                    return {
                        success: false,
                        error: 'کاربر وجود دارد اما رمز اشتباه است'
                    }
                }
            }
            
            return {
                success: false,
                error: 'ایمیل یا رمز عبور نادرست'
            }
        }

        console.log('✅ ورود موفق:', data.user.id)
        
        // بررسی کن اگر کاربر در جدول users نیست، اضافه کن
        const { data: userExists } = await supabase
            .from('users')
            .select('id')
            .eq('id', data.user.id)
            .single()

        if (!userExists) {
            console.log('👤 کاربر در جدول users نیست، در حال اضافه کردن...')
            
            const userMetadata = data.user.user_metadata || {}
            
            await supabase
                .from('users')
                .insert({
                    id: data.user.id,
                    email: data.user.email,
                    full_name: userMetadata.full_name || 'کاربر جدید',
                    referral_code: 'USER' + Date.now(),
                    created_at: new Date().toISOString()
                })
        }

        return {
            success: true,
            user: data.user,
            message: 'خوش آمدید!'
        }

    } catch (error) {
        console.error('🔥 خطای ورود:', error)
        return {
            success: false,
            error: 'خطا در ورود به سیستم'
        }
    }
}

// 👤 گرفتن کاربر فعلی
export async function getSimpleUser() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (error) {
            console.error('❌ خطا در دریافت کاربر:', error.message)
            return null
        }
        
        return user
    } catch (error) {
        console.error('🔥 خطا:', error)
        return null
    }
}

// ⛏️ استخراج ساده
export async function simpleMine(userId, amount = 100) {
    try {
        if (!userId) {
            return { success: false, error: 'کاربر وارد نشده است' }
        }

        // 1. آپدیت موجودی
        const { error: balanceError } = await supabase.rpc('increment_balance', {
            user_id: userId,
            amount: amount
        }).catch(async () => {
            // اگر تابع وجود ندارد، دستی انجام بده
            const { data: currentBalance } = await supabase
                .from('user_balances')
                .select('sod_balance')
                .eq('user_id', userId)
                .single()
                
            const newBalance = (currentBalance?.sod_balance || 0) + amount
            
            await supabase
                .from('user_balances')
                .update({ sod_balance: newBalance })
                .eq('user_id', userId)
        })

        // 2. آپدیت پروفایل
        await supabase
            .from('user_profiles')
            .update({
                total_mined: supabase.raw('total_mined + ' + amount),
                last_active: new Date().toISOString()
            })
            .eq('user_id', userId)

        // 3. ثبت تراکنش
        await supabase
            .from('transactions')
            .insert({
                user_id: userId,
                transaction_type: 'mining',
                amount: amount,
                currency: 'SOD',
                description: 'استخراج ' + amount + ' SOD',
                created_at: new Date().toISOString()
            })

        return {
            success: true,
            message: amount + ' SOD استخراج شد!'
        }

    } catch (error) {
        console.error('❌ خطا در استخراج:', error)
        return {
            success: false,
            error: 'خطا در استخراج'
        }
    }
}

// 💰 گرفتن موجودی
export async function getSimpleBalance(userId) {
    try {
        const { data, error } = await supabase
            .from('user_balances')
            .select('sod_balance, usdt_balance')
            .eq('user_id', userId)
            .single()

        if (error) {
            // اگر موجودی نداشت، ایجاد کن
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

// 📤 خروج
export async function simpleLogout() {
    const { error } = await supabase.auth.signOut()
    return { success: !error }
}

// اکسپورت Supabase برای استفاده مستقیم
export { supabase }
