// المتحكم الشامل لتطبيق بستان الأذكار ومدرب الصلاة للأطفال
class AppController {
  constructor() {
    this.garden = null;
    this.confetti = null;
    this.activeTab = 'azkar'; // 'azkar' أو 'prayer'

    // بيانات الطفل
    this.profile = {
      name: '',
      nickname: '',
      gender: 'boy' // 'boy' أو 'girl'
    };

    // حالة الأذكار
    this.currentCategory = 'all';
    this.filteredAzkar = [];
    this.currentDhikrIndex = 0;
    this.currentDhikrCount = 0;

    // حالة الصلاة
    this.currentPrayerIndex = 0;
    this.currentPrayerStep = 0;

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
        prayersCompleted: 0
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

    // تجهيز قسم الأذكار
    this.filterAzkar(this.currentCategory);
    this.setupCategoriesUI();
    this.renderCurrentDhikr();

    // تجهيز قسم الصلاة
    this.setupPrayersUI();
    this.renderCurrentPrayerStep();

    this.setupEventListeners();
    this.updateUI();
    this.restoreGardenVisuals();

    // فحص ما إذا كان الطفل قد سجل اسمه من قبل
    if (!this.profile.name) {
      setTimeout(() => {
        this.openWelcomeModal();
      }, 300);
    }

    // تسجيل الـ Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js').catch(err => {
        console.log('SW registration error:', err);
      });
    }
  }

  // ========== إدارة البيانات والحفظ ==========
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

    if (this.profile.name) {
      const title = this.profile.gender === 'girl' ? 'البطلة' : 'البطل';
      const nick = this.profile.nickname ? ` (${this.profile.nickname})` : '';
      avatarEl.textContent = this.profile.gender === 'girl' ? '👧' : '👦';
      textEl.textContent = `أهلاً بـ${title} ${this.profile.name}${nick}`;

      // تحديث الأسماء في النوافذ المنبثقة
      document.getElementById('congrat-child-name').textContent = this.profile.nickname || this.profile.name;
      document.getElementById('prayer-congrat-name').textContent = this.profile.nickname || this.profile.name;
      document.getElementById('gallery-child-name').textContent = this.profile.nickname || this.profile.name;
    } else {
      avatarEl.textContent = '🌱';
      textEl.textContent = 'اضغط لتسجيل اسمك يا بطل';
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

  // ========== التبديل بين قسمي الأذكار والصلاة ==========
  setupTabNavigation() {
    const tabAzkar = document.getElementById('tab-azkar-btn');
    const tabPrayer = document.getElementById('tab-prayer-btn');

    tabAzkar.addEventListener('click', () => {
      sounds.playPop();
      this.switchTab('azkar');
    });

    tabPrayer.addEventListener('click', () => {
      sounds.playPop();
      this.switchTab('prayer');
    });
  }

  switchTab(tab) {
    this.activeTab = tab;
    const tabAzkar = document.getElementById('tab-azkar-btn');
    const tabPrayer = document.getElementById('tab-prayer-btn');
    const secAzkar = document.getElementById('section-azkar');
    const secPrayer = document.getElementById('section-prayer');

    if (tab === 'azkar') {
      tabAzkar.classList.add('active-azkar');
      tabPrayer.classList.remove('active-prayer');
      secAzkar.classList.remove('hidden');
      secPrayer.classList.add('hidden');
    } else {
      tabAzkar.classList.remove('active-azkar');
      tabPrayer.classList.add('active-prayer');
      secAzkar.classList.add('hidden');
      secPrayer.classList.remove('hidden');
    }
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
    document.getElementById('prayer-step-icon').textContent = step.icon;
    document.getElementById('prayer-step-title').textContent = step.title;
    document.getElementById('prayer-step-action').textContent = step.action;
    document.getElementById('prayer-step-arabic').textContent = step.arabic;
    document.getElementById('prayer-step-tip').innerHTML = `💡 <b>نصيحة للبطل:</b> ${step.tip}`;

    // مؤشر شريط الخطوات
    const bar = document.getElementById('steps-progress-bar');
    bar.innerHTML = '';
    for (let i = 0; i < totalSteps; i++) {
      const dot = document.createElement('div');
      dot.className = `step-bar-dot ${i === this.currentPrayerStep ? 'active' : (i < this.currentPrayerStep ? 'completed' : '')}`;
      bar.appendChild(dot);
    }

    // تعديل أزرار التنقل
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
      // إتمام الصلاة
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

    // مكافأة إتمام الصلاة: +50 حسنة ونجمة ذهبية في البستان
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

  // ========== عام وإعدادات المستمعين ==========
  updateUI() {
    document.getElementById('coins-count').textContent = this.state.coins;
    document.getElementById('streak-count').textContent = `${this.state.streak} يوم`;

    document.getElementById('stat-flowers').textContent = this.state.inventory.flower;
    document.getElementById('stat-fruits').textContent = (this.state.inventory.apple || 0) + (this.state.inventory.orange || 0);
    document.getElementById('stat-stars').textContent = this.state.inventory.star;
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
    // تعديل الاسم من الرأس
    document.getElementById('header-greeting').addEventListener('click', () => {
      sounds.playPop();
      this.openWelcomeModal();
    });

    // حفظ الاسم في نافذة الترحيب
    document.getElementById('btn-save-profile').addEventListener('click', () => {
      this.saveChildProfile();
    });

    // أزرار اختيار الشخصية (ولد/بنت)
    document.querySelectorAll('.gender-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        sounds.playPop();
      });
    });

    // زر السقي بالأذكار
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

    // استمع للذكر
    document.getElementById('btn-speak').addEventListener('click', () => {
      const dhikr = this.getCurrentDhikr();
      if (dhikr) sounds.speakArabic(dhikr.arabic);
    });

    // استمع لخطوة الصلاة
    document.getElementById('btn-prayer-speak').addEventListener('click', () => {
      const step = PRAYER_STEPS[this.currentPrayerStep];
      if (step) sounds.speakArabic(step.arabic);
    });

    // أزرار خطوات الصلاة
    document.getElementById('btn-prayer-next').addEventListener('click', () => {
      this.nextPrayerStep();
    });

    document.getElementById('btn-prayer-prev').addEventListener('click', () => {
      this.prevPrayerStep();
    });

    // إغلاق نوافذ التهنئة
    document.getElementById('close-congrat-btn').addEventListener('click', () => {
      this.closeCongratModal();
    });

    document.getElementById('close-prayer-congrat-btn').addEventListener('click', () => {
      this.closePrayerCongratModal();
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
