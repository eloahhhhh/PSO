const form = document.getElementById("renderForm");
const statusBox = document.getElementById("statusBox");
const submitBtn = document.getElementById("submitBtn");
const resultVideo = document.getElementById("resultVideo");
const downloadBtn = document.getElementById("downloadBtn");

const viewer = document.querySelector(".viewer");
const liveCanvas = document.createElement("canvas");
liveCanvas.id = "liveCanvas";
liveCanvas.width = 1100;
liveCanvas.height = 620;
viewer.insertBefore(liveCanvas, resultVideo);
const ctx = liveCanvas.getContext("2d");

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

function mapToCanvas(x, y, domain) {
  const nx = (x - domain.minX) / (domain.maxX - domain.minX);
  const ny = (y - domain.minY) / (domain.maxY - domain.minY);
  return {
    px: nx * liveCanvas.width,
    py: liveCanvas.height - ny * liveCanvas.height,
  };
}

function drawBackground(domain, fnName) {
  const cols = 110;
  const rows = 62;
  const cellW = liveCanvas.width / cols;
  const cellH = liveCanvas.height / rows;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = domain.minX + ((col + 0.5) / cols) * (domain.maxX - domain.minX);
      const y = domain.minY + ((row + 0.5) / rows) * (domain.maxY - domain.minY);
      const z = objective(fnName, x, y);
      const normalized = clamp(1 - z / 20, 0, 1);
      const hue = 200 - normalized * 180;
      const light = 12 + normalized * 55;
      ctx.fillStyle = `hsl(${hue} 80% ${light}%)`;
      ctx.fillRect(col * cellW, liveCanvas.height - (row + 1) * cellH, cellW + 1, cellH + 1);
    }
  }
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
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#ffe082";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#111";
    ctx.stroke();
  }

  const g = mapToCanvas(globalBest.x, globalBest.y, domain);
  ctx.beginPath();
  ctx.arc(g.px, g.py, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#00ffb8";
  ctx.fill();
  ctx.strokeStyle = "#023b2b";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(12, 12, 370, 78);
  ctx.fillStyle = "#dce8ff";
  ctx.font = "16px Segoe UI";
  ctx.fillText(`Iteration: ${iteration + 1} / ${payload.iterations}`, 20, 40);
  ctx.fillText(`Bestwert: ${globalBest.value.toFixed(6)}`, 20, 64);
  ctx.fillText(`Funktion: ${payload.function_name}`, 20, 88);
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
  const payload = toPayload(new FormData(form));
  const domain = domainFor(payload.function_name);
  const rng = createRng(payload.seed);
  const { particles, globalBest } = createParticles(payload, domain, rng);

  statusBox.textContent = "Rendering läuft lokal im Browser...";
  submitBtn.disabled = true;
  downloadBtn.classList.add("disabled");
  downloadBtn.removeAttribute("href");
  resultVideo.removeAttribute("src");
  resultVideo.load();

  try {
    if (!window.MediaRecorder) {
      throw new Error("Dein Browser unterstützt MediaRecorder nicht.");
    }
    const stream = liveCanvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data);
      }
    };
    recorder.start();

    for (let i = 0; i < payload.iterations; i += 1) {
      stepParticles(payload, domain, particles, globalBest, rng);
      drawFrame(payload, domain, particles, globalBest, i);
      statusBox.textContent = `Rendering läuft lokal... Iteration ${i + 1}/${payload.iterations}`;
      await sleep(45);
    }

    await new Promise((resolve) => {
      recorder.onstop = resolve;
      recorder.stop();
    });

    const videoBlob = new Blob(chunks, { type: "video/webm" });
    const videoUrl = URL.createObjectURL(videoBlob);
    resultVideo.src = videoUrl;
    resultVideo.load();
    downloadBtn.href = videoUrl;
    downloadBtn.download = `pso-${payload.function_name}.webm`;
    downloadBtn.classList.remove("disabled");
    statusBox.textContent = "Fertig. Video wurde lokal erzeugt und kann heruntergeladen werden.";
  } catch (error) {
    statusBox.textContent = `Fehler: ${error.message}`;
  } finally {
    submitBtn.disabled = false;
  }
});
