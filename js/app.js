// تطبيق «البطل المسلم» للأطفال (أذكار، صلاة، وعقيدتي مع تدريب القراءة وتثبيت التطبيق)

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

    this.loadState();
    this.checkStreak();
  }

  init() {
    this.garden = new GardenTree('tree-canvas');
    this.confetti = new ConfettiEngine('confetti-canvas');

    this.setupProfileUI();
    this.setupTabNavigation();

    // تجهيز الأقسام الثلاثة
    this.filterAzkar(this.currentCategory);
    this.setupCategoriesUI();
    this.renderCurrentDhikr();

    this.setupPrayersUI();
    this.renderCurrentPrayerStep();

    this.setupAqeedahUI();
    this.renderCurrentAqeedahLesson();

    this.setupEventListeners();
    this.setupPWAInstallation();
    this.updateUI();
    this.restoreGardenVisuals();
    this.switchTab('home');

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

  // ========== التبديل بين الشاشة الرئيسية والأقسام الثلاثة ==========
  setupTabNavigation() {
    const tabHome = document.getElementById('tab-home-btn');
    const tabAzkar = document.getElementById('tab-azkar-btn');
    const tabPrayer = document.getElementById('tab-prayer-btn');
    const tabAqeedah = document.getElementById('tab-aqeedah-btn');
    const brandHomeLink = document.getElementById('brand-home-link');

    if (tabHome) {
      tabHome.addEventListener('click', () => {
        sounds.playPop();
        this.switchTab('home');
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

    // ربط الكروت الثلاثة الكبيرة في شاشة البداية للتنقل المباشر للأقسام
    const cardAzkar = document.getElementById('card-launch-azkar');
    const cardPrayer = document.getElementById('card-launch-prayer');
    const cardAqeedah = document.getElementById('card-launch-aqeedah');

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

    // ربط أزرار العودة للشاشة الرئيسية الموجودة أعلى كل قسم
    document.querySelectorAll('.btn-back-home').forEach(btn => {
      btn.addEventListener('click', () => {
        sounds.playPop();
        this.switchTab('home');
      });
    });
  }

  clearAllSpeakingStyles() {
    ['btn-speak', 'btn-prayer-speak', 'btn-aq-speak'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('speaking-active');
    });
  }

  switchTab(tab) {
    sounds.stopSpeaking();
    this.clearAllSpeakingStyles();
    this.activeTab = tab;
    const tabHome = document.getElementById('tab-home-btn');
    const tabAzkar = document.getElementById('tab-azkar-btn');
    const tabPrayer = document.getElementById('tab-prayer-btn');
    const tabAqeedah = document.getElementById('tab-aqeedah-btn');

    const secHome = document.getElementById('section-home');
    const secAzkar = document.getElementById('section-azkar');
    const secPrayer = document.getElementById('section-prayer');
    const secAqeedah = document.getElementById('section-aqeedah');

    if (tabHome) tabHome.className = 'nav-tab-btn';
    if (tabAzkar) tabAzkar.className = 'nav-tab-btn';
    if (tabPrayer) tabPrayer.className = 'nav-tab-btn';
    if (tabAqeedah) tabAqeedah.className = 'nav-tab-btn';

    if (secHome) secHome.classList.add('hidden');
    if (secAzkar) secAzkar.classList.add('hidden');
    if (secPrayer) secPrayer.classList.add('hidden');
    if (secAqeedah) secAqeedah.classList.add('hidden');

    if (tab === 'home') {
      if (tabHome) tabHome.classList.add('active-home');
      if (secHome) secHome.classList.remove('hidden');
      this.updateUI();
    } else if (tab === 'azkar') {
      if (tabAzkar) tabAzkar.classList.add('active-azkar');
      if (secAzkar) secAzkar.classList.remove('hidden');
      if (this.garden) this.garden.resize();
    } else if (tab === 'prayer') {
      if (tabPrayer) tabPrayer.classList.add('active-prayer');
      if (secPrayer) secPrayer.classList.remove('hidden');
    } else if (tab === 'aqeedah') {
      if (tabAqeedah) tabAqeedah.classList.add('active-aqeedah');
      if (secAqeedah) secAqeedah.classList.remove('hidden');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
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

    this.garden.addItem(dhikr.fruit);
    this.state.inventory[dhikr.fruit] = (this.state.inventory[dhikr.fruit] || 0) + 1;
    this.state.coins += dhikr.reward;
    this.saveState();
    this.updateUI();

    setTimeout(() => {
      this.showCongratModal(dhikr);
    }, 450);
  }

  showCongratModal(dhikr) {
    const fruitNames = {
      flower: 'زهرة عطرة 🌸',
      apple: 'تفاحة حمراء لذيذة 🍎',
      orange: 'برتقالة ناضجة 🍊',
      star: 'نجمة حسنات ذهبية ⭐'
    };

    document.getElementById('modal-fruit-name').textContent = fruitNames[dhikr.fruit] || 'ثمرة مباركة 🌱';
    document.getElementById('modal-reward-coins').textContent = `+${dhikr.reward}`;
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

    this.state.coins += 50;
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
        this.state.coins += 25;
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
        window.location.href = window.location.origin + window.location.pathname + '?v8=' + Date.now();
      });
    }
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
