export type Species = 'tetra' | 'clownfish';

function normalizeAngle(angle: number): number {
  while (angle <= -Math.PI) angle += Math.PI * 2;
  while (angle > Math.PI) angle -= Math.PI * 2;
  return angle;
}

export class VectorFish {
  id: string;
  species: Species;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  angle: number;
  size: number;
  baseSpeed: number;
  maxSpeed: number;
  maxForce: number;
  idOffset: number;

  constructor(width: number, height: number, species?: Species) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.species = species || (Math.random() > 0.8 ? 'clownfish' : 'tetra');
    this.x = Math.random() * width;
    this.z = Math.random() * 100; // 0 is back, 100 is front
    this.vz = (Math.random() - 0.5) * 0.2; // Slow depth movement
    
    if (this.species === 'clownfish') {
      this.y = height - 150 - Math.random() * 150; // Clownfish prefer bottom
      this.size = 1.0 + Math.random() * 0.3;
      this.baseSpeed = 0.6 + Math.random() * 0.3;
      this.maxForce = 0.03 + Math.random() * 0.01;
    } else {
      this.y = Math.random() * (height - 200) + 100; // Tetras everywhere
      this.size = 0.8 + Math.random() * 0.3;
      this.baseSpeed = 0.9 + Math.random() * 0.4;
      this.maxForce = 0.04 + Math.random() * 0.02;
    }
    
