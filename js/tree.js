// محرك رسم بستان الأذكار والشجرة التفاعلية (Canvas 2D)
class GardenTree {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.items = []; // ثمار وأزهار ونجوم الشجرة
    this.drops = []; // قطرات الماء المتساقطة
    this.butterflies = [];
    this.leavesLevel = 1; // مستوى كثافة الشجرة (1 - 5)
    this.waterCount = 0;
    this.wind = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.initButterflies();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  initButterflies() {
    this.butterflies = [
      { x: this.width * 0.2, y: this.height * 0.4, vx: 0.8, vy: 0.3, color: '#ff6b81', size: 8, angle: 0 },
      { x: this.width * 0.7, y: this.height * 0.35, vx: -0.6, vy: -0.2, color: '#feca57', size: 9, angle: 0 }
    ];
  }

  // إضافة ثمرة أو زهرة جديدة إلى الشجرة
  addItem(type = 'flower') {
    const cx = this.width / 2;
    const cy = this.height * 0.45;
    const radius = Math.min(this.width * 0.28, 120);

    // زاوية عشوائية حول فروع الشجرة
    const angle = Math.random() * Math.PI * 1.6 + Math.PI * 0.2;
    const dist = Math.random() * radius * 0.8 + 20;

    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * (dist * 0.65);

    this.items.push({
      type, // 'flower', 'apple', 'orange', 'star'
      x,
      y,
      scale: 0.1,
      targetScale: 1,
      wobble: Math.random() * Math.PI,
      createdAt: Date.now()
    });

    if (this.items.length % 3 === 0 && this.leavesLevel < 5) {
      this.leavesLevel++;
    }
  }

  // تأثير ري الشجرة بقطرات ماء متلألئة
  addWaterDrops() {
    const cx = this.width / 2;
    for (let i = 0; i < 7; i++) {
      this.drops.push({
        x: cx + (Math.random() - 0.5) * 140,
        y: this.height * 0.25 + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 1.5,
        vy: Math.random() * 3 + 3,
        alpha: 1,
        radius: Math.random() * 4 + 3
      });
    }
    this.waterCount++;
  }

  animate() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.wind += 0.03;

    this.drawSkyAndSun();
    this.drawGround();
    this.drawTree();
    this.drawItems();
    this.drawWaterDrops();
    this.drawButterflies();

