-- توابع مورد نیاز برای SODmAX Pro
-- این توابع را در SQL Editor اجرا کنید

-- 1. افزایش موجودی SOD
CREATE OR REPLACE FUNCTION increment_sod_balance(
    user_id UUID,
    amount BIGINT
)
RETURNS VOID AS $$
BEGIN
    UPDATE user_balances
    SET 
        sod_balance = sod_balance + amount,
        last_update = NOW()
    WHERE user_id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. افزایش کل استخراج شده
CREATE OR REPLACE FUNCTION increment_total_mined(
    user_id UUID,
    amount BIGINT
)
RETURNS VOID AS $$
BEGIN
    UPDATE user_profiles
    SET 
        total_mined = total_mined + amount,
        last_active = NOW()
    WHERE user_id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. افزایش قدرت استخراج
CREATE OR REPLACE FUNCTION increment_mining_power(
    user_id UUID,
    amount INTEGER
)
RETURNS VOID AS $$
BEGIN
    UPDATE user_profiles
    SET mining_power = mining_power + amount
    WHERE user_id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. تبدیل SOD به USDT
CREATE OR REPLACE FUNCTION convert_sod_to_usdt(
    user_id_param UUID,
    sod_amount_param BIGINT
)
RETURNS VOID AS $$
DECLARE
    usdt_amount DECIMAL(10,4);
    current_balance BIGINT;
BEGIN
    -- محاسبه مقدار USDT
    usdt_amount := (sod_amount_param / 10000000.0) * 0.01;
    
    -- بررسی موجودی کافی
    SELECT sod_balance INTO current_balance
    FROM user_balances
    WHERE user_id = user_id_param;
    
    IF current_balance < sod_amount_param THEN
        RAISE EXCEPTION 'موجودی SOD کافی نیست';
    END IF;
    
    -- آپدیت موجودی
    UPDATE user_balances
    SET 
        sod_balance = sod_balance - sod_amount_param,
        usdt_balance = usdt_balance + usdt_amount,
        last_update = NOW()
    WHERE user_id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. دریافت اطلاعات کاربر
CREATE OR REPLACE FUNCTION get_user_summary(user_id_param UUID)
RETURNS TABLE (
    email TEXT,
    full_name TEXT,
    user_level INTEGER,
    mining_power INTEGER,
    total_mined BIGINT,
    sod_balance BIGINT,
    usdt_balance DECIMAL(10,4),
    mined_today BIGINT,
    last_active TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.email,
        u.full_name,
        COALESCE(up.user_level, 1) as user_level,
        COALESCE(up.mining_power, 10) as mining_power,
        COALESCE(up.total_mined, 0) as total_mined,
        COALESCE(ub.sod_balance, 0) as sod_balance,
        COALESCE(ub.usdt_balance, 0) as usdt_balance,
        COALESCE(da.mined_today, 0) as mined_today,
        COALESCE(up.last_active, NOW()) as last_active
    FROM users u
    LEFT JOIN user_profiles up ON u.id = up.user_id
    LEFT JOIN user_balances ub ON u.id = ub.user_id
    LEFT JOIN daily_activities da ON u.id = da.user_id 
        AND da.activity_date = CURRENT_DATE
    WHERE u.id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
