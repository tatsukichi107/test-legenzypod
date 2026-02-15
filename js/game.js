// FILE: js/game.js
/* =========================================================
   TalisPod v0.79-prep
   game.js（module不使用）
   エリアID（TSP_AREA）ベースで
   - 環境属性（volcano/tornado/earthquake/storm/neutral）
   - 相性ランク（超ベスト/ベスト/良好/普通/最悪/無属性）
   - 育成（回復→成長→ダメージ）
   - 1分予告
   を提供する統合ロジック

   公開：
   window.TSP_GAME

   依存：
   - window.TSP_AREAMAP（areaMap.js）
   - window.TSP_AREA（areaResolver.js）
   ========================================================= */
(function () {
  "use strict";

  const AM = window.TSP_AREAMAP;
  const AR = window.TSP_AREA;

  if (!AM || !AR) {
    console.error("[game] required libs missing:", { TSP_AREAMAP: !!AM, TSP_AREA: !!AR });
    window.TSP_GAME = window.TSP_GAME || {};
    return;
  }

  const ATTR_UP = AM.ATTRIBUTES; // VOLCANO / TORNADO / EARTHQUAKE / STORM
  const AREAS = AM.AREAS;

  /* =========================================================
     ステップ値（スライダーはインデックスで選ぶ）
     ★ -297 を撤去し、-273 は一番左へ
     ========================================================= */
  const TEMP_STEPS = [
    -273,
    -45, -40, -35,
    -30, -25, -20, -15, -10, -5,
    0,
    5, 10, 15, 20, 25, 30, 35, 40, 45,
    999
  ];

  const HUM_STEPS = [
    0, 5, 10, 15, 20, 25, 30, 35, 40, 45,
    50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 99, 100
  ];

  /* =========================================================
     属性キー（app.js 互換：小文字）
     ========================================================= */
  const Attr = Object.freeze({
    neutral: "neutral",
    volcano: "volcano",
    tornado: "tornado",
    earthquake: "earthquake",
    storm: "storm"
  });

  function areaAttrToKey(areaAttrUpper) {
    switch (areaAttrUpper) {
      case ATTR_UP.VOLCANO: return Attr.volcano;
      case ATTR_UP.TORNADO: return Attr.tornado;
      case ATTR_UP.EARTHQUAKE: return Attr.earthquake;
      case ATTR_UP.STORM: return Attr.storm;
      default: return Attr.neutral;
    }
  }

  /* =========================================================
     表示用メタ
     - key: 育成に使う成長キー（state.js の growStats と一致）
     ========================================================= */
  const ATTR_META = {
    [Attr.volcano]:   { jp: "ヴォルケーノ", key: "fire" },
    [Attr.tornado]:   { jp: "トルネード",   key: "wind" },
    [Attr.earthquake]:{ jp: "アースクエイク", key: "earth" },
    [Attr.storm]:     { jp: "ストーム",     key: "water" },
    [Attr.neutral]:   { jp: "無属性",       key: null }
  };

  /* =========================================================
     ランク
     ========================================================= */
  const Rank = Object.freeze({
    neutral: "neutral",
    superbest: "superbest",
    best: "best",
    good: "good",
    normal: "normal",
    bad: "bad"
  });

  /* =========================================================
     光量適正（陸上のみ足切り）
     - 無属性と水中は無視
     - 6:00〜9:59 => 50
     - 10:00〜15:59 => 100
     - 16:00〜5:59 => 0
     ========================================================= */
  function expectedLightByTime(dateObj) {
    const h = dateObj.getHours();
    if (h >= 6 && h <= 9) return 50;
    if (h >= 10 && h <= 15) return 100;
    return 0;
  }

  /* =========================================================
     envAttribute(temp, hum, lightOrDepth)
     -> "neutral" | "volcano" | "tornado" | "earthquake" | "storm"
     ========================================================= */
  function envAttribute(temp, hum, lightOrDepth) {
    const areaId = AR.resolveAreaId(temp, hum, lightOrDepth);
    if (areaId === "NEUTRAL") return Attr.neutral;
    const area = AREAS[areaId];
    if (!area) return Attr.neutral;
    return areaAttrToKey(area.attribute);
  }

  /* =========================================================
     超ベスト / ベスト
     - 超ベスト：温度・湿度（＋水中なら水深）が完全一致
     - ベスト：bestAreaId があればそれ、無ければ superBest のエリアを best とみなす
     ========================================================= */
  function isSuperBest(mon, env) {
    if (!mon || !mon.superBest) return false;
    const sb = mon.superBest;

    const tOk = Number(env.temp) === Number(sb.temp);
    const hOk = Number(env.hum) === Number(sb.hum);
    if (!tOk || !hOk) return false;

    if (Number(env.hum) === 100) {
      const dOk = Number(env.light) === Number(sb.waterDepth);
      return dOk;
    }
    return true;
  }

  function bestAreaIdFallback(mon) {
    if (!mon || !mon.superBest) return null;
    const sb = mon.superBest;
    const t = Number(sb.temp);
    const h = Number(sb.hum);
    const l = (Number(sb.hum) === 100) ? Number(sb.waterDepth) : 50; // 陸上は便宜上 50（ここはbest判定用なのでOK）
    return AR.resolveAreaId(t, h, l);
  }

  function isBest(mon, areaId) {
    if (!mon) return false;
    const bestId = mon.bestAreaId ? String(mon.bestAreaId) : null;
    if (bestId) return String(areaId) === bestId;

    const fb = bestAreaIdFallback(mon);
    if (!fb || fb === "NEUTRAL") return false;
    return String(areaId) === String(fb);
  }

  /* =========================================================
     属性相性（陸上・水中共通） ※水中は「水属性扱い」(envAttr=storm)
     優先：
     - 同属性 => good
     - 逆属性 => bad（風↔土、火↔水）
     - 隣接属性 => normal
     - neutral => neutral
     ========================================================= */
  function oppositeAttr(attrKey) {
    switch (attrKey) {
      case Attr.volcano: return Attr.storm;
      case Attr.storm: return Attr.volcano;
      case Attr.tornado: return Attr.earthquake;
      case Attr.earthquake: return Attr.tornado;
      default: return null;
    }
  }

  function relationRank(monAttrKey, envAttrKey) {
    if (!envAttrKey || envAttrKey === Attr.neutral) return Rank.neutral;

    if (!monAttrKey || monAttrKey === Attr.neutral) {
      // モンスター側が無属性扱いなら、環境は全部normalに寄せる
      return Rank.normal;
    }

    if (envAttrKey === monAttrKey) return Rank.good;

    const opp = oppositeAttr(monAttrKey);
    if (opp && envAttrKey === opp) return Rank.bad;

    // 上記以外は隣接（またはその他）＝普通
    return Rank.normal;
  }

  /* =========================================================
     computeRank
     return:
     {
       rank,
       areaId,
       envAttr,     // "volcano" etc
       areaName,    // "火山" etc（ない時null）
       isSea,
       lightExpected,
       lightOk
     }
     ========================================================= */
  function computeRank(mon, envApplied, now, monAttributeKey) {
    const temp = Number(envApplied.temp);
    const hum = Number(envApplied.hum);
    const light = Number(envApplied.light);

    const areaId = AR.resolveAreaId(temp, hum, light);

    // 1) 無属性（最優先）
    if (areaId === "NEUTRAL") {
      return {
        rank: Rank.neutral,
        areaId,
        envAttr: Attr.neutral,
        areaName: null,
        isSea: false,
        lightExpected: expectedLightByTime(now),
        lightOk: true
      };
    }

    const area = AREAS[areaId] || null;
    const envAttrKey = area ? areaAttrToKey(area.attribute) : Attr.neutral;
    const isSea = AR.isSeaAreaId(areaId);

    // 2) 水中（湿度100）：光は水深扱い、足切りなし
    if (isSea) {
      if (isSuperBest(mon, { temp, hum, light })) {
        return {
          rank: Rank.superbest,
          areaId,
          envAttr: envAttrKey,
          areaName: area ? area.name : null,
          isSea: true,
          lightExpected: null,
          lightOk: true
        };
      }
      if (isBest(mon, areaId)) {
        return {
          rank: Rank.best,
          areaId,
          envAttr: envAttrKey,
          areaName: area ? area.name : null,
          isSea: true,
          lightExpected: null,
          lightOk: true
        };
      }

      // 相性（水中は水属性扱い。areaMap側でstormなのでそのまま）
      const rel = relationRank(monAttributeKey, envAttrKey);
      return {
        rank: rel,
        areaId,
        envAttr: envAttrKey,
        areaName: area ? area.name : null,
        isSea: true,
        lightExpected: null,
        lightOk: true
      };
    }

    // 3) 陸上：光足切り（最優先）
    const need = expectedLightByTime(now);
    const lightOk = (light === need);
    if (!lightOk) {
      return {
        rank: Rank.bad,
        areaId,
        envAttr: envAttrKey,
        areaName: area ? area.name : null,
        isSea: false,
        lightExpected: need,
        lightOk: false
      };
    }

    // 4) 超ベスト/ベスト（光OKのときだけ到達）
    if (isSuperBest(mon, { temp, hum, light })) {
      return {
        rank: Rank.superbest,
        areaId,
        envAttr: envAttrKey,
        areaName: area ? area.name : null,
        isSea: false,
        lightExpected: need,
        lightOk: true
      };
    }
    if (isBest(mon, areaId)) {
      return {
        rank: Rank.best,
        areaId,
        envAttr: envAttrKey,
        areaName: area ? area.name : null,
        isSea: false,
        lightExpected: need,
        lightOk: true
      };
    }

    // 5) 相性（良好/普通/最悪）
    const rel = relationRank(monAttributeKey, envAttrKey);
    return {
      rank: rel,
      areaId,
      envAttr: envAttrKey,
      areaName: area ? area.name : null,
      isSea: false,
      lightExpected: need,
      lightOk: true
    };
  }

  /* =========================================================
     成長/回復/ダメージ（state.js 互換）
     - HP成長は soul.growHP
     - 属性成長は soul.growStats.fire/wind/earth/water
     ========================================================= */
  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function safeGrowStats(soul) {
    soul.growStats = soul.growStats || { fire: 0, wind: 0, earth: 0, water: 0 };
    if (typeof soul.growHP !== "number") soul.growHP = Number(soul.growHP || 0);
    return soul;
  }

  function maxHP(soul) {
    const base = Number(soul.baseHP || 0);
    const grow = Number(soul.growHP || 0);
    return base + grow;
  }

  function capGrowHP(soul) {
    soul.growHP = clamp(Number(soul.growHP || 0), 0, 5110);
  }

  function capGrowElem(soul, key) {
    soul.growStats[key] = clamp(Number(soul.growStats[key] || 0), 0, 630);
  }

  function envElemKey(envAttrKey) {
    const meta = ATTR_META[envAttrKey];
    return meta ? meta.key : null;
  }

  function growthProfile(rank) {
    switch (rank) {
      case Rank.superbest:
        return { hpGrow: 50, elemGrow: 20, elemInterval: 1, healCap: 500, hpDmg: 0 };
      case Rank.best:
        return { hpGrow: 30, elemGrow: 10, elemInterval: 1, healCap: 300, hpDmg: 0 };
      case Rank.good:
        return { hpGrow: 20, elemGrow: 10, elemInterval: 2, healCap: 200, hpDmg: 0 };
      case Rank.normal:
        return { hpGrow: 10, elemGrow: 10, elemInterval: 3, healCap: 100, hpDmg: 0 };
      case Rank.bad:
        return { hpGrow: 10, elemGrow: 10, elemInterval: 5, healCap: 0, hpDmg: 10 };
      default:
        return { hpGrow: 0, elemGrow: 0, elemInterval: 0, healCap: 0, hpDmg: 0 };
    }
  }

  function computeMinutePreview(soul, mon, envApplied, now, elemCounter) {
    safeGrowStats(soul);

    const info = computeRank(mon, envApplied, now, soul.attribute);
    if (info.rank === Rank.neutral) {
      return { rank: Rank.neutral, heal: 0, hpDmg: 0, hpGrow: 0, elemKey: null, elemGrow: 0 };
    }

    const prof = growthProfile(info.rank);
    const mx = maxHP(soul);
    const cur = Number(soul.currentHP != null ? soul.currentHP : mx);
    const missing = Math.max(0, mx - cur);

    const heal = (prof.healCap > 0) ? Math.min(prof.healCap, missing) : 0;

    const k = envElemKey(info.envAttr);
    let elemGrow = 0;
    if (k && prof.elemInterval > 0) {
      const c = Number((elemCounter && elemCounter[k]) || 0) + 1;
      if (c >= prof.elemInterval) elemGrow = prof.elemGrow;
    }

    const hpGrowNow = (Number(soul.growHP || 0) >= 5110) ? 0 : prof.hpGrow;
    const hpDmg = (info.rank === Rank.bad) ? prof.hpDmg : 0;

    return { rank: info.rank, heal, hpDmg, hpGrow: hpGrowNow, elemKey: k, elemGrow };
  }

  function applyOneMinute(soul, mon, envApplied, now, elemCounter) {
    safeGrowStats(soul);

    const info = computeRank(mon, envApplied, now, soul.attribute);
    if (info.rank === Rank.neutral) return;

    const prof = growthProfile(info.rank);
    const mxBefore = maxHP(soul);

    // 1) 回復
    if (prof.healCap > 0) {
      const cur = Number(soul.currentHP != null ? soul.currentHP : mxBefore);
      const missing = Math.max(0, mxBefore - cur);
      const heal = Math.min(prof.healCap, missing);
      if (heal > 0) soul.currentHP = cur + heal;
    }

    // 2) HP成長（増えた分 currentHP も増やす）
    if (prof.hpGrow > 0) {
      const beforeGrow = Number(soul.growHP || 0);
      if (beforeGrow < 5110) {
        const add = Math.min(prof.hpGrow, 5110 - beforeGrow);
        soul.growHP = beforeGrow + add;

        const cur = Number(soul.currentHP != null ? soul.currentHP : mxBefore);
        soul.currentHP = cur + add;
      }
    }
    capGrowHP(soul);

    // 3) 属性成長（到達分のみ）
    const k = envElemKey(info.envAttr);
    if (k && prof.elemInterval > 0) {
      elemCounter = elemCounter || {};
      elemCounter[k] = Number(elemCounter[k] || 0) + 1;

      if (elemCounter[k] >= prof.elemInterval) {
        elemCounter[k] = 0;
        const before = Number(soul.growStats[k] || 0);
        if (before < 630) {
          const add = Math.min(prof.elemGrow, 630 - before);
          soul.growStats[k] = before + add;
        }
        capGrowElem(soul, k);
      }
    }

    // 4) 最悪：現在HP減少
    if (info.rank === Rank.bad && prof.hpDmg > 0) {
      const mxAfter = maxHP(soul);
      const cur = Number(soul.currentHP != null ? soul.currentHP : mxAfter);
      soul.currentHP = clamp(cur - prof.hpDmg, 0, mxAfter);
    }

    // 5) クランプ
    const mxFinal = maxHP(soul);
    soul.currentHP = clamp(Number(soul.currentHP != null ? soul.currentHP : mxFinal), 0, mxFinal);
  }

  /* =========================================================
     公開
     ========================================================= */
  window.TSP_GAME = {
    Rank,
    TEMP_STEPS,
    HUM_STEPS,
    ATTR_META,

    expectedLightByTime,
    envAttribute,
    computeRank,

    maxHP,
    computeMinutePreview,
    applyOneMinute
  };
})();
