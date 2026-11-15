// ============================================================
// 🕌 ميزاني — نظام تتبع الصلوات الخمس للأطفال
// جزء من تطبيق «البطل المسلم» (bustan-alazkar)
// ============================================================

const SALAWAT = [
  { id: 'fajr',    name: 'الفجر',  icon: '🌅', color: '#38bdf8', rewardHome: 2, rewardMosque: 5 },
  { id: 'dhuhr',   name: 'الظهر',  icon: '☀️', color: '#fbbf24', rewardHome: 2, rewardMosque: 5 },
  { id: 'asr',     name: 'العصر',  icon: '🌤️', color: '#f97316', rewardHome: 2, rewardMosque: 5 },
  { id: 'maghrib', name: 'المغرب', icon: '🌇', color: '#ec4899', rewardHome: 2, rewardMosque: 5 },
  { id: 'isha',    name: 'العشاء', icon: '🌙', color: '#6366f1', rewardHome: 2, rewardMosque: 5 }
];

const SALAWAT_BADGES = [
  { id: 'first_salah',   icon: '🌟', name: 'أول صلاة',     desc: 'سجّلت أول صلاة لك!',              check: (st) => (st.stats.totalMosque + st.stats.totalHome) >= 1,  coins: 5  },
  { id: 'fajr_7',        icon: '🌙', name: 'بطل الفجر',    desc: 'صليت الفجر 7 مرات!',              check: (st) => st.stats.totalFajr >= 7,                           coins: 15 },
  { id: 'mosque_10',     icon: '🕌', name: 'محبّ المسجد',  desc: '10 صلوات في المسجد!',             check: (st) => st.stats.totalMosque >= 10,                         coins: 20 },
  { id: 'perfect_day_1', icon: '💫', name: 'يوم مثالي',    desc: 'الصلوات الخمس كاملة في يوم واحد!', check: (st) => st.stats.perfectDays >= 1,                          coins: 10 },
  { id: 'perfect_week',  icon: '👑', name: 'بطل الأسبوع',  desc: '7 أيام كاملة متتالية!',           check: (st) => st.stats.longestStreak >= 7,                        coins: 25 },
  { id: 'streak_30',     icon: '🔥', name: 'سلسلة 30 يوم', desc: 'مداومة 30 يوماً متتالياً!',       check: (st) => st.stats.longestStreak >= 30,                       coins: 50 },
  { id: 'mosque_50',     icon: '🏛️', name: 'ابن المسجد',   desc: '50 صلاة في المسجد!',             check: (st) => st.stats.totalMosque >= 50,                         coins: 50 },
  { id: 'money_100',     icon: '💰', name: 'الكنز الصغير', desc: 'جمعت 100 جنيه في ميزانك!',       check: (st) => st.pocketMoney >= 100,                              coins: 0  }
];

const SALAWAT_STORAGE_KEY = 'bustan_salawat_state';
const FAJR_BONUS = 1;
const PERFECT_DAY_BONUS = 5;
const PERFECT_WEEK_BONUS = 20;

class SalawatTracker {
  constructor(appController) {
    this.app = appController;
    this.state = this._loadState();
  }

  // ========== تحميل وحفظ البيانات ==========
  _defaultState() {
    return {
      pocketMoney: 0,
      history: {},
      badges: [],
      stats: {
        totalMosque: 0,
        totalHome: 0,
        totalFajr: 0,
        perfectDays: 0,
        currentStreak: 0,
        longestStreak: 0
      }
    };
  }

  _loadState() {
    try {
      const raw = localStorage.getItem(SALAWAT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return Object.assign(this._defaultState(), parsed);
      }
    } catch(e) {
      console.warn('Error loading salawat state:', e);
    }
    return this._defaultState();
  }

  _saveState() {
    try {
      localStorage.setItem(SALAWAT_STORAGE_KEY, JSON.stringify(this.state));
    } catch(e) {
      console.warn('Error saving salawat state:', e);
    }
  }

  // ========== مساعدات التاريخ ==========
  _today() {
    return new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
  }

  _getOrCreateTodayRecord() {
    const today = this._today();
    if (!this.state.history[today]) {
      this.state.history[today] = {
        fajr:    { done: false, place: null },
        dhuhr:   { done: false, place: null },
        asr:     { done: false, place: null },
        maghrib: { done: false, place: null },
        isha:    { done: false, place: null }
      };
    }
    return this.state.history[today];
  }

