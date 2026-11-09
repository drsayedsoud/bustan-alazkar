// المتحكم الرئيسي لتطبيق بستان الأذكار للأطفال
class AppController {
  constructor() {
    this.garden = null;
    this.confetti = null;
    this.currentCategory = 'all';
    this.filteredAzkar = [];
    this.currentIndex = 0;
    this.currentCount = 0;

    this.state = {
      coins: 0,
      streak: 1,
      lastDate: null,
      inventory: {
        flower: 0,
        apple: 0,
        orange: 0,
        star: 0,
        totalWater: 0
      }
    };

    this.loadState();
    this.checkStreak();
  }

  init() {
    this.garden = new GardenTree('tree-canvas');
    this.confetti = new ConfettiEngine('confetti-canvas');

    this.filterAzkar(this.currentCategory);
    this.setupCategoriesUI();
    this.renderCurrentDhikr();
    this.setupEventListeners();
    this.updateUI();
    this.restoreGardenVisuals();

    // تسجيل الـ Service Worker للعمل أوفلاين
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js').catch(err => {
        console.log('SW registration error:', err);
      });
    }
  }

  loadState() {
    try {
      const saved = localStorage.getItem('bustan_azkar_state');
      if (saved) {
        this.state = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load state', e);
    }
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
    this.currentIndex = 0;
    this.currentCount = 0;

    document.querySelectorAll('.cat-tab').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.includes(AZKAR_CATEGORIES.find(c => c.id === catId).name));
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
    return this.filteredAzkar[this.currentIndex] || this.filteredAzkar[0];
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
    document.getElementById('counter-current').textContent = this.currentCount;

    const dotsContainer = document.getElementById('dots-row');
    dotsContainer.innerHTML = '';

    const maxDots = Math.min(dhikr.target, 12);
    for (let i = 0; i < maxDots; i++) {
      const dot = document.createElement('div');
      dot.className = `target-dot ${i < this.currentCount ? 'filled' : ''}`;
      dotsContainer.appendChild(dot);
    }
  }

  // الضغط على زر السقي والتسبيح
  handleWaterTap() {
    const dhikr = this.getCurrentDhikr();
    if (!dhikr) return;

    // اهتزاز خفيف للأجهزة الداعمة
    if (navigator.vibrate) navigator.vibrate(25);

    sounds.playWaterDrop();
    this.garden.addWaterDrops();
    this.state.inventory.totalWater++;

    this.currentCount++;
    this.updateCounterUI();

    // اكتمال الذكر والوصول للهدف
    if (this.currentCount >= dhikr.target) {
      this.onDhikrCompleted(dhikr);
    }
  }

  onDhikrCompleted(dhikr) {
    sounds.playVictory();
    sounds.playBloom();
    sounds.playCoin();
    this.confetti.burst(60);

    // إضافة الثمرة أو الزهرة لشجرة الكانفاس وللمخزون
    this.garden.addItem(dhikr.fruit);
    this.state.inventory[dhikr.fruit] = (this.state.inventory[dhikr.fruit] || 0) + 1;
    this.state.coins += dhikr.reward;
    this.saveState();
    this.updateUI();

    // إظهار نافذة التهنئة
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
    this.currentIndex = (this.currentIndex + 1) % this.filteredAzkar.length;
    this.currentCount = 0;
    this.renderCurrentDhikr();
  }

  prevDhikr() {
    this.currentIndex = (this.currentIndex - 1 + this.filteredAzkar.length) % this.filteredAzkar.length;
    this.currentCount = 0;
    this.renderCurrentDhikr();
  }

  updateUI() {
    document.getElementById('coins-count').textContent = this.state.coins;
    document.getElementById('streak-count').textContent = `${this.state.streak} يوم`;

    document.getElementById('stat-flowers').textContent = this.state.inventory.flower;
    document.getElementById('stat-fruits').textContent = (this.state.inventory.apple || 0) + (this.state.inventory.orange || 0);
    document.getElementById('stat-stars').textContent = this.state.inventory.star;
  }

  restoreGardenVisuals() {
    // إعادة رسم الثمار الموجودة في المخزون على الشجرة
    const totalToDraw = Math.min(
      (this.state.inventory.flower || 0) +
      (this.state.inventory.apple || 0) +
      (this.state.inventory.orange || 0) +
      (this.state.inventory.star || 0),
      25
    );

    let types = [];
    for (let i = 0; i < (this.state.inventory.flower || 0); i++) types.push('flower');
    for (let i = 0; i < (this.state.inventory.apple || 0); i++) types.push('apple');
    for (let i = 0; i < (this.state.inventory.orange || 0); i++) types.push('orange');
    for (let i = 0; i < (this.state.inventory.star || 0); i++) types.push('star');

    // خلط وإضافة
    types.slice(0, 20).forEach(t => this.garden.addItem(t));
  }

  setupEventListeners() {
    // زر السقي والتسبيح
    const waterBtn = document.getElementById('water-action-btn');
    waterBtn.addEventListener('click', () => this.handleWaterTap());

    // أسهم التنقل
    document.getElementById('btn-next').addEventListener('click', () => {
      sounds.playPop();
      this.nextDhikr();
    });
    document.getElementById('btn-prev').addEventListener('click', () => {
      sounds.playPop();
      this.prevDhikr();
    });

    // استمع للذكر صوتياً
    document.getElementById('btn-speak').addEventListener('click', () => {
      const dhikr = this.getCurrentDhikr();
      if (dhikr) sounds.speakArabic(dhikr.arabic);
    });

    // زر حديقتي
    document.getElementById('btn-gallery').addEventListener('click', () => {
      sounds.playPop();
      this.openGallery();
    });

    document.getElementById('close-gallery-btn').addEventListener('click', () => {
      sounds.playPop();
      document.getElementById('gallery-modal').classList.remove('active');
    });

    document.getElementById('close-congrat-btn').addEventListener('click', () => {
      this.closeCongratModal();
    });

    // تبديل الصوت
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

// تشغيل التطبيق عند تحميل الصفحة
window.addEventListener('DOMContentLoaded', () => {
  const app = new AppController();
  app.init();
});
