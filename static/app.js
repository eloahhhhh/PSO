const form = document.getElementById("renderForm");
const statusBox = document.getElementById("statusBox");
const submitBtn = document.getElementById("submitBtn");
const resultVideo = document.getElementById("resultVideo");
const downloadBtn = document.getElementById("downloadBtn");

function toPayload(formData) {
  return {
    function_name: formData.get("function_name"),
    particles: Number(formData.get("particles")),
    iterations: Number(formData.get("iterations")),
    inertia_weight: Number(formData.get("inertia_weight")),
    cognitive_factor: Number(formData.get("cognitive_factor")),
    social_factor: Number(formData.get("social_factor")),
    seed: Number(formData.get("seed")),
  };
}

async function parseResponseData(response) {
  const raw = await response.text();
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = toPayload(new FormData(form));
  statusBox.textContent = "Rendering läuft... Das kann je nach Iterationen etwas dauern.";
  submitBtn.disabled = true;
  downloadBtn.classList.add("disabled");
  downloadBtn.removeAttribute("href");

  try {
    const response = await fetch("/api/render", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await parseResponseData(response);
    if (!response.ok) {
      const serverMessage =
        data?.detail?.message ||
        data?.message ||
        data?.raw ||
        `Serverfehler (${response.status}) beim Rendering.`;
      throw new Error(serverMessage);
    }
    if (!data?.video_url) {
      throw new Error("Server hat keine gueltige Video-URL geliefert.");
    }

    const timestampedVideoUrl = `${data.video_url}?t=${Date.now()}`;
    resultVideo.src = timestampedVideoUrl;
    resultVideo.load();
    downloadBtn.href = data.video_url;
    downloadBtn.download = `pso-${payload.function_name}.mp4`;
    downloadBtn.classList.remove("disabled");
    statusBox.textContent = "Rendering erfolgreich. Video ist bereit.";
  } catch (error) {
    statusBox.textContent = `Fehler: ${error.message}`;
  } finally {
    submitBtn.disabled = false;
  }
});