    requestAnimationFrame(this.animate);
  }

  drawSkyAndSun() {
    // قرص الشمس اللطيف
    const sunX = this.width * 0.85;
    const sunY = this.height * 0.18;
    const sunR = Math.min(this.width * 0.1, 42);

    // توهج الشمس
    const grad = this.ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 1.8);
    grad.addColorStop(0, 'rgba(255, 230, 100, 0.9)');
    grad.addColorStop(0.5, 'rgba(255, 210, 50, 0.3)');
    grad.addColorStop(1, 'rgba(255, 200, 0, 0)');
    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(sunX, sunY, sunR * 1.8, 0, Math.PI * 2);
    this.ctx.fill();

    // قرص الشمس
    this.ctx.fillStyle = '#ffb300';
    this.ctx.beginPath();
    this.ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
    this.ctx.fill();

    // ابتسامة الشمس الكرتونية للأطفال
    this.ctx.strokeStyle = '#d87a00';
    this.ctx.lineWidth = 2.5;
    this.ctx.beginPath();
    this.ctx.arc(sunX, sunY + 4, sunR * 0.45, 0.15 * Math.PI, 0.85 * Math.PI);
    this.ctx.stroke();

    // عيون الشمس
    this.ctx.fillStyle = '#b25900';
    this.ctx.beginPath();
    this.ctx.arc(sunX - sunR * 0.3, sunY - 4, 3, 0, Math.PI * 2);
    this.ctx.arc(sunX + sunR * 0.3, sunY - 4, 3, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawGround() {
    const h = this.height;
    const w = this.width;

    // تلة خلفية خضراء داكنة
    this.ctx.fillStyle = '#48bb78';
    this.ctx.beginPath();
    this.ctx.ellipse(w * 0.2, h * 0.95, w * 0.6, h * 0.2, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // تلة أمامية خضراء زاهية
    this.ctx.fillStyle = '#38a169';
    this.ctx.beginPath();
    this.ctx.ellipse(w * 0.6, h * 0.98, w * 0.7, h * 0.22, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // أرضية العشب
    this.ctx.fillStyle = '#2f855a';
    this.ctx.fillRect(0, h * 0.92, w, h * 0.08);
  }

  drawTree() {
    const cx = this.width / 2;
    const groundY = this.height * 0.92;
    const trunkTop = this.height * 0.55;
    const trunkWidth = Math.min(this.width * 0.09, 38);

    // جذع الشجرة
    this.ctx.fillStyle = '#8B5A2B';
    this.ctx.beginPath();
    this.ctx.moveTo(cx - trunkWidth * 0.7, groundY);
    this.ctx.lineTo(cx - trunkWidth * 0.4, trunkTop);
    this.ctx.lineTo(cx + trunkWidth * 0.4, trunkTop);
    this.ctx.lineTo(cx + trunkWidth * 0.7, groundY);
    this.ctx.closePath();
    this.ctx.fill();

    // فروع الشجرة
    this.ctx.strokeStyle = '#6d421d';
    this.ctx.lineWidth = trunkWidth * 0.35;
    this.ctx.lineCap = 'round';

    this.ctx.beginPath();
    this.ctx.moveTo(cx, trunkTop + 20);
    this.ctx.quadraticCurveTo(cx - 30, trunkTop - 15, cx - 60, trunkTop - 35);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(cx, trunkTop + 20);
    this.ctx.quadraticCurveTo(cx + 30, trunkTop - 15, cx + 60, trunkTop - 35);
    this.ctx.stroke();

    // كتل الأوراق الخضراء مع نسيم خفيف (Wind Sway)
    const sway = Math.sin(this.wind) * 4;
    const leafRadius = Math.min(this.width * 0.22, 95);
    const leafCenterY = this.height * 0.43;

    // ظل الأوراق الخلفية
    this.ctx.fillStyle = '#22543d';
    this.ctx.beginPath();
    this.ctx.arc(cx - leafRadius * 0.55 + sway * 0.5, leafCenterY - 10, leafRadius * 0.7, 0, Math.PI * 2);
    this.ctx.arc(cx + leafRadius * 0.55 + sway * 0.5, leafCenterY - 10, leafRadius * 0.7, 0, Math.PI * 2);
    this.ctx.arc(cx + sway * 0.5, leafCenterY - leafRadius * 0.6, leafRadius * 0.8, 0, Math.PI * 2);
    this.ctx.fill();

    // طبقة الأوراق الخضراء الرئيسية
    this.ctx.fillStyle = '#2f855a';
    this.ctx.beginPath();
    this.ctx.arc(cx - leafRadius * 0.4 + sway, leafCenterY, leafRadius * 0.75, 0, Math.PI * 2);
    this.ctx.arc(cx + leafRadius * 0.4 + sway, leafCenterY, leafRadius * 0.75, 0, Math.PI * 2);
    this.ctx.arc(cx + sway, leafCenterY - leafRadius * 0.4, leafRadius * 0.85, 0, Math.PI * 2);
    this.ctx.fill();

    // طبقة أوراق عليا مضيئة (Highlights)
    this.ctx.fillStyle = '#48bb78';
    this.ctx.beginPath();
    this.ctx.arc(cx - leafRadius * 0.2 + sway * 1.2, leafCenterY - leafRadius * 0.2, leafRadius * 0.55, 0, Math.PI * 2);
    this.ctx.arc(cx + leafRadius * 0.2 + sway * 1.2, leafCenterY - leafRadius * 0.3, leafRadius * 0.5, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawItems() {
    this.items.forEach(item => {
      // أنيميشن التفتح والنمو (Scale In)
      if (item.scale < item.targetScale) {
        item.scale = Math.min(item.targetScale, item.scale + 0.05);
      }
      const swayX = Math.sin(this.wind + item.wobble) * 2;
      const x = item.x + swayX;
      const y = item.y;

      this.ctx.save();
      this.ctx.translate(x, y);
      this.ctx.scale(item.scale, item.scale);

      if (item.type === 'flower') {
        this.drawFlower();
      } else if (item.type === 'apple') {
        this.drawFruit('#e53e3e', '#9b2c2c');
      } else if (item.type === 'orange') {
        this.drawFruit('#ed8936', '#c05621');
      } else if (item.type === 'star') {
        this.drawStar();
      }

      this.ctx.restore();
    });
  }

  drawFlower() {
    // 5 بتلات وردية لطيفة
    this.ctx.fillStyle = '#f687b3';
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5;
      const px = Math.cos(angle) * 9;
      const py = Math.sin(angle) * 9;
      this.ctx.beginPath();
      this.ctx.arc(px, py, 6, 0, Math.PI * 2);
      this.ctx.fill();
    }
    // قلب الزهرة الأصفر
    this.ctx.fillStyle = '#ecc94b';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawFruit(mainColor, shadowColor) {
    // ساق الثمرة
    this.ctx.strokeStyle = '#4a5568';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(0, -9);
    this.ctx.quadraticCurveTo(2, -14, 5, -13);
    this.ctx.stroke();

    // ورقة صغيرة
    this.ctx.fillStyle = '#48bb78';
    this.ctx.beginPath();
    this.ctx.ellipse(3, -11, 4, 2, 0.4, 0, Math.PI * 2);
    this.ctx.fill();

    // الثمرة
    this.ctx.fillStyle = mainColor;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 10, 0, Math.PI * 2);
    this.ctx.fill();

    // لمعة الثمرة (Highlight)
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    this.ctx.beginPath();
    this.ctx.arc(-3, -3, 3, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawStar() {
    this.ctx.fillStyle = '#f6e05e';
    this.ctx.strokeStyle = '#d69e2e';
    this.ctx.lineWidth = 1.5;

    this.ctx.beginPath();
    const spikes = 5;
    const outerRadius = 12;
    const innerRadius = 5;
    let rot = (Math.PI / 2) * 3;
    let step = Math.PI / spikes;

    this.ctx.moveTo(0, -outerRadius);
    for (let i = 0; i < spikes; i++) {
      let x = Math.cos(rot) * outerRadius;
      let y = Math.sin(rot) * outerRadius;
      this.ctx.lineTo(x, y);
      rot += step;

      x = Math.cos(rot) * innerRadius;
      y = Math.sin(rot) * innerRadius;
      this.ctx.lineTo(x, y);
      rot += step;
    }
    this.ctx.lineTo(0, -outerRadius);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
  }

  drawWaterDrops() {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.x += d.vx;
      d.y += d.vy;
      d.alpha -= 0.02;

      this.ctx.fillStyle = `rgba(66, 153, 225, ${Math.max(0, d.alpha)})`;
      this.ctx.beginPath();
      this.ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
      this.ctx.fill();

      if (d.alpha <= 0 || d.y > this.height * 0.9) {
        this.drops.splice(i, 1);
      }
    }
  }

  drawButterflies() {
    this.butterflies.forEach(b => {
      b.x += b.vx;
      b.y += b.vy + Math.sin(this.wind * 2) * 0.5;
      b.angle += 0.25;

      if (b.x < 30 || b.x > this.width - 30) b.vx *= -1;
      if (b.y < this.height * 0.2 || b.y > this.height * 0.65) b.vy *= -1;

      const wingSpan = Math.abs(Math.sin(b.angle)) * b.size;

      this.ctx.fillStyle = b.color;
      this.ctx.beginPath();
      // جناح أيمن
      this.ctx.ellipse(b.x + wingSpan * 0.6, b.y, wingSpan * 0.7, b.size * 0.5, 0.3, 0, Math.PI * 2);
      // جناح أيسر
      this.ctx.ellipse(b.x - wingSpan * 0.6, b.y, wingSpan * 0.7, b.size * 0.5, -0.3, 0, Math.PI * 2);
      this.ctx.fill();

      // جسم الفراشة
      this.ctx.fillStyle = '#2d3748';
      this.ctx.beginPath();
      this.ctx.ellipse(b.x, b.y, 1.5, b.size * 0.6, 0, 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  // إعادة تعيين الشجرة في بستان جديد
  resetTree() {
    this.items = [];
    this.leavesLevel = 1;
    this.waterCount = 0;
  }
}
