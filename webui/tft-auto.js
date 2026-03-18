const defaultRegions = {
  gold: { x: 0.392, y: 0.876, w: 0.07, h: 0.05 },
  hp: { x: 0.018, y: 0.06, w: 0.07, h: 0.055 },
  level: { x: 0.294, y: 0.87, w: 0.045, h: 0.06 },
  shop: { x: 0.206, y: 0.776, w: 0.585, h: 0.086 }
};

const presetFields = [
  ["gold", "金币区域"],
  ["hp", "血量区域"],
  ["level", "等级区域"],
  ["shop", "商店区域"]
];

const state = {
  workers: new Map(),
  loopTimer: null,
  lastSpoken: "",
  running: false,
  imageWidth: 0,
  imageHeight: 0
};

function $(selector) {
  return document.querySelector(selector);
}

function loadRegions() {
  try {
    const saved = JSON.parse(localStorage.getItem("tft-auto-regions") || "null");
    return saved ? { ...defaultRegions, ...saved } : { ...defaultRegions };
  } catch {
    return { ...defaultRegions };
  }
}

function saveRegions(regions) {
  localStorage.setItem("tft-auto-regions", JSON.stringify(regions));
}

function renderRegionInputs() {
  const container = $("#roiGrid");
  const regions = loadRegions();
  container.innerHTML = "";

  for (const [key, label] of presetFields) {
    const region = regions[key];
    ["x", "y", "w", "h"].forEach((part) => {
      const wrapper = document.createElement("label");
      wrapper.innerHTML = `<span>${label} ${part.toUpperCase()}</span>`;
      const input = document.createElement("input");
      input.type = "number";
      input.step = "0.001";
      input.min = "0";
      input.max = "1";
      input.value = String(region[part]);
      input.dataset.region = key;
      input.dataset.part = part;
      input.addEventListener("change", () => {
        const next = loadRegions();
        next[key][part] = Number(input.value);
        saveRegions(next);
      });
      wrapper.append(input);
      container.append(wrapper);
    });
  }
}

async function getWorker(langKey) {
  if (state.workers.has(langKey)) {
    return state.workers.get(langKey);
  }

  $("#statusLine").textContent = `状态：正在初始化 OCR (${langKey})`;
  const worker = await Tesseract.createWorker(langKey);
  state.workers.set(langKey, worker);
  return worker;
}

