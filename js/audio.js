// محرك المؤثرات الصوتية للأطفال بدون ملفات خارجية (Web Audio API)
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // صوت قطرة ماء عند كل تسبيحة
  playWaterDrop() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      // انزلاق التردد يعطي صوت القطرة (Water Drop Pitch Slide)
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(1100, now + 0.08);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }

  // صوت نقرة مرحة
  playPop() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.06);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {}
  }

  // رنين تفتح الزهرة أو ظهور الثمرة (Sparkle Chime)
  playBloom() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        try {
          const now = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0.2, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(now);
          osc.stop(now + 0.28);
        } catch (e) {}
      }, idx * 70);
    });
  }

  // احتفال الإنجاز واكتمال الذكر (Victory Fanfare)
  playVictory() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const chordNotes = [
      { f: 523.25, t: 0, d: 0.18 },    // C5
      { f: 659.25, t: 0.12, d: 0.18 }, // E5
      { f: 783.99, t: 0.24, d: 0.22 }, // G5
      { f: 1046.50, t: 0.40, d: 0.60 } // C6 (طويل ومبهج)
    ];

    chordNotes.forEach(item => {
      setTimeout(() => {
        try {
          const now = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(item.f, now);

          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + item.d);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(now);
          osc.stop(now + item.d);
        } catch (e) {}
      }, item.t * 1000);
    });
  }

  // صوت عملة ذهبية لحصالة الحسنات
  playCoin() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  }

  // قراءة صوتية باللغة العربية عبر SpeechSynthesis
  speakArabic(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const cleanText = text.replace(/[۝۞۩]/g, '').trim();
    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.lang = 'ar-SA';
    utter.rate = 0.85; // نبرة هادئة ومناسبة للأطفال
    utter.pitch = 1.05;

    // محاولة البحث عن صوت عربي متاح
    const voices = window.speechSynthesis.getVoices();
    const arVoice = voices.find(v => v.lang.startsWith('ar'));
    if (arVoice) utter.voice = arVoice;

    window.speechSynthesis.speak(utter);
  }
}

const sounds = new SoundFX();
