const form = document.getElementById("renderForm");
const statusBox = document.getElementById("statusBox");
const submitBtn = document.getElementById("submitBtn");
const liveCanvas = document.getElementById("liveCanvas");
const ctx = liveCanvas.getContext("2d");
let canvasCssWidth = 1200;
let canvasCssHeight = 760;

let backgroundCache = null;
let activeRunId = 0;

function setCanvasResolution() {
  const dpr = window.devicePixelRatio || 1;
  const measuredWidth = Math.max(480, Math.round(liveCanvas.clientWidth || 1200));
  canvasCssWidth = measuredWidth;
  canvasCssHeight = Math.round(measuredWidth * (760 / 1200));
  liveCanvas.style.height = `${canvasCssHeight}px`;
  liveCanvas.width = Math.round(canvasCssWidth * dpr);
  liveCanvas.height = Math.round(canvasCssHeight * dpr);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
}

setCanvasResolution();
window.addEventListener("resize", () => {
  setCanvasResolution();
  backgroundCache = null;
});

function createRng(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function objective(name, x, y) {
  if (name === "rosenbrock") {
    const a = 1 - x;
    const b = y - x * x;
    return a * a + 100 * b * b;
  }
  const r = Math.sqrt(0.5 * (x * x + y * y));
  return -20 * Math.exp(-0.2 * r) - Math.exp(0.5 * (Math.cos(2 * Math.PI * x) + Math.cos(2 * Math.PI * y))) + Math.E + 20;
}

function domainFor(functionName) {
  return functionName === "rosenbrock"
    ? { minX: -2.2, maxX: 2.2, minY: -1.2, maxY: 3.2 }
    : { minX: -5, maxX: 5, minY: -5, maxY: 5 };
}

function toPayload(formData) {
  return {
    function_name: String(formData.get("function_name")),
    particles: Number(formData.get("particles")),
    iterations: Number(formData.get("iterations")),
    inertia_weight: Number(formData.get("inertia_weight")),
    cognitive_factor: Number(formData.get("cognitive_factor")),
    social_factor: Number(formData.get("social_factor")),
    seed: Number(formData.get("seed")),
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeValue(functionName, z) {
  if (functionName === "rosenbrock") {
    const logScaled = Math.log10(z + 1);
    return clamp(1 - logScaled / 3.2, 0, 1);
  }
  return clamp(1 - z / 22, 0, 1);
}

function mapToCanvas(x, y, domain) {
  const nx = (x - domain.minX) / (domain.maxX - domain.minX);
  const ny = (y - domain.minY) / (domain.maxY - domain.minY);
  return {
    px: nx * canvasCssWidth,
    py: canvasCssHeight - ny * canvasCssHeight,
  };
}

function paletteInferno(t) {
  const stops = [
    [0.0, [16, 12, 48]],
    [0.2, [66, 10, 104]],
    [0.4, [127, 34, 142]],
    [0.6, [187, 55, 84]],
    [0.8, [238, 122, 26]],
    [1.0, [252, 238, 89]],
  ];
  for (let i = 0; i < stops.length - 1; i += 1) {
    const [t0, c0] = stops[i];
    const [t1, c1] = stops[i + 1];
    if (t >= t0 && t <= t1) {
      const k = (t - t0) / (t1 - t0);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * k),
        Math.round(c0[1] + (c1[1] - c0[1]) * k),
        Math.round(c0[2] + (c1[2] - c0[2]) * k),
      ];
    }
  }
  return [252, 238, 89];
}

function drawBackground(domain, fnName) {
  const cacheKey = `${fnName}:${domain.minX}:${domain.maxX}:${domain.minY}:${domain.maxY}:${liveCanvas.width}:${liveCanvas.height}`;
  if (backgroundCache?.key === cacheKey) {
    ctx.putImageData(backgroundCache.imageData, 0, 0);
    return;
  }

  const width = liveCanvas.width;
  const height = liveCanvas.height;
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;
  const contourLevels = 28;

  for (let py = 0; py < height; py += 1) {
    for (let px = 0; px < width; px += 1) {
      const x = domain.minX + (px / (width - 1)) * (domain.maxX - domain.minX);
      const y = domain.maxY - (py / (height - 1)) * (domain.maxY - domain.minY);
      const z = objective(fnName, x, y);
      const t = normalizeValue(fnName, z);
      let [r, g, b] = paletteInferno(t);

      const contourDistance = Math.abs(t * contourLevels - Math.round(t * contourLevels));
      if (contourDistance < 0.035) {
        const mix = clamp((0.035 - contourDistance) / 0.035, 0, 1) * 0.25;
        r = Math.round(r + (255 - r) * mix);
        g = Math.round(g + (255 - g) * mix);
        b = Math.round(b + (255 - b) * mix);
      }

      const idx = (py * width + px) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  backgroundCache = { key: cacheKey, imageData };
}

function createParticles(payload, domain, rng) {
  const particles = [];
  let globalBest = null;
  for (let i = 0; i < payload.particles; i += 1) {
    const x = domain.minX + rng() * (domain.maxX - domain.minX);
    const y = domain.minY + rng() * (domain.maxY - domain.minY);
    const vx = (rng() - 0.5) * 0.15;
    const vy = (rng() - 0.5) * 0.15;
    const value = objective(payload.function_name, x, y);
    const particle = {
      x,
      y,
      vx,
      vy,
      bestX: x,
      bestY: y,
      bestValue: value,
    };
    particles.push(particle);
    if (!globalBest || value < globalBest.value) {
      globalBest = { x, y, value };
    }
  }
  return { particles, globalBest };
}

function drawFrame(payload, domain, particles, globalBest, iteration) {
  drawBackground(domain, payload.function_name);

  for (const particle of particles) {
    const { px, py } = mapToCanvas(particle.x, particle.y, domain);
    ctx.beginPath();
    ctx.arc(px, py, 5.6, 0, Math.PI * 2);
    ctx.fillStyle = "#8fe7ff";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(12,22,29,0.72)";
    ctx.stroke();
  }

  const g = mapToCanvas(globalBest.x, globalBest.y, domain);
  ctx.beginPath();
  ctx.arc(g.px, g.py, 8.5, 0, Math.PI * 2);
  ctx.fillStyle = "#ff7c6b";
  ctx.fill();
  ctx.strokeStyle = "#501711";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function stepParticles(payload, domain, particles, globalBest, rng) {
  for (const particle of particles) {
    const r1 = rng();
    const r2 = rng();
    particle.vx =
      payload.inertia_weight * particle.vx +
      payload.cognitive_factor * r1 * (particle.bestX - particle.x) +
      payload.social_factor * r2 * (globalBest.x - particle.x);
    particle.vy =
      payload.inertia_weight * particle.vy +
      payload.cognitive_factor * r1 * (particle.bestY - particle.y) +
      payload.social_factor * r2 * (globalBest.y - particle.y);

    particle.x = clamp(particle.x + particle.vx * 0.08, domain.minX, domain.maxX);
    particle.y = clamp(particle.y + particle.vy * 0.08, domain.minY, domain.maxY);

    const value = objective(payload.function_name, particle.x, particle.y);
    if (value < particle.bestValue) {
      particle.bestValue = value;
      particle.bestX = particle.x;
      particle.bestY = particle.y;
    }
    if (value < globalBest.value) {
      globalBest.x = particle.x;
      globalBest.y = particle.y;
      globalBest.value = value;
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const runId = ++activeRunId;
  const payload = toPayload(new FormData(form));
  setCanvasResolution();
  const domain = domainFor(payload.function_name);
  const rng = createRng(payload.seed);
  const { particles, globalBest } = createParticles(payload, domain, rng);
  backgroundCache = null;

  statusBox.textContent = "Rendering läuft lokal im Browser...";
  submitBtn.disabled = true;

  try {
    for (let i = 0; i < payload.iterations; i += 1) {
      if (runId !== activeRunId) {
        return;
      }
      stepParticles(payload, domain, particles, globalBest, rng);
      drawFrame(payload, domain, particles, globalBest, i);
      statusBox.textContent = `Rendering läuft lokal... Iteration ${i + 1}/${payload.iterations}`;
      await sleep(33);
    }
    statusBox.textContent = "Fertig. Die Animation ist abgeschlossen.";
  } catch (error) {
    statusBox.textContent = `Fehler: ${error.message}`;
  } finally {
    submitBtn.disabled = false;
  }
});
