// api/tts.js - Vercel Serverless Function: تحويل النص لصوت طفل كرتوني عالي الجودة عبر Microsoft Edge Neural TTS
// مع ذاكرة تخزين مؤقتة (In-Memory Cache) لتسريع الاستجابة وتفادي حدود الطلبات (Rate Limits)

const { EdgeTTS } = require('node-edge-tts');

// ذاكرة تخزين مؤقتة للمقاطع الشائعة (حتى لا يتم تكرار طلب نفس الجملة)
const audioCache = new Map();
const MAX_CACHE_ITEMS = 300;

function sanitizeText(str) {
  if (!str) return '';
  return String(str)
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\[\]{}()<>_*~`#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = async function (req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let rawText = '';
    let pitch = 'default'; // الصوت الأنثوي الطبيعي بدون أي تلاعب بالنبرة
    let rate = 'default';   // السرعة الطبيعية الأصلية المتزنة
    let voice = 'ar-EG-SalmaNeural'; // صوت سلمى الطبيعي الفصيح والدافئ

    if (req.method === 'GET') {
      rawText = req.query.text || '';
      if (req.query.pitch) pitch = req.query.pitch;
      if (req.query.rate) rate = req.query.rate;
      if (req.query.voice) voice = req.query.voice;
    } else if (req.method === 'POST') {
      let body = req.body || {};
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) { body = {}; }
      }
      rawText = body.text || '';
      if (body.pitch) pitch = body.pitch;
      if (body.rate) rate = body.rate;
      if (body.voice) voice = body.voice;
    }

    const cleanText = sanitizeText(rawText);
    if (!cleanText) {
      return res.status(400).json({ error: 'نص القراءة مطلوب' });
    }

    const textToSpeak = cleanText.slice(0, 1000);
    const cacheKey = `${voice}_${pitch}_${rate}_${textToSpeak}`;

    // التحقق من الذاكرة المؤقتة السريعة (In-Memory Cache)
    if (audioCache.has(cacheKey)) {
      const cachedBuffer = audioCache.get(cacheKey);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', cachedBuffer.length);
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).send(cachedBuffer);
    }

    const tts = new EdgeTTS({
      voice: voice,
      pitch: pitch,
      rate: rate,
      timeout: 9000
    });

    const chunks = [];
    for await (const chunk of tts.streamAudio(textToSpeak)) {
      if (Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
      }
    }

    if (chunks.length === 0) {
      return res.status(502).json({ error: 'لم يتم استلام صوت من الخدمة' });
    }

    const audioBuffer = Buffer.concat(chunks);

    // حفظ في الذاكرة المؤقتة
    if (audioCache.size >= MAX_CACHE_ITEMS) {
      const firstKey = audioCache.keys().next().value;
      audioCache.delete(firstKey);
    }
    audioCache.set(cacheKey, audioBuffer);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800, immutable');
    res.setHeader('X-Cache', 'MISS');

    return res.status(200).send(audioBuffer);
  } catch (error) {
    console.warn('[tts-api] Error:', error.message || error);
    return res.status(503).json({ error: error.message || 'خدمة الصوت غير متاحة حالياً' });
  }
};
