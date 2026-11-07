// Apache 2 licensed Spine Canvas triangle mapping; local Telegram preloader override.
function drawTriangle(img, x0, y0, u0, v0, x1, y1, u1, v1, x2, y2, u2, v2) {
      const ctx = this.ctx;
      const width = img.width - 1;
      const height = img.height - 1;
      u0 *= width;
      v0 *= height;
      u1 *= width;
      v1 *= height;
      u2 *= width;
      v2 *= height;
      ctx.beginPath();
      // Перекрываем сглаженные края клипов, сохраняя исходное UV-преобразование.
      const cx = (x0+x1+x2)/3, cy = (y0+y1+y2)/3;
      const expand = (x,y) => { const d=Math.hypot(x-cx,y-cy); return d ? [x+(x-cx)*0.35/d,y+(y-cy)*0.35/d] : [x,y]; };
      ctx.moveTo(...expand(x0,y0));
      ctx.lineTo(...expand(x1,y1));
      ctx.lineTo(...expand(x2,y2));
      ctx.closePath();
      x1 -= x0;
      y1 -= y0;
      x2 -= x0;
      y2 -= y0;
      u1 -= u0;
      v1 -= v0;
      u2 -= u0;
      v2 -= v0;
      let det = u1 * v2 - u2 * v1;
      if (det === 0) return;
      det = 1 / det;
      const a = (v2 * x1 - v1 * x2) * det;
      const b = (v2 * y1 - v1 * y2) * det;
      const c = (u1 * x2 - u2 * x1) * det;
      const d = (u1 * y2 - u2 * y1) * det;
      const e = x0 - a * u0 - c * v0;
      const f = y0 - b * u0 - d * v0;
      ctx.save();
      ctx.transform(a, b, c, d, e, f);
      ctx.clip();
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    }

export function installTelegramSpineSeams(renderer) { renderer.drawTriangle = drawTriangle; }
