// محرك المؤثرات الصوتية والقراءة الذكية للأطفال (محلياً أو أونلاين مثل تطبيق kids)
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.fallbackAudio = null;
    this.referrerMeta = null;
    this.isSpeaking = false;
    this.currentSpeakToken = 0;
    this.currentOnEnd = null;

    // تهيئة قائمة الأصوات مسبقاً للهواتف التي تُحمّلها لاحقاً (Lazy Voices)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.addEventListener('voiceschanged', () => {
          window.speechSynthesis.getVoices();
        });
      } catch (e) {}
    }
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
      { f: 1046.50, t: 0.40, d: 0.60 } // C6
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

  // ===================== محرك قراءة النصوص العربية =====================

  // فحص توفر صوت عربي على الهاتف
  hasArabicVoice() {
    try {
      if (!('speechSynthesis' in window)) return false;
      const voices = window.speechSynthesis.getVoices() || [];
      return voices.some(v => /^ar/i.test(v.lang));
    } catch (e) {
      return false;
    }
  }

  // جلب أفضل صوت عربي متاح في نظام الهاتف
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

  // تبديل Referrer Policy لحظياً لتفادي حجب سيرفر جوجل للقراءة الصوتية (404)
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

  // إيقاف أي قراءة جارية حالياً (محلياً أو أونلاين)
  stopSpeaking() {
    this.currentSpeakToken++;
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    if (this.fallbackAudio) {
      try {
        this.fallbackAudio.pause();
        this.fallbackAudio.currentTime = 0;
      } catch (e) {}
      this.fallbackAudio = null;
    }
    const hadEnd = this.currentOnEnd;
    this.currentOnEnd = null;
    this.isSpeaking = false;
    if (typeof hadEnd === 'function') hadEnd();
  }

  // القراءة عبر الإنترنت باستخدام خدمة Google TTS (نفس التقنية المعتمدة في تطبيق kids)
  speakOnline(text, onEnd) {
    this.stopSpeaking();
    const token = ++this.currentSpeakToken;
    this.currentOnEnd = onEnd;

    // تنظيف الرموز الخاصة مع الاحتفاظ بالتشكيل العربي
    const clean = String(text || '')
      .replace(/[۝۞۩]/g, ' ')
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
      .replace(/[^\p{L}\p{N}\p{M}\s،؟?!.,؛:()\-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean) {
      if (typeof onEnd === 'function') onEnd();
      return Promise.resolve(false);
    }

    if (!navigator.onLine) {
      console.warn('[TTS] الجهاز غير متصل بالإنترنت ولا يوجد صوت عربي مثبت على الهاتف.');
      if (typeof onEnd === 'function') onEnd();
      return Promise.resolve(false);
    }

    // تقطيع النص إلى مقاطع <= 160 حرفاً حتى لا يرفضها سيرفر جوجل
    const chunks = [];
    let cur = '';
    clean.split(/\s+/).forEach(w => {
      if ((cur + ' ' + w).trim().length > 160) {
        if (cur.trim()) chunks.push(cur.trim());
        cur = w;
      } else {
        cur = cur ? cur + ' ' + w : w;
      }
    });
    if (cur.trim()) chunks.push(cur.trim());

    if (!chunks.length) {
      if (typeof onEnd === 'function') onEnd();
      return Promise.resolve(false);
    }

    this.isSpeaking = true;
    const audio = this.fallbackAudio = new Audio();

    return chunks.reduce((chain, chunk) => {
      return chain.then(ok => {
        if (ok === false || token !== this.currentSpeakToken) return false;
        return new Promise(res => {
          if (token !== this.currentSpeakToken) return res(false);

          const restoreReferrer = this.setReferrerPolicy('no-referrer');
          audio.onloadstart = restoreReferrer;
          audio.src = 'https://translate.googleapis.com/translate_tts?ie=UTF-8&tl=ar&client=tw-ob&q=' + encodeURIComponent(chunk);

          audio.onended = () => {
            restoreReferrer();
            res(true);
          };
          audio.onerror = () => {
            restoreReferrer();
            res(false);
          };

          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              restoreReferrer();
              res(false);
            });
          }
        });
      });
    }, Promise.resolve(true)).then(result => {
      if (token === this.currentSpeakToken) {
        this.isSpeaking = false;
        if (typeof onEnd === 'function') onEnd();
      }
      return result;
    });
  }

  // الدالة العامة لقراءة النصوص العربية (محلياً أو بالتحول للأونلاين تلقائياً)
  speakArabic(text, onEnd) {
    if (!text) {
      if (typeof onEnd === 'function') onEnd();
      return;
    }

    // إذا كان يقرأ بالفعل، الضغط مرة أخرى يوقف القراءة (Toggle Stop)
    if (this.isSpeaking) {
      this.stopSpeaking();
      return;
    }

    this.stopSpeaking();
    const token = ++this.currentSpeakToken;
    this.currentOnEnd = onEnd;

    const cleanText = String(text).replace(/[۝۞۩]/g, '').trim();
    if (!cleanText) {
      if (typeof onEnd === 'function') onEnd();
      return;
    }

    const hasVoice = this.hasArabicVoice();
    const arVoice = this.getArabicVoice();

    // 1. إذا وُجد صوت عربي مثبت على الهاتف: استخدمه مباشرة أوفلاين
    if (hasVoice && arVoice && ('speechSynthesis' in window)) {
      try {
        const utter = new SpeechSynthesisUtterance(cleanText);
        utter.voice = arVoice;
        utter.lang = arVoice.lang || 'ar-SA';
        utter.rate = 0.88;
        utter.pitch = 1.05;

        this.isSpeaking = true;
        utter.onend = () => {
          if (token === this.currentSpeakToken) {
            this.isSpeaking = false;
            if (typeof onEnd === 'function') onEnd();
          }
        };
        utter.onerror = (e) => {
          console.warn('[SpeechSynthesis] خطأ في القارئ المحلي، التحول للأونلاين:', e);
          if (token === this.currentSpeakToken) {
            if (navigator.onLine) {
              this.speakOnline(cleanText, onEnd);
            } else {
              this.isSpeaking = false;
              if (typeof onEnd === 'function') onEnd();
            }
          }
        };

        window.speechSynthesis.speak(utter);
        return;
      } catch (err) {
        console.warn('SpeechSynthesis error:', err);
      }
    }

    // 2. الهاتف لا يدعم القراءة العربية: تحول فوري للقراءة عبر الإنترنت (مثل تطبيق kids)
    if (navigator.onLine) {
      this.speakOnline(cleanText, onEnd);
    } else {
      console.warn('لا يوجد صوت عربي مثبت على الهاتف والجهاز حالياً بدون إنترنت.');
      if (typeof onEnd === 'function') onEnd();
    }
  }
}

const sounds = new SoundFX();
