// محرك الاحتفالات والنجوم المتطايرة للأطفال (Confetti & Stars)
class ConfettiEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.running = false;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  burst(count = 60) {
    const colors = ['#f6e05e', '#ff6b81', '#48bb78', '#4299e1', '#9f7aea', '#ed8936'];
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight * 0.45;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 9 + 4;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        size: Math.random() * 8 + 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        vrot: (Math.random() - 0.5) * 12,
        alpha: 1,
        isStar: Math.random() > 0.4
      });
    }

    if (!this.running) {
      this.running = true;
      this.render();
    }
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25; // جاذبية
      p.rotation += p.vrot;
      p.alpha -= 0.012;

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = Math.max(0, p.alpha);

      if (p.isStar) {
        this.drawStar(0, 0, p.size, p.size * 0.4);
      } else {
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
      }

      this.ctx.restore();

      if (p.alpha <= 0 || p.y > this.canvas.height) {
        this.particles.splice(i, 1);
      }
    }

    if (this.particles.length > 0) {
      requestAnimationFrame(() => this.render());
    } else {
      this.running = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  drawStar(cx, cy, outerRadius, innerRadius) {
    let rot = (Math.PI / 2) * 3;
    let step = Math.PI / 5;
    this.ctx.beginPath();
    this.ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < 5; i++) {
      let x = cx + Math.cos(rot) * outerRadius;
      let y = cy + Math.sin(rot) * outerRadius;
      this.ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      this.ctx.lineTo(x, y);
      rot += step;
    }
    this.ctx.lineTo(cx, cy - outerRadius);
    this.ctx.closePath();
    this.ctx.fill();
  }
}