    this.angle = Math.random() * Math.PI * 2;
    this.vx = Math.cos(this.angle);
    this.vy = Math.sin(this.angle);
    this.maxSpeed = this.baseSpeed;
    this.idOffset = Math.random() * 1000;
  }

  update(width: number, height: number, fishes: VectorFish[], foods: Food[], flow: number) {
    let ax = 0;
    let ay = 0;

    // Adjust max speed based on flow (50 is neutral, 0 is slow, 100 is fast)
    const flowMultiplier = 0.5 + (flow / 100); // 0.5x to 1.5x speed
    this.maxSpeed = this.baseSpeed * flowMultiplier;

    // 1. Seek Food
    let nearestFood: Food | null = null;
    let minDist = 300;
    for (const food of foods) {
      if (food.eaten) continue;
      const dx = food.x - this.x;
      const dy = food.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        nearestFood = food;
      }
    }

    if (nearestFood) {
      const dx = nearestFood.x - this.x;
      const dy = nearestFood.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 15 * this.size) {
        nearestFood.eaten = true;
      } else {
        ax += (dx / dist) * this.maxForce * 2.5;
        ay += (dy / dist) * this.maxForce * 2.5;
      }
    } else {
      // 2. Flocking (Tetras flock strongly, Clownfish weakly)
      let sepX = 0, sepY = 0, sepCount = 0;
      let aliX = 0, aliY = 0, aliCount = 0;
      let cohX = 0, cohY = 0, cohCount = 0;

      const perceptionRadius = this.species === 'tetra' ? 120 : 60;
      const separationRadius = 35 * this.size;

      for (const other of fishes) {
        if (other === this) continue;
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0 && dist < separationRadius) {
          sepX += dx / dist;
          sepY += dy / dist;
          sepCount++;
        }

        if (dist > 0 && dist < perceptionRadius && this.species === other.species) {
          aliX += other.vx;
          aliY += other.vy;
          aliCount++;
          cohX += other.x;
          cohY += other.y;
          cohCount++;
        }
      }

      if (sepCount > 0) {
        ax += (sepX / sepCount) * this.maxForce * 2.0;
        ay += (sepY / sepCount) * this.maxForce * 2.0;
      }

      if (aliCount > 0) {
        aliX /= aliCount;
        aliY /= aliCount;
        const speed = Math.sqrt(aliX * aliX + aliY * aliY);
        if (speed > 0) {
          ax += ((aliX / speed) * this.maxSpeed - this.vx) * this.maxForce * 0.8;
          ay += ((aliY / speed) * this.maxSpeed - this.vy) * this.maxForce * 0.8;
        }
        
        cohX /= cohCount;
        cohY /= cohCount;
        const dx = cohX - this.x;
        const dy = cohY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          ax += ((dx / dist) * this.maxSpeed - this.vx) * this.maxForce * 0.5;
          ay += ((dy / dist) * this.maxSpeed - this.vy) * this.maxForce * 0.5;
        }
      }

      // 3. Wander
      const time = Date.now() / 1000 + this.idOffset;
      ax += Math.cos(time * 0.5) * this.maxForce * 0.4;
      ay += Math.sin(time * 0.6) * this.maxForce * 0.4;
      
      // Clownfish prefer bottom
      if (this.species === 'clownfish') {
        const targetY = height - 100;
        ay += (targetY - this.y) * 0.0002;
      }
    }

    // 4. Avoid Walls smoothly
    const marginX = 100;
    const marginY = 80;
    const turnFactor = this.maxForce * 3;
    
    if (this.x < marginX) ax += turnFactor * (marginX - this.x) / marginX;
    if (this.x > width - marginX) ax -= turnFactor * (this.x - (width - marginX)) / marginX;
    
    if (this.y < marginY) ay += turnFactor * (marginY - this.y) / marginY;
    if (this.y > height - marginY - 50) ay -= turnFactor * (this.y - (height - marginY - 50)) / marginY;

    // Apply acceleration
    this.vx += ax;
    this.vy += ay;

    // Limit speed
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > this.maxSpeed) {
      this.vx = (this.vx / speed) * this.maxSpeed;
      this.vy = (this.vy / speed) * this.maxSpeed;
    } else if (speed < this.maxSpeed * 0.3) {
      this.vx = (this.vx / speed) * (this.maxSpeed * 0.3);
      this.vy = (this.vy / speed) * (this.maxSpeed * 0.3);
    }

    this.x += this.vx;
    this.y += this.vy;
    this.z += this.vz;
    
    if (this.z < 0) { this.z = 0; this.vz *= -1; }
    if (this.z > 100) { this.z = 100; this.vz *= -1; }

    // Smooth angle rotation
    const targetAngle = Math.atan2(this.vy, this.vx);
    let diff = normalizeAngle(targetAngle - this.angle);
    this.angle += diff * 0.1;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    
    const isFlipped = Math.abs(normalizeAngle(this.angle)) > Math.PI / 2;
    ctx.rotate(this.angle);
    if (isFlipped) {
      ctx.scale(1, -1);
    }

    // Parallax scale based on z-depth (0.6x at back, 1.2x at front)
    const depthScale = 0.6 + (this.z / 100) * 0.6;
    ctx.scale(this.size * depthScale, this.size * depthScale);

    const time = Date.now() / 1000 + this.idOffset;
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const tailSway = Math.sin(time * (10 + speed * 5)) * (0.2 + speed * 0.1);
    const finSway = Math.sin(time * 5) * 0.1;

    if (this.species === 'tetra') {
      this.drawTetra(ctx, tailSway, finSway);
    } else {
      this.drawClownfish(ctx, tailSway, finSway);
    }

    ctx.restore();
  }

  drawTetra(ctx: CanvasRenderingContext2D, tailSway: number, finSway: number) {
    // Tail
    ctx.save();
    ctx.translate(-10, 0);
    ctx.rotate(tailSway);
    ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-8, -5); ctx.lineTo(-6, 0); ctx.lineTo(-8, 5); ctx.fill();
    ctx.restore();

    // Body
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 4, 0, 0, Math.PI*2); ctx.fill();

    // Neon Stripes
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#00ffff'; // Neon cyan
    ctx.beginPath(); ctx.moveTo(-8, -1); ctx.lineTo(6, -1); ctx.stroke();
    
    ctx.strokeStyle = '#ff3333'; // Neon red
    ctx.beginPath(); ctx.moveTo(-2, 1); ctx.lineTo(10, 1); ctx.stroke();

    // Pectoral fin
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.save();
    ctx.translate(3, 1.5);
    ctx.rotate(finSway + 0.2);
    ctx.beginPath(); ctx.ellipse(0, 0, 2.5, 1, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Eye
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(8, -1, 1.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(8.5, -1, 0.8, 0, Math.PI*2); ctx.fill();
  }

  drawClownfish(ctx: CanvasRenderingContext2D, tailSway: number, finSway: number) {
    // Tail
    ctx.save();
    ctx.translate(-12, 0);
    ctx.rotate(tailSway * 1.2);
    ctx.fillStyle = '#ea580c';
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-8, -6); ctx.quadraticCurveTo(-10, 0, -8, 6); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#000'; ctx.stroke();
    ctx.restore();

    // Top fin
    ctx.fillStyle = '#ea580c';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-4, -6); ctx.quadraticCurveTo(0, -12, 4, -5); ctx.fill(); ctx.stroke();

    // Body
    ctx.fillStyle = '#ea580c';
    ctx.beginPath(); ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI*2); ctx.fill();

    // White Bands
    const drawBand = (x: number, w: number, h: number) => {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, 0, w, h, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    };
    drawBand(5, 2, 6.5);
    drawBand(-2, 2.5, 7);
    drawBand(-9, 1.5, 5);

    // Pectoral fin
    ctx.save();
    ctx.translate(1, 2);
    ctx.rotate(finSway * 2 + 0.5);
    ctx.fillStyle = '#ea580c';
    ctx.beginPath(); ctx.ellipse(0, 0, 3.5, 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();

    // Eye
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(10, -2, 1.5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(10.5, -2, 0.8, 0, Math.PI*2); ctx.fill();
  }
}

