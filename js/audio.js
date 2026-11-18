// js/audio.js - محرك المؤثرات الصوتية والقراءة الذكية للأطفال
// تقنية Microsoft Edge Neural TTS + أصوات سينثسيزر WebAudio و mp3 مطابقة تماماً لتطبيق kids
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.fallbackAudio = null;
    this.referrerMeta = null;
    this.isSpeaking = false;
    this.currentSpeakToken = 0;
    this.currentOnEnd = null;

    // قائمة الأصوات العربية المتاحة في Microsoft Edge Neural (مطابقة لتطبيق kids)
    this.ARABIC_VOICES = [
      { id: 'ar-EG-SalmaNeural', name: 'سلمى', country: 'مصر 🇪🇬', desc: 'فصيح ودافئ ومألوف جداً للأطفال', gender: 'أنثى', sample: 'مرحباً يا بطل! أنا سلمى، هل أنت مستعد لخوض رحلة اليوم معي في بستان الأذكار؟' },
      { id: 'ar-SA-ZariyahNeural', name: 'زارية', country: 'السعودية 🇸🇦', desc: 'فصحى هادئة ومتزنة ومريحة للأذن', gender: 'أنثى', sample: 'أهلاً بك يا صديقي، أنا زارية، هيا بنا نستمتع بالأذكار والصلوات معاً.' },
      { id: 'ar-JO-SanaNeural', name: 'سناء', country: 'الأردن 🇯🇴', desc: 'مخارج حروف قوية وواضحة جداً للتعليم', gender: 'أنثى', sample: 'مرحباً، أنا سناء، هيا نفكر بذكاء ونتعلم خطوات الصلاة والوضوء!' },
      { id: 'ar-LB-LaylaNeural', name: 'ليلى', country: 'لبنان 🇱🇧', desc: 'صوت ناعم ورقيق ومريح', gender: 'أنثى', sample: 'أهلاً يا أبطال! أنا ليلى، رح نتعلم ونحفظ الأذكار مع بعض.' },
      { id: 'ar-AE-FatimaNeural', name: 'فاطمة', country: 'الإمارات 🇦🇪', desc: 'نبرة عصرية مشرقة ومنطلقة', gender: 'أنثى', sample: 'مرحباً بكم يا أبطال، أنا فاطمة، هيا نبدأ التسبيح والأذكار الآن!' },
      { id: 'ar-KW-NouraNeural', name: 'نورة', country: 'الكويت 🇰🇼', desc: 'فصحى خليجية واضحة ومرحة', gender: 'أنثى', sample: 'هلا والله يا بطل، أنا نورة، جاهز لجمع الحسنات والفوز؟' },
      { id: 'ar-QA-AmalNeural', name: 'أمل', country: 'قطر 🇶🇦', desc: 'صوت هادئ ورصين ومريح', gender: 'أنثى', sample: 'مرحباً بك، أنا أمل، أتمنى لك وقتاً ممتعاً ومباركاً معنا.' },
      { id: 'ar-DZ-AminaNeural', name: 'أمينة', country: 'الجزائر 🇩🇿', desc: 'فصحى هادئة ومحببة', gender: 'أنثى', sample: 'أهلاً وسهلاً بك، أنا أمينة، هيا نزرع أزهاراً وثماراً جديدة في البستان.' },
      { id: 'ar-TN-ReemNeural', name: 'ريم', country: 'تونس 🇹🇳', desc: 'نبرة لطيفة وسلسة', gender: 'أنثى', sample: 'مرحباً يا أصدقاء، أنا ريم، فلنبدأ رحلة الطاعة والذكر معاً.' },
      { id: 'ar-EG-ShakirNeural', name: 'شاكر', country: 'مصر 🇪🇬', desc: 'صوت شاب مصري فصيح ومرح', gender: 'ذكر', sample: 'أهلاً يا صديقي البطل! أنا شاكر، يلا بينا نذكر ربنا ونملأ الحصالة حسنات!' },
      { id: 'ar-JO-TaimNeural', name: 'تيم', country: 'الأردن 🇯🇴', desc: 'صوت فتى نشيط وحيوي للألعاب', gender: 'ذكر', sample: 'مرحباً يا بطل! أنا تيم، مستعد للتركيز والفوز بكل الشارات؟' },
      { id: 'ar-SA-HamedNeural', name: 'حامد', country: 'السعودية 🇸🇦', desc: 'صوت وقور وواضح', gender: 'ذكر', sample: 'السلام عليكم ورحمة الله، أنا حامد، بالتوفيق والبركة يا بني.' }
    ];

    // تهيئة مسبقة للأصوات المحلية
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.addEventListener('voiceschanged', () => {
          window.speechSynthesis.getVoices();
        });
      } catch (e) {}
    }

    // تجهيز الصوت عند أول تفاعل للمستخدم
    if (typeof document !== 'undefined') {
      ['pointerdown', 'keydown', 'touchstart'].forEach(ev => {
        document.addEventListener(ev, () => this.init(), { once: true, passive: true });
      });
    }
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        try { this.ctx = new AudioCtx(); } catch (e) {}
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // ===================== نظام اختيار الصوت واللهجة =====================

  getVoiceMode() {
    return localStorage.getItem('kids_voice_mode') || localStorage.getItem('bustan_voice_mode') || 'random';
  }

  setVoiceMode(mode, voiceId) {
    localStorage.setItem('kids_voice_mode', mode);
    localStorage.setItem('bustan_voice_mode', mode);
    if (voiceId) {
      localStorage.setItem('kids_voice_name', voiceId);
      localStorage.setItem('bustan_voice_name', voiceId);
    }
  }

  // الصوت النشط حالياً (نفس منطق تطبيق kids بالضبط)
  getActiveVoice() {
    const mode = this.getVoiceMode();
    if (mode === 'fixed') {
      return localStorage.getItem('kids_voice_name') || localStorage.getItem('bustan_voice_name') || 'ar-EG-SalmaNeural';
    }

    // في الوضع العشوائي: نثبت الصوت طوال الجلسة الحالية (sessionStorage)، ولكن في الجلسة القادمة نختار صوتاً مختلفاً
    let sessionVoice = null;
    try { sessionVoice = sessionStorage.getItem('kids_active_voice') || sessionStorage.getItem('bustan_active_voice'); } catch (e) {}

    if (!sessionVoice) {
      const lastVoice = localStorage.getItem('kids_last_random_voice') || localStorage.getItem('bustan_last_random_voice');
      const pool = this.ARABIC_VOICES.filter(v => v.id !== lastVoice);
      const candidates = pool.length ? pool : this.ARABIC_VOICES;
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      sessionVoice = chosen ? chosen.id : 'ar-EG-SalmaNeural';

      try {
        sessionStorage.setItem('kids_active_voice', sessionVoice);
        sessionStorage.setItem('bustan_active_voice', sessionVoice);
        localStorage.setItem('kids_last_random_voice', sessionVoice);
        localStorage.setItem('bustan_last_random_voice', sessionVoice);
      } catch (e) {}
    }
    return sessionVoice;
  }

  // ===================== المؤثرات الصوتية (Web Audio + MP3) =====================

  tone(freq, start, duration, type, volume, slideTo) {
    if (!this.enabled) return;
    const c = this.init(); if (!c) return;
    try {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, c.currentTime + start);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + start + duration);
      gain.gain.setValueAtTime(0.0001, c.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(volume || 0.2, c.currentTime + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + duration);
      osc.connect(gain).connect(c.destination);
      osc.start(c.currentTime + start);
      osc.stop(c.currentTime + start + duration + 0.05);
    } catch (e) {}
  }

  noise(start, duration, volume) {
    if (!this.enabled) return;
    const c = this.init(); if (!c) return;
    try {
      const buffer = c.createBuffer(1, c.sampleRate * duration, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = c.createBufferSource();
      src.buffer = buffer;
      const gain = c.createGain();
      gain.gain.value = volume || 0.15;
      src.connect(gain).connect(c.destination);
      src.start(c.currentTime + start);
    } catch (e) {}
  }

  // تشغيل المؤثرات باسمائها (مثل تطبيق kids)
  play(name) {
    if (!this.enabled) return;
    switch (name) {
      case 'pop':
        this.playPop();
        break;
      case 'click':
        this.tone(400, 0, 0.06, 'triangle', 0.2);
        break;
      case 'whoosh':
        this.noise(0, 0.25, 0.12);
        this.tone(300, 0, 0.25, 'sine', 0.15, 900);
        break;
      case 'correct':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, i * 0.09, 0.25, 'triangle', 0.25));
        break;
      case 'wrong':
        this.tone(300, 0, 0.35, 'sawtooth', 0.12, 120);
        this.tone(220, 0.05, 0.3, 'sine', 0.1, 100);
        break;
      case 'tick':
        this.tone(880, 0, 0.1, 'square', 0.12);
        break;
      case 'go':
        [523, 659, 784].forEach((f, i) => this.tone(f, i * 0.06, 0.15, 'square', 0.15));
        this.tone(1046, 0.2, 0.5, 'triangle', 0.25);
        break;
      case 'tada':
        [523, 523, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, i * 0.12, i === 5 ? 0.8 : 0.18, 'triangle', 0.25));
        this.noise(0.6, 0.6, 0.08);
        break;
      case 'star':
        this.tone(1200, 0, 0.12, 'sine', 0.15, 1800);
        this.tone(1600, 0.08, 0.15, 'sine', 0.12, 2400);
        break;
      case 'join':
        [659, 784, 1046].forEach((f, i) => this.tone(f, i * 0.08, 0.2, 'sine', 0.2));
        break;
      case 'boing':
        this.tone(200, 0, 0.3, 'sine', 0.2, 600);
        break;
      case 'water':
      case 'waterdrop':
        this.playWaterDrop();
        break;
      case 'bloom':
        this.playBloom();
        break;
      case 'victory':
        this.playVictory();
        break;
      case 'coin':
        this.playCoin();
        break;
      case 'wow':
        this.playBloom();
        break;
      default:
        this.playPop();
    }
  }

  // رنين تشجيع هادئ ووقور للأطفال
  playWow() {
    if (!this.enabled) return;
    this.playBloom();
  }

  // صوت نقرة البوب المرحة
  playPop() {
    if (!this.enabled) return;
    this.tone(600, 0, 0.08, 'sine', 0.25, 900);
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
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(1100, now + 0.08);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }

  // رنين تفتح الزهرة أو ظهور الثمرة (Sparkle Chime)
  playBloom() {
    if (!this.enabled) return;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.tone(freq, 0, 0.28, 'sine', 0.2);
      }, idx * 70);
    });
  }

  // احتفال الإنجاز واكتمال الذكر (Victory Fanfare)
  playVictory() {
    if (!this.enabled) return;
    const chordNotes = [
      { f: 523.25, t: 0, d: 0.18 },
      { f: 659.25, t: 0.12, d: 0.18 },
      { f: 783.99, t: 0.24, d: 0.22 },
      { f: 1046.50, t: 0.40, d: 0.60 }
    ];
    chordNotes.forEach(item => {
      setTimeout(() => {
        this.tone(item.f, 0, item.d, 'triangle', 0.3);
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
      osc.frequency.setValueAtTime(987.77, now);
      osc.frequency.setValueAtTime(1318.51, now + 0.08);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) {}
  }

  // ===================== محرك قراءة النصوص العربية والذكاء الاصطناعي =====================

  hasArabicVoice() {
    try {
      if (!('speechSynthesis' in window)) return false;
      const voices = window.speechSynthesis.getVoices() || [];
      return voices.some(v => /^ar/i.test(v.lang));
    } catch (e) {
      return false;
    }
  }

  getArabicVoice() {
    try {
      if (!('speechSynthesis' in window)) return null;
      const voices = window.speechSynthesis.getVoices() || [];
      return voices.find(v => /^ar[-_]EG/i.test(v.lang)) ||
             voices.find(v => /^ar[-_]SA/i.test(v.lang)) ||
             voices.find(v => /^ar/i.test(v.lang)) || null;
    } catch (e) {
      return null;
    }
  }

  setReferrerPolicy(policy) {
    try {
      if (!this.referrerMeta) {
        this.referrerMeta = document.createElement('meta');
        this.referrerMeta.name = 'referrer';
        document.head.appendChild(this.referrerMeta);
      }
      this.referrerMeta.content = policy;
    } catch (e) {}
    let done = false;
    return () => {
      if (done) return;
      done = true;
      try {
        if (this.referrerMeta) this.referrerMeta.content = 'strict-origin-when-cross-origin';
      } catch (e) {}
    };
  }

  stopSpeaking() {
    this.currentSpeakToken++;
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    if (this.fallbackAudio) {
      try {
        this.fallbackAudio.pause();
        this.fallbackAudio.currentTime = 0;
        this.fallbackAudio.src = '';
      } catch (e) {}
      this.fallbackAudio = null;
    }
    const hadEnd = this.currentOnEnd;
    this.currentOnEnd = null;
    this.isSpeaking = false;
    if (typeof hadEnd === 'function') hadEnd();
  }

  // تنظيف وتحضير النص العربي للقراءة
  sanitizeForSpeech(text) {
    return String(text || '')
      .replace(/[۝۞۩]/g, ' ')
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/[\[\]{}()<>_*~`#]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // القراءة الطبيعية عبر Microsoft Edge Neural TTS (المحرك الرئيسي مثل تطبيق kids)
  speakOnline(text, onEnd, opts) {
    this.stopSpeaking();
    const token = ++this.currentSpeakToken;
    this.currentOnEnd = onEnd;

    const clean = this.sanitizeForSpeech(text);
    if (!clean) {
      if (typeof onEnd === 'function') onEnd();
      return Promise.resolve(false);
    }

    if (!navigator.onLine) {
      // انقطاع النت: التراجع للمحرك المحلي
      return this.playLocalFallback(clean, onEnd, opts);
    }

    const voice = (opts && opts.voice) ? opts.voice : this.getActiveVoice();
    const pitch = (opts && opts.pitch) ? opts.pitch : 'default';
    const rate = (opts && opts.rate) ? opts.rate : 'default';

    this.isSpeaking = true;
    const tokenAudio = this.fallbackAudio = new Audio();

    let query = `/api/tts?text=${encodeURIComponent(clean.slice(0, 950))}&voice=${encodeURIComponent(voice)}`;
    if (pitch !== 'default') query += `&pitch=${encodeURIComponent(pitch)}`;
    if (rate !== 'default') query += `&rate=${encodeURIComponent(rate)}`;

    tokenAudio.src = query;

    return new Promise(res => {
      let done = false;
      const finish = (ok) => {
        if (done) return;
        done = true;
        if (token === this.currentSpeakToken) {
          this.isSpeaking = false;
          if (typeof onEnd === 'function') onEnd();
        }
        res(ok);
      };

      tokenAudio.onended = () => finish(true);

      // في حالة تعثر سيرفر Edge TTS، تراجع ذكي لـ Google TTS أو المحرك المحلي
      tokenAudio.onerror = () => {
        if (this.currentSpeakToken !== token) return finish(false);
        const restoreReferrer = this.setReferrerPolicy('no-referrer');
        tokenAudio.onloadstart = restoreReferrer;
        tokenAudio.src = 'https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=ar&client=tw-ob&q=' + encodeURIComponent(clean.slice(0, 180));
        tokenAudio.onerror = () => {
          restoreReferrer();
          this.playLocalFallback(clean, onEnd, opts).then(finish);
        };
        tokenAudio.onended = () => {
          restoreReferrer();
          finish(true);
        };
        tokenAudio.play().catch(() => {
          restoreReferrer();
          this.playLocalFallback(clean, onEnd, opts).then(finish);
        });
      };

      tokenAudio.play().catch(() => {
        finish(false);
      });
    });
  }

  // المحرك المحلي كاحتياطي عند انقطاع النت
  playLocalFallback(cleanText, onEnd, opts) {
    if (!('speechSynthesis' in window)) {
      if (typeof onEnd === 'function') onEnd();
      return Promise.resolve(false);
    }
    const token = this.currentSpeakToken;
    try {
      const utter = new SpeechSynthesisUtterance(cleanText);
      const arVoice = this.getArabicVoice();
      if (arVoice) utter.voice = arVoice;
      utter.lang = (arVoice && arVoice.lang) || 'ar-SA';
      utter.rate = (opts && opts.rateNum) || 0.95;
      utter.pitch = (opts && opts.pitchNum) || 1.0;

      this.isSpeaking = true;
      return new Promise(res => {
        utter.onend = () => {
          if (token === this.currentSpeakToken) {
            this.isSpeaking = false;
            if (typeof onEnd === 'function') onEnd();
          }
          res(true);
        };
        utter.onerror = () => {
          if (token === this.currentSpeakToken) {
            this.isSpeaking = false;
            if (typeof onEnd === 'function') onEnd();
          }
          res(false);
        };
        window.speechSynthesis.speak(utter);
      });
    } catch (e) {
      if (typeof onEnd === 'function') onEnd();
      return Promise.resolve(false);
    }
  }

  // الدالة العامة لقراءة النصوص (الأولوية القصوى لأصوات Edge Neural الطبيعية)
  speakArabic(text, onEnd, opts) {
    if (!text) {
      if (typeof onEnd === 'function') onEnd();
      return;
    }

    if (this.isSpeaking) {
      this.stopSpeaking();
      return;
    }

    if (navigator.onLine) {
      return this.speakOnline(text, onEnd, opts);
    } else {
      const clean = this.sanitizeForSpeech(text);
      return this.playLocalFallback(clean, onEnd, opts);
    }
  }

  // دالة متوافقة مع استدعاءات التطبيق السابقة
  speakText(text, onStart, onEnd) {
    if (typeof onStart === 'function') onStart();
    return this.speakArabic(text, onEnd);
  }
}

// إنشاء النسخة العامة وربطها بالنافذة
const sounds = new SoundFX();
if (typeof window !== 'undefined') {
  window.SoundFX = SoundFX;
  window.sounds = sounds;
  // التوافق مع مكونات kids
  window.KidsTheme = window.KidsTheme || {
    ARABIC_VOICES: sounds.ARABIC_VOICES,
    getActiveVoice: () => sounds.getActiveVoice(),
    speak: (t, choices, opts) => sounds.speakArabic(t, null, opts),
    speakOnline: (t, opts) => sounds.speakOnline(t, null, opts),
    play: (n) => sounds.play(n),
    stop: () => sounds.stopSpeaking(),
    readEnabled: () => localStorage.getItem('kids_read') !== 'off'
  };
}
