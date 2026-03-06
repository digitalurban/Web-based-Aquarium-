import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { VectorFish, Bubble, Food, Pebble, Rock, Plant, GhostShrimp } from '../lib/entities';

export interface AquariumRef {
  addFish: (species: 'tetra' | 'clownfish') => void;
  removeFish: (species: 'tetra' | 'clownfish') => void;
  feed: (x?: number, y?: number) => void;
  setFlow: (flow: number) => void;
  setAirPump: (level: number) => void;
  setLightZoom: (zoom: number) => void;
}

const Aquarium = forwardRef<AquariumRef, {}>((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const stateRef = useRef({
    flow: 50,
    airPump: 50,
    lightZoom: 0.1,
  });

  const simRef = useRef({
    fishes: [] as VectorFish[],
    foods: [] as Food[],
    bubbles: [] as Bubble[],
    shrimps: [] as GhostShrimp[],
    environment: [] as (Pebble | Rock)[],
    plants: [] as Plant[],
    width: 0,
    height: 0
  });

  useImperativeHandle(ref, () => ({
    addFish: (species: 'tetra' | 'clownfish') => {
      simRef.current.fishes.push(new VectorFish(simRef.current.width, simRef.current.height, species));
    },
    removeFish: (species: 'tetra' | 'clownfish') => {
      const fishes = simRef.current.fishes;
      for (let i = fishes.length - 1; i >= 0; i--) {
        if (fishes[i].species === species) {
          fishes.splice(i, 1);
          break;
        }
      }
    },
    feed: (x?: number, y?: number) => {
      const sim = simRef.current;
      const count = Math.floor(Math.random() * 5) + 3;
      for (let i = 0; i < count; i++) {
        const dropX = x ?? (Math.random() * (sim.width - 100) + 50);
        const dropY = y ?? (Math.random() * 20);
        sim.foods.push(new Food(dropX + (Math.random() * 40 - 20), dropY));
      }
    },
    setFlow: (flow: number) => { stateRef.current.flow = flow; },
    setAirPump: (level: number) => { stateRef.current.airPump = level; },
    setLightZoom: (zoom: number) => { stateRef.current.lightZoom = zoom; },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const sim = simRef.current;

    const generateEnvironment = () => {
      const pebbles: Pebble[] = [];
      const rocks: Rock[] = [];
      const plants: Plant[] = [];
      
      for (let i = 0; i < 1200; i++) pebbles.push(new Pebble(sim.width, sim.height));
      for (let i = 0; i < 8; i++) rocks.push(new Rock(sim.width, sim.height));
      for (let i = 0; i < 30; i++) plants.push(new Plant(sim.width, sim.height));

      // Combine and sort by Y coordinate for correct depth rendering
      sim.environment = [...pebbles, ...rocks].sort((a, b) => a.y - b.y);
      sim.plants = plants;
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = parent.clientWidth * dpr;
        canvas.height = parent.clientHeight * dpr;
        ctx.scale(dpr, dpr);
        canvas.style.width = `${parent.clientWidth}px`;
        canvas.style.height = `${parent.clientHeight}px`;
        
        sim.width = parent.clientWidth;
        sim.height = parent.clientHeight;
        
        generateEnvironment();
      }
    };
    
    window.addEventListener('resize', resize);
    resize();

    // Clear existing to prevent duplicates in React Strict Mode
    sim.fishes = [];
    sim.foods = [];
    sim.bubbles = [];
    sim.shrimps = [];

    // Initial population: 5 Tetras, 2 Clownfish, 2 Ghost Shrimps
    for (let i = 0; i < 20; i++) sim.fishes.push(new VectorFish(sim.width, sim.height, 'tetra'));
    for (let i = 0; i < 2; i++) sim.fishes.push(new VectorFish(sim.width, sim.height, 'clownfish'));
    for (let i = 0; i < 2; i++) sim.shrimps.push(new GhostShrimp(sim.width, sim.height));

    let animationId: number;

    const drawBackground = () => {
      const time = Date.now() / 1000;
      const { lightZoom } = stateRef.current;

      // Realistic Blue Deep water gradient
      const grad = ctx.createLinearGradient(0, 0, 0, sim.height);
      grad.addColorStop(0, '#006994'); // Ocean blue surface
      grad.addColorStop(0.5, '#004b75'); // Mid water
      grad.addColorStop(1, '#001a2e'); // Deep water
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, sim.width, sim.height);

      // Light rays
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const numRays = 5;
      const raySpread = 200 * lightZoom;
      
      for (let i = 0; i < numRays; i++) {
        const x = (sim.width / numRays) * i + Math.sin(time * 0.5 + i) * 50;
        const rayGrad = ctx.createLinearGradient(x, 0, x, sim.height);
        rayGrad.addColorStop(0, `rgba(200, 240, 255, ${0.06 * lightZoom})`);
        rayGrad.addColorStop(1, 'rgba(200, 240, 255, 0)');
        
        ctx.fillStyle = rayGrad;
        ctx.beginPath();
        ctx.moveTo(x - raySpread/2, 0);
        ctx.lineTo(x + raySpread/2, 0);
        ctx.lineTo(x + raySpread, sim.height);
        ctx.lineTo(x - raySpread, sim.height);
        ctx.fill();
      }
      ctx.restore();

      // Water surface
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let x = 0; x <= sim.width; x += 20) {
        ctx.lineTo(x, 20 + Math.sin(x * 0.02 + time) * 3);
      }
      ctx.lineTo(sim.width, 0);
      ctx.fill();
      
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= sim.width; x += 20) {
        const y = 20 + Math.sin(x * 0.02 + time) * 3;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    const loop = () => {
      const time = Date.now() / 1000;
      const { flow: rawFlow, airPump } = stateRef.current;
      
      // Scale flow so 100% is equivalent to the old 30%
      const flow = rawFlow * 0.3;

      drawBackground();

      // Air Pump Bubbles
      if (airPump > 0) {
        const pumpX = sim.width * 0.75;
        // Spawn rate based on airPump level (0 to 100)
        const spawnChance = (airPump / 100) * 0.8;
        if (Math.random() < spawnChance) {
          // Spawn multiple bubbles at higher levels
          const count = Math.floor((airPump / 100) * 3) + 1;
          for (let i = 0; i < count; i++) {
            sim.bubbles.push(new Bubble(pumpX + (Math.random() * 20 - 10), sim.height - 20, 1.0));
          }
        }
      }

      // Random ambient bubbles
      if (Math.random() < 0.02) {
        sim.bubbles.push(new Bubble(Math.random() * sim.width, sim.height - 20, 0.5));
      }
      
      sim.bubbles = sim.bubbles.filter(b => b.y + b.size > 0);
      sim.bubbles.forEach(b => {
        b.update(flow);
        b.draw(ctx);
      });

      // Static Environment (Depth Sorted by Y)
      sim.environment.forEach(item => {
        item.draw(ctx);
      });

      // Foods
      sim.foods = sim.foods.filter(f => !f.eaten);
      sim.foods.forEach(f => {
        f.update(sim.height, flow);
        f.draw(ctx);
      });

      // Shrimps
      sim.shrimps.forEach(s => {
        s.update(sim.width, sim.height, sim.foods, sim.plants);
        s.draw(ctx);
      });

      // Parallax Entities (Plants and Fishes sorted by Z)
      const parallaxEntities: { type: 'plant' | 'fish', z: number, obj: any }[] = [
        ...(sim.plants || []).map(p => ({ type: 'plant' as const, z: p.z, obj: p })),
        ...sim.fishes.map(f => ({ type: 'fish' as const, z: f.z, obj: f }))
      ];

      parallaxEntities.sort((a, b) => a.z - b.z);

      parallaxEntities.forEach(entity => {
        if (entity.type === 'plant') {
          const p = entity.obj as Plant;
          p.update();
          p.draw(ctx, time, flow);
        } else {
          const f = entity.obj as VectorFish;
          f.update(sim.width, sim.height, sim.fishes, sim.foods, flow);
          f.draw(ctx);
        }
      });

      animationId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const sim = simRef.current;
    const count = Math.floor(Math.random() * 4) + 2;
    for (let i = 0; i < count; i++) {
      sim.foods.push(new Food(x + (Math.random() * 30 - 15), y));
    }
  };

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full block cursor-crosshair"
      onClick={handleCanvasClick}
    />
  );
});

export default Aquarium;