  _getLast7Days() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      days.push({ key, record: this.state.history[key] || null });
    }
    return days;
  }

  // ========== المنطق الأساسي ==========
  getTodayRecord() {
    return this._getOrCreateTodayRecord();
  }

  isSalahDone(salahId) {
    const rec = this._getOrCreateTodayRecord();
    return rec[salahId] && rec[salahId].done;
  }

  recordSalah(salahId, place) {
    // place = 'mosque' أو 'home'
    const rec = this._getOrCreateTodayRecord();

    if (rec[salahId] && rec[salahId].done) return null;

    const salah = SALAWAT.find(s => s.id === salahId);
    if (!salah) return null;

    const reward = place === 'mosque' ? salah.rewardMosque : salah.rewardHome;
    const isFajrBonus = (salahId === 'fajr');
    const totalReward = reward + (isFajrBonus ? FAJR_BONUS : 0);

    rec[salahId] = { done: true, place };

    this.state.pocketMoney += totalReward;
    if (place === 'mosque') {
      this.state.stats.totalMosque++;
    } else {
      this.state.stats.totalHome++;
    }
    if (salahId === 'fajr') {
      this.state.stats.totalFajr++;
    }

    // إضافة للحسنات العامة في التطبيق أيضاً
    if (this.app && this.app.state) {
      this.app.state.coins = (this.app.state.coins || 0) + totalReward;
    }

    const perfectDay = this._checkPerfectDay();
    if (perfectDay) {
      this.state.pocketMoney += PERFECT_DAY_BONUS;
      if (this.app && this.app.state) {
        this.app.state.coins += PERFECT_DAY_BONUS;
      }
      this.state.stats.perfectDays++;
      this._updateStreak();
    }

    const perfectWeek = this._checkPerfectWeek();
    if (perfectWeek) {
      this.state.pocketMoney += PERFECT_WEEK_BONUS;
      if (this.app && this.app.state) {
        this.app.state.coins += PERFECT_WEEK_BONUS;
      }
    }

    const newBadges = this._checkBadges();

    this._saveState();
    if (this.app && typeof this.app.saveState === 'function') {
      this.app.saveState();
    }

    return {
      salah,
      place,
      reward: totalReward,
      isFajrBonus,
      perfectDay,
      perfectWeek,
      newBadges,
      totalPocketMoney: this.state.pocketMoney
    };
  }

  _checkPerfectDay() {
    const rec = this._getOrCreateTodayRecord();
    return SALAWAT.every(s => rec[s.id] && rec[s.id].done);
  }

  _checkPerfectWeek() {
    const days = this._getLast7Days();
    return days.length === 7 && days.every(d => {
      if (!d.record) return false;
      return SALAWAT.every(s => d.record[s.id] && d.record[s.id].done);
    });
  }

  _updateStreak() {
    this.state.stats.currentStreak++;
    if (this.state.stats.currentStreak > this.state.stats.longestStreak) {
      this.state.stats.longestStreak = this.state.stats.currentStreak;
    }
  }

  _checkBadges() {
    const newBadges = [];
    SALAWAT_BADGES.forEach(badge => {
      if (!this.state.badges.includes(badge.id) && badge.check(this.state)) {
        this.state.badges.push(badge.id);
        if (badge.coins > 0) {
          this.state.pocketMoney += badge.coins;
          if (this.app && this.app.state) {
            this.app.state.coins += badge.coins;
          }
        }
        newBadges.push(badge);
      }
    });
    return newBadges;
  }

  // ========== للقراءة (UI) ==========
  getTodayCoins() {
    const rec = this._getOrCreateTodayRecord();
    let total = 0;
    SALAWAT.forEach(s => {
      if (rec[s.id] && rec[s.id].done) {
        total += (rec[s.id].place === 'mosque' ? s.rewardMosque : s.rewardHome);
        if (s.id === 'fajr') total += FAJR_BONUS;
      }
    });
    return total;
  }

  getTodayCount() {
    const rec = this._getOrCreateTodayRecord();
    return SALAWAT.filter(s => rec[s.id] && rec[s.id].done).length;
  }

  getPocketMoney() {
    return this.state.pocketMoney;
  }

  getBadges() {
    return SALAWAT_BADGES.map(b => ({
      ...b,
      earned: this.state.badges.includes(b.id)
    }));
  }

  getWeeklyStats() {
    return this._getLast7Days();
  }

  getStats() {
    return this.state.stats;
  }
}
