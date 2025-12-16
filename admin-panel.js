// admin-panel.js
class AdminPanel {
    constructor() {
        this.supabase = window.supabase.createClient(
            'https://zoqsgvgbmxrkemcwxwus.supabase.co',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcXNndmdibXhya2VtY3d4d3VzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTc4Nzk1MCwiZXhwIjoyMDgxMzYzOTUwfQ.hxIxYP66EhjZyjU_DYquUjci_qYmCATNFkwA3s22ZJU'
        );
    }

    async getAllUsers() {
        const { data, error } = await this.supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) {
            console.error('خطا در دریافت کاربران:', error);
            return [];
        }
        return data;
    }

    async updateUserBalance(userId, sodChange) {
        const { data: current } = await this.supabase
            .from('user_balances')
            .select('sod_balance')
            .eq('user_id', userId)
            .single();

        const newBalance = (current?.sod_balance || 0) + sodChange;

        const { error } = await this.supabase
            .from('user_balances')
            .update({ sod_balance: newBalance })
            .eq('user_id', userId);

        return !error;
    }

    async getSystemStats() {
        const { count: userCount } = await this.supabase
            .from('users')
            .select('*', { count: 'exact', head: true });

        const { data: balances } = await this.supabase
            .from('user_balances')
            .select('sod_balance, usdt_balance');

        let totalSOD = 0, totalUSDT = 0;
        balances.forEach(b => {
            totalSOD += b.sod_balance || 0;
            totalUSDT += b.usdt_balance || 0;
        });

        return { userCount, totalSOD, totalUSDT };
    }
}

window.AdminPanel = new AdminPanel();