async function fetchScreenshotBlob() {
  const response = await fetch(`/api/tft/capture?ts=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("截图接口不可用");
  }
  return response.blob();
}

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

function drawPreview(image) {
  const canvas = $("#previewCanvas");
  const ctx = canvas.getContext("2d");
  canvas.width = image.width;
  canvas.height = image.height;
  ctx.drawImage(image, 0, 0);
  state.imageWidth = image.width;
  state.imageHeight = image.height;

  const regions = loadRegions();
  ctx.lineWidth = Math.max(2, Math.round(image.width / 500));
  ctx.font = `${Math.max(16, Math.round(image.width / 60))}px sans-serif`;

  const palette = {
    gold: "#38b2ac",
    hp: "#f56565",
    level: "#f6ad55",
    shop: "#63b3ed"
  };

  for (const [key, region] of Object.entries(regions)) {
    const x = region.x * image.width;
    const y = region.y * image.height;
    const w = region.w * image.width;
    const h = region.h * image.height;
    ctx.strokeStyle = palette[key];
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = palette[key];
    ctx.fillText(key, x + 4, y + 20);
  }
}

function cropAndEnhance(image, region, { scale = 3, monochrome = true } = {}) {
  const canvas = document.createElement("canvas");
  const x = Math.round(region.x * image.width);
  const y = Math.round(region.y * image.height);
  const w = Math.round(region.w * image.width);
  const h = Math.round(region.h * image.height);
  canvas.width = Math.max(1, w * scale);
  canvas.height = Math.max(1, h * scale);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, x, y, w, h, 0, 0, canvas.width, canvas.height);

  if (monochrome) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11);
      const value = gray > 132 ? 255 : 0;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  return canvas;
}

async function recognizeText(worker, imageLike, parameters) {
  if (parameters) {
    await worker.setParameters(parameters);
  }
  const { data } = await worker.recognize(imageLike);
  return (data.text || "").trim();
}

function digitsOnly(value) {
  const digits = value.replace(/\D+/g, "");
  return digits || "-";
}

function normalizeShopText(text) {
  return text
    .replace(/[^\u4e00-\u9fa5A-Za-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return text.split(/[\s,，]+/).map((item) => item.trim()).filter(Boolean);
}

function similarity(a, b) {
  if (!a || !b) return 0;
  let score = 0;
  for (const ch of a) {
    if (b.includes(ch)) score += 1;
  }
  return score / Math.max(a.length, b.length);
}

function normalizeShopUnits(rawText, dictionary) {
  const tokens = tokenize(rawText);
  const units = [];

  for (const token of tokens) {
    let best = token;
    let bestScore = 0;

    for (const candidate of dictionary) {
      const score = similarity(token, candidate);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    units.push(bestScore >= 0.5 ? best : token);
  }

  return units.slice(0, 8);
}

function buildAdvice({ gold, hp, level, shopUnits }) {
  const advice = [];
  const duplicates = shopUnits.filter((unit, index) => shopUnits.indexOf(unit) !== index);

  if (duplicates.length) {
    advice.push({
      title: "优先拿对子",
      body: `当前商店里有重复或高相似来牌：${[...new Set(duplicates)].join("、")}。优先补对子，提升中期稳血。`
    });
  }

  if (hp !== "-" && Number(hp) <= 35) {
    advice.push({
      title: "低血量稳血",
      body: "当前血量较低。建议本回合优先战力，不要强行吃满利息。"
    });
  } else if (gold !== "-" && Number(gold) >= 50) {
    advice.push({
      title: "优先保经济",
      body: "经济健康。除非马上掉大血，否则优先吃满利息再上人口或慢 D。"
    });
  } else {
    advice.push({
      title: "中性节奏",
      body: "当前局势更适合按对子和关键战力点做小调整，不建议盲目梭哈。"
    });
  }

  if (level !== "-" && Number(level) <= 6) {
    advice.push({
      title: "等级建议",
      body: "当前人口偏中期。优先兼顾经济和过渡质量，不要为了低费卡过度 D 牌。"
    });
  } else if (level !== "-" && Number(level) >= 8) {
    advice.push({
      title: "高人口阶段",
      body: "已进入高人口阶段。优先找高费单卡提升上限，低费非核心对子可适当放弃。"
    });
  }

  if (shopUnits.length) {
    advice.push({
      title: "本轮商店建议",
      body: `本轮识别到的候选来牌：${shopUnits.join("、")}。优先拿能立即提升战力或形成二星的牌。`
    });
  }

  return advice;
}

function updateAdviceUi(payload) {
  $("#levelText").textContent = payload.level;
  $("#goldText").textContent = payload.gold;
  $("#hpText").textContent = payload.hp;
  $("#shopText").textContent = payload.shopUnits.length ? payload.shopUnits.join("、") : payload.shopRaw || "-";

  const block = $("#adviceBlock");
  block.innerHTML = "";
  payload.advice.forEach((item) => {
    const node = document.createElement("div");
    node.className = "advice-item";
    node.innerHTML = `<strong>${item.title}</strong><div>${item.body}</div>`;
    block.append(node);
  });

  const first = payload.advice[0];
  $("#overlayMain").textContent = first?.title || "暂无建议";
  $("#overlaySub").textContent = first?.body || "等待下一轮识别";
}

function speak(text) {
  if (!$("#voiceEnabled").checked) {
    return;
  }
  if (!text || text === state.lastSpoken) {
    return;
  }
  state.lastSpoken = text;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 1.05;
  speechSynthesis.speak(utterance);
}

async function analyzeOnce() {
  const blob = await fetchScreenshotBlob();
  const image = await blobToImage(blob);
  drawPreview(image);

  const regions = loadRegions();
  const lang = $("#language").value;
  const numberWorker = await getWorker("eng");
  const textWorker = await getWorker(lang);

  $("#statusLine").textContent = "状态：正在识别";

  const goldCanvas = cropAndEnhance(image, regions.gold);
  const hpCanvas = cropAndEnhance(image, regions.hp);
  const levelCanvas = cropAndEnhance(image, regions.level);
  const shopCanvas = cropAndEnhance(image, regions.shop, { scale: 2, monochrome: false });

  const [goldRaw, hpRaw, levelRaw, shopRaw] = await Promise.all([
    recognizeText(numberWorker, goldCanvas, {
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_WORD,
      tessedit_char_whitelist: "0123456789"
    }),
    recognizeText(numberWorker, hpCanvas, {
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_WORD,
      tessedit_char_whitelist: "0123456789"
    }),
    recognizeText(numberWorker, levelCanvas, {
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_WORD,
      tessedit_char_whitelist: "0123456789"
    }),
    recognizeText(textWorker, shopCanvas, {
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT
    })
  ]);

  const dictionary = tokenize($("#dictionary").value);
  const payload = {
    gold: digitsOnly(goldRaw),
    hp: digitsOnly(hpRaw),
    level: digitsOnly(levelRaw),
    shopRaw: normalizeShopText(shopRaw),
    shopUnits: normalizeShopUnits(normalizeShopText(shopRaw), dictionary)
  };
  payload.advice = buildAdvice(payload);

  updateAdviceUi(payload);
  speak(`${payload.advice[0]?.title || ""}。${payload.advice[0]?.body || ""}`);
  $("#statusLine").textContent = `状态：识别完成 ${new Date().toLocaleTimeString()}`;
}

async function scanLoop() {
  if (!state.running) {
    return;
  }

  try {
    await analyzeOnce();
  } catch (error) {
    $("#statusLine").textContent = `状态：识别失败 - ${error.message}`;
  }

  if ($("#loopEnabled").checked && state.running) {
    const interval = Math.max(2, Number($("#interval").value || 4)) * 1000;
    state.loopTimer = setTimeout(scanLoop, interval);
  }
}

function start() {
  if (state.running) {
    return;
  }
  state.running = true;
  scanLoop();
}

function stop() {
  state.running = false;
  if (state.loopTimer) {
    clearTimeout(state.loopTimer);
    state.loopTimer = null;
  }
  $("#statusLine").textContent = "状态：已停止";
}

$("#startBtn").addEventListener("click", start);
$("#stopBtn").addEventListener("click", stop);
$("#analyzeBtn").addEventListener("click", async () => {
  try {
    await analyzeOnce();
  } catch (error) {
    $("#statusLine").textContent = `状态：识别失败 - ${error.message}`;
  }
});

renderRegionInputs();
