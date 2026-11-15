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

const DEFAULT_SALAWAT_SETTINGS = {
  currencyName: 'جنيه',
  rewardMosque: 5,
  rewardHome: 2,
  bonusFajr: 1,
  bonusPerfectDay: 5,
  bonusPerfectWeek: 20
};

class SalawatTracker {
  constructor(appController) {
    this.app = appController;
    this.state = this._loadState();
  }

  getSettings() {
    if (this.app && this.app.rewardsSettings) {
      return this.app.rewardsSettings;
    }
    return DEFAULT_SALAWAT_SETTINGS;
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

  // ========== مساعدات التاريخ والأسابيع ==========
  _today() {
    return new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
  }

  _getOrCreateTodayRecord() {
    return this.getOrCreateDateRecord(this._today());
  }

  getOrCreateDateRecord(dateKey) {
    if (!this.state.history[dateKey]) {
      this.state.history[dateKey] = {
        fajr:    { done: false, missed: false, place: null },
        dhuhr:   { done: false, missed: false, place: null },
        asr:     { done: false, missed: false, place: null },
        maghrib: { done: false, missed: false, place: null },
        isha:    { done: false, missed: false, place: null }
      };
    }
    return this.state.history[dateKey];
  }

  // حساب الأيام السبعة لأسبوع محدد (يبدأ من السبت وينتهي بالجمعة)
  getWeekSchedule(weekOffset = 0) {
    const now = new Date();
    // إزاحة الأسابيع
    now.setDate(now.getDate() + (weekOffset * 7));

    // في التقويم الإسلامي والعربي يبدأ الأسبوع يوم السبت
    // في JS: الأحد = 0، الإثنين = 1، ...، السبت = 6
    const jsDay = now.getDay();
    const dayFromSaturday = (jsDay + 1) % 7; // السبت = 0، الأحد = 1، ...، الجمعة = 6

    const saturday = new Date(now);
    saturday.setDate(now.getDate() - dayFromSaturday);

    const weekDays = [];
    const dayNames = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const todayStr = this._today();

    const settings = this.getSettings();
    const rMosque = Number(settings.rewardMosque ?? 5);
    const rHome = Number(settings.rewardHome ?? 2);
    const bFajr = Number(settings.bonusFajr ?? 1);

    let weekMosqueCount = 0;
    let weekHomeCount = 0;
    let weekMissedCount = 0;
    let weekCoins = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(saturday);
      d.setDate(saturday.getDate() + i);
      const dateKey = d.toISOString().split('T')[0];

      const isToday = (dateKey === todayStr);
      const isPast = (dateKey < todayStr);
      const isFuture = (dateKey > todayStr);

      const record = this.state.history[dateKey] || null;

      // حساب حالة كل صلاة من الصلوات الخمس في هذا اليوم
      const prayersStatus = {};
      SALAWAT.forEach(salah => {
        const entry = record ? record[salah.id] : null;
        const extraFajr = (salah.id === 'fajr') ? bFajr : 0;

        if (entry && entry.done) {
          const place = entry.place || 'home';
          const rew = (place === 'mosque' ? rMosque : rHome) + extraFajr;
          prayersStatus[salah.id] = {
            status: 'done',
            place,
            icon: place === 'mosque' ? '✅ 🕌' : '✅ 🏠',
            badgeText: place === 'mosque' ? 'مسجد' : 'بيت',
            reward: rew,
            text: place === 'mosque' ? 'صليت بالمسجد' : 'صليت بالبيت'
          };
          if (place === 'mosque') weekMosqueCount++;
          else weekHomeCount++;
          weekCoins += rew;
        } else if (entry && entry.missed) {
          prayersStatus[salah.id] = {
            status: 'missed',
            place: null,
            icon: '❌',
            badgeText: 'لم تُصلَّ',
            reward: 0,
            text: 'لم تُصلَّ'
          };
          weekMissedCount++;
        } else if (isPast) {
          // يوم ماضي انتهى بدون تسجيل الصلاة = علامة خطأ (فائتة)
          prayersStatus[salah.id] = {
            status: 'missed',
            place: null,
            icon: '❌',
            badgeText: 'لم تُصلَّ',
            reward: 0,
            text: 'فاتت الصلاة'
          };
          weekMissedCount++;
        } else if (isToday) {
          prayersStatus[salah.id] = {
            status: 'pending',
            place: null,
            icon: '➕',
            badgeText: 'سجّل الآن',
            reward: 0,
            text: 'اضغط للتسجيل'
          };
        } else {
          // يوم قادم
          prayersStatus[salah.id] = {
            status: 'future',
            place: null,
            icon: '⏳',
            badgeText: 'قادمة',
            reward: 0,
            text: 'في انتظار وقتها'
          };
        }
      });

      weekDays.push({
        date: d,
        dateKey,
        dayName: dayNames[i],
        dayNumber: d.getDate(),
        monthName: monthNames[d.getMonth()],
        isToday,
        isPast,
        isFuture,
        prayers: prayersStatus
      });
    }

    const firstDay = weekDays[0];
    const lastDay = weekDays[6];
    const rangeLabel = `${firstDay.dayName} ${firstDay.dayNumber} ${firstDay.monthName} — ${lastDay.dayName} ${lastDay.dayNumber} ${lastDay.monthName}`;

    return {
      weekOffset,
      rangeLabel,
      days: weekDays,
      stats: {
        totalMosque: weekMosqueCount,
        totalHome: weekHomeCount,
        totalMissed: weekMissedCount,
        totalDone: weekMosqueCount + weekHomeCount,
        totalCoins: weekCoins
      }
    };
  }

