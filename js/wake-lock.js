// Screen Wake Lock API لإبقاء الشاشة مضاءة دائماً أثناء القراءة والأذكار والصلوات
class WakeLockController {
  constructor() {
    this.wakeLock = null;
    this.isSupported = 'wakeLock' in navigator;
    this.init();
  }

  async requestWakeLock() {
    if (!this.isSupported) return;
    try {
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.wakeLock.addEventListener('release', () => {
        this.wakeLock = null;
      });
      console.log('[WakeLock] الشاشة ستبقى مضاءة دائماً');
    } catch (err) {
      console.warn('[WakeLock] غير متاح حالياً:', err.message);
    }
  }

  async releaseWakeLock() {
    if (this.wakeLock !== null) {
      try {
        await this.wakeLock.release();
        this.wakeLock = null;
      } catch (e) {
        console.warn(e);
      }
    }
  }

  init() {
    // طلب القفل فوراً
    this.requestWakeLock();

    // طلب القفل أيضاً عند أول لمسة أو ضغطة للمستخدم (لضمان توافق المتصفحات المقيدة)
    const activate = () => {
      if (!this.wakeLock) this.requestWakeLock();
    };
    ['click', 'touchstart', 'scroll'].forEach(evt => {
      document.addEventListener(evt, activate, { passive: true, once: true });
    });

    // استعادة القفل عند العودة للتطبيق بعد التبديل
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.requestWakeLock();
      }
    });
  }
}

// تشغيل تلقائي
window.screenWakeLock = new WakeLockController();
