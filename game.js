// FILE: js/game.js
/* =========================================================
   TalisPod v0.79
   game.js（module不使用）
   エリアID（TSP_AREA）ベースで
   - 環境属性
   - 相性ランク（超ベスト/ベスト/良好/普通/最悪/無属性）
   - 育成（回復→成長→ダメージ）
   - 1分予告
   を提供する統合ロジック

   ★v0.79 追加（英語併記UIのため）
   - areaName（日本語）/ areaEnName（英語）を computeRank に含める
   - envAttr の英語表示名（Volcano/Tornado/Earthquake/Storm）を返せるようにする（ATTR_META.jp/en）

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

  const ATTRIBUTES = AM.ATTRIBUTES;
  const AREAS = AM.AREAS;

  /* =========================================================
     ステップ値（スライダーはインデックスで選ぶ）
     - 温度： -273 は「いちばん左」に置く（UI要望）
     ========================================================= */
  const TEMP_STEPS = [
    -273,
    -45, -40, -35,
    -30, -25, -20, -15, -10, -5,
    0, 5, 10, 15, 20, 25, 30, 35, 40, 45,
    999
  ];

  const HUM_STEPS = [
    0, 5, 10, 15, 20, 25, 30, 35, 40, 45,
    50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 99, 100
  ];

  /* =========================================================
     属性メタ（表示用）
     ========================================================= */
  const ATTR_META = {
    [ATTRIBUTES.VOLCANO]: { jp: "ヴォルケーノ", en: "Volcano", key: "fire" },
    [ATTRIBUTES.TORNADO]: { jp: "トルネード",   en: "Tornado", key: "wind" },
    [ATTRIBUTES.EARTHQUAKE]: { jp: "アースクエイク", en: "Earthquake", key: "earth" },
    [ATTRIBUTES.STORM]: { jp: "ストーム",     en: "Storm", key: "water" },
    neutral: { jp: "無属性", en: "Neutral", key: null }
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
     ルール：光適正（陸上のみ足切り）
     ========================================================= */
  function expectedLightByTime(dateObj) {
    const h = dateObj.getHours();
    if (h >= 6 && h <= 9) return 50;
    if (h >= 10 && h <= 15) return 100;
    return 0;
  }

  /* =========================================================
     エリア属性：env(temp,hum,light) -> ATTRIBUTES or "neutral"
     ========================================================= */
  function envAttribute(temp, hum, lightOrDepth) {
    const areaId = AR.resolveAreaId(temp, hum, lightOrDepth);
    if (areaId === "NEUTRAL") return "neutral";
    const area = AREAS[areaId];
    return area ? area.attribute : "neutral";
  }

  /* =========================================================
     モンスター属性相性（4属性）
     - 同属性 => good
     - 苦手 => bad（mon.weakAttribute があれば最優先）
     - 残り => normal
     ========================================================= */
  function relationRank(monAttr, envAttr, mon) {
    if (!envAttr || envAttr === "neutral") return Rank.neutral;

    const weak = mon && mon.weakAttribute;
    if (weak && envAttr === weak) return Rank.bad;

    if (monAttr && envAttr === monAttr) return Rank.good;

    return Rank.normal;
  }

  /* =========================================================
     ベスト/超ベスト判定（優先）
     - 超ベスト：温度・湿度（＋水中なら水深）が完全一致
     - ベスト：エリア一致（mon.bestAreaId があれば）
       ない場合のフォールバック：
       superBest の (temp,hum,waterDepth) から決まるエリアIDを best とみなす
       ※ただし超ベストには届かない条件（temp/humがズレてる等）でのみ効く
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
    const l = (Number(sb.hum) === 100) ? Number(sb.waterDepth) : 50; // 陸上は光50扱いで解決
    const id = AR.resolveAreaId(t, h, l);
    return (id && id !== "NEUTRAL") ? id : null;
  }

  function isBest(mon, areaId) {
    if (!mon) return false;

    if (mon.bestAreaId) return String(mon.bestAreaId) === String(areaId);

    const fb = bestAreaIdFallback(mon);
    return fb ? (String(fb) === String(areaId)) : false;
  }

  /* =========================================================
     computeRank
     return:
     {
       rank,
       areaId,
       envAttr, envAttrJp, envAttrEn,
       areaName, areaEnName,
       isSea,
       lightExpected,
       lightOk
     }
     ========================================================= */
  function computeRank(mon, envApplied, now, monAttribute) {
    const temp = Number(envApplied.temp);
    const hum = Number(envApplied.hum);
    const light = Number(envApplied.light);

    const areaId = AR.resolveAreaId(temp, hum, light);

    // 1) 無属性
    if (areaId === "NEUTRAL") {
      return {
        rank: Rank.neutral,
        areaId,
        envAttr: "neutral",
        envAttrJp: ATTR_META.neutral.jp,
        envAttrEn: ATTR_META.neutral.en,
        areaName: null,
        areaEnName: null,
        isSea: false,
        lightExpected: expectedLightByTime(now),
        lightOk: true
      };
    }

    const area = AREAS[areaId] || null;
    const envAttr = area ? area.attribute : "neutral";
    const isSea = AR.isSeaAreaId(areaId);

    const meta = ATTR_META[envAttr] || ATTR_META.neutral;
    const areaName = area ? (area.name || null) : null;
    const areaEnName = area ? (area.enName || null) : null;

    // 2) 水中（湿度100）：光は水深扱い、足切りなし
    if (isSea) {
      if (isSuperBest(mon, { temp, hum, light })) {
        return {
          rank: Rank.superbest,
          areaId, envAttr,
          envAttrJp: meta.jp, envAttrEn: meta.en,
          areaName, areaEnName,
          isSea: true,
          lightExpected: null, lightOk: true
        };
      }
      if (isBest(mon, areaId)) {
        return {
          rank: Rank.best,
          areaId, envAttr,
          envAttrJp: meta.jp, envAttrEn: meta.en,
          areaName, areaEnName,
          isSea: true,
          lightExpected: null, lightOk: true
        };
      }
      const rel = relationRank(monAttribute, envAttr, mon);
      return {
        rank: rel,
        areaId, envAttr,
        envAttrJp: meta.jp, envAttrEn: meta.en,
        areaName, areaEnName,
        isSea: true,
        lightExpected: null, lightOk: true
      };
    }

    // 3) 陸上：光足切り
    const need = expectedLightByTime(now);
    const lightOk = (light === need);
    if (!lightOk) {
      return {
        rank: Rank.bad,
        areaId, envAttr,
        envAttrJp: meta.jp, envAttrEn: meta.en,
        areaName, areaEnName,
        isSea: false,
        lightExpected: need, lightOk: false
      };
    }

    // 4) 超ベスト/ベスト
    if (isSuperBest(mon, { temp, hum, light })) {
      return {
        rank: Rank.superbest,
        areaId, envAttr,
        envAttrJp: meta.jp, envAttrEn: meta.en,
        areaName, areaEnName,
        isSea: false,
        lightExpected: need, lightOk: true
      };
    }
    if (isBest(mon, areaId)) {
      return {
        rank: Rank.best,
        areaId, envAttr,
        envAttrJp: meta.jp, envAttrEn: meta.en,
        areaName, areaEnName,
        isSea: false,
        lightExpected: need, lightOk: true
      };
    }

    // 5) 相性
    const rel = relationRank(monAttribute, envAttr, mon);
    return {
      rank: rel,
      areaId, envAttr,
      envAttrJp: meta.jp, envAttrEn: meta.en,
      areaName, areaEnName,
      isSea: false,
      lightExpected: need, lightOk: true
    };
  }

  /* =========================================================
     成長/回復/ダメージ
     ========================================================= */
  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

function maxHP(soul) {
  const base = Number(soul.baseHP || 0);

  const growFromStats =
    Number((soul.growStats && soul.growStats.hp) || 0);

  const growFromLegacy =
    Number(soul.growHP || 0);

  return base + growFromStats + growFromLegacy;
}


  function capGrowHP(soul) {
    soul.growStats.hp = clamp(Number(soul.growStats.hp || 0), 0, 5110);
  }
  function capGrowElem(soul, key) {
    soul.growStats[key] = clamp(Number(soul.growStats[key] || 0), 0, 630);
  }

  function envElemKey(envAttr) {
    const meta = ATTR_META[envAttr];
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
        return { hpGrow: 0, elemGrow: 10, elemInterval: 5, healCap: 0, hpDmg: 10 };
      default:
        return { hpGrow: 0, elemGrow: 0, elemInterval: 0, healCap: 0, hpDmg: 0 };
    }
  }

  function computeMinutePreview(soul, mon, envApplied, now, elemCounter) {
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

    const hpGrowNow = (Number(soul.growStats.hp || 0) >= 5110) ? 0 : prof.hpGrow;
    const hpDmg = (info.rank === Rank.bad) ? prof.hpDmg : 0;

    return { rank: info.rank, heal, hpDmg, hpGrow: hpGrowNow, elemKey: k, elemGrow };
  }

  function applyOneMinute(soul, mon, envApplied, now, elemCounter) {
    const info = computeRank(mon, envApplied, now, soul.attribute);
    if (info.rank === Rank.neutral) return;

    const prof = growthProfile(info.rank);
    const mxBefore = maxHP(soul);

    // 0) growStatsの安全化
    soul.growStats = soul.growStats || { hp: 0, fire: 0, wind: 0, earth: 0, water: 0 };

    // 1) 回復
    if (prof.healCap > 0) {
      const cur = Number(soul.currentHP != null ? soul.currentHP : mxBefore);
      const missing = Math.max(0, mxBefore - cur);
      const heal = Math.min(prof.healCap, missing);
      if (heal > 0) soul.currentHP = cur + heal;
    }

    // 2) HP成長（増えた分 currentHP も増やす）
    if (prof.hpGrow > 0) {
      const beforeGrow = Number(soul.growStats.hp || 0);
      if (beforeGrow < 5110) {
        const add = Math.min(prof.hpGrow, 5110 - beforeGrow);
        soul.growStats.hp = beforeGrow + add;

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
     window.TSP_GAME 公開
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