  // ========== المنطق الأساسي لتسجيل الصلاة ==========
  getTodayRecord() {
    return this._getOrCreateTodayRecord();
  }

  isSalahDone(salahId, targetDateKey = null) {
    const rec = this.getOrCreateDateRecord(targetDateKey || this._today());
    return rec[salahId] && rec[salahId].done;
  }

  recordSalah(salahId, action, targetDateKey = null) {
    // action: 'mosque' | 'home' | 'missed' | 'clear'
    const dateKey = targetDateKey || this._today();
    const rec = this.getOrCreateDateRecord(dateKey);
    const prevEntry = rec[salahId] ? Object.assign({}, rec[salahId]) : { done: false, place: null };
    const salah = SALAWAT.find(s => s.id === salahId);
    if (!salah) return null;

    const settings = this.getSettings();
    const rMosque = Number(settings.rewardMosque ?? salah.rewardMosque);
    const rHome = Number(settings.rewardHome ?? salah.rewardHome);
    const isFajrBonus = (salahId === 'fajr');
    const fajrBonusVal = isFajrBonus ? Number(settings.bonusFajr ?? 1) : 0;

    // حساب المكافأة السابقة إذا كانت الصلاة مسبقاً مسجلة done
    let prevReward = 0;
    if (prevEntry.done) {
      prevReward = (prevEntry.place === 'mosque' ? rMosque : rHome) + fajrBonusVal;
      if (prevEntry.place === 'mosque') this.state.stats.totalMosque = Math.max(0, this.state.stats.totalMosque - 1);
      if (prevEntry.place === 'home') this.state.stats.totalHome = Math.max(0, this.state.stats.totalHome - 1);
      if (salahId === 'fajr') this.state.stats.totalFajr = Math.max(0, this.state.stats.totalFajr - 1);
    }

    let newReward = 0;
    if (action === 'mosque' || action === 'home') {
      newReward = (action === 'mosque' ? rMosque : rHome) + fajrBonusVal;
      rec[salahId] = { done: true, missed: false, place: action };
      if (action === 'mosque') this.state.stats.totalMosque++;
      if (action === 'home') this.state.stats.totalHome++;
      if (salahId === 'fajr') this.state.stats.totalFajr++;
    } else if (action === 'missed') {
      rec[salahId] = { done: false, missed: true, place: null };
    } else if (action === 'clear') {
      rec[salahId] = { done: false, missed: false, place: null };
    }

    const deltaCoins = newReward - prevReward;
    this.state.pocketMoney = Math.max(0, this.state.pocketMoney + deltaCoins);
    if (this.app && this.app.state) {
      this.app.state.coins = Math.max(0, (this.app.state.coins || 0) + deltaCoins);
    }

    let perfectDay = false;
    let perfectWeek = false;

    if (action === 'mosque' || action === 'home') {
      perfectDay = this._checkPerfectDayForDate(dateKey);
      if (perfectDay && !prevEntry.done) {
        const pDayBonus = Number(settings.bonusPerfectDay ?? 5);
        this.state.pocketMoney += pDayBonus;
        if (this.app && this.app.state) {
          this.app.state.coins += pDayBonus;
        }
        this.state.stats.perfectDays++;
        this._updateStreak();
      }

      perfectWeek = this._checkPerfectWeek();
      if (perfectWeek && !prevEntry.done) {
        const pWeekBonus = Number(settings.bonusPerfectWeek ?? 20);
        this.state.pocketMoney += pWeekBonus;
        if (this.app && this.app.state) {
          this.app.state.coins += pWeekBonus;
        }
      }
    }

    const newBadges = this._checkBadges();

    this._saveState();
    if (this.app && typeof this.app.saveState === 'function') {
      this.app.saveState();
    }

    return {
      salah,
      action,
      place: (action === 'mosque' || action === 'home') ? action : null,
      reward: newReward,
      deltaCoins,
      isFajrBonus,
      fajrBonusVal,
      perfectDay,
      perfectWeek,
      newBadges,
      totalPocketMoney: this.state.pocketMoney,
      currencyName: settings.currencyName || 'جنيه',
      dateKey
    };
  }

  _checkPerfectDayForDate(dateKey) {
    const rec = this.state.history[dateKey];
    if (!rec) return false;
    return SALAWAT.every(s => rec[s.id] && rec[s.id].done);
  }

  _checkPerfectDay() {
    return this._checkPerfectDayForDate(this._today());
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
    const settings = this.getSettings();
    const rMosque = Number(settings.rewardMosque ?? 5);
    const rHome = Number(settings.rewardHome ?? 2);
    const bFajr = Number(settings.bonusFajr ?? 1);

    let total = 0;
    SALAWAT.forEach(s => {
      if (rec[s.id] && rec[s.id].done) {
        total += (rec[s.id].place === 'mosque' ? rMosque : rHome);
        if (s.id === 'fajr') total += bFajr;
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