export class Bubble {
  x: number;
  y: number;
  size: number;
  vy: number;
  wobble: number;
  wobbleSpeed: number;
  startX: number;

  constructor(x: number, y: number, sizeMultiplier: number = 1) {
    this.startX = x;
    this.x = x;
    this.y = y;
    // Smaller, more realistic bubbles
    this.size = (Math.random() * 1.5 + 0.5) * sizeMultiplier;
    // Faster rise for larger bubbles, slower for tiny ones
    this.vy = -(Math.random() * 0.5 + 0.4) * (this.size * 0.5 + 0.5);
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed = Math.random() * 0.1 + 0.05;
  }

  update(flow: number) {
    const flowMag = flow / 100;
    this.y += this.vy * (1 + flowMag * 0.5);
    this.wobble += this.wobbleSpeed * (1 + flowMag * 2);
    
    // Flow pushes bubbles horizontally as they rise
    this.startX += flowMag * 1.5;
    
    // More wobble for smaller bubbles, and flow increases wobble width
    const wobbleWidth = (3 / this.size) * (1 + flowMag * 5);
    this.x = this.startX + Math.sin(this.wobble) * wobbleWidth;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(this.x - this.size * 0.3, this.y - this.size * 0.3, this.size * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class Food {
  id: string;
  x: number;
  y: number;
  vy: number;
  vx: number;
  eaten: boolean;
  life: number;

  constructor(x: number, y: number) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.x = x;
    this.y = y;
    this.vy = 0.5 + Math.random() * 0.5;
    this.vx = (Math.random() - 0.5) * 0.5;
    this.eaten = false;
    this.life = 0;
  }

  update(height: number, flow: number) {
    const flowMag = flow / 100;
    if (this.y < height - 15) {
      this.y += this.vy * (1 + flowMag * 0.5);
      this.x += this.vx * (1 + flowMag);
    } else {
      this.y = height - 15;
      this.life++;
      if (this.life > 1000) { // Decay after a while on the bottom
        this.eaten = true;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#d97706'; // Amber/Brown flake
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class Pebble {
  x: number;
  y: number;
  rX: number;
  rY: number;
  angle: number;
  lightColor: string;
  darkColor: string;

  constructor(width: number, height: number) {
    this.x = Math.random() * width;
    // Spread pebbles across the bottom 60px
    this.y = height - Math.random() * 60;
    this.rX = Math.random() * 3 + 1.5; // smaller, 1.5 to 4.5
    this.rY = this.rX * (0.3 + Math.random() * 0.3); // flatter
    this.angle = Math.random() * Math.PI;
    
    // Darker, slightly blue-tinted colors to blend with deep water
    const baseColors = [
      [100, 110, 120], // mid blue-gray
      [80, 90, 100],   // dark blue-gray
      [60, 70, 80],    // darker blue-gray
      [50, 60, 70],    // slate blue
      [40, 50, 60],    // dark slate
      [30, 40, 50],    // very dark slate
    ];
    const base = baseColors[Math.floor(Math.random() * baseColors.length)];
    const r = Math.min(255, Math.max(0, base[0] + (Math.random() * 15 - 7)));
    const g = Math.min(255, Math.max(0, base[1] + (Math.random() * 15 - 7)));
    const b = Math.min(255, Math.max(0, base[2] + (Math.random() * 15 - 7)));
    
    this.lightColor = `rgb(${r+20}, ${g+25}, ${b+30})`; // Highlight has a blue tint
    this.darkColor = `rgb(${r-30}, ${g-30}, ${b-20})`;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const grad = ctx.createRadialGradient(
      this.x - this.rX * 0.3, this.y - this.rY * 0.3, this.rX * 0.1,
      this.x, this.y, this.rX
    );
    grad.addColorStop(0, this.lightColor);
    grad.addColorStop(1, this.darkColor);
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, this.rX, this.rY, this.angle, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class Rock {
  x: number;
  y: number;
  width: number;
  height: number;
  lightColor: string;
  darkColor: string;

  constructor(width: number, height: number) {
    this.x = Math.random() * width;
    this.y = height - Math.random() * 40; // Spread rocks in depth
    this.width = Math.random() * 40 + 30;
    this.height = Math.random() * 20 + 15;
    
    const shade = 20 + Math.random() * 20; // Darker rocks
    this.lightColor = `rgb(${shade + 10}, ${shade + 15}, ${shade + 25})`; // Blue tint
    this.darkColor = `rgb(${shade - 15}, ${shade - 10}, ${shade - 5})`;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const grad = ctx.createRadialGradient(
      this.x - this.width * 0.2, this.y - this.height * 0.2, this.width * 0.1,
      this.x, this.y, this.width
    );
    grad.addColorStop(0, this.lightColor);
    grad.addColorStop(1, this.darkColor);
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, this.width, this.height, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class Plant {
  x: number;
  y: number;
  z: number;
  type: 'grass' | 'leafy' | 'elodea';
  segments: number;
  maxHeight: number;
  currentHeight: number;
  growthRate: number;
  color: string;
  swayPhase: number;
  blades?: { xOff: number, hMult: number, swayOff: number }[];
  growing: boolean;

  constructor(width: number, height: number) {
    this.x = Math.random() * width;
    this.y = height - Math.random() * 50; // Spread plants in depth
    this.z = Math.random() * 100; // 0 is back, 100 is front
    const rand = Math.random();
    if (rand > 0.6) this.type = 'grass';
    else if (rand > 0.3) this.type = 'leafy';
    else this.type = 'elodea';
    this.segments = Math.floor(Math.random() * 6) + 6; // 6 to 11
    
    // Grow to ~80% of tank height
    this.maxHeight = height * 0.8 * (0.8 + Math.random() * 0.4); 
    this.currentHeight = Math.random() * this.maxHeight; // Start at random height
    
    // Growth rate set for a cycle of roughly 1 hour (3600 seconds)
    // Assuming 60 fps, 3600 * 60 = 216000 frames.
    // To grow ~600px in 216000 frames, rate is ~0.0027 per frame.
    this.growthRate = 0.001 + Math.random() * 0.003; 
    
    this.growing = Math.random() > 0.5;
    
    const colors = ['#15803d', '#166534', '#22c55e', '#10b981', '#047857'];
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.swayPhase = Math.random() * Math.PI * 2;

    if (this.type === 'grass') {
      const numBlades = Math.floor(Math.random() * 4) + 3; // 3 to 6 blades
      this.blades = Array.from({length: numBlades}, () => ({
        xOff: (Math.random() - 0.5) * 20,
        hMult: 0.4 + Math.random() * 0.8, // Varying heights
        swayOff: Math.random() * Math.PI
      }));
    }
  }

  update() {
    if (this.growing) {
      this.currentHeight += this.growthRate;
      if (this.currentHeight >= this.maxHeight) {
        this.growing = false;
      }
    } else {
      this.currentHeight -= this.growthRate * 0.5; // Die off a bit slower
      if (this.currentHeight <= 10) {
        this.growing = true;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, time: number, flow: number) {
    ctx.save();
    // Parallax scale based on z-depth
    const depthScale = 0.6 + (this.z / 100) * 0.6;
    // Translate to plant base, scale, then translate back to draw relative to original coordinates
    ctx.translate(this.x, this.y);
    ctx.scale(depthScale, depthScale);
    ctx.translate(-this.x, -this.y);

    const flowMag = flow / 100;
    
    if (this.type === 'grass' && this.blades) {
      ctx.fillStyle = this.color;
      for (const blade of this.blades) {
        const h = this.currentHeight * blade.hMult;
        const sway = Math.sin(time * (1.5 + flowMag * 1.2) + this.swayPhase + blade.swayOff) * (h * (flowMag * 0.14));
        const bx = this.x + blade.xOff;
        
        ctx.beginPath();
        ctx.moveTo(bx - 3, this.y);
        ctx.quadraticCurveTo(bx + sway * 0.5, this.y - h * 0.5, bx + sway, this.y - h);
        ctx.quadraticCurveTo(bx + sway * 0.5 + 3, this.y - h * 0.5, bx + 3, this.y);
        ctx.fill();
      }
    } else if (this.type === 'elodea') {
      const seedState = { val: this.x * 1000 };
      this.drawElodeaBranch(ctx, this.x, this.y, this.currentHeight * 0.4, 0, 3, time, flowMag, this.swayPhase, seedState);
    } else {
      // Leafy
      const sway = Math.sin(time * (1.2 + flowMag * 1.2) + this.swayPhase) * (this.currentHeight * (flowMag * 0.14));
      
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.quadraticCurveTo(this.x + sway * 0.5, this.y - this.currentHeight * 0.5, this.x + sway, this.y - this.currentHeight);
      ctx.stroke();

      ctx.fillStyle = this.color;
      // Only draw leaves up to the current grown height proportion
      const activeSegments = Math.floor((this.currentHeight / this.maxHeight) * this.segments);
      
      for (let i = 1; i <= activeSegments; i++) {
        const t = i / this.segments;
        const px = (1-t)*(1-t)*this.x + 2*(1-t)*t*(this.x + sway*0.5) + t*t*(this.x + sway);
        const py = (1-t)*(1-t)*this.y + 2*(1-t)*t*(this.y - this.currentHeight*0.5) + t*t*(this.y - this.currentHeight);

        const leafSway = Math.sin(time * 2 + i) * 0.2;
        const leafSize = 1 - (t * 0.6); // Leaves get smaller towards top
        
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(leafSway + (sway * 0.02));
        
        // Left leaf
        ctx.beginPath(); ctx.ellipse(-6 * leafSize, 0, 7 * leafSize, 3 * leafSize, -Math.PI/6, 0, Math.PI*2); ctx.fill();
        // Right leaf
        ctx.beginPath(); ctx.ellipse(6 * leafSize, 0, 7 * leafSize, 3 * leafSize, Math.PI/6, 0, Math.PI*2); ctx.fill();
        
        ctx.restore();
      }
    }
    ctx.restore();
  }

  drawElodeaBranch(ctx: CanvasRenderingContext2D, startX: number, startY: number, length: number, angle: number, depth: number, time: number, flowMag: number, swayPhase: number, seedState: { val: number }) {
    if (depth === 0 || length < 5) return;

    const random = () => {
      let x = Math.sin(seedState.val++) * 10000;
      return x - Math.floor(x);
    };

    // Calculate end point with sway
    const sway = Math.sin(time * (1.0 + flowMag) + swayPhase + depth) * (length * flowMag * 0.3);
    const endX = startX + Math.sin(angle) * length + sway;
    const endY = startY - Math.cos(angle) * length;

    // Draw stem
    ctx.strokeStyle = this.color;
    ctx.lineWidth = depth * 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(startX + sway * 0.5, startY - length * 0.5, endX, endY);
    ctx.stroke();

    // Draw leaves along the stem
    const numLeaves = Math.floor(length / 8);
    ctx.fillStyle = this.color;
    for (let i = 1; i <= numLeaves; i++) {
      const t = i / numLeaves;
      const px = (1-t)*(1-t)*startX + 2*(1-t)*t*(startX + sway*0.5) + t*t*endX;
      const py = (1-t)*(1-t)*startY + 2*(1-t)*t*(startY - length*0.5) + t*t*endY;

      const leafSize = 2 + depth * 0.8;
      
      // Whorl of leaves
      const whorlSway = Math.sin(time * 2 + i) * 0.1;
      const baseAngle = angle + whorlSway;
      
      for (let j = 0; j < 3; j++) {
        ctx.save();
        ctx.translate(px, py);
        const leafAngle = baseAngle + (j * Math.PI * 2 / 3);
        ctx.rotate(leafAngle);
        ctx.beginPath();
        // Elodea leaves are thin and slightly curved
        ctx.ellipse(leafSize * 1.5, 0, leafSize * 2, leafSize * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Branching
    if (depth > 1) {
      // Main continuation
      this.drawElodeaBranch(ctx, endX, endY, length * (0.7 + random()*0.2), angle + (random() - 0.5) * 0.2, depth - 1, time, flowMag, swayPhase, seedState);
      
      // Side branches
      if (random() > 0.3) {
        const branchAngle = angle - 0.3 - random() * 0.3;
        this.drawElodeaBranch(ctx, endX, endY, length * (0.5 + random()*0.2), branchAngle, depth - 1, time, flowMag, swayPhase, seedState);
      }
      if (random() > 0.3) {
        const branchAngle = angle + 0.3 + random() * 0.3;
        this.drawElodeaBranch(ctx, endX, endY, length * (0.5 + random()*0.2), branchAngle, depth - 1, time, flowMag, swayPhase, seedState);
      }
      
      // Occasional mid-stem branch
      if (random() > 0.6) {
        const midT = 0.3 + random() * 0.4;
        const midX = (1-midT)*(1-midT)*startX + 2*(1-midT)*midT*(startX + sway*0.5) + midT*midT*endX;
        const midY = (1-midT)*(1-midT)*startY + 2*(1-midT)*midT*(startY - length*0.5) + midT*midT*endY;
        const branchAngle = angle + (random() > 0.5 ? 0.5 : -0.5);
        this.drawElodeaBranch(ctx, midX, midY, length * 0.6, branchAngle, depth - 1, time, flowMag, swayPhase, seedState);
      }
    }
  }
}

export class GhostShrimp {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number | null;
  targetY: number | null;
  width: number;
  height: number;
  legPhase: number;
  facingRight: boolean;
  state: 'walking' | 'swimming' | 'climbing';
  targetPlant: Plant | null;
  swimPhase: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.x = Math.random() * width;
    this.y = height - 15;
    this.vx = 0;
    this.vy = 0;
    this.targetX = null;
    this.targetY = null;
    this.legPhase = 0;
    this.facingRight = Math.random() > 0.5;
    this.state = 'walking';
    this.targetPlant = null;
    this.swimPhase = 0;
  }

  update(width: number, height: number, foods: Food[], plants: Plant[]) {
    this.width = width;
    this.height = height;
    const floorY = height - 15;

    if (this.state === 'walking') {
      this.y = floorY;
      this.vy = 0;

      // Look for food near the bottom
      let closestFood: Food | null = null;
      let minDist = Infinity;

      for (const f of foods) {
        if (!f.eaten && f.y > this.height - 40) {
          const dist = Math.abs(f.x - this.x);
          if (dist < minDist) {
            minDist = dist;
            closestFood = f;
          }
        }
      }

      if (closestFood) {
        this.targetX = closestFood.x;
        if (minDist < 15 && Math.abs(closestFood.y - this.y) < 20) {
          closestFood.eaten = true;
          this.targetX = null;
        }
      } else {
        if (this.targetX === null || Math.abs(this.targetX - this.x) < 5) {
          const rand = Math.random();
          if (rand < 0.005 && plants.length > 0) {
            // Start climbing
            this.state = 'climbing';
            this.targetPlant = plants[Math.floor(Math.random() * plants.length)];
            this.targetX = this.targetPlant.x;
          } else if (rand < 0.01) {
            // Start swimming
            this.state = 'swimming';
            this.targetX = this.x + (Math.random() * 200 - 100);
            this.targetY = this.y - 50 - Math.random() * 150;
            this.targetX = Math.max(20, Math.min(this.width - 20, this.targetX));
          } else if (rand < 0.03) {
            this.targetX = this.x + (Math.random() * 300 - 150);
            this.targetX = Math.max(20, Math.min(this.width - 20, this.targetX));
          } else if (rand < 0.08) {
            this.targetX = null; // stop moving
          }
        }
      }

      if (this.targetX !== null) {
        this.targetX = Math.max(10, Math.min(this.width - 10, this.targetX));
        const dx = this.targetX - this.x;
        if (Math.abs(dx) > 2) {
          this.vx = Math.sign(dx) * 0.15; // Slower walking speed
          this.facingRight = this.vx > 0;
          this.legPhase += 0.04; // Slower leg movement to match
        } else {
          this.vx = 0;
        }
      } else {
        this.vx = 0;
      }

    } else if (this.state === 'swimming') {
      this.swimPhase += 0.1;
      this.legPhase += 0.15; // Legs move faster when swimming
      
      if (this.targetX !== null && this.targetY !== null) {
        this.targetX = Math.max(10, Math.min(this.width - 10, this.targetX));
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 5) {
          this.vx = (dx / dist) * 0.5;
          this.vy = (dy / dist) * 0.5;
          this.facingRight = this.vx > 0;
        } else {
          // Reached target, either swim somewhere else or sink back down
          if (Math.random() < 0.3) {
            this.targetX = this.x + (Math.random() * 200 - 100);
            this.targetY = this.y + (Math.random() * 100 - 50);
            // Keep within bounds
            this.targetX = Math.max(20, Math.min(this.width - 20, this.targetX));
            this.targetY = Math.max(height * 0.3, Math.min(floorY, this.targetY));
          } else {
            // Swim down to the floor
            this.targetX = this.x;
            this.targetY = floorY;
          }
        }
      } else {
        // Swim down to the floor
        this.targetX = this.x;
        this.targetY = floorY;
      }
      
      // Add a little bobbing motion when swimming
      this.vy += Math.sin(this.swimPhase) * 0.1;
      
      // If we hit the floor, go back to walking
      if (this.y >= floorY) {
        this.y = floorY;
        this.state = 'walking';
      }

    } else if (this.state === 'climbing') {
      this.legPhase += 0.05;
      
      if (this.targetPlant) {
        if (this.targetPlant.x < 10 || this.targetPlant.x > this.width - 10) {
          this.targetPlant = null;
          this.state = 'swimming';
          this.targetX = this.x;
          this.targetY = floorY;
        } else {
          // First move to the plant
          const dx = this.targetPlant.x - this.x;
          if (Math.abs(dx) > 2 && this.y >= floorY - 5) {
            this.vx = Math.sign(dx) * 0.15; // Slower walking speed when moving to plant
            this.vy = 0;
            this.facingRight = this.vx > 0;
          } else {
            // At the plant, climb up
            this.vx = 0;
            this.x = this.targetPlant.x; // Snap to plant
            
            // Determine how high we can climb (plant's current height)
            const minClimbY = this.targetPlant.y - this.targetPlant.currentHeight + 20;
            
            if (this.targetY === null || this.targetY > this.y) {
              // Set a target to climb up to
              this.targetY = minClimbY + Math.random() * (this.y - minClimbY);
            }
            
            const dy = this.targetY - this.y;
            if (Math.abs(dy) > 2) {
              this.vy = Math.sign(dy) * 0.2; // Climb slowly
              // Face up/down the plant? For now just alternate or face plant center
              this.facingRight = Math.sin(Date.now() / 500) > 0;
            } else {
              // Reached climb target
              if (Math.random() < 0.02) {
                // Swim away
                this.state = 'swimming';
                this.targetX = this.x + (Math.random() > 0.5 ? 50 : -50);
                this.targetY = this.y - 20;
                this.targetX = Math.max(20, Math.min(this.width - 20, this.targetX));
                this.targetPlant = null;
              } else if (Math.random() < 0.05) {
                // Pick a new spot on the plant
                this.targetY = minClimbY + Math.random() * (floorY - minClimbY);
              } else {
                this.vy = 0; // Just hang out
              }
            }
          }
        }
      } else {
        this.state = 'swimming';
        this.targetX = this.x;
        this.targetY = floorY;
      }
    }

    this.x += this.vx;
    this.y += this.vy;
    
    // Keep in bounds
    this.x = Math.max(10, Math.min(this.width - 10, this.x));
    this.y = Math.min(floorY, this.y);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    
    // If facing right, flip the context because the default drawing faces left
    if (this.facingRight) {
      ctx.scale(-1, 1);
    }
    
    // If swimming or climbing, maybe rotate a bit
    if (this.state === 'swimming') {
      const angle = Math.atan2(this.vy, Math.abs(this.vx || 1)) * 0.5;
      ctx.rotate(this.facingRight ? angle : -angle);
    } else if (this.state === 'climbing' && this.vy !== 0) {
      // Tilt up or down when climbing
      ctx.rotate(this.vy < 0 ? 0.5 : -0.5);
    }

    // Pink shrimp colors
    ctx.strokeStyle = 'rgba(255, 150, 180, 0.6)';
    ctx.fillStyle = 'rgba(255, 180, 200, 0.4)';
    ctx.lineWidth = 1.5;

    // Body
    ctx.beginPath();
    ctx.moveTo(-12, 0); // Head
    ctx.quadraticCurveTo(-5, -8, 5, -5); // Back
    ctx.quadraticCurveTo(15, -2, 18, 2); // Tail
    ctx.quadraticCurveTo(5, 2, -12, 0); // Belly
    ctx.fill();
    ctx.stroke();

    // Tail fan
    ctx.beginPath();
    ctx.moveTo(18, 2);
    ctx.lineTo(24, -2);
    ctx.lineTo(22, 6);
    ctx.lineTo(18, 2);
    ctx.fill();
    ctx.stroke();

    // Legs
    for (let i = 0; i < 4; i++) {
      const legX = -2 + i * 4;
      const legY = Math.sin(this.legPhase + i) * 3;
      ctx.beginPath();
      ctx.moveTo(legX, 1);
      ctx.lineTo(legX - 2, 6 + legY);
      ctx.lineTo(legX, 10 + legY);
      ctx.stroke();
    }

    // Antennae
    ctx.beginPath();
    ctx.moveTo(-12, -2);
    ctx.quadraticCurveTo(-18, -10, -25, -12 + Math.sin(this.legPhase)*2);
    ctx.moveTo(-12, -1);
    ctx.quadraticCurveTo(-20, -5, -28, -2 + Math.cos(this.legPhase)*2);
    ctx.stroke();

    // Eye
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.arc(-9, -3, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
