// database-manager.js
class DatabaseManager {
    constructor() {
        this.userData = null;
        this.gameData = {
            sodBalance: 0,
            usdtBalance: 0,
            userLevel: 1,
            miningPower: 10,
            todayEarnings: 0,
            totalMined: 0
        };
        this.isInitialized = false;
    }
    
    // راه‌اندازی اولیه
    async init() {
        try {
            console.log('🔄 Initializing DatabaseManager...');
            
            // بررسی وضعیت احراز هویت
            const user = await SupabaseAPI.getCurrentUser();
            
            if (user) {
                // کاربر لاگین کرده
                await this.loadUserData(user.id);
                console.log('✅ User is logged in:', user.email);
            } else {
                // کاربر لاگین نکرده
                console.log('ℹ️ No user logged in');
            }
            
            this.isInitialized = true;
            console.log('✅ DatabaseManager initialized successfully');
            return true;
            
        } catch (error) {
            console.error('❌ DatabaseManager initialization failed:', error);
            this.isInitialized = false;
            return false;
        }
    }
    
    // بارگذاری اطلاعات کاربر
    async loadUserData(userId) {
        try {
            console.log('🔄 Loading user data for:', userId);
            
            // دریافت اطلاعات کامل کاربر
            const fullProfile = await SupabaseAPI.getUserFullProfile(userId);
            
            if (fullProfile) {
                this.userData = {
                    id: fullProfile.id,
                    email: fullProfile.email,
                    fullName: fullProfile.full_name,
                    isAdmin: fullProfile.is_admin || false,
                    referralCode: fullProfile.referral_code,
                    registerDate: fullProfile.created_at
                };
                
                // بارگذاری اطلاعات بازی
                if (fullProfile.user_balances && fullProfile.user_balances.length > 0) {
                    this.gameData.sodBalance = fullProfile.user_balances[0].sod_balance || 0;
                    this.gameData.usdtBalance = fullProfile.user_balances[0].usdt_balance || 0;
                }
                
                if (fullProfile.user_profiles && fullProfile.user_profiles.length > 0) {
                    this.gameData.userLevel = fullProfile.user_profiles[0].user_level || 1;
                    this.gameData.miningPower = fullProfile.user_profiles[0].mining_power || 10;
                    this.gameData.totalMined = fullProfile.user_profiles[0].total_mined || 0;
                }
                
                // دریافت فعالیت امروز
                const today = new Date().toISOString().split('T')[0];
                const { data: todayActivity } = await SupabaseAPI.supabase
                    .from('daily_activities')
                    .select('mined_today')
                    .eq('user_id', userId)
                    .eq('activity_date', today)
                    .single();
                
                this.gameData.todayEarnings = todayActivity?.mined_today || 0;
                
                console.log('✅ User data loaded successfully');
                return true;
            }
            
            return false;
            
        } catch (error) {
            console.error('❌ Error loading user data:', error);
            return false;
        }
    }
    
    // پردازش کلیک استخراج
    async processMiningClick() {
        if (!this.userData) {
            console.warn('⚠️ No user data available for mining');
            return { 
                success: false, 
                error: 'لطفاً ابتدا وارد شوید یا ثبت نام کنید.' 
            };
        }
        
        const user = await SupabaseAPI.getCurrentUser();
        if (!user) {
            return { 
                success: false, 
                error: 'جلسه شما منقضی شده. لطفاً دوباره وارد شوید.' 
            };
        }
        
        // محاسبه مقدار استخراج (بر اساس قدرت استخراج)
        const amount = this.gameData.miningPower;
        
        // ثبت استخراج در دیتابیس
        const result = await SupabaseAPI.recordMining(user.id, amount);
        
        if (result.success) {
            // آپدیت داده‌های محلی
            this.gameData.sodBalance = result.newBalance;
            this.gameData.totalMined += amount;
            this.gameData.todayEarnings += amount;
            
            // آپدیت زمان آخرین فعالیت
            await SupabaseAPI.updateLastActive(user.id);
            
            console.log('✅ Mining click processed successfully');
        }
        
        return result;
    }
    
    // تابع بررسی پاداش USDT
    async checkUSDT() {
        if (!this.userData) return { earned: 0 };
        
        const exchangeRate = 10000000; // 10 میلیون SOD = 0.01 USDT
        
        if (this.gameData.sodBalance >= exchangeRate) {
            const usdtEarned = 0.01;
            const sodUsed = exchangeRate;
            
            // آپدیت موجودی‌ها در دیتابیس
            const user = await SupabaseAPI.getCurrentUser();
            if (user) {
                try {
                    // آپدیت موجودی SOD
                    await SupabaseAPI.supabase
                        .from('user_balances')
                        .update({
                            sod_balance: this.gameData.sodBalance - sodUsed,
                            usdt_balance: SupabaseAPI.supabase.raw('usdt_balance + ' + usdtEarned)
                        })
                        .eq('user_id', user.id);
                    
                    // ثبت تراکنش USDT
                    await SupabaseAPI.supabase
                        .from('transactions')
                        .insert([{
                            user_id: user.id,
                            transaction_type: 'usdt_reward',
                            amount: usdtEarned,
                            currency: 'USDT',
                            description: `پاداش USDT برای ${this.formatNumber(sodUsed)} SOD`,
                            created_at: new Date().toISOString()
                        }]);
                    
                    // آپدیت داده‌های محلی
                    this.gameData.sodBalance -= sodUsed;
                    this.gameData.usdtBalance += usdtEarned;
                    
                    console.log('✅ USDT reward processed:', usdtEarned);
                    
                    return { 
                        earned: usdtEarned,
                        sodUsed: sodUsed,
                        success: true 
                    };
                    
                } catch (error) {
                    console.error('❌ Error processing USDT reward:', error);
                    return { earned: 0, error: error.message };
                }
            }
        }
        
        return { earned: 0 };
    }
    
    // دریافت موجودی SOD
    getSODBalance() {
        return this.gameData.sodBalance || 0;
    }
    
    // دریافت موجودی USDT
    getUSDTBalance() {
        return this.gameData.usdtBalance || 0;
    }
    
    // دریافت سطح کاربر
    getUserLevel() {
        return this.gameData.userLevel || 1;
    }
    
    // دریافت قدرت استخراج
    getMiningPower() {
        return this.gameData.miningPower || 10;
    }
    
    // دریافت درآمد امروز
    getTodayEarnings() {
        return this.gameData.todayEarnings || 0;
    }
    
    // دریافت کل استخراج
    getTotalMined() {
        return this.gameData.totalMined || 0;
    }
    
    // بررسی آیا کاربر ادمین است
    isUserAdmin() {
        return this.userData?.isAdmin || false;
    }
    
    // فرمت اعداد
    formatNumber(num) {
        if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return Math.floor(num).toString();
    }
    
    // ریست داده‌ها (برای خروج)
    reset() {
        this.userData = null;
        this.gameData = {
            sodBalance: 0,
            usdtBalance: 0,
            userLevel: 1,
            miningPower: 10,
            todayEarnings: 0,
            totalMined: 0
        };
        console.log('✅ DatabaseManager data reset');
    }
}

// ایجاد یک نمونه جهانی از DatabaseManager
window.DB = new DatabaseManager();

console.log('🎯 SODmAX Pro DatabaseManager Ready!');
