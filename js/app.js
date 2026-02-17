// FILE: js/app.js
/* =========================================================
 * TalisPod v0.79 (EN append tweaks)
 *
 * 反映（今回ぶん）
 * - ヘッダー
 *   - Line1: SagaName: ○○（英語のみ）
 *   - Line2: 種族名/Species：○○/△△（日本語/英語）
 *   - Line3: Nickname: ○○（英語のみ）
 * - Home
 *   - 無属性時：育成/Growth：環境成長なし/No Growth（2段）
 *   - 環境表示：日本語エリア名/英語エリア名（Good等は英語で括弧）
 * - Env
 *   - 光量/Light と 水深/Depth を切替（ラベル側）
 *   - 予想環境(Preview)の値：英語属性名のみ（例 Tornado）
 *   - 冒険中表示：冒険中.../Adventuring（英語は...無し・2段）
 * - Legendz
 *   - 種族名：○○/△△
 *   - 属性：英語のみ
 * - Comeback modal
 *   - 文言を指定どおりに差し替え
 *
 * 依存：
 * - window.TSP_STATE
 * - window.TSP_GAME
 * - window.TSP_AREAMAP / window.TSP_AREA
 * ========================================================= */

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const qsa = (sel) => Array.from(document.querySelectorAll(sel));

  function must(id) {
    const el = $(id);
    if (!el) throw new Error(`DOM missing: #${id}`);
    return el;
  }

  function safeText(s) {
    return String(s ?? "").replace(/\s+/g, " ").trim();
  }

  // ===== lightweight UI notice (no native dialogs) =====
  let noticeModal = null;
  let toastEl = null;
  let toastTimer = null;

  function ensureToast() {
    if (toastEl) return toastEl;
    const el = document.createElement("div");
    el.id = "tspToast";
    el.style.position = "fixed";
    el.style.left = "50%";
    el.style.bottom = "calc(84px + env(safe-area-inset-bottom, 0px))";
    el.style.transform = "translateX(-50%)";
    el.style.zIndex = "120";
    el.style.maxWidth = "92vw";
    el.style.padding = "10px 12px";
    el.style.borderRadius = "14px";
    el.style.border = "1px solid rgba(255,255,255,0.14)";
    el.style.background = "rgba(15,18,28,0.92)";
    el.style.backdropFilter = "blur(10px)";
    el.style.color = "rgba(255,255,255,0.92)";
    el.style.fontSize = "13px";
    el.style.lineHeight = "1.45";
    el.style.boxShadow = "0 14px 28px rgba(0,0,0,0.35)";
    el.style.display = "none";
    el.style.whiteSpace = "pre-wrap";
    document.body.appendChild(el);
    toastEl = el;
    return el;
  }

  function toast(msg, ms = 1400) {
    try {
      const el = ensureToast();
      el.textContent = String(msg ?? "");
      el.style.display = "block";
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        el.style.display = "none";
      }, ms);
    } catch {
      console.error("toast failed", msg);
    }
  }

  function ensureNoticeModal() {
    if (noticeModal) return noticeModal;

    const modal = document.createElement("div");
    modal.className = "modal-backdrop";
    modal.innerHTML = `
      <div class="modal">
        <div id="nzTitle" class="modal-title">Notice</div>
        <div id="nzBody" style="color:var(--muted); font-size:13px; line-height:1.55; white-space:pre-wrap;"></div>
        <div class="modal-actions" style="margin-top:12px;">
          <button id="nzOkBtn">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeNotice();
    });

    noticeModal = modal;
    $("nzOkBtn").onclick = () => closeNotice();

    return noticeModal;
  }

  function openNotice(title, body) {
    const m = ensureNoticeModal();
    $("nzTitle").textContent = String(title ?? "Notice");
    $("nzBody").textContent = String(body ?? "");
    m.classList.add("active");
  }

  function closeNotice() {
    if (!noticeModal) return;
    noticeModal.classList.remove("active");
  }

  function showError(where, e) {
    const msg = (e && (e.message || String(e))) || "unknown";
    console.error(where, e);
    openNotice("Error", `(${where})\n${msg}`);
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ===== Monster / sprite config =====
  const MONSTER = {
    id: "windragon",
    spritePath: "./assets/sprites/windragon.png",
    superBest: { temp: -45, hum: 5, waterDepth: 50 },
  };

  const SHEET = {
    frameW: 24,
    frameH: 32,
    scale: 3,
    frameToRC(i) {
      const idx = Math.max(1, Math.min(8, i)) - 1;
      return { r: Math.floor(idx / 4), c: idx % 4 };
    }
  };

  const WALK = {
    halfRangePx: 84,
    speedPxPerSec: 12,
    facing: "right",
    x: 0,
    stepTimer: 0,
    stepFrame: 1,
    turnTimer: 0
  };

  const IDLE = { timer: 0, frame: 1 };

  // ===== Particle emit accumulators =====
  const FX = {
    superAcc: 0,
    bestAcc: 0,
    goodAcc: 0,
    badAcc: 0
  };

  // ===== DOM refs =====
  let startView, mainView;
  let headerLine1, headerLine2, headerLine3;

  let sagaInput, soulTextInput, newSoulBtn, textRebornBtn;

  let tabBtns;
  let tabEls;

  let envAttributeLabel, growthTimer, growthPreview, comebackBtn;
  let homeNeutralBtn;

  let spriteMover, spriteViewport, spriteSheetLayer, spriteFxLayer;
  let scene;

  let tempSlider, humiditySlider;
  let tempValue, humidityValue, lightValue, lightLabel;
  let envPreviewLabel, neutralBtn, applyEnvBtn;

  let lightBtn0, lightBtn50, lightBtn100;

  let speciesName, nicknameInput, nicknameApplyBtn, legendzAttribute;
  let hpStat, magicStat, counterStat, strikeStat, healStat;

  let skillSlots;
  let crystalList;

  // ===== Modals =====
  let comebackModal = null;
  let confirmModal = null;

  // ===== State =====
  let soul = null;
  let envDraft = { temp: 0, hum: 50, light: 50 };
  let envApplied = { temp: 0, hum: 50, light: 50 };
  const elemCounter = { fire: 0, wind: 0, earth: 0, water: 0 };

  let secondsAccum = 0;
  let lastRafMs = null;
  let uiLocked = false;

  // ===== Skills event guard =====
  let skillsClickBound = false;

  // FX state tracking
  let lastRankKey = null;

  // ===== EN maps (今の実装エリア名に合わせて) =====
  const AREA_EN_MAP = Object.freeze({
    V1: "volcano",
    V2: "desert",
    V3: "arid zone",
    V4: "broadleaf forest",

    T1: "stratosphere",
    T2: "mountain region",
    T3: "plateau",
    T4: "conifer forest",

    E1: "underground",
    E2: "tropical rainforest",
    E3: "tropics",
    E4: "temperate grassland",

    S1: "absolute zero",
    S2: "polar region",
    S3: "subarctic",
    S4: "cold steppe",

    SS_SHALLOW: "south sea (shallow)",
    SS_MID: "south sea (mid)",
    SS_DEEP: "south sea (deep)",

    SN_SHALLOW: "north sea (shallow)",
    SN_MID: "north sea (mid)",
    SN_DEEP: "north sea (deep)",
  });

  const SPECIES_EN_MAP = Object.freeze({
    windragon: "Windragon",
  });

  function getAreaEnName(areaId) {
    if (!areaId || areaId === "NEUTRAL") return null;
    return AREA_EN_MAP[areaId] || null;
  }

  function getSpeciesEnName(s) {
    const id = safeText(s && s.speciesId);
    return SPECIES_EN_MAP[id] || "";
  }

  function lockUI(on) {
    uiLocked = on;
    if (tabBtns) tabBtns.forEach(b => (b.disabled = on));
    if (applyEnvBtn) applyEnvBtn.disabled = on;
    if (neutralBtn) neutralBtn.disabled = on;
    if (homeNeutralBtn) homeNeutralBtn.disabled = on;
  }

  function setUnrebornFlag(isUnreborn) {
    document.body.classList.toggle("unreborn", !!isUnreborn);
  }

  // ===== View / Tab =====
  function show(view) {
    startView.classList.remove("active");
    mainView.classList.remove("active");
    view.classList.add("active");
    setUnrebornFlag(view === startView);
  }

  function activeTabKey() {
    const btn = tabBtns.find(b => b.classList.contains("active"));
    return (btn && btn.dataset) ? (btn.dataset.tab || "home") : "home";
  }

  function switchTab(key) {
    tabBtns.forEach(b => b.classList.toggle("active", b.dataset.tab === key));
    Object.values(tabEls).forEach(el => el.classList.remove("active"));
    tabEls[key].classList.add("active");
  }

  // ===== Header =====
  function displayNickname(s) {
    const n = safeText(s && s.nickname);
    return n ? n : "Unregistered";
  }

  function setHeader() {
    if (!soul) {
      headerLine1.textContent = "";
      headerLine2.textContent = "";
      headerLine3.textContent = "Not reborn";
      return;
    }

    const saga = safeText(soul.sagaName);
    const spJp = safeText(soul.speciesName);
    const spEn = safeText(getSpeciesEnName(soul));
    const nick = displayNickname(soul);

    headerLine1.textContent = `SagaName: ${saga}`;
    headerLine2.textContent = `種族名/Species：${spJp}${spEn ? "/" + spEn : ""}`;
    headerLine3.textContent = `Nickname: ${nick}`;
  }

  function rankEn(rank) {
    const R = window.TSP_GAME.Rank;
    switch (rank) {
      case R.superbest: return "SuperBest";
      case R.best: return "Best";
      case R.good: return "Good";
      case R.normal: return "Normal";
      case R.bad: return "Bad";
      default: return "Neutral";
    }
  }

  function attrEnFromGame(envAttr) {
    const meta = window.TSP_GAME && window.TSP_GAME.ATTR_META;
    if (!meta) return "";
    const m = meta[envAttr] || meta.neutral;
    return safeText(m && m.en);
  }

  // ===== Home background (existing) =====
  function setHomeBackgroundByEnvAttr(envAttr) {
    if (!scene) return;
    scene.classList.remove("attr-none", "attr-volcano", "attr-tornado", "attr-earthquake", "attr-storm");
    switch (String(envAttr || "")) {
      case "volcano": scene.classList.add("attr-volcano"); break;
      case "tornado": scene.classList.add("attr-tornado"); break;
      case "earthquake": scene.classList.add("attr-earthquake"); break;
      case "storm": scene.classList.add("attr-storm"); break;
      default: scene.classList.add("attr-none");
    }
  }

  // ===== Stats UI =====
  function refreshStatsUI() {
    if (!soul) return;

    // Species: JP/EN
    const spJp = safeText(soul.speciesName);
    const spEn = safeText(getSpeciesEnName(soul));
    speciesName.textContent = spEn ? `${spJp}/${spEn}` : spJp;

    // Attribute: EN only
    legendzAttribute.textContent = String(soul.attribute ? attrEnFromGame(soul.attribute) : "");

    nicknameInput.value = soul.nickname || "";

    const mx = window.TSP_GAME.maxHP(soul);
    hpStat.textContent = `${soul.currentHP}/${mx}`;

    magicStat.textContent = String(soul.baseStats.fire + soul.growStats.fire);
    counterStat.textContent = String(soul.baseStats.wind + soul.growStats.wind);
    strikeStat.textContent = String(soul.baseStats.earth + soul.growStats.earth);
    healStat.textContent = String(soul.baseStats.water + soul.growStats.water);
  }

  function refreshCrystalsUI() {
    if (!soul) return;
    const c = soul.crystals || {};
    crystalList.innerHTML = `
      <div>Volcano：${c.volcano || 0}</div>
      <div>Tornado：${c.tornado || 0}</div>
      <div>Earthquake：${c.earthquake || 0}</div>
      <div>Storm：${c.storm || 0}</div>
    `;
  }

  // ===== Skills (dummy) =====
  const DUMMY_SKILLS = Array.from({ length: 15 }, (_, i) => ({
    id: `skill_${i + 1}`,
    name: `Skill ${String(i + 1).padStart(2, "0")}`,
    meta: (i % 3 === 0) ? "Attack" : (i % 3 === 1 ? "Support" : "Recover"),
  }));

  function renderSkillsUI() {
    if (!skillSlots) return;
    skillSlots.innerHTML = "";
    DUMMY_SKILLS.forEach((sk, idx) => {
      const row = document.createElement("div");
      row.className = "skill-slot";
      row.innerHTML = `
        <div class="left">
          <div class="name">${sk.name}</div>
          <div class="meta">${sk.meta} / Slot ${idx + 1}</div>
        </div>
        <button type="button" class="try-btn" data-skill="${sk.id}">Try</button>
      `;
      skillSlots.appendChild(row);
    });
  }

  function bindSkillsClickOnce() {
    if (!skillSlots || skillsClickBound) return;
    skillsClickBound = true;

    skillSlots.addEventListener("click", (e) => {
      const btn = e.target && e.target.closest && e.target.closest(".try-btn");
      if (!btn) return;

      const id = btn.getAttribute("data-skill");
      const sk = DUMMY_SKILLS.find(s => s.id === id);
      if (!sk) return;

      openNotice("Try", `${sk.name}`);
    });
  }

  // ===== Env sliders =====
  function initSliders() {
    tempSlider.min = "0";
    tempSlider.max = String(window.TSP_GAME.TEMP_STEPS.length - 1);
    tempSlider.step = "1";

    humiditySlider.min = "0";
    humiditySlider.max = String(window.TSP_GAME.HUM_STEPS.length - 1);
    humiditySlider.step = "1";
  }

  function setLightDraft(value) {
    envDraft.light = value;
    lightValue.textContent = String(value);

    [lightBtn0, lightBtn50, lightBtn100].forEach(b => b.classList.remove("active"));
    if (value === 0) lightBtn0.classList.add("active");
    else if (value === 50) lightBtn50.classList.add("active");
    else lightBtn100.classList.add("active");
  }

  function readDraftFromSlidersOnly() {
    const t = window.TSP_GAME.TEMP_STEPS[Number(tempSlider.value)] ?? 0;
    const h = window.TSP_GAME.HUM_STEPS[Number(humiditySlider.value)] ?? 50;
    envDraft.temp = t;
    envDraft.hum = h;
  }

  function setSlidersFromDraft() {
    const tIdx = window.TSP_GAME.TEMP_STEPS.indexOf(Number(envDraft.temp));
    const hIdx = window.TSP_GAME.HUM_STEPS.indexOf(Number(envDraft.hum));
    tempSlider.value = String(Math.max(0, tIdx));
    humiditySlider.value = String(Math.max(0, hIdx));
  }

  function updateLightLabelByHumidity() {
    const isSea = (Number(envDraft.hum) === 100);
    lightLabel.textContent = isSea ? "水深" : "光量";

    // HTML側の small-en を切替（存在すれば）
    const wrap = lightLabel && lightLabel.parentElement;
    const small = wrap ? wrap.querySelector(".small-en") : null;
    if (small) small.textContent = isSea ? " / Depth" : " / Light";
  }

  function refreshEnvUI() {
    tempValue.textContent = `${envDraft.temp}℃`;
    humidityValue.textContent = `${envDraft.hum}％`;
    updateLightLabelByHumidity();

    // Preview：英語属性のみ（Neutralなら Neutral）
    const attr = window.TSP_GAME.envAttribute(envDraft.temp, envDraft.hum, envDraft.light);
    envPreviewLabel.textContent = (attr === "neutral") ? "Neutral" : attrEnFromGame(attr);
  }

  // ===== Adventure apply (center overlay) =====
  function ensureAdventureOverlay() {
    let el = $("tspAdventureOverlay");
    if (el) return el;

    el = document.createElement("div");
    el.id = "tspAdventureOverlay";
    el.style.position = "fixed";
    el.style.left = "50%";
    el.style.top = "50%";
    el.style.transform = "translate(-50%,-50%)";
    el.style.zIndex = "200";
    el.style.padding = "14px 16px";
    el.style.borderRadius = "16px";
    el.style.border = "1px solid rgba(255,255,255,0.14)";
    el.style.background = "rgba(15,18,28,0.92)";
    el.style.backdropFilter = "blur(10px)";
    el.style.boxShadow = "0 18px 34px rgba(0,0,0,0.45)";
    el.style.display = "none";
    el.style.textAlign = "center";
    el.style.whiteSpace = "pre";
    document.body.appendChild(el);
    return el;
  }

  async function playAdventureAndApply() {
    if (uiLocked) return;

    lockUI(true);

    const overlay = ensureAdventureOverlay();
    overlay.textContent = "冒険中...\nAdventuring";
    overlay.style.display = "block";

    await sleep(3000);

    overlay.style.display = "none";

    envApplied = { ...envDraft };
    secondsAccum = 0;

    switchTab("home");
    lockUI(false);

    updateGrowthPreviewAndTimer();
    renderByCurrentEnv(0);
  }

  // =========================================================
  // Sprite / Rendering
  // =========================================================
  function setSpriteSheet() {
    spriteSheetLayer.style.backgroundImage = `url("${MONSTER.spritePath}")`;
    spriteSheetLayer.style.transform = "";
    spriteMover.style.transform = "translateX(0px)";
    spriteViewport.style.transform = "scaleX(1)";
  }

  function setFacing(direction) {
    spriteViewport.style.transform = (direction === "right") ? "scaleX(-1)" : "scaleX(1)";
  }

  function applyMoveX(xPx) {
    spriteMover.style.transform = `translateX(${xPx}px)`;
  }

  function renderFrame(frameIndex) {
    const rc = SHEET.frameToRC(frameIndex);
    const x = -(rc.c * SHEET.frameW * SHEET.scale);
    const y = -(rc.r * SHEET.frameH * SHEET.scale);
    spriteSheetLayer.style.backgroundPosition = `${x}px ${y}px`;
  }

  // ===== FX helpers =====
  function clearSceneFxClasses() {
    if (!scene) return;
    scene.classList.remove("fx-superbest", "fx-best", "fx-good", "fx-bad");
  }

  function removeParticles() {
    if (!scene) return;
    qsa(".tsp-particle, .tsp-darkfall").forEach(p => p.remove());
  }

  function clearFxAllHard() {
    spriteFxLayer.innerHTML = "";
    clearSceneFxClasses();
    removeParticles();
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function spawnParticle({ text, xPct, yPct, cls, dur, dx, dy, rot, scale, sizePx }) {
    if (!scene) return;

    const p = document.createElement("div");
    p.className = cls;
    p.textContent = text;
    p.style.left = `${xPct}%`;
    p.style.top = `${yPct}%`;

    if (cls.indexOf("tsp-particle") >= 0) {
      p.style.setProperty("--tspDur", `${dur}s`);
      p.style.setProperty("--tspDX", `${dx}px`);
      p.style.setProperty("--tspDY", `${dy}px`);
      p.style.setProperty("--tspR", `${rot}deg`);
      p.style.setProperty("--tspS", `${scale}`);
      p.style.fontSize = `${sizePx}px`;
    } else {
      // darkfall
      p.style.setProperty("--tspDur", `${dur}s`);
      p.style.setProperty("--tspDX", `${dx}px`);
      p.style.setProperty("--tspDY", `${dy}px`);
      p.style.fontSize = `${sizePx}px`;
    }

    scene.appendChild(p);

    const rmMs = Math.max(900, dur * 1000 + 240);
    setTimeout(() => { try { p.remove(); } catch {} }, rmMs);
  }

  // 超ベスト：飛び交う（♪✨混在）
  function emitSuperbest(dtSec) {
    if (!scene) return;
    scene.classList.add("fx-superbest");

    FX.superAcc += dtSec;
    const interval = 0.06;
    while (FX.superAcc >= interval) {
      FX.superAcc -= interval;
      const count = 6;

      for (let i = 0; i < count; i++) {
        const isSpark = Math.random() > 0.52;
        const text = isSpark ? "✨" : "♪";

        const xPct = rand(2, 98);
        const yPct = rand(2, 98);

        const dx = rand(-140, 140);
        const dy = rand(-220, 80);
        const rot = rand(-30, 30);
        const dur = rand(1.0, 1.9);
        const scale = rand(0.9, 1.35);
        const sizePx = isSpark ? rand(16, 24) : rand(14, 22);

        spawnParticle({
          text, xPct, yPct,
          cls: "tsp-particle tsp-fly",
          dur, dx, dy, rot, scale, sizePx
        });
      }
    }
  }

  // ベスト：♪が降り注ぐ
  function emitBest(dtSec) {
    if (!scene) return;
    scene.classList.add("fx-best");

    FX.bestAcc += dtSec;
    const interval = 0.12;
    while (FX.bestAcc >= interval) {
      FX.bestAcc -= interval;
      const count = 4;

      for (let i = 0; i < count; i++) {
        const isSpark = Math.random() > 0.86;
        const text = isSpark ? "✨" : "♪";

        const xPct = rand(4, 96);
        const yPct = rand(-8, 6);
        const dx = rand(-22, 22);
        const dy = rand(220, 340);
        const rot = rand(-12, 12);
        const dur = rand(1.4, 2.2);
        const scale = rand(0.9, 1.2);
        const sizePx = isSpark ? rand(16, 22) : rand(14, 20);

        spawnParticle({
          text, xPct, yPct,
          cls: "tsp-particle tsp-fall",
          dur, dx, dy, rot, scale, sizePx
        });
      }
    }
  }

  // 良好：♪がパラパラ
  function emitGood(dtSec) {
    if (!scene) return;
    scene.classList.add("fx-good");

    FX.goodAcc += dtSec;
    const interval = 0.45;
    while (FX.goodAcc >= interval) {
      FX.goodAcc -= interval;
      const count = 1 + (Math.random() > 0.7 ? 1 : 0);

      for (let i = 0; i < count; i++) {
        const text = "♪";
        const xPct = rand(8, 92);
        const yPct = rand(-6, 10);
        const dur = rand(1.8, 2.6);
        const dx = rand(-14, 14);
        const dy = rand(160, 240);
        const rot = rand(-14, 14);
        const scale = rand(0.9, 1.15);
        const sizePx = rand(13, 18);

        spawnParticle({
          text, xPct, yPct,
          cls: "tsp-particle tsp-drift",
          dur, dx, dy, rot, scale, sizePx
        });
      }
    }
  }

  // 最悪：暗い絵文字をパラパラ（良好と同じノリで）
  function emitBadDarkfall(dtSec) {
    if (!scene) return;
    scene.classList.add("fx-bad");

    FX.badAcc += dtSec;
    const interval = 0.38;
    while (FX.badAcc >= interval) {
      FX.badAcc -= interval;

      const texts = ["🌑", "☁️", "🕳️"];
      const text = texts[Math.floor(Math.random() * texts.length)];

      const xPct = rand(6, 94);
      const yPct = rand(-10, 6);
      const dur = rand(1.8, 2.6);
      const dx = rand(-16, 16);
      const dy = rand(180, 260);
      const sizePx = rand(14, 20);

      spawnParticle({
        text, xPct, yPct,
        cls: "tsp-darkfall",
        dur, dx, dy,
        rot: 0, scale: 1, sizePx
      });
    }
  }

  function centerSprite() {
    WALK.x = 0;
    applyMoveX(0);
  }

  function tickIdle(dtSec) {
    IDLE.timer += dtSec;
    if (IDLE.timer >= 0.5) {
      IDLE.timer -= 0.5;
      IDLE.frame = (IDLE.frame === 1) ? 2 : 1;
    }
  }

  function tickWalk(dtSec) {
    if (WALK.turnTimer > 0) {
      WALK.turnTimer -= dtSec;
      setFacing(WALK.facing);
      renderFrame(3);
      applyMoveX(WALK.x);
      return;
    }

    const dir = (WALK.facing === "right") ? 1 : -1;
    WALK.x += WALK.speedPxPerSec * dtSec * dir;

    if (WALK.x > WALK.halfRangePx) {
      WALK.x = WALK.halfRangePx;
      WALK.facing = "left";
      WALK.turnTimer = 0.5;
      WALK.stepTimer = 0;
    } else if (WALK.x < -WALK.halfRangePx) {
      WALK.x = -WALK.halfRangePx;
      WALK.facing = "right";
      WALK.turnTimer = 0.5;
      WALK.stepTimer = 0;
    }

    WALK.stepTimer += dtSec;
    if (WALK.stepTimer >= 0.5) {
      WALK.stepTimer -= 0.5;
      WALK.stepFrame = (WALK.stepFrame === 1) ? 2 : 1;
    }

    setFacing(WALK.facing);
    renderFrame(WALK.stepFrame);
    applyMoveX(WALK.x);
  }

  function updateHomeNeutralButtonVisibility(rankInfo) {
    if (!homeNeutralBtn) return;
    const R = window.TSP_GAME.Rank;
    const showIt = (rankInfo && rankInfo.rank !== R.neutral);
    homeNeutralBtn.style.display = showIt ? "block" : "none";
  }

  function makeRankKey(info) {
    return `${String(info.rank)}|${String(info.envAttr)}|${String(info.areaId)}`;
  }

  function onRankChanged(newKey) {
    clearFxAllHard();
    FX.superAcc = 0;
    FX.bestAcc = 0;
    FX.goodAcc = 0;
    FX.badAcc = 0;
    lastRankKey = newKey;
  }

  function renderByCurrentEnv(dtSec) {
    if (!soul) return;

    const now = new Date();
    const info = window.TSP_GAME.computeRank(MONSTER, envApplied, now, soul.attribute);
    const R = window.TSP_GAME.Rank;

    // Home: 環境表示＝日本語エリア名/英語エリア名（英語相性）
    if (info.rank === R.neutral) {
      envAttributeLabel.textContent = "無属性";
    } else {
      const jp = safeText(info.areaName || "");
      const en = safeText(info.areaEnName || getAreaEnName(info.areaId) || "");
      const rel = rankEn(info.rank);
      if (jp && en) envAttributeLabel.textContent = `${jp}/${en}（${rel}）`;
      else if (jp) envAttributeLabel.textContent = `${jp}（${rel}）`;
      else envAttributeLabel.textContent = `${rel}`;
    }

    setHomeBackgroundByEnvAttr(info.envAttr);

    const key = makeRankKey(info);
    if (key !== lastRankKey) onRankChanged(key);

    updateHomeNeutralButtonVisibility(info);

    // ランク別 表情・演出
    switch (info.rank) {
      case R.superbest:
        setFacing("left");
        renderFrame(7);
        emitSuperbest(dtSec);
        centerSprite();
        break;

      case R.best:
        setFacing("left");
        renderFrame(7);
        emitBest(dtSec);
        centerSprite();
        break;

      case R.good:
        tickIdle(dtSec);
        setFacing("left");
        renderFrame(IDLE.frame);
        emitGood(dtSec);
        centerSprite();
        break;

      case R.normal:
        tickIdle(dtSec);
        setFacing("left");
        renderFrame(IDLE.frame);
        centerSprite();
        break;

      case R.bad:
        setFacing("left");
        renderFrame(8);
        emitBadDarkfall(dtSec);
        centerSprite();
        break;

      case R.neutral:
      default:
        tickWalk(dtSec);
        break;
    }
  }

  // ===== Growth preview / timer =====
  function setGrowthTimerNeutral() {
    // 「環境成長なし/No Growth」2段
    growthTimer.textContent = "環境成長なし/No Growth";
  }

  function updateGrowthPreviewAndTimer() {
    if (!soul) return;

    const now = new Date();
    const info = window.TSP_GAME.computeMinutePreview(soul, MONSTER, envApplied, now, elemCounter);

    if (info.rank === window.TSP_GAME.Rank.neutral) {
      setGrowthTimerNeutral();
      growthPreview.textContent = "";
      return;
    }

    const sec = Math.max(0, Math.floor(60 - secondsAccum));
    const mm = String(Math.floor(sec / 60)).padStart(2, "0");
    const ss = String(sec % 60).padStart(2, "0");
    growthTimer.textContent = `${mm}:${ss}`;

    const parts = [];
    if (info.heal > 0) parts.push(`Recover+${info.heal}`);
    if (info.hpDmg > 0) parts.push(`HP-${info.hpDmg}`);
    parts.push(`HP+${info.hpGrow}`);

    if (info.elemKey) {
      const en = { fire: "Magic", wind: "Counter", earth: "Attack", water: "Recover" }[info.elemKey];
      parts.push(`${en}+${info.elemGrow}`);
    }

    growthPreview.textContent = parts.join(" / ");
  }

  // ===== Comeback modal =====
  let comebackModalBound = false;

  function ensureComebackModal() {
    if (comebackModal) return comebackModal;

    const modal = document.createElement("div");
    modal.className = "modal-backdrop";
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-title">ソウルドールの記憶/Soul doll Memory</div>
        <textarea id="cbCodeArea" class="modal-code" readonly></textarea>
        <div class="modal-actions">
          <button id="cbCopyBtn">コピー（Copy）</button>
          <button id="cbRebornBtn">カムバック（Comeback）</button>
          <button id="cbCloseBtn">閉じる（Close）</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeComebackModal();
    });

    comebackModal = modal;
    return modal;
  }

  function openComebackModal(code) {
    const m = ensureComebackModal();
    const area = $("cbCodeArea");
    area.value = code;

    if (!comebackModalBound) {
      comebackModalBound = true;

      $("cbCopyBtn").onclick = async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(area.value);
            toast("Copied");
          } else {
            area.focus();
            area.select();
            openNotice("Copy", "Auto-copy is not supported.\nPlease copy manually.");
          }
        } catch (e) {
          showError("copy", e);
        }
      };

      $("cbRebornBtn").onclick = () => {
        try {
          closeComebackModal();
          soul = null;
          setHeader();
          show(startView);
        } catch (e) {
          showError("cbRebornBtn", e);
        }
      };

      $("cbCloseBtn").onclick = () => closeComebackModal();
    }

    m.classList.add("active");
  }

  function closeComebackModal() {
    if (!comebackModal) return;
    comebackModal.classList.remove("active");
  }

  function doComeback() {
    if (!soul) return;
    const code = window.TSP_STATE.makeSoulCode(soul);
    openComebackModal(code);
  }

  // ===== Confirm modal (ムゾクセイ？ only) =====
  function ensureConfirmModal() {
    if (confirmModal) return confirmModal;

    const modal = document.createElement("div");
    modal.className = "modal-backdrop";
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-title">Neutral?</div>
        <div class="modal-actions" style="margin-top:12px;">
          <button id="cfYesBtn">Yes</button>
          <button id="cfNoBtn" class="ghost">No</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeConfirmModal();
    });

    confirmModal = modal;
    return modal;
  }

  function openConfirmModal(onYes) {
    const m = ensureConfirmModal();

    $("cfYesBtn").onclick = () => {
      try {
        closeConfirmModal();
        onYes && onYes();
      } catch (e) { showError("confirmYes", e); }
    };
    $("cfNoBtn").onclick = () => closeConfirmModal();

    m.classList.add("active");
  }

  function closeConfirmModal() {
    if (!confirmModal) return;
    confirmModal.classList.remove("active");
  }

  // ===== Loop =====
  function rafLoop(msNow) {
    if (lastRafMs == null) lastRafMs = msNow;
    const dtSec = Math.min(0.05, (msNow - lastRafMs) / 1000);
    lastRafMs = msNow;

    const tab = activeTabKey();

    if (soul && tab === "home") {
      secondsAccum += dtSec;

      if (secondsAccum >= 60) {
        secondsAccum -= 60;
        try {
          window.TSP_GAME.applyOneMinute(soul, MONSTER, envApplied, new Date(), elemCounter);
          refreshStatsUI();
        } catch (e) {
          showError("applyOneMinute", e);
        }
      }

      try {
        updateGrowthPreviewAndTimer();
        renderByCurrentEnv(dtSec);
      } catch (e) {
        showError("homeTickRender", e);
      }
    }

    requestAnimationFrame(rafLoop);
  }

  // ===== Neutral resets =====
  function resetToNeutralEnvApplied() {
    envApplied = { temp: 0, hum: 50, light: 50 };
    secondsAccum = 0;
    lastRankKey = null;

    updateGrowthPreviewAndTimer();
    renderByCurrentEnv(0);
  }

  function resetToNeutralEnvDraft() {
    envDraft = { temp: 0, hum: 50, light: 50 };
    setSlidersFromDraft();
    setLightDraft(50);
    refreshEnvUI();
  }

  // ===== Reborn pipeline =====
  function pipelineAfterReborn() {
    envDraft = { temp: 0, hum: 50, light: 50 };
    envApplied = { ...envDraft };
    secondsAccum = 0;

    setSlidersFromDraft();
    setLightDraft(50);
    refreshEnvUI();

    setSpriteSheet();
    lastRafMs = null;

    WALK.x = 0; WALK.facing = "right"; WALK.stepTimer = 0; WALK.stepFrame = 1; WALK.turnTimer = 0;
    IDLE.timer = 0; IDLE.frame = 1;

    FX.superAcc = 0;
    FX.bestAcc = 0;
    FX.goodAcc = 0;
    FX.badAcc = 0;

    lastRankKey = null;

    setHeader();
    refreshStatsUI();
    refreshCrystalsUI();

    renderSkillsUI();
    bindSkillsClickOnce();

    show(mainView);
    switchTab("home");

    updateGrowthPreviewAndTimer();
    renderByCurrentEnv(0);
  }

  // ===== Bind events =====
  function bindEvents() {
    tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (uiLocked) return;
        try {
          switchTab(btn.dataset.tab);

          if (btn.dataset.tab === "home") {
            updateGrowthPreviewAndTimer();
            renderByCurrentEnv(0);
          }
        } catch (e) {
          showError("tabSwitch", e);
        }
      });
    });

    newSoulBtn.addEventListener("click", () => {
      try {
        const saga = safeText(sagaInput.value);
        if (!saga) return openNotice("Input", "Enter SagaName");
        soul = window.TSP_STATE.newSoulWindragon(saga);
        pipelineAfterReborn();
      } catch (e) {
        showError("newReborn", e);
      }
    });

    textRebornBtn.addEventListener("click", () => {
      try {
        const saga = safeText(sagaInput.value);
        if (!saga) return openNotice("Input", "Enter SagaName");

        const code = safeText(soulTextInput.value);
        if (!code) return openNotice(
  "記憶が空です",
  "Memory Empty"
);


        const parsed = window.TSP_STATE.parseSoulCode(code);
        window.TSP_STATE.assertSagaMatch(parsed, saga);

        soul = parsed;
        pipelineAfterReborn();
      } catch (e) {
        showError("memoryReborn", e);
      }
    });

    comebackBtn.addEventListener("click", () => {
      try { doComeback(); }
      catch (e) { showError("comeback", e); }
    });

    if (homeNeutralBtn) {
      homeNeutralBtn.addEventListener("click", () => {
        try {
          if (!soul) return;
          openConfirmModal(() => {
            resetToNeutralEnvApplied();
            resetToNeutralEnvDraft();
            toast("Neutral");
          });
        } catch (e) {
          showError("homeNeutralBtn", e);
        }
      });
    }

    nicknameApplyBtn.addEventListener("click", () => {
      try {
        if (!soul) return;
        soul.nickname = safeText(nicknameInput.value);
        setHeader();
        toast("Updated");
      } catch (e) {
        showError("nicknameApply", e);
      }
    });

    const onEnvInput = () => {
      try {
        readDraftFromSlidersOnly();
        refreshEnvUI();
      } catch (e) {
        showError("envInput", e);
      }
    };
    tempSlider.addEventListener("input", onEnvInput);
    humiditySlider.addEventListener("input", onEnvInput);

    neutralBtn.addEventListener("click", () => {
      try {
        resetToNeutralEnvDraft();
        toast("Reset");
      } catch (e) { showError("neutralBtn", e); }
    });

    const bindLightBtn = (btn, val) => {
      btn.addEventListener("click", () => {
        try {
          setLightDraft(val);
          refreshEnvUI();
        } catch (e) {
          showError("lightBtn", e);
        }
      });
    };
    bindLightBtn(lightBtn0, 0);
    bindLightBtn(lightBtn50, 50);
    bindLightBtn(lightBtn100, 100);

    applyEnvBtn.addEventListener("click", async () => {
      try {
        await playAdventureAndApply();
        lastRankKey = null;
      } catch (e) {
        lockUI(false);
        showError("applyEnvBtn", e);
      }
    });
  }

  // ===== Boot =====
  let booted = false;

  function boot() {
    if (booted) return;
    booted = true;

    try {
      if (!window.TSP_STATE) throw new Error("TSP_STATE missing (state.js)");
      if (!window.TSP_GAME) throw new Error("TSP_GAME missing (game.js)");

      startView = must("startView");
      mainView = must("mainView");

      headerLine1 = must("headerLine1");
      headerLine2 = must("headerLine2");
      headerLine3 = must("headerLine3");

      sagaInput = must("sagaInput");
      soulTextInput = must("soulTextInput");
      newSoulBtn = must("newSoulBtn");
      textRebornBtn = must("textRebornBtn");

      tabBtns = qsa(".tab-btn");
      tabEls = {
        home: must("tab-home"),
        environment: must("tab-environment"),
        legendz: must("tab-legendz"),
        crystal: must("tab-crystal"),
      };

      envAttributeLabel = must("envAttributeLabel");
      growthTimer = must("growthTimer");
      growthPreview = must("growthPreview");
      comebackBtn = must("comebackBtn");
      homeNeutralBtn = $("homeNeutralBtn");

      spriteMover = must("spriteMover");
      spriteViewport = must("spriteViewport");
      spriteSheetLayer = must("spriteSheetLayer");
      spriteFxLayer = must("spriteFxLayer");
      scene = document.querySelector(".scene");

      tempSlider = must("tempSlider");
      humiditySlider = must("humiditySlider");
      tempValue = must("tempValue");
      humidityValue = must("humidityValue");
      lightValue = must("lightValue");
      lightLabel = must("lightLabel");

      envPreviewLabel = must("envPreviewLabel");
      neutralBtn = must("neutralBtn");
      applyEnvBtn = must("applyEnvBtn");

      lightBtn0 = must("lightBtn0");
      lightBtn50 = must("lightBtn50");
      lightBtn100 = must("lightBtn100");

      speciesName = must("speciesName");
      nicknameInput = must("nicknameInput");
      nicknameApplyBtn = must("nicknameApplyBtn");
      legendzAttribute = must("legendzAttribute");
      hpStat = must("hpStat");
      magicStat = must("magicStat");
      counterStat = must("counterStat");
      strikeStat = must("strikeStat");
      healStat = must("healStat");

      skillSlots = $("skillSlots");
      crystalList = must("crystalList");

      show(startView);
      setHeader();

      initSliders();

      envDraft = { temp: 0, hum: 50, light: 50 };
      envApplied = { ...envDraft };
      setSlidersFromDraft();
      setLightDraft(50);
      refreshEnvUI();

      spriteViewport.style.width = (SHEET.frameW * SHEET.scale) + "px";
      spriteViewport.style.height = (SHEET.frameH * SHEET.scale) + "px";
      spriteSheetLayer.style.width = (96 * SHEET.scale) + "px";
      spriteSheetLayer.style.height = (64 * SHEET.scale) + "px";
      spriteSheetLayer.style.backgroundRepeat = "no-repeat";
      spriteSheetLayer.style.backgroundSize = `${96 * SHEET.scale}px ${64 * SHEET.scale}px`;

      setSpriteSheet();
      setFacing("left");
      renderFrame(1);
      applyMoveX(0);

      renderSkillsUI();
      bindSkillsClickOnce();

      setGrowthTimerNeutral();

      bindEvents();
      requestAnimationFrame(rafLoop);

    } catch (e) {
      booted = false;
      showError("boot", e);
    }
  }

  window.addEventListener("load", boot, { once: true });

})();
