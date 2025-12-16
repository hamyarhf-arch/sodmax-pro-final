class DatabaseManager {
    constructor() { this.userData = null; this.gameData = { sodBalance: 0, usdtBalance: 0 }; }
    
    async init() {
        try {
            const user = await SupabaseAPI.getCurrentUser();
            if (user) {
                const data = await SupabaseAPI.getUserGameData(user.id);
                if (data) {
                    this.gameData.sodBalance = data.sod_balance;
                    this.gameData.usdtBalance = data.usdt_balance;
                }
                this.userData = { id: user.id, email: user.email };
            }
            return true;
        } catch (error) {
            console.error('خطا در راه‌اندازی:', error);
            return false;
        }
    }
    
    async processMining() {
        if (!this.userData) { alert('لطفا ابتدا وارد شوید.'); return false; }
        const result = await SupabaseAPI.recordMining(this.userData.id, 100);
        if (result.success) {
            this.gameData.sodBalance = result.newBalance;
            return true;
        }
        return false;
    }
    
    getSOD() { return this.gameData.sodBalance; }
    getUSDT() { return this.gameData.usdtBalance; }
}
window.DB = new DatabaseManager();
