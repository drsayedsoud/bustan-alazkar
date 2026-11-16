// تطبيق «البطل المسلم» للأطفال (أذكار، صلاة، وعقيدتي مع تدريب القراءة وتثبيت التطبيق)

const DEFAULT_REWARDS_SETTINGS = {
  currencyName: 'جنيه',
  rewardMosque: 5,
  rewardHome: 2,
  bonusFajr: 1,
  bonusPerfectDay: 5,
  bonusPerfectWeek: 20,
  rewardDhikr: 30,
  rewardPrayerLesson: 50,
  rewardAqeedahLesson: 25
};

// دالة تلوين حروف المد والتشكيل (طبق الأصل لتدريب القراءة في kids)
function colorize(rawText) {
  let h = String(rawText || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  // المد بالألف — لوّن الألف (U+0627) التي تسبقها فتحة
  h = h.replace(/(\u064E)(\u0627)/g, '$1<b class="c-alef">$2</b>');

  // المد بالواو — لوّن الواو (U+0648) غير المشكّلة بعد ضمة
  h = h.replace(/(\u064F)(\u0648)(?![\u064E\u064F\u0650\u0651\u0652])/g, '$1<b class="c-waw">$2</b>');

  // المد بالياء — لوّن الياء (U+064A) غير المشكّلة بعد كسرة
  h = h.replace(/(\u0650)(\u064A)(?![\u064E\u064F\u0650\u0651\u0652])/g, '$1<b class="c-ya">$2</b>');

  // التنوين — لوّن علامة التنوين نفسها (ً ٌ ٍ)
  h = h.replace(/([\u064B\u064C\u064D])/g, '<b class="c-tanwin">$1</b>');

  // الشدة — لوّن علامة الشدة نفسها (U+0651)
  h = h.replace(/(\u0651)/g, '<b class="c-shadda">$1</b>');

  // السكون — لوّن علامة السكون نفسها (U+0652)
  h = h.replace(/(\u0652)/g, '<b class="c-sukun">$1</b>');

  return h;
}

class AppController {
  constructor() {
    this.garden = null;
    this.confetti = null;
    this.activeTab = 'home';
    this.deferredInstallPrompt = null;

    // بيانات الطفل
    this.profile = {
      name: '',
      nickname: '',
      gender: 'boy'
    };

    // حالة الأذكار
    this.currentCategory = 'all';
    this.filteredAzkar = [];
    this.currentDhikrIndex = 0;
    this.currentDhikrCount = 0;

    // حالة الصلاة
    this.currentPrayerIndex = 0;
    this.currentPrayerStep = 0;

    // حالة الوضوء
    this.currentWuduStep = 0;

    // حالة أذكار الصباح والمساء
    this.currentMeType = 'morning';
    this.meCounts = {};

    // الوضع الليلي
    this.currentTheme = localStorage.getItem('bustan_theme') || 'light';

    // حالة العقيدة
    this.currentAqeedahIndex = 0;
    this.completedLessons = {};

    // المخزون والنقاط
    this.state = {
      coins: 0,
      streak: 1,
      lastDate: null,
      inventory: {
        flower: 0,
        apple: 0,
        orange: 0,
        star: 0,
        totalWater: 0,
        prayersCompleted: 0,
        lessonsCompleted: 0
      }
    };

    this.salawatTracker = null;
    this._pendingSalahId = null;
    this._pendingDateKey = null;
    this.currentWeekOffset = 0;
    this.rewardsSettings = this.loadRewardsSettings();
    this.currentEncouragementPhrase = '';

    this.loadState();
    this.checkStreak();
  }

  init() {
    this.initTheme();
    this.garden = new GardenTree('tree-canvas');
    this.confetti = new ConfettiEngine('confetti-canvas');

    this.setupProfileUI();
    this.setupTabNavigation();
    this.setupSettingsUI();
    this.setupWuduUI();
    this.setupMorningEveningUI();

    // تجهيز الأقسام الأربعة
    this.filterAzkar(this.currentCategory);
    this.setupCategoriesUI();
    this.renderCurrentDhikr();

    this.setupPrayersUI();
    this.renderCurrentPrayerStep();

    this.setupAqeedahUI();
    this.renderCurrentAqeedahLesson();

    if (typeof SalawatTracker !== 'undefined') {
      this.salawatTracker = new SalawatTracker(this);
      this.setupSalawatUI();
    }

    this.setupEventListeners();
    this.setupPWAInstallation();
    this.setupBackSwipeGesture();

    // تهيئة سجل التصفح والرجوع (Browser & Gesture Back)
    try {
      history.replaceState({ tab: 'home' }, '');
    } catch (e) {}

    window.addEventListener('popstate', (e) => {
      if (this.closeOpenModalsOrSidebar()) {
        try {
          history.pushState({ tab: this.activeTab }, '', '#' + this.activeTab);
        } catch (err) {}
        return;
      }
      const targetTab = (e.state && e.state.tab) ? e.state.tab : 'home';
      this.switchTab(targetTab, false);
    });

    this.applyRewardsSettings();
    this.updateUI();
    this.restoreGardenVisuals();
    this.switchTab('home', false);

    if (!this.profile.name) {
      setTimeout(() => {
        this.openWelcomeModal();
      }, 300);
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js').then(reg => {
        // فحص وجود تحديثات فور فتح الصفحة
        reg.update();
      }).catch(err => {
        console.log('SW registration error:', err);
      });

      // إعادة تحميل الصفحة تلقائياً لمرة واحدة عند تفعيل السيرفس ووركر الجديد
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }

  // ========== إدارة PWA واقتراح تثبيت التطبيق ==========
  setupPWAInstallation() {
    const installBanner = document.getElementById('pwa-install-banner');
    const headerInstallBtn = document.getElementById('btn-header-install');
    const installNowBtn = document.getElementById('btn-pwa-install-now');
    const dismissBtn = document.getElementById('btn-pwa-dismiss');
    const iosModal = document.getElementById('ios-install-modal');
    const closeIosBtn = document.getElementById('close-ios-install-btn');

    // كشف ما إذا كان التطبيق مثبتاً بالفعل
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
      installBanner.classList.add('hidden');
      headerInstallBtn.classList.add('hidden');
      return;
    }

    // فحص ما إذا كان المستخدم رفض التثبيت مؤخراً
    const dismissedTime = localStorage.getItem('bustan_install_dismissed');
    const isRecentlyDismissed = dismissedTime && (Date.now() - parseInt(dismissedTime, 10) < 1000 * 60 * 60 * 24); // 24 ساعة

    // التقاط حدث التثبيت القياسي من المتصفح (Chrome, Edge, Samsung Internet, Android)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;

      // إظهار زر الرأس دائماً
      headerInstallBtn.classList.remove('hidden');

      // إظهار البانر بعد ثانيتين إلا إذا تم إغلاقه مؤخراً
      if (!isRecentlyDismissed) {
        setTimeout(() => {
          installBanner.classList.remove('hidden');
        }, 2200);
      }
    });

    const triggerInstall = async () => {
      sounds.playPop();
      if (this.deferredInstallPrompt) {
        this.deferredInstallPrompt.prompt();
        const choice = await this.deferredInstallPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          sounds.playVictory();
          this.confetti.burst(70);
          installBanner.classList.add('hidden');
          headerInstallBtn.classList.add('hidden');
        }
        this.deferredInstallPrompt = null;
      } else {
        // فحص أجهزة iOS Safari
        const isIosDevice = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
        if (isIosDevice) {
          iosModal.classList.add('active');
        } else {
          alert('لتثبيت التطبيق: افتح قائمة المتصفح (⋮) واختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية" 👍');
        }
      }
    };

    installNowBtn.addEventListener('click', triggerInstall);
    headerInstallBtn.addEventListener('click', triggerInstall);

    dismissBtn.addEventListener('click', () => {
      sounds.playPop();
      installBanner.classList.add('hidden');
      localStorage.setItem('bustan_install_dismissed', Date.now().toString());
    });

    closeIosBtn.addEventListener('click', () => {
      sounds.playPop();
      iosModal.classList.remove('active');
    });

    window.addEventListener('appinstalled', () => {
      installBanner.classList.add('hidden');
      headerInstallBtn.classList.add('hidden');
      sounds.playVictory();
    });
  }

  // ========== حفظ واسترجاع البيانات ==========
  loadState() {
    try {
      const savedProfile = localStorage.getItem('bustan_child_profile');
      if (savedProfile) {
        this.profile = JSON.parse(savedProfile);
      }
      const savedState = localStorage.getItem('bustan_azkar_state');
      if (savedState) {
        this.state = JSON.parse(savedState);
      }
      const savedLessons = localStorage.getItem('bustan_completed_lessons');
      if (savedLessons) {
        this.completedLessons = JSON.parse(savedLessons);
      }
    } catch (e) {
      console.warn('Failed to load storage', e);
    }
  }

  saveProfile() {
    try {
      localStorage.setItem('bustan_child_profile', JSON.stringify(this.profile));
    } catch (e) {}
  }

  saveState() {
    try {
      localStorage.setItem('bustan_azkar_state', JSON.stringify(this.state));
      localStorage.setItem('bustan_completed_lessons', JSON.stringify(this.completedLessons));
    } catch (e) {}
  }

  checkStreak() {
    const today = new Date().toISOString().split('T')[0];
    if (!this.state.lastDate) {
      this.state.lastDate = today;
      this.state.streak = 1;
    } else if (this.state.lastDate !== today) {
      const last = new Date(this.state.lastDate);
      const now = new Date(today);
      const diffDays = Math.round((now - last) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        this.state.streak += 1;
      } else if (diffDays > 1) {
        this.state.streak = 1;
      }
      this.state.lastDate = today;
      this.saveState();
    }
  }

  // ========== نافذة الترحيب واسم الطفل ==========
  setupProfileUI() {
    const avatarEl = document.getElementById('greeting-avatar');
    const textEl = document.getElementById('greeting-text');
    const heroNameEl = document.getElementById('home-hero-name');
    const heroAvatarEl = document.getElementById('home-hero-avatar');

    if (this.profile.name) {
      const title = this.profile.gender === 'girl' ? 'البطلة' : 'البطل';
      const nick = this.profile.nickname ? ` (${this.profile.nickname})` : '';
      const avatar = this.profile.gender === 'girl' ? '👧' : '👦';
      avatarEl.textContent = avatar;
      textEl.textContent = `أهلاً بـ${title} ${this.profile.name}${nick}`;

      if (heroNameEl) heroNameEl.textContent = this.profile.nickname || this.profile.name;
      if (heroAvatarEl) heroAvatarEl.textContent = avatar;

      document.getElementById('congrat-child-name').textContent = this.profile.nickname || this.profile.name;
      document.getElementById('prayer-congrat-name').textContent = this.profile.nickname || this.profile.name;
      document.getElementById('aq-congrat-name').textContent = this.profile.nickname || this.profile.name;
      document.getElementById('gallery-child-name').textContent = this.profile.nickname || this.profile.name;
    } else {
      avatarEl.textContent = '🌟';
      textEl.textContent = 'اضغط لتسجيل اسمك يا بطل';
      if (heroNameEl) heroNameEl.textContent = 'بَطَلَنَا الصَّغِير';
      if (heroAvatarEl) heroAvatarEl.textContent = '🌟';
    }
  }

  openWelcomeModal() {
    document.getElementById('input-child-name').value = this.profile.name || '';
    document.getElementById('input-child-nickname').value = this.profile.nickname || '';

    document.querySelectorAll('.gender-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.gender === (this.profile.gender || 'boy'));
    });

    document.getElementById('welcome-modal').classList.add('active');
  }

  closeWelcomeModal() {
    document.getElementById('welcome-modal').classList.remove('active');
  }

  saveChildProfile() {
    const nameInput = document.getElementById('input-child-name').value.trim();
    const nickInput = document.getElementById('input-child-nickname').value.trim();

    if (!nameInput) {
      alert('من فضلك اكتب اسمك يا بطل!');
      return;
    }

    this.profile.name = nameInput;
    this.profile.nickname = nickInput || nameInput;

    const activeGenderBtn = document.querySelector('.gender-btn.active');
    this.profile.gender = activeGenderBtn ? activeGenderBtn.dataset.gender : 'boy';

    this.saveProfile();
    this.setupProfileUI();
    this.closeWelcomeModal();

    sounds.playVictory();
    this.confetti.burst(50);
  }

  // ========== التبديل بين الشاشة الرئيسية والأقسام ==========
  setupTabNavigation() {
    const tabHome = document.getElementById('tab-home-btn');
    const tabWudu = document.getElementById('tab-wudu-btn');
    const tabPrayer = document.getElementById('tab-prayer-btn');
    const tabMorningEvening = document.getElementById('tab-morning-evening-btn');
    const tabAzkar = document.getElementById('tab-azkar-btn');
    const tabAqeedah = document.getElementById('tab-aqeedah-btn');
    const tabSalawat = document.getElementById('tab-salawat-btn');
    const brandHomeLink = document.getElementById('brand-home-link');

    if (tabHome) {
      tabHome.addEventListener('click', () => {
        sounds.playPop();
        this.switchTab('home');
      });
    }

    if (tabWudu) {
      tabWudu.addEventListener('click', () => {
        sounds.playPop();
        this.switchTab('wudu');
      });
    }

    if (tabMorningEvening) {
      tabMorningEvening.addEventListener('click', () => {
        sounds.playPop();
        this.switchTab('morning_evening');
      });
    }

    if (brandHomeLink) {
      brandHomeLink.addEventListener('click', () => {
        sounds.playPop();
        this.switchTab('home');
      });
      brandHomeLink.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          sounds.playPop();
          this.switchTab('home');
        }
      });
    }

    if (tabAzkar) {
      tabAzkar.addEventListener('click', () => {
        sounds.playPop();
        this.switchTab('azkar');
      });
    }

    if (tabPrayer) {
      tabPrayer.addEventListener('click', () => {
        sounds.playPop();
        this.switchTab('prayer');
      });
    }

    if (tabAqeedah) {
      tabAqeedah.addEventListener('click', () => {
        sounds.playPop();
        this.switchTab('aqeedah');
      });
    }

    if (tabSalawat) {
      tabSalawat.addEventListener('click', () => {
        sounds.playPop();
        this.switchTab('salawat');
      });
    }

    // ربط الكروت في شاشة البداية للتنقل المباشر للأقسام
    const cardAzkar = document.getElementById('card-launch-azkar');
    const cardPrayer = document.getElementById('card-launch-prayer');
    const cardAqeedah = document.getElementById('card-launch-aqeedah');
    const cardSalawat = document.getElementById('card-launch-salawat');
    const cardWudu = document.getElementById('card-launch-wudu');
    const cardME = document.getElementById('card-launch-morning-evening');

    if (cardAzkar) {
      cardAzkar.addEventListener('click', () => {
        sounds.playPop();
        this.switchTab('azkar');
      });
      cardAzkar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          sounds.playPop();
          this.switchTab('azkar');
        }
      });
    }

    if (cardWudu) {
      cardWudu.addEventListener('click', () => {
        sounds.playPop();
        this.switchTab('wudu');
      });
      cardWudu.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          sounds.playPop();
          this.switchTab('wudu');
        }
      });
    }

    if (cardME) {
      cardME.addEventListener('click', () => {
        sounds.playPop();
        this.switchTab('morning_evening');
      });
      cardME.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          sounds.playPop();
          this.switchTab('morning_evening');
        }
      });
    }

    if (cardPrayer) {
      cardPrayer.addEventListener('click', () => {
        sounds.playPop();
        this.switchTab('prayer');
      });
      cardPrayer.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          sounds.playPop();
          this.switchTab('prayer');
        }
      });
    }

    if (cardAqeedah) {
      cardAqeedah.addEventListener('click', () => {
        sounds.playPop();
        this.switchTab('aqeedah');
      });
      cardAqeedah.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          sounds.playPop();
          this.switchTab('aqeedah');
        }
      });
    }

    if (cardSalawat) {
      cardSalawat.addEventListener('click', () => {
        sounds.playPop();
        this.switchTab('salawat');
      });
      cardSalawat.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          sounds.playPop();
          this.switchTab('salawat');
        }
      });
    }

    // ربط القائمة الجانبية (Sidebar Drawer)
    const btnSidebarToggle = document.getElementById('btn-sidebar-toggle');
    const btnSidebarClose = document.getElementById('btn-sidebar-close');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    if (btnSidebarToggle) {
      btnSidebarToggle.addEventListener('click', () => {
        this.openSidebar();
      });
    }

    if (btnSidebarClose) {
      btnSidebarClose.addEventListener('click', () => {
        sounds.playPop();
        this.closeSidebar();
      });
    }

    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', () => {
        this.closeSidebar();
      });
    }

    document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        sounds.playPop();
        const target = btn.dataset.nav;
        this.closeSidebar();
        if (target) this.switchTab(target);
      });
    });

    const sidebarBtnSettings = document.getElementById('sidebar-btn-settings');
    if (sidebarBtnSettings) {
      sidebarBtnSettings.addEventListener('click', () => {
        sounds.playPop();
        this.closeSidebar();
        this.openSettingsModal();
      });
    }

    const sidebarBtnShare = document.getElementById('sidebar-btn-share');
    if (sidebarBtnShare) {
      sidebarBtnShare.addEventListener('click', () => {
        this.closeSidebar();
        this.shareAppViaWhatsApp();
      });
    }

    // أزرار تبديل الوضع الليلي والنهاري
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    if (btnThemeToggle) {
      btnThemeToggle.addEventListener('click', () => {
        this.toggleTheme();
      });
    }

    const sidebarBtnTheme = document.getElementById('sidebar-btn-theme');
    if (sidebarBtnTheme) {
      sidebarBtnTheme.addEventListener('click', () => {
        this.toggleTheme();
      });
    }

    // ربط أزرار العودة للشاشة الرئيسية الموجودة أعلى كل قسم
    document.querySelectorAll('.btn-back-home').forEach(btn => {
      btn.addEventListener('click', () => {
        sounds.playPop();
        this.switchTab('home');
      });
    });
  }

  openSidebar() {
    sounds.playPop();
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('sidebar-closed');
    if (overlay) overlay.classList.remove('hidden');
  }

  closeSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.add('sidebar-closed');
    if (overlay) overlay.classList.add('hidden');
  }

  initTheme() {
    const saved = localStorage.getItem('bustan_theme') || 'light';
    this.setTheme(saved);
  }

  setTheme(theme) {
    this.currentTheme = theme;
    localStorage.setItem('bustan_theme', theme);
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    const iconHeader = document.getElementById('btn-theme-toggle');
    const iconSidebar = document.getElementById('sidebar-theme-icon');
    const iconText = theme === 'dark' ? '☀️' : '🌙';
    if (iconHeader) iconHeader.textContent = iconText;
    if (iconSidebar) iconSidebar.textContent = iconText;
  }

  toggleTheme() {
    sounds.playPop();
    const next = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
  }

  clearAllSpeakingStyles() {
    ['btn-speak', 'btn-prayer-speak', 'btn-aq-speak', 'btn-wudu-speak'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('speaking-active');
    });
  }

  switchTab(tab, pushHistory = true) {
    sounds.stopSpeaking();
    this.clearAllSpeakingStyles();

    if (pushHistory && tab !== this.activeTab) {
      try {
        history.pushState({ tab: tab }, '', '#' + tab);
      } catch (e) {}
    }

    this.activeTab = tab;

    const tabHome = document.getElementById('tab-home-btn');
    const tabWudu = document.getElementById('tab-wudu-btn');
    const tabPrayer = document.getElementById('tab-prayer-btn');
    const tabMorningEvening = document.getElementById('tab-morning-evening-btn');
    const tabAzkar = document.getElementById('tab-azkar-btn');
    const tabAqeedah = document.getElementById('tab-aqeedah-btn');
    const tabSalawat = document.getElementById('tab-salawat-btn');

    const secHome = document.getElementById('section-home');
    const secWudu = document.getElementById('section-wudu');
    const secPrayer = document.getElementById('section-prayer');
    const secMorningEvening = document.getElementById('section-morning-evening');
    const secAzkar = document.getElementById('section-azkar');
    const secAqeedah = document.getElementById('section-aqeedah');
    const secSalawat = document.getElementById('section-salawat');

    if (tabHome) tabHome.className = 'nav-tab-btn';
    if (tabWudu) tabWudu.className = 'nav-tab-btn';
    if (tabPrayer) tabPrayer.className = 'nav-tab-btn';
    if (tabMorningEvening) tabMorningEvening.className = 'nav-tab-btn';
    if (tabAzkar) tabAzkar.className = 'nav-tab-btn';
    if (tabAqeedah) tabAqeedah.className = 'nav-tab-btn';
    if (tabSalawat) tabSalawat.className = 'nav-tab-btn';

    if (secHome) secHome.classList.add('hidden');
    if (secWudu) secWudu.classList.add('hidden');
    if (secPrayer) secPrayer.classList.add('hidden');
    if (secMorningEvening) secMorningEvening.classList.add('hidden');
    if (secAzkar) secAzkar.classList.add('hidden');
    if (secAqeedah) secAqeedah.classList.add('hidden');
    if (secSalawat) secSalawat.classList.add('hidden');

    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.nav === tab);
    });

    if (tab === 'home') {
      if (tabHome) tabHome.classList.add('active-home');
      if (secHome) secHome.classList.remove('hidden');
      this.updateUI();
    } else if (tab === 'wudu') {
      if (tabWudu) tabWudu.classList.add('active-wudu');
      if (secWudu) secWudu.classList.remove('hidden');
      this.renderCurrentWuduStep();
    } else if (tab === 'prayer') {
      if (tabPrayer) tabPrayer.classList.add('active-prayer');
      if (secPrayer) secPrayer.classList.remove('hidden');
    } else if (tab === 'morning_evening') {
      if (tabMorningEvening) tabMorningEvening.classList.add('active-morning-evening');
      if (secMorningEvening) secMorningEvening.classList.remove('hidden');
      this.renderMorningEveningSection();
    } else if (tab === 'azkar') {
      if (tabAzkar) tabAzkar.classList.add('active-azkar');
      if (secAzkar) secAzkar.classList.remove('hidden');
      if (this.garden) this.garden.resize();
    } else if (tab === 'aqeedah') {
      if (tabAqeedah) tabAqeedah.classList.add('active-aqeedah');
      if (secAqeedah) secAqeedah.classList.remove('hidden');
    } else if (tab === 'salawat') {
      if (tabSalawat) tabSalawat.classList.add('active-salawat');
      if (secSalawat) secSalawat.classList.remove('hidden');
      if (this.salawatTracker) this.renderSalawatSection();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // دعم إيماءات اللمس من جانب الشاشة (Backstroke Swipe & System Back)
  setupBackSwipeGesture() {
    let touchStartX = 0;
    let touchStartY = 0;
    let isEdgeSwipe = false;

    window.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      const screenWidth = window.innerWidth;

      // فحص إن كانت اللمسة بدأت بالقرب من حافة الشاشة (اليمنى أو اليسرى بمقدار 55 بكسل)
      if (touchStartX > screenWidth - 55 || touchStartX < 55) {
        isEdgeSwipe = true;
      } else {
        isEdgeSwipe = false;
      }
    }, { passive: true });

    window.addEventListener('touchend', (e) => {
      if (!isEdgeSwipe) return;
      if (!e.changedTouches.length) return;
      const t = e.changedTouches[0];
      const diffX = t.clientX - touchStartX;
      const diffY = t.clientY - touchStartY;

      // حركة أفقية ملحوظة كإيماءة رجوع (أكثر من 60 بكسل أفقياً وأقل من 65 رأسياً)
      if (Math.abs(diffX) > 60 && Math.abs(diffY) < 65) {
        if (this.closeOpenModalsOrSidebar()) {
          return;
        }
        if (this.activeTab !== 'home') {
          sounds.playPop();
          this.switchTab('home');
        }
      }
    }, { passive: true });
  }

  closeOpenModalsOrSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar && !sidebar.classList.contains('sidebar-closed')) {
      this.closeSidebar();
      return true;
    }
    const activeModal = document.querySelector('.modal-overlay.active, .bottom-sheet-overlay.active');
    if (activeModal) {
      activeModal.classList.remove('active');
      return true;
    }
    return false;
  }

  // ========== 🌿 قسم بستان الأذكار ==========
  setupCategoriesUI() {
    const scroll = document.getElementById('categories-scroll');
    scroll.innerHTML = '';

    AZKAR_CATEGORIES.forEach(cat => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `cat-tab ${cat.id === this.currentCategory ? 'active' : ''}`;
      btn.textContent = cat.name;
      btn.onclick = () => {
        sounds.playPop();
        this.selectCategory(cat.id);
      };
      scroll.appendChild(btn);
    });
  }

  selectCategory(catId) {
    this.currentCategory = catId;
    this.filterAzkar(catId);
    this.currentDhikrIndex = 0;
    this.currentDhikrCount = 0;

    document.querySelectorAll('.cat-tab').forEach(btn => {
      const catObj = AZKAR_CATEGORIES.find(c => c.id === catId);
      btn.classList.toggle('active', btn.textContent.includes(catObj ? catObj.name : ''));
    });

    this.renderCurrentDhikr();
  }

  filterAzkar(catId) {
    if (catId === 'all') {
      this.filteredAzkar = [...AZKAR_DATA];
    } else {
      this.filteredAzkar = AZKAR_DATA.filter(item => item.category === catId);
    }
    if (this.filteredAzkar.length === 0) {
      this.filteredAzkar = [...AZKAR_DATA];
    }
  }

  getCurrentDhikr() {
    return this.filteredAzkar[this.currentDhikrIndex] || this.filteredAzkar[0];
  }

  renderCurrentDhikr() {
    const dhikr = this.getCurrentDhikr();
    if (!dhikr) return;

    document.getElementById('dhikr-badge').textContent = `${dhikr.icon} ${this.getCategoryName(dhikr.category)}`;
    document.getElementById('dhikr-title').textContent = dhikr.title;
    document.getElementById('dhikr-arabic').textContent = dhikr.arabic;
    document.getElementById('dhikr-meaning').innerHTML = `💡 <b>الفائدة للبطل:</b> ${dhikr.meaning}`;
    document.getElementById('dhikr-source').textContent = `📚 المصدر: ${dhikr.source}`;
    document.getElementById('counter-target').textContent = dhikr.target;

    this.updateCounterUI();
  }

  getCategoryName(catId) {
    const cat = AZKAR_CATEGORIES.find(c => c.id === catId);
    return cat ? cat.name.replace(/[^\u0600-\u06FF\s]/g, '').trim() : '';
  }

  updateCounterUI() {
    const dhikr = this.getCurrentDhikr();
    document.getElementById('counter-current').textContent = this.currentDhikrCount;

    const dotsContainer = document.getElementById('dots-row');
    dotsContainer.innerHTML = '';

    const maxDots = Math.min(dhikr.target, 12);
    for (let i = 0; i < maxDots; i++) {
      const dot = document.createElement('div');
      dot.className = `target-dot ${i < this.currentDhikrCount ? 'filled' : ''}`;
      dotsContainer.appendChild(dot);
    }
  }

  handleWaterTap() {
    const dhikr = this.getCurrentDhikr();
    if (!dhikr) return;

    if (navigator.vibrate) navigator.vibrate(25);

    sounds.playWaterDrop();
    this.garden.addWaterDrops();
    this.state.inventory.totalWater++;

    this.currentDhikrCount++;
    this.updateCounterUI();

    if (this.currentDhikrCount >= dhikr.target) {
      this.onDhikrCompleted(dhikr);
    }
  }

  onDhikrCompleted(dhikr) {
    sounds.playVictory();
    sounds.playBloom();
    sounds.playCoin();
    this.confetti.burst(60);

    const rewardCoins = Number(this.rewardsSettings.rewardDhikr ?? dhikr.reward ?? 30);
    this.garden.addItem(dhikr.fruit);
    this.state.inventory[dhikr.fruit] = (this.state.inventory[dhikr.fruit] || 0) + 1;
    this.state.coins += rewardCoins;
    this.saveState();
    this.updateUI();

    setTimeout(() => {
      this.showCongratModal(dhikr, rewardCoins);
    }, 450);
  }

  showCongratModal(dhikr, customReward) {
    const fruitNames = {
      flower: 'زهرة عطرة 🌸',
      apple: 'تفاحة حمراء لذيذة 🍎',
      orange: 'برتقالة ناضجة 🍊',
      star: 'نجمة حسنات ذهبية ⭐'
    };

    const rewardCoins = customReward ?? Number(this.rewardsSettings.rewardDhikr ?? dhikr.reward ?? 30);
    const curName = this.rewardsSettings.currencyName || 'حسنة';

    document.getElementById('modal-fruit-name').textContent = fruitNames[dhikr.fruit] || 'ثمرة مباركة 🌱';
    document.getElementById('modal-reward-coins').textContent = `+${rewardCoins} ${curName}`;
    document.getElementById('congrat-modal').classList.add('active');
  }

  closeCongratModal() {
    sounds.playPop();
    document.getElementById('congrat-modal').classList.remove('active');
    this.nextDhikr();
  }

  nextDhikr() {
    this.currentDhikrIndex = (this.currentDhikrIndex + 1) % this.filteredAzkar.length;
    this.currentDhikrCount = 0;
    this.renderCurrentDhikr();
  }

  prevDhikr() {
    this.currentDhikrIndex = (this.currentDhikrIndex - 1 + this.filteredAzkar.length) % this.filteredAzkar.length;
    this.currentDhikrCount = 0;
    this.renderCurrentDhikr();
  }

  // ========== 💧 قسم تعليم الوضوء للصغار ==========
  setupWuduUI() {
    const prevBtn = document.getElementById('btn-wudu-prev');
    const nextBtn = document.getElementById('btn-wudu-next');
    const audioBtn = document.getElementById('btn-wudu-speak');

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        this.prevWuduStep();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.nextWuduStep();
      });
    }

    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        this.speakCurrentWuduStep();
      });
    }
  }

  renderCurrentWuduStep() {
    if (typeof WUDU_STEPS === 'undefined' || !WUDU_STEPS.length) return;
    const step = WUDU_STEPS[this.currentWuduStep];
    const total = WUDU_STEPS.length;

    const indEl = document.getElementById('wudu-step-indicator');
    if (indEl) indEl.textContent = `الخطوة ${this.currentWuduStep + 1} من ${total}`;

    const ruleEl = document.getElementById('wudu-rule-badge');
    if (ruleEl) ruleEl.textContent = step.rule || 'سُنَّة';

    const repeatEl = document.getElementById('wudu-repeat-badge');
    if (repeatEl) repeatEl.textContent = step.repeat || 'مرة واحدة';

    const titleEl = document.getElementById('wudu-step-title');
    if (titleEl) titleEl.textContent = step.title;

    const actionEl = document.getElementById('wudu-step-action');
    if (actionEl) actionEl.textContent = step.action;

    const arabicEl = document.getElementById('wudu-step-arabic');
    if (arabicEl) arabicEl.textContent = step.arabic;

    const meaningEl = document.getElementById('wudu-step-meaning');
    if (meaningEl) meaningEl.textContent = step.meaning;

    const tipEl = document.getElementById('wudu-step-tip');
    if (tipEl) tipEl.innerHTML = `💡 <b>نصيحة للبطل:</b> ${step.tip}`;

    // صورة أو إيموجي الخطوة
    const imgContainer = document.getElementById('wudu-img-container');
    if (imgContainer) {
      const imgSrc = WUDU_IMAGES_PATH + step.image;
      imgContainer.innerHTML = `
        <img src="${imgSrc}" alt="${step.title}" class="wudu-step-img" onerror="this.style.display='none'; document.getElementById('wudu-fallback-icon').style.display='flex';">
        <div class="wudu-img-placeholder" id="wudu-fallback-icon" style="display: none;">
          <span class="wudu-img-placeholder-icon">${step.icon}</span>
          <span style="font-size: 0.95rem; font-weight: 700; color: #0891b2;">${step.title}</span>
        </div>
      `;
    }

    // مؤشر النقاط
    const bar = document.getElementById('wudu-progress-bar');
    if (bar) {
      bar.innerHTML = '';
      for (let i = 0; i < total; i++) {
        const dot = document.createElement('div');
        dot.className = `step-bar-dot ${i === this.currentWuduStep ? 'active' : (i < this.currentWuduStep ? 'completed' : '')}`;
        bar.appendChild(dot);
      }
    }

    const prevBtn = document.getElementById('btn-wudu-prev');
    const nextBtn = document.getElementById('btn-wudu-next');

    if (prevBtn) {
      prevBtn.style.visibility = this.currentWuduStep === 0 ? 'hidden' : 'visible';
    }

    if (nextBtn) {
      if (this.currentWuduStep === total - 1) {
        nextBtn.textContent = 'أتممتُ الوضوء بحمد الله! 🌟';
        nextBtn.className = 'wudu-btn wudu-btn-complete';
      } else {
        nextBtn.textContent = 'الخطوة التالية ⬅️';
        nextBtn.className = 'wudu-btn wudu-btn-next';
      }
    }
  }

  nextWuduStep() {
    if (typeof WUDU_STEPS === 'undefined') return;
    const total = WUDU_STEPS.length;
    if (this.currentWuduStep < total - 1) {
      this.currentWuduStep++;
      sounds.playPop();
      this.renderCurrentWuduStep();
    } else {
      this.onWuduCompleted();
    }
  }

  prevWuduStep() {
    if (this.currentWuduStep > 0) {
      this.currentWuduStep--;
      sounds.playPop();
      this.renderCurrentWuduStep();
    }
  }

  speakCurrentWuduStep() {
    if (typeof WUDU_STEPS === 'undefined') return;
    const step = WUDU_STEPS[this.currentWuduStep];
    const textToSpeak = `${step.action}. ${step.arabic}. ${step.meaning}`;
    sounds.stopSpeaking();
    sounds.speakText(textToSpeak, () => {}, () => {});
  }

  onWuduCompleted() {
    sounds.playVictory();
    sounds.playCoin();
    this.confetti.burst(60);
    this.state.coins += 30;
    this.saveState();
    this.updateUI();
    alert('مبارك يا بطل! 🎉 لقد أتممت خطوات الوضوء الصحيحة وحصلت على +30 حسنة في حصالتك! وضوءك نور وطهارة صلاتك مقبولة إن شاء الله. 💧✨');
    this.currentWuduStep = 0;
    this.renderCurrentWuduStep();
    this.switchTab('home');
  }

  // ========== ☀️ قسم أذكار الصباح والمساء ==========
  setupMorningEveningUI() {
    const btnM = document.getElementById('btn-me-morning');
    const btnE = document.getElementById('btn-me-evening');

    if (btnM) {
      btnM.addEventListener('click', () => {
        sounds.playPop();
        this.currentMeType = 'morning';
        this.renderMorningEveningSection();
      });
    }

    if (btnE) {
      btnE.addEventListener('click', () => {
        sounds.playPop();
        this.currentMeType = 'evening';
        this.renderMorningEveningSection();
      });
    }
  }

  renderMorningEveningSection() {
    const btnM = document.getElementById('btn-me-morning');
    const btnE = document.getElementById('btn-me-evening');
    if (btnM && btnE) {
      btnM.classList.toggle('active', this.currentMeType === 'morning');
      btnE.classList.toggle('active', this.currentMeType === 'evening');
    }

    const data = this.currentMeType === 'morning' ? (typeof MORNING_AZKAR_DATA !== 'undefined' ? MORNING_AZKAR_DATA : []) : (typeof EVENING_AZKAR_DATA !== 'undefined' ? EVENING_AZKAR_DATA : []);
    const container = document.getElementById('me-cards-list');
    if (!container) return;

    let completed = 0;
    data.forEach(item => {
      const c = this.meCounts[item.id] || 0;
      if (c >= item.target) completed++;
    });

    const percent = data.length ? Math.round((completed / data.length) * 100) : 0;
    const progressText = document.getElementById('me-progress-text');
    const progressFill = document.getElementById('me-progress-fill');
    const progressPercent = document.getElementById('me-progress-percent');

    if (progressText) progressText.textContent = `إنجازك: ${completed} من ${data.length} أذكار`;
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressPercent) progressPercent.textContent = `${percent}%`;

    container.innerHTML = '';
    data.forEach(item => {
      const currentCount = this.meCounts[item.id] || 0;
      const isDone = currentCount >= item.target;

      const card = document.createElement('div');
      card.className = `me-card ${isDone ? 'completed' : ''}`;

      card.innerHTML = `
        <div class="me-card-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.5rem;">${item.icon || '☀️'}</span>
            <span class="me-card-title">${item.title}</span>
          </div>
          <span style="font-size: 0.8rem; font-weight: 800; color: #10b981; background: rgba(16, 185, 129, 0.15); padding: 3px 10px; border-radius: 20px;">+${item.reward} حسنة</span>
        </div>

        <div class="me-arabic">${item.arabic}</div>
        <div class="me-virtue">💡 <b>الفضل والبركة:</b> ${item.virtue}</div>

        <div class="me-card-footer">
          <button type="button" class="wudu-audio-btn me-speak-btn" data-id="${item.id}" style="margin: 0;">
            <span>🔊</span>
            <span>استمع</span>
          </button>
          <button type="button" class="me-counter-btn ${isDone ? 'done' : ''}" data-id="${item.id}">
            <span>${isDone ? 'أتممتَ الذكر ✅' : 'ردّد وسَبِّح 💧'}</span>
            <span style="font-size: 1.15rem; font-weight: 900;">${currentCount} / ${item.target}</span>
          </button>
        </div>
      `;

      const speakBtn = card.querySelector('.me-speak-btn');
      speakBtn.onclick = () => {
        sounds.stopSpeaking();
        sounds.speakText(item.arabic, () => {}, () => {});
      };

      const countBtn = card.querySelector('.me-counter-btn');
      countBtn.onclick = () => {
        if (isDone) {
          sounds.playPop();
          return;
        }
        sounds.playWaterDrop();
        if (navigator.vibrate) navigator.vibrate(30);

        const newCount = (this.meCounts[item.id] || 0) + 1;
        this.meCounts[item.id] = newCount;

        if (newCount >= item.target) {
          sounds.playCoin();
          this.state.coins += item.reward;
          this.saveState();
          this.updateUI();

          const nowDone = data.filter(d => (this.meCounts[d.id] || 0) >= d.target).length;
          if (nowDone === data.length) {
            sounds.playVictory();
            this.confetti.burst(70);
            this.state.coins += 50;
            this.saveState();
            this.updateUI();
            alert(`هنيئاً لك يا بطل! 🌟 لقد أتممت ${this.currentMeType === 'morning' ? 'أذكار الصباح' : 'أذكار المساء'} كاملة ونلت حصن الحفظ الإلهي وبونص +50 حسنة! 🎉`);
          }
        }
        this.renderMorningEveningSection();
      };

      container.appendChild(card);
    });
  }

  // ========== 🕌 قسم تعليم الصلاة ==========
  setupPrayersUI() {
    const container = document.getElementById('prayers-selector');
    container.innerHTML = '';

    PRAYERS_INFO.forEach((p, idx) => {
      const pill = document.createElement('div');
      pill.className = `prayer-pill ${idx === this.currentPrayerIndex ? 'active' : ''}`;
      pill.innerHTML = `
        <span style="font-size: 1.4rem;">${p.icon}</span>
        <span class="prayer-pill-name">${p.name.split(' ')[1]}</span>
        <span class="prayer-pill-rakats">${p.rakats} ركعات</span>
      `;
      pill.onclick = () => {
        sounds.playPop();
        this.selectPrayer(idx);
      };
      container.appendChild(pill);
    });

    this.renderPrayerInfoBanner();
  }

  selectPrayer(index) {
    this.currentPrayerIndex = index;
    this.currentPrayerStep = 0;

    document.querySelectorAll('.prayer-pill').forEach((pill, idx) => {
      pill.classList.toggle('active', idx === index);
    });

    this.renderPrayerInfoBanner();
    this.renderCurrentPrayerStep();
  }

  renderPrayerInfoBanner() {
    const prayer = PRAYERS_INFO[this.currentPrayerIndex];
    document.getElementById('p-info-rakats').innerHTML = `🕌 <b>${prayer.name}:</b> ${prayer.rakats} ركعات`;
    document.getElementById('p-info-type').innerHTML = `📖 <b>نوع القراءة:</b> ${prayer.type}`;
  }

  renderCurrentPrayerStep() {
    const step = PRAYER_STEPS[this.currentPrayerStep];
    const totalSteps = PRAYER_STEPS.length;

    document.getElementById('step-indicator').textContent = `الخطوة ${this.currentPrayerStep + 1} من ${totalSteps}`;

    // عرض صورة الحركة أو الإيموجي كبديل
    const iconEl = document.getElementById('prayer-step-icon');
    if (step.image) {
      const imgSrc = PRAYER_IMAGES_PATH + step.image;
      iconEl.innerHTML = `<img src="${imgSrc}" alt="${step.title}" class="prayer-step-img" onerror="this.parentElement.textContent='${step.icon}'">`;
    } else {
      iconEl.textContent = step.icon;
    }

    document.getElementById('prayer-step-title').textContent = step.title;
    document.getElementById('prayer-step-action').textContent = step.action;
    document.getElementById('prayer-step-arabic').textContent = step.arabic;
    document.getElementById('prayer-step-tip').innerHTML = `💡 <b>نصيحة للبطل:</b> ${step.tip}`;

    const bar = document.getElementById('steps-progress-bar');
    bar.innerHTML = '';
    for (let i = 0; i < totalSteps; i++) {
      const dot = document.createElement('div');
      dot.className = `step-bar-dot ${i === this.currentPrayerStep ? 'active' : (i < this.currentPrayerStep ? 'completed' : '')}`;
      bar.appendChild(dot);
    }

    const prevBtn = document.getElementById('btn-prayer-prev');
    const nextBtn = document.getElementById('btn-prayer-next');

    prevBtn.style.visibility = this.currentPrayerStep === 0 ? 'hidden' : 'visible';

    if (this.currentPrayerStep === totalSteps - 1) {
      nextBtn.textContent = 'أتممتُ الصلاة بحمد الله! 🎉';
      nextBtn.className = 'prayer-btn prayer-btn-complete';
    } else {
      nextBtn.textContent = 'الخطوة التالية ⬅️';
      nextBtn.className = 'prayer-btn prayer-btn-next';
    }
  }

  nextPrayerStep() {
    const totalSteps = PRAYER_STEPS.length;
    if (this.currentPrayerStep < totalSteps - 1) {
      this.currentPrayerStep++;
      sounds.playPop();
      this.renderCurrentPrayerStep();
    } else {
      this.onPrayerCompleted();
    }
  }

  prevPrayerStep() {
    if (this.currentPrayerStep > 0) {
      this.currentPrayerStep--;
      sounds.playPop();
      this.renderCurrentPrayerStep();
    }
  }

  onPrayerCompleted() {
    sounds.playVictory();
    sounds.playBloom();
    this.confetti.burst(70);

    const rewardCoins = Number(this.rewardsSettings.rewardPrayerLesson ?? 50);
    this.state.coins += rewardCoins;
    this.state.inventory.star = (this.state.inventory.star || 0) + 1;
    this.state.inventory.prayersCompleted = (this.state.inventory.prayersCompleted || 0) + 1;
    this.garden.addItem('star');
    this.saveState();
    this.updateUI();

    document.getElementById('prayer-congrat-modal').classList.add('active');
  }

  closePrayerCongratModal() {
    sounds.playPop();
    document.getElementById('prayer-congrat-modal').classList.remove('active');
    this.currentPrayerStep = 0;
    this.renderCurrentPrayerStep();
  }

  // ========== 📖 قسم عقيدتي (تدريب القراءة الذاتية) ==========
  setupAqeedahUI() {
    const bar = document.getElementById('lessons-selector-bar');
    bar.innerHTML = '';

    AQEEDAH_LESSONS.forEach((lesson, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isDone = this.completedLessons[lesson.id];
      btn.className = `lesson-pill-btn ${idx === this.currentAqeedahIndex ? 'active' : ''} ${isDone ? 'completed' : ''}`;
      btn.innerHTML = `<span>${lesson.emoji}</span><span>الدرس ${lesson.number}</span>${isDone ? '<span>✓</span>' : ''}`;
      btn.onclick = () => {
        sounds.playPop();
        this.selectAqeedahLesson(idx);
      };
      bar.appendChild(btn);
    });
  }

  selectAqeedahLesson(index) {
    this.currentAqeedahIndex = index;
    this.renderCurrentAqeedahLesson();

    document.querySelectorAll('.lesson-pill-btn').forEach((btn, idx) => {
      btn.classList.toggle('active', idx === index);
    });
  }

  renderCurrentAqeedahLesson() {
    const lesson = AQEEDAH_LESSONS[this.currentAqeedahIndex];
    if (!lesson) return;

    document.getElementById('aq-chapter-emoji').textContent = lesson.emoji;
    document.getElementById('aq-chapter-subtitle').textContent = `الدَّرْسُ ${lesson.number} مِنْ ${AQEEDAH_LESSONS.length}: ${lesson.subtitle}`;
    document.getElementById('aq-chapter-title').innerHTML = colorize(lesson.title);

    document.getElementById('aq-chapter-text').innerHTML = colorize(lesson.text);

    const conceptsList = document.getElementById('aq-concepts-list');
    conceptsList.innerHTML = '';
    lesson.keyConcepts.forEach(c => {
      const div = document.createElement('div');
      div.className = 'concept-item';
      div.innerHTML = `<span>✅</span><span>${colorize(c)}</span>`;
      conceptsList.appendChild(div);
    });

    document.getElementById('aq-q-text').innerHTML = colorize(lesson.question.text);
    const choicesGrid = document.getElementById('aq-choices-grid');
    choicesGrid.innerHTML = '';

    lesson.question.choices.forEach((choice) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice-btn';
      btn.innerHTML = colorize(choice.text);
      btn.onclick = () => this.handleChoiceClick(btn, choice, lesson);
      choicesGrid.appendChild(btn);
    });

    const prevBtn = document.getElementById('btn-aq-prev');
    const nextBtn = document.getElementById('btn-aq-next');

    prevBtn.style.visibility = this.currentAqeedahIndex === 0 ? 'hidden' : 'visible';
    nextBtn.textContent = this.currentAqeedahIndex === AQEEDAH_LESSONS.length - 1 ? '🎉 ختمتُ دروس العقيدة' : 'الدرس التالي ⬅️';
  }

  handleChoiceClick(btn, choice, lesson) {
    if (choice.correct) {
      sounds.playVictory();
      sounds.playCoin();
      this.confetti.burst(60);

      btn.classList.add('correct');

      if (!this.completedLessons[lesson.id]) {
        this.completedLessons[lesson.id] = true;
        const rewardCoins = Number(this.rewardsSettings.rewardAqeedahLesson ?? 25);
        this.state.coins += rewardCoins;
        this.state.inventory.flower = (this.state.inventory.flower || 0) + 1;
        this.state.inventory.lessonsCompleted = (this.state.inventory.lessonsCompleted || 0) + 1;
        this.garden.addItem('flower');
        this.saveState();
        this.updateUI();
        this.setupAqeedahUI();
      }

      setTimeout(() => {
        document.getElementById('aqeedah-congrat-modal').classList.add('active');
      }, 500);
    } else {
      sounds.playPop();
      btn.classList.add('wrong');
      setTimeout(() => {
        btn.classList.remove('wrong');
      }, 800);
    }
  }

  nextAqeedahLesson() {
    if (this.currentAqeedahIndex < AQEEDAH_LESSONS.length - 1) {
      this.currentAqeedahIndex++;
      sounds.playPop();
      this.renderCurrentAqeedahLesson();
      this.setupAqeedahUI();
    } else {
      sounds.playVictory();
      this.confetti.burst(90);
      alert('ما شاء الله تبارك الله! لقد أتممت جميع دروس العقيدة يا بطل!');
    }
  }

  prevAqeedahLesson() {
    if (this.currentAqeedahIndex > 0) {
      this.currentAqeedahIndex--;
      sounds.playPop();
      this.renderCurrentAqeedahLesson();
      this.setupAqeedahUI();
    }
  }

  // ========== عام وتحديث الواجهة ==========
  updateUI() {
    const coinsEl = document.getElementById('coins-count');
    const streakEl = document.getElementById('streak-count');
    if (coinsEl) coinsEl.textContent = this.state.coins;
    if (streakEl) streakEl.textContent = `${this.state.streak} يوم`;

    const flowersEl = document.getElementById('stat-flowers');
    const fruitsEl = document.getElementById('stat-fruits');
    const starsEl = document.getElementById('stat-stars');
    if (flowersEl) flowersEl.textContent = this.state.inventory.flower || 0;
    if (fruitsEl) fruitsEl.textContent = (this.state.inventory.apple || 0) + (this.state.inventory.orange || 0);
    if (starsEl) starsEl.textContent = this.state.inventory.star || 0;

    // تحديث إحصائيات وبطاقات شاشة البداية
    const homeCoins = document.getElementById('home-stat-coins');
    const homeStreak = document.getElementById('home-stat-streak');
    const homeTree = document.getElementById('home-stat-tree');
    const totalHarvest = (this.state.inventory.flower || 0) + (this.state.inventory.apple || 0) + (this.state.inventory.orange || 0) + (this.state.inventory.star || 0);

    if (homeCoins) homeCoins.textContent = this.state.coins;
    if (homeStreak) homeStreak.textContent = `${this.state.streak} يوم`;
    if (homeTree) homeTree.textContent = totalHarvest;

    const cardAzkarProgress = document.getElementById('card-azkar-progress');
    if (cardAzkarProgress) {
      cardAzkarProgress.textContent = `${(this.state.inventory.flower || 0) + (this.state.inventory.apple || 0) + (this.state.inventory.orange || 0)} زهرة وثمرة تم جمعها`;
    }

    const cardPrayerProgress = document.getElementById('card-prayer-progress');
    if (cardPrayerProgress) {
      cardPrayerProgress.textContent = `${this.state.inventory.prayersCompleted || 0} صلوات مكتملة`;
    }

    const cardAqeedahProgress = document.getElementById('card-aqeedah-progress');
    if (cardAqeedahProgress) {
      const completedCount = Object.keys(this.completedLessons || {}).length;
      cardAqeedahProgress.textContent = `${completedCount} من 12 درساً مكتملة`;
    }

    const cardSalawatProgress = document.getElementById('card-salawat-progress');
    if (cardSalawatProgress && this.salawatTracker) {
      const done = this.salawatTracker.getTodayCount();
      cardSalawatProgress.textContent = done > 0 ? `${done} من 5 صلوات اليوم ✅` : 'ابدأ رحلتك اليوم!';
    }
  }

  restoreGardenVisuals() {
    let types = [];
    for (let i = 0; i < (this.state.inventory.flower || 0); i++) types.push('flower');
    for (let i = 0; i < (this.state.inventory.apple || 0); i++) types.push('apple');
    for (let i = 0; i < (this.state.inventory.orange || 0); i++) types.push('orange');
    for (let i = 0; i < (this.state.inventory.star || 0); i++) types.push('star');

    types.slice(0, 20).forEach(t => this.garden.addItem(t));
  }

  setupEventListeners() {
    document.getElementById('header-greeting').addEventListener('click', () => {
      sounds.playPop();
      this.openWelcomeModal();
    });

    document.getElementById('btn-save-profile').addEventListener('click', () => {
      this.saveChildProfile();
    });

    document.querySelectorAll('.gender-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        sounds.playPop();
      });
    });

    // أذكار
    document.getElementById('water-action-btn').addEventListener('click', () => {
      this.handleWaterTap();
    });

    document.getElementById('btn-next').addEventListener('click', () => {
      sounds.playPop();
      this.nextDhikr();
    });

    document.getElementById('btn-prev').addEventListener('click', () => {
      sounds.playPop();
      this.prevDhikr();
    });

    document.getElementById('btn-speak').addEventListener('click', () => {
      const btn = document.getElementById('btn-speak');
      const dhikr = this.getCurrentDhikr();
      if (!dhikr) return;
      if (sounds.isSpeaking && btn.classList.contains('speaking-active')) {
        sounds.stopSpeaking();
        btn.classList.remove('speaking-active');
        return;
      }
      this.clearAllSpeakingStyles();
      btn.classList.add('speaking-active');
      sounds.speakArabic(dhikr.arabic, () => {
        btn.classList.remove('speaking-active');
      });
    });

    // صلاة
    document.getElementById('btn-prayer-speak').addEventListener('click', () => {
      const btn = document.getElementById('btn-prayer-speak');
      const step = PRAYER_STEPS[this.currentPrayerStep];
      if (!step) return;
      if (sounds.isSpeaking && btn.classList.contains('speaking-active')) {
        sounds.stopSpeaking();
        btn.classList.remove('speaking-active');
        return;
      }
      this.clearAllSpeakingStyles();
      btn.classList.add('speaking-active');
      sounds.speakArabic(step.arabic, () => {
        btn.classList.remove('speaking-active');
      });
    });

    document.getElementById('btn-prayer-next').addEventListener('click', () => {
      sounds.stopSpeaking();
      this.clearAllSpeakingStyles();
      this.nextPrayerStep();
    });

    document.getElementById('btn-prayer-prev').addEventListener('click', () => {
      sounds.stopSpeaking();
      this.clearAllSpeakingStyles();
      this.prevPrayerStep();
    });

    // عقيدة
    document.getElementById('btn-aq-speak').addEventListener('click', () => {
      const btn = document.getElementById('btn-aq-speak');
      const lesson = AQEEDAH_LESSONS[this.currentAqeedahIndex];
      if (!lesson) return;
      if (sounds.isSpeaking && btn.classList.contains('speaking-active')) {
        sounds.stopSpeaking();
        btn.classList.remove('speaking-active');
        return;
      }
      this.clearAllSpeakingStyles();
      btn.classList.add('speaking-active');
      sounds.speakArabic(lesson.text, () => {
        btn.classList.remove('speaking-active');
      });
    });

    document.getElementById('btn-aq-next').addEventListener('click', () => {
      sounds.stopSpeaking();
      this.clearAllSpeakingStyles();
      this.nextAqeedahLesson();
    });

    document.getElementById('btn-aq-prev').addEventListener('click', () => {
      sounds.stopSpeaking();
      this.clearAllSpeakingStyles();
      this.prevAqeedahLesson();
    });

    // التحكم في حجم خط القراءة في عقيدتي
    let currentReadingSize = parseFloat(localStorage.getItem('bustan_reading_font_size') || '2.45');
    const applyFontSize = (size) => {
      currentReadingSize = Math.max(1.7, Math.min(size, 3.6));
      document.documentElement.style.setProperty('--reading-font-size', `${currentReadingSize}rem`);
      localStorage.setItem('bustan_reading_font_size', currentReadingSize.toString());
    };
    applyFontSize(currentReadingSize);

    const btnZoomIn = document.getElementById('btn-font-zoom-in');
    const btnZoomOut = document.getElementById('btn-font-zoom-out');
    const btnZoomReset = document.getElementById('btn-font-reset');

    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => {
        sounds.playPop();
        applyFontSize(currentReadingSize + 0.25);
      });
    }
    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => {
        sounds.playPop();
        applyFontSize(currentReadingSize - 0.25);
      });
    }
    if (btnZoomReset) {
      btnZoomReset.addEventListener('click', () => {
        sounds.playPop();
        applyFontSize(2.45);
      });
    }

    // نوافذ التهنئة
    document.getElementById('close-congrat-btn').addEventListener('click', () => {
      this.closeCongratModal();
    });

    document.getElementById('close-prayer-congrat-btn').addEventListener('click', () => {
      this.closePrayerCongratModal();
    });

    document.getElementById('close-aq-congrat-btn').addEventListener('click', () => {
      sounds.playPop();
      document.getElementById('aqeedah-congrat-modal').classList.remove('active');
      this.nextAqeedahLesson();
    });

    // المعرض والصوت
    document.getElementById('btn-gallery').addEventListener('click', () => {
      sounds.playPop();
      this.openGallery();
    });

    document.getElementById('close-gallery-btn').addEventListener('click', () => {
      sounds.playPop();
      document.getElementById('gallery-modal').classList.remove('active');
    });

    const soundToggle = document.getElementById('btn-sound-toggle');
    soundToggle.addEventListener('click', () => {
      sounds.enabled = !sounds.enabled;
      soundToggle.textContent = sounds.enabled ? '🔊' : '🔇';
    });

    // زر تحديث التطبيق ومسح الكاش
    const forceRefreshBtn = document.getElementById('btn-force-refresh');
    if (forceRefreshBtn) {
      forceRefreshBtn.addEventListener('click', async () => {
        sounds.playPop();
        forceRefreshBtn.style.transition = 'transform 0.5s ease';
        forceRefreshBtn.style.transform = 'rotate(360deg)';
        try {
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
          }
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(r => r.unregister()));
          }
        } catch (e) {
          console.warn(e);
        }
        window.location.href = window.location.origin + window.location.pathname + '?v12=' + Date.now();
      });
    }

    // أزرار مشاركة التطبيق عبر واتساب
    const btnHeaderShareWa = document.getElementById('btn-header-share-wa');
    if (btnHeaderShareWa) {
      btnHeaderShareWa.addEventListener('click', () => this.shareAppViaWhatsApp());
    }

    const btnHomeShareWa = document.getElementById('btn-share-whatsapp-home');
    if (btnHomeShareWa) {
      btnHomeShareWa.addEventListener('click', () => this.shareAppViaWhatsApp());
    }

    const btnSettingsShareWa = document.getElementById('btn-share-whatsapp-settings');
    if (btnSettingsShareWa) {
      btnSettingsShareWa.addEventListener('click', () => this.shareAppViaWhatsApp());
    }
  }

  shareAppViaWhatsApp() {
    sounds.playPop();
    const appUrl = 'https://bustan-alazkar.vercel.app/';
    const shareText = 
`🌟 *تطبيق «البَطَلُ المُسْلِم» للأطفال* 🌟
تطبيق إسلامي تفاعلي مميز ومجاني يُحبّب أبناءنا في الطاعات ويدربهم عليها يومياً:

🌿 *بُستان الأذكار:* أذكار الصباح والمساء وشجرة الحسنات التفاعلية
🕌 *تعلّم الصلاة:* خطوات الوضوء والصلاة خطوة بخطوة بالصور التوضيحية والصوت
📖 *عَقِيدَتِي نُورِي:* أركان الإيمان وتدريب القراءة السليمة بالتشكيل
💰 *صَلَوَاتِي:* تتبع الصلوات الخمس بجدول أسبوعي تفاعلي ومكافآت تشجيعية

📲 *افتح التطبيق وثبّته مباشرة على هاتفك (مجاناً بدون متجر):*
${appUrl}

«مَنْ دَلَّ عَلَى خَيْرٍ فَلَهُ مِثْلُ أَجْرِ فَاعِلِهِ» 🤲💚`;

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, '_blank');
  }

  // ========== 🕌 قسم صلواتي ==========
  setupSalawatUI() {
    // التنقل بين الأسابيع في جدول الصلوات
    const btnPrevWeek = document.getElementById('btn-prev-week');
    if (btnPrevWeek) {
      btnPrevWeek.addEventListener('click', () => {
        sounds.playPop();
        this.currentWeekOffset--;
        this.renderSalawatSection();
      });
    }

    const btnNextWeek = document.getElementById('btn-next-week');
    if (btnNextWeek) {
      btnNextWeek.addEventListener('click', () => {
        sounds.playPop();
        this.currentWeekOffset++;
        this.renderSalawatSection();
      });
    }

    const btnCurrentWeek = document.getElementById('btn-current-week');
    if (btnCurrentWeek) {
      btnCurrentWeek.addEventListener('click', () => {
        sounds.playPop();
        this.currentWeekOffset = 0;
        this.renderSalawatSection();
      });
    }

    // Modal تسجيل المكان / الفائتة
    const btnMosque = document.getElementById('btn-choose-mosque');
    if (btnMosque) {
      btnMosque.addEventListener('click', () => {
        if (!this._pendingSalahId) return;
        const salahId = this._pendingSalahId;
        const dateKey = this._pendingDateKey;
        this.closePlaceModal();
        this.recordSalahAndShow(salahId, 'mosque', dateKey);
      });
    }

    const btnHome = document.getElementById('btn-choose-home');
    if (btnHome) {
      btnHome.addEventListener('click', () => {
        if (!this._pendingSalahId) return;
        const salahId = this._pendingSalahId;
        const dateKey = this._pendingDateKey;
        this.closePlaceModal();
        this.recordSalahAndShow(salahId, 'home', dateKey);
      });
    }

    const btnMissed = document.getElementById('btn-choose-missed');
    if (btnMissed) {
      btnMissed.addEventListener('click', () => {
        if (!this._pendingSalahId) return;
        const salahId = this._pendingSalahId;
        const dateKey = this._pendingDateKey;
        this.closePlaceModal();
        this.recordSalahAndShow(salahId, 'missed', dateKey);
      });
    }

    const btnClear = document.getElementById('btn-choose-clear');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (!this._pendingSalahId) return;
        const salahId = this._pendingSalahId;
        const dateKey = this._pendingDateKey;
        this.closePlaceModal();
        this.recordSalahAndShow(salahId, 'clear', dateKey);
      });
    }

    const btnCancelChoice = document.getElementById('btn-choice-cancel');
    if (btnCancelChoice) {
      btnCancelChoice.addEventListener('click', () => {
        sounds.playPop();
        this.closePlaceModal();
      });
    }

    const placeModalOverlay = document.getElementById('salawat-place-modal');
    if (placeModalOverlay) {
      placeModalOverlay.addEventListener('click', (e) => {
        if (e.target === placeModalOverlay) {
          sounds.playPop();
          this.closePlaceModal();
        }
      });
    }

    const btnWeek = document.getElementById('btn-salawat-week');
    if (btnWeek) {
      btnWeek.addEventListener('click', () => {
        sounds.playPop();
        this.openWeekModal();
      });
    }

    const btnBadges = document.getElementById('btn-salawat-badges');
    if (btnBadges) {
      btnBadges.addEventListener('click', () => {
        sounds.playPop();
        this.openBadgesModal();
      });
    }

    const btnCloseCongrat = document.getElementById('close-salawat-congrat-btn');
    if (btnCloseCongrat) {
      btnCloseCongrat.addEventListener('click', () => {
        sounds.playPop();
        document.getElementById('salawat-congrat-modal').classList.remove('active');
      });
    }

    const congratModalOverlay = document.getElementById('salawat-congrat-modal');
    if (congratModalOverlay) {
      congratModalOverlay.addEventListener('click', (e) => {
        if (e.target === congratModalOverlay) {
          sounds.playPop();
          congratModalOverlay.classList.remove('active');
        }
      });
    }

    const btnCloseWeek = document.getElementById('close-week-modal-btn');
    if (btnCloseWeek) {
      btnCloseWeek.addEventListener('click', () => {
        sounds.playPop();
        document.getElementById('salawat-week-modal').classList.remove('active');
      });
    }

    const btnCloseBadges = document.getElementById('close-badges-modal-btn');
    if (btnCloseBadges) {
      btnCloseBadges.addEventListener('click', () => {
        sounds.playPop();
        document.getElementById('salawat-badges-modal').classList.remove('active');
      });
    }

    const btnSalawatSettings = document.getElementById('btn-salawat-settings');
    if (btnSalawatSettings) {
      btnSalawatSettings.addEventListener('click', () => {
        sounds.playPop();
        this.openSettingsModal();
      });
    }

    // زر إعادة الاستماع للتشجيع الصوتي
    const btnSpeakEnc = document.getElementById('btn-salawat-speak-encouragement');
    if (btnSpeakEnc) {
      btnSpeakEnc.addEventListener('click', () => {
        if (!this.currentEncouragementPhrase) return;
        sounds.stopSpeaking();
        if (typeof sounds.speakOnline === 'function') {
          sounds.speakOnline(this.currentEncouragementPhrase);
        } else {
          sounds.speakArabic(this.currentEncouragementPhrase);
        }
      });
    }

    this._pendingSalahId = null;
    this._pendingDateKey = null;
  }

  openPlaceModal(salah, targetDateKey = null, dayLabel = '') {
    if (!this.salawatTracker) return;
    const dateKey = targetDateKey || this.salawatTracker._today();
    this._pendingSalahId = salah.id;
    this._pendingDateKey = dateKey;

    const iconEl = document.getElementById('choice-salah-icon');
    if (iconEl) iconEl.textContent = salah.icon;

    const titleEl = document.getElementById('choice-salah-title');
    if (titleEl) {
      const isToday = (dateKey === this.salawatTracker._today());
      titleEl.textContent = `تسجيل صلاة ${salah.name}` + (isToday ? ' (اليوم)' : (dayLabel ? ` (${dayLabel})` : ''));
    }

    const subtitleEl = document.getElementById('choice-salah-subtitle');
    if (subtitleEl) {
      subtitleEl.textContent = `أين أدّيت صلاة ${salah.name} يا بطلنا؟ 🤲`;
    }

    const s = this.rewardsSettings;
    const rMosque = Number(s.rewardMosque ?? 5);
    const rHome = Number(s.rewardHome ?? 2);
    const bFajr = Number(s.bonusFajr ?? 1);
    const cur = s.currencyName || 'جنيه';
    const isFajr = (salah.id === 'fajr');

    const rewMosqueEl = document.getElementById('sheet-reward-mosque');
    if (rewMosqueEl) rewMosqueEl.textContent = `+${rMosque + (isFajr ? bFajr : 0)} ${cur}`;

    const rewHomeEl = document.getElementById('sheet-reward-home');
    if (rewHomeEl) rewHomeEl.textContent = `+${rHome + (isFajr ? bFajr : 0)} ${cur}`;

    // إظهار زر المسح إذا كانت الصلاة مسجلة بالفعل في هذا التاريخ
    const history = this.salawatTracker.state.history || {};
    const rec = history[dateKey];
    const isRecorded = rec && rec[salah.id] && (rec[salah.id].done || rec[salah.id].missed);
    const btnMosque = document.getElementById('btn-choose-mosque');
    if (btnMosque) {
      btnMosque.onclick = () => {
        sounds.playPop();
        this.closePlaceModal();
        this.recordSalahAndShow(salah.id, 'mosque', dateKey);
      };
    }

    const btnHome = document.getElementById('btn-choose-home');
    if (btnHome) {
      btnHome.onclick = () => {
        sounds.playPop();
        this.closePlaceModal();
        this.recordSalahAndShow(salah.id, 'home', dateKey);
      };
    }

    const btnMissed = document.getElementById('btn-choose-missed');
    if (btnMissed) {
      btnMissed.onclick = () => {
        sounds.playPop();
        this.closePlaceModal();
        this.recordSalahAndShow(salah.id, 'missed', dateKey);
      };
    }

    const btnClear = document.getElementById('btn-choose-clear');
    if (btnClear) {
      if (isRecorded) {
        btnClear.classList.remove('hidden');
        btnClear.onclick = () => {
          sounds.playPop();
          this.closePlaceModal();
          this.recordSalahAndShow(salah.id, 'clear', dateKey);
        };
      } else {
        btnClear.classList.add('hidden');
        btnClear.onclick = null;
      }
    }

    const modal = document.getElementById('salawat-place-modal');
    if (modal) modal.classList.add('active');
  }

  closePlaceModal() {
    const modal = document.getElementById('salawat-place-modal');
    if (modal) modal.classList.remove('active');
  }

  renderSalawatSection() {
    if (!this.salawatTracker) return;
    const st = this.salawatTracker;
    const rec = st.getTodayRecord();
    const nick = this.profile.nickname || this.profile.name || 'بطلنا';
    const s = this.rewardsSettings;
    const cur = s.currencyName || 'جنيه';
    const rMosque = Number(s.rewardMosque ?? 5);
    const rHome = Number(s.rewardHome ?? 2);
    const bFajr = Number(s.bonusFajr ?? 1);

    // التاريخ الحالي
    const now = new Date();
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const dateEl = document.getElementById('salawat-date');
    if (dateEl) {
      dateEl.textContent = `${days[now.getDay()]}، ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    }

    const greetingEl = document.getElementById('salawat-greeting');
    if (greetingEl) {
      greetingEl.textContent = `تقبّل الله يا ${nick}! 🤲`;
    }

    // إحصائيات اليوم
    const todayCoins = st.getTodayCoins();
    const doneCount = st.getTodayCount();

    const todayCoinsEl = document.getElementById('salawat-today-coins');
    if (todayCoinsEl) todayCoinsEl.textContent = todayCoins;

    const doneCountEl = document.getElementById('salawat-done-count');
    if (doneCountEl) doneCountEl.textContent = doneCount;

    const progBar = document.getElementById('salawat-progress-bar');
    if (progBar) progBar.style.width = `${(doneCount / 5) * 100}%`;

    // الميزان الكلي
    const totalMoneyEl = document.getElementById('salawat-total-money');
    if (totalMoneyEl) totalMoneyEl.textContent = st.getPocketMoney();

    const streakEl = document.getElementById('salawat-streak');
    if (streakEl) streakEl.textContent = st.getStats().longestStreak;

    // ================= جدول الصلوات الأسبوعي التفاعلي =================
    const weekSchedule = st.getWeekSchedule(this.currentWeekOffset);
    const weekRangeEl = document.getElementById('week-range-label');
    if (weekRangeEl) {
      weekRangeEl.textContent = (this.currentWeekOffset === 0 ? '🌟 الأسبوع الحالي: ' : '') + weekSchedule.rangeLabel;
    }

    const btnCurrentWeek = document.getElementById('btn-current-week');
    if (btnCurrentWeek) {
      if (this.currentWeekOffset !== 0) {
        btnCurrentWeek.classList.remove('hidden');
      } else {
        btnCurrentWeek.classList.add('hidden');
      }
    }

    // بطاقات إحصائيات الأسبوع
    const statMosqueEl = document.getElementById('stat-week-mosque');
    if (statMosqueEl) statMosqueEl.textContent = weekSchedule.stats.totalMosque;

    const statHomeEl = document.getElementById('stat-week-home');
    if (statHomeEl) statHomeEl.textContent = weekSchedule.stats.totalHome;

    const statMissedEl = document.getElementById('stat-week-missed');
    if (statMissedEl) statMissedEl.textContent = weekSchedule.stats.totalMissed;

    const statCoinsEl = document.getElementById('stat-week-coins');
    if (statCoinsEl) statCoinsEl.textContent = weekSchedule.stats.totalCoins;

    // بناء الجدول الأسبوعي
    const tableWrap = document.getElementById('salawat-week-table-wrap');
    if (tableWrap) {
      let tblHtml = '<table class="salawat-week-table"><thead><tr>';
      tblHtml += '<th class="col-sticky-salah">الصلاة</th>';
      weekSchedule.days.forEach(d => {
        const thCls = d.isToday ? 'col-today-header' : '';
        tblHtml += `<th class="${thCls}">${d.dayName}<br><span class="col-date">${d.dayNumber} ${d.monthName}</span>${d.isToday ? ' <span class="today-tag">اليوم</span>' : ''}</th>`;
      });
      tblHtml += '</tr></thead><tbody>';

      SALAWAT.forEach(salah => {
        tblHtml += `<tr><td class="col-sticky-salah"><span class="table-salah-icon">${salah.icon}</span> ${salah.name}</td>`;
        weekSchedule.days.forEach(d => {
          const p = d.prayers[salah.id];
          const tdCls = d.isToday ? 'col-today-cell' : '';
          let cellState = 'cell-state-future';
          let iconHtml = '⏳';
          let tagHtml = 'قادمة';
          let rewardHtml = '';

          if (p.status === 'done') {
            cellState = (p.place === 'mosque') ? 'cell-state-mosque' : 'cell-state-home';
            iconHtml = (p.place === 'mosque') ? '✅ 🕌' : '✅ 🏠';
            tagHtml = (p.place === 'mosque') ? 'مسجد' : 'بيت';
            rewardHtml = `<span class="week-cell-reward">+${p.reward} ${cur}</span>`;
          } else if (p.status === 'missed') {
            cellState = 'cell-state-missed';
            iconHtml = '❌';
            tagHtml = 'لم تُصلَّ';
          } else if (p.status === 'pending') {
            cellState = 'cell-state-pending';
            iconHtml = '➕';
            tagHtml = 'سجّل الآن';
          }

          tblHtml += `
            <td class="${tdCls}">
              <button type="button" class="week-cell-btn ${cellState}" data-salah="${salah.id}" data-date="${d.dateKey}" data-day="${d.dayName}" title="${salah.name} - ${d.dayName}">
                <span class="week-cell-icon">${iconHtml}</span>
                <span class="week-cell-tag">${tagHtml}</span>
                ${rewardHtml}
              </button>
            </td>
          `;
        });
        tblHtml += '</tr>';
      });

      tblHtml += '</tbody></table>';
      tableWrap.innerHTML = tblHtml;

      // التمرير التلقائي السلس إلى عمود اليوم على شاشات الهواتف
      const todayTh = tableWrap.querySelector('.col-today-header');
      if (todayTh && this.currentWeekOffset === 0) {
        setTimeout(() => {
          todayTh.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }, 120);
      }

      // ربط أحداث النقر على كل خلايا الجدول الأسبوعي
      tableWrap.querySelectorAll('.week-cell-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const salahId = btn.getAttribute('data-salah');
          const dateKey = btn.getAttribute('data-date');
          const dayName = btn.getAttribute('data-day');
          const salahObj = SALAWAT.find(s => s.id === salahId);
          if (salahObj) {
            sounds.playPop();
            this.openPlaceModal(salahObj, dateKey, dayName);
          }
        });
      });
    }

    // ================= بناء بطاقات صلوات اليوم السريعة =================
    const grid = document.getElementById('salawat-grid');
    if (grid) {
      grid.innerHTML = '';
      SALAWAT.forEach(salah => {
        const entry = rec[salah.id];
        const done = entry && entry.done;
        const missed = entry && entry.missed;
        const place = done ? entry.place : null;

        const row = document.createElement('div');
        let stateClass = '';
        if (done) stateClass = (place === 'mosque' ? 'done-mosque' : 'done-home');
        else if (missed) stateClass = 'done-missed';
        row.className = `salah-row ${stateClass}`;

        let statusText = 'اضغط للتسجيل';
        let rewardText = '';
        if (done) {
          statusText = place === 'mosque' ? '✅ صليت في المسجد 🕌' : '✅ صليت في البيت 🏠';
          rewardText = place === 'mosque' ? `+${rMosque}` : `+${rHome}`;
          if (salah.id === 'fajr') rewardText += `+${bFajr}`;
          rewardText += ` ${cur}`;
        } else if (missed) {
          statusText = '❌ لم تُصلَّ (فاتت)';
        }

        row.innerHTML = `
          <span class="salah-icon">${salah.icon}</span>
          <div class="salah-info">
            <div class="salah-name">${salah.name}</div>
            <div class="salah-status ${done ? 'done' : (missed ? 'missed' : '')}">${statusText}</div>
          </div>
          ${done ? `<span class="salah-reward-badge">${rewardText} 💰</span>` : ''}
          ${missed ? `<span class="salah-reward-badge missed-badge">❌ فاتت</span>` : ''}
        `;

        row.addEventListener('click', () => {
          sounds.playPop();
          this.openPlaceModal(salah, st._today(), 'اليوم');
        });

        grid.appendChild(row);
      });
    }
  }

  recordSalahAndShow(salahId, action, targetDateKey = null) {
    if (!this.salawatTracker) return;
    const dateKey = targetDateKey || this.salawatTracker._today();
    const result = this.salawatTracker.recordSalah(salahId, action, dateKey);
    if (!result) return;

    if (action === 'clear' || action === 'missed') {
      sounds.playPop();
      this.renderSalawatSection();
      this.updateUI();
      return;
    }

    // إشعار بالنجاح وتشجيع تفاعلي
    sounds.playVictory();
    sounds.playCoin();
    this.confetti.burst(70);

    // تحديث الواجهة
    this.renderSalawatSection();
    this.updateUI();

    // إعداد modal التهنئة
    const nick = this.profile.nickname || this.profile.name || 'بطل';
    const cur = this.rewardsSettings.currencyName || 'جنيه';
    const nameEl = document.getElementById('salawat-congrat-name');
    if (nameEl) nameEl.textContent = nick;

    const iconEl = document.getElementById('salawat-congrat-icon');
    if (iconEl) iconEl.textContent = (action === 'mosque' ? '🕌' : '🏠');

    const descEl = document.getElementById('salawat-congrat-desc');
    if (descEl) {
      descEl.textContent = `صليت ${result.salah.name} في ${action === 'mosque' ? 'المسجد 🕌' : 'البيت 🏠'}`;
    }

    let rewardText = `+${result.reward} ${cur}`;
    if (result.isFajrBonus) {
      const bFajr = Number(this.rewardsSettings.bonusFajr ?? 1);
      rewardText += ` (شامل بونص الفجر +${bFajr})`;
    }
    const rewardEl = document.getElementById('salawat-congrat-reward');
    if (rewardEl) rewardEl.textContent = rewardText;

    const totalEl = document.getElementById('salawat-congrat-total');
    if (totalEl) totalEl.textContent = this.salawatTracker.getPocketMoney();

    // عبارات التشجيع التفاعلية المخصصة للمسجد والبيت
    let phrase = '';
    if (action === 'mosque') {
      const mosquePhrases = [
        `مَا شَاءَ اللَّهُ تَبَارَكَ اللَّهُ! أَحْسَنْتَ يَا ${nick}، صَلَّيْتَ ${result.salah.name} فِي الْمَسْجِدِ، صَلَاةُ الْجَمَاعَةِ نُورٌ وَأَجْرٌ عَظِيمٌ!`,
        `تَقَبَّلَ اللَّهُ صَلَاتَكَ يَا بَطَلَ الْمَسْجِدِ! خُطُوَاتُكَ إِلَى بَيْتِ اللَّهِ حَسَنَاتٌ وَرِفْعَةٌ فِي الدَّرَجَاتِ!`,
        `يَا لَهُ مِنْ بَطَلٍ مُبَارَكٍ! صَلَّيْتَ فِي الْمَسْجِدِ وَرَبِحْتَ ${result.reward} ${cur} فِي مِيزَانِكَ!`,
        `هَنِيئاً لَكَ يَا ${nick}! قَلْبُكَ مُعَلَّقٌ بِالْمَسَاجِدِ، بَارَكَ اللَّهُ فِيكَ وَحَفِظَكَ!`
      ];
      phrase = mosquePhrases[Math.floor(Math.random() * mosquePhrases.length)];
    } else {
      const homePhrases = [
        `تَقَبَّلَ اللَّهُ صَلَاتَكَ يَا ${nick}! صَلَاتُكَ نُورٌ لِقَلْبِكَ وَبَرَكَةٌ لِيَوْمِكَ.`,
        `أَحْسَنْتَ يَا بَطَلَنَا! حَافَظْتَ عَلَى صَلَاتِكَ فِي وَقْتِهَا، مَاشَاءَ اللَّهُ عَلَيْكَ!`
      ];
      phrase = homePhrases[Math.floor(Math.random() * homePhrases.length)];
    }

    this.currentEncouragementPhrase = phrase;
    const encCard = document.getElementById('salawat-encouragement-card');
    const encText = document.getElementById('salawat-encouragement-text');
    if (encCard && encText) {
      encText.textContent = phrase;
      encCard.style.display = 'block';
    }

    // قراءة التشجيع بصوت أونلاين عبر النت (نفس محرك تطبيق kids)
    if (sounds.enabled) {
      setTimeout(() => {
        if (typeof sounds.speakOnline === 'function') {
          sounds.speakOnline(phrase);
        } else {
          sounds.speakArabic(phrase);
        }
      }, 550);
    }

    // شارة جديدة؟
    const badgeEl = document.getElementById('salawat-new-badge');
    if (badgeEl) {
      if (result.newBadges && result.newBadges.length > 0) {
        const b = result.newBadges[0];
        const badgeNameEl = document.getElementById('salawat-badge-name');
        if (badgeNameEl) badgeNameEl.textContent = `${b.icon} ${b.name}`;
        badgeEl.classList.remove('hidden');
      } else {
        badgeEl.classList.add('hidden');
      }
    }

    const congratModal = document.getElementById('salawat-congrat-modal');
    if (congratModal) congratModal.classList.add('active');
  }

  openWeekModal() {
    if (!this.salawatTracker) return;
    const days7 = this.salawatTracker.getWeeklyStats();
    const dayNames = ['أحد', 'اثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];

    let totalCoins = 0;

    let tableHtml = '<table><thead><tr><th>الصلاة</th>';
    days7.forEach(d => {
      const date = new Date(d.key + 'T00:00:00');
      tableHtml += `<th>${dayNames[date.getDay()]}<br><small>${date.getDate()}</small></th>`;
    });
    tableHtml += '</tr></thead><tbody>';

    SALAWAT.forEach(salah => {
      tableHtml += `<tr><td><strong>${salah.icon} ${salah.name}</strong></td>`;
      days7.forEach(d => {
        if (!d.record) {
          tableHtml += '<td class="cell-missed">-</td>';
        } else {
          const entry = d.record[salah.id];
          if (entry && entry.done) {
            const cls = entry.place === 'mosque' ? 'cell-done-mosque' : 'cell-done-home';
            const ico = entry.place === 'mosque' ? '🕌' : '🏠';
            const rMosque = Number(this.rewardsSettings.rewardMosque ?? salah.rewardMosque);
            const rHome = Number(this.rewardsSettings.rewardHome ?? salah.rewardHome);
            totalCoins += (entry.place === 'mosque' ? rMosque : rHome);
            tableHtml += `<td class="${cls}">${ico}</td>`;
          } else {
            tableHtml += '<td class="cell-missed">⬜</td>';
          }
        }
      });
      tableHtml += '</tr>';
    });

    tableHtml += '</tbody></table>';

    const gridEl = document.getElementById('week-grid');
    if (gridEl) gridEl.innerHTML = tableHtml;

    const coinsEl = document.getElementById('week-total-coins');
    if (coinsEl) coinsEl.textContent = totalCoins;

    const modal = document.getElementById('salawat-week-modal');
    if (modal) modal.classList.add('active');
  }

  openBadgesModal() {
    if (!this.salawatTracker) return;
    const badges = this.salawatTracker.getBadges();
    const grid = document.getElementById('badges-grid');
    if (!grid) return;
    grid.innerHTML = '';

    badges.forEach(b => {
      const div = document.createElement('div');
      div.className = `badge-item ${b.earned ? 'earned' : 'locked'}`;
      div.innerHTML = `
        <div class="badge-icon">${b.earned ? b.icon : '🔒'}</div>
        <div class="badge-name">${b.name}</div>
        <div class="badge-desc">${b.earned ? b.desc : (b.desc || 'لم تُفتح بعد')}</div>
      `;
      grid.appendChild(div);
    });

    const modal = document.getElementById('salawat-badges-modal');
    if (modal) modal.classList.add('active');
  }

  // ========== ⚙️ إدارة إعدادات المكافآت والحصالة ==========
  loadRewardsSettings() {
    try {
      const raw = localStorage.getItem('bustan_rewards_settings');
      if (raw) {
        return Object.assign({}, DEFAULT_REWARDS_SETTINGS, JSON.parse(raw));
      }
    } catch (e) {
      console.warn('Error loading rewards settings:', e);
    }
    return Object.assign({}, DEFAULT_REWARDS_SETTINGS);
  }

  saveRewardsSettings(newSettings) {
    this.rewardsSettings = Object.assign({}, DEFAULT_REWARDS_SETTINGS, newSettings);
    try {
      localStorage.setItem('bustan_rewards_settings', JSON.stringify(this.rewardsSettings));
    } catch (e) {
      console.warn('Error saving rewards settings:', e);
    }
    this.applyRewardsSettings();
    if (this.salawatTracker) {
      this.renderSalawatSection();
    }
    this.updateUI();
  }

  applyRewardsSettings() {
    const cur = this.rewardsSettings.currencyName || 'جنيه';
    document.querySelectorAll('.currency-label').forEach(el => {
      el.textContent = cur;
    });

    const sheetRewMosque = document.getElementById('sheet-reward-mosque');
    if (sheetRewMosque) {
      sheetRewMosque.textContent = `+${this.rewardsSettings.rewardMosque} ${cur}`;
    }
    const sheetRewHome = document.getElementById('sheet-reward-home');
    if (sheetRewHome) {
      sheetRewHome.textContent = `+${this.rewardsSettings.rewardHome} ${cur}`;
    }
  }

  setupSettingsUI() {
    // زر فتح الإعدادات في شريط الرأس
    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) {
      btnSettings.addEventListener('click', () => {
        sounds.playPop();
        this.openSettingsModal();
      });
    }

    // زر الإلغاء والإغلاق
    const btnCloseSettings = document.getElementById('close-settings-modal-btn');
    if (btnCloseSettings) {
      btnCloseSettings.addEventListener('click', () => {
        sounds.playPop();
        this.closeSettingsModal();
      });
    }

    // أزرار العملات السريعة
    document.querySelectorAll('.currency-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sounds.playPop();
        const val = btn.dataset.val;
        const curInput = document.getElementById('setting-currency');
        if (curInput) curInput.value = val;
        document.querySelectorAll('.currency-pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // زر حفظ الإعدادات
    const btnSaveSettings = document.getElementById('btn-save-settings');
    if (btnSaveSettings) {
      btnSaveSettings.addEventListener('click', (e) => {
        e.preventDefault();
        this.saveSettingsFromForm();
      });
    }

    // زر استعادة الافتراضي
    const btnResetSettings = document.getElementById('btn-reset-settings');
    if (btnResetSettings) {
      btnResetSettings.addEventListener('click', () => {
        sounds.playPop();
        this.populateSettingsForm(DEFAULT_REWARDS_SETTINGS);
      });
    }
  }

  openSettingsModal() {
    this.populateSettingsForm(this.rewardsSettings);
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.add('active');
  }

  closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) modal.classList.remove('active');
  }

  populateSettingsForm(settings) {
    const s = settings || this.rewardsSettings;
    const curInput = document.getElementById('setting-currency');
    if (curInput) curInput.value = s.currencyName || 'جنيه';

    document.querySelectorAll('.currency-pill-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.val === (s.currencyName || 'جنيه'));
    });

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };

    setVal('setting-reward-mosque', s.rewardMosque ?? 5);
    setVal('setting-reward-home', s.rewardHome ?? 2);
    setVal('setting-bonus-fajr', s.bonusFajr ?? 1);
    setVal('setting-bonus-day', s.bonusPerfectDay ?? 5);
    setVal('setting-bonus-week', s.bonusPerfectWeek ?? 20);
    setVal('setting-reward-dhikr', s.rewardDhikr ?? 30);
    setVal('setting-reward-prayer-lesson', s.rewardPrayerLesson ?? 50);
    setVal('setting-reward-aqeedah-lesson', s.rewardAqeedahLesson ?? 25);
  }

  saveSettingsFromForm() {
    const curInput = document.getElementById('setting-currency');
    const currencyName = (curInput ? curInput.value.trim() : '') || 'جنيه';

    const getVal = (id, defaultVal) => {
      const el = document.getElementById(id);
      const val = el ? parseInt(el.value, 10) : defaultVal;
      return isNaN(val) ? defaultVal : Math.max(0, val);
    };

    const newSettings = {
      currencyName,
      rewardMosque: getVal('setting-reward-mosque', 5),
      rewardHome: getVal('setting-reward-home', 2),
      bonusFajr: getVal('setting-bonus-fajr', 1),
      bonusPerfectDay: getVal('setting-bonus-day', 5),
      bonusPerfectWeek: getVal('setting-bonus-week', 20),
      rewardDhikr: getVal('setting-reward-dhikr', 30),
      rewardPrayerLesson: getVal('setting-reward-prayer-lesson', 50),
      rewardAqeedahLesson: getVal('setting-reward-aqeedah-lesson', 25)
    };

    this.saveRewardsSettings(newSettings);
    sounds.playVictory();
    this.confetti.burst(50);
    this.closeSettingsModal();
  }

  openGallery() {
    document.getElementById('gal-flowers').textContent = this.state.inventory.flower || 0;
    document.getElementById('gal-apples').textContent = this.state.inventory.apple || 0;
    document.getElementById('gal-oranges').textContent = this.state.inventory.orange || 0;
    document.getElementById('gal-stars').textContent = this.state.inventory.star || 0;
    document.getElementById('gal-water').textContent = this.state.inventory.totalWater || 0;
    document.getElementById('gal-coins').textContent = this.state.coins || 0;
    document.getElementById('gallery-modal').classList.add('active');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new AppController();
  app.init();
});
