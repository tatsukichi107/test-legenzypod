// FILE: js/areaMap.js
/* =========================================================
   TalisPod v0.77+  areaMap.js（最終固定版）
   エリア定義データ（ID / 名称 / 属性 / 種別）
   - file:// でも確実に動くように import/export を使わない
   - window.TSP_AREAMAP として公開

   ★ID体系（あなた指定）
   火=V（ヴォルケーノ）/ 風=T（トルネード）/ 土=E（アースクエイク）/ 水=S（ストーム）
   水中はおすすめID（北海/南海 × 浅瀬/水中/深海）
   ========================================================= */
(function () {
  "use strict";

  /* =======================================================
     属性定義（areaResolver / game が参照）
     - 値は「大文字」で統一（game.js 側で小文字へ正規化）
     ======================================================= */
  const ATTRIBUTES = Object.freeze({
    VOLCANO: "VOLCANO",       // 火
    TORNADO: "TORNADO",       // 風
    EARTHQUAKE: "EARTHQUAKE", // 土
    STORM: "STORM"            // 水
  });

  /* =======================================================
     エリアマスタ（IDと名称をセットで覚える）
     ======================================================= */
  const AREAS = Object.freeze({
    /* ===== 火（VOLCANO）===== */
    V1: Object.freeze({ id: "V1", name: "火山",     attribute: ATTRIBUTES.VOLCANO, type: "land" }),
    V2: Object.freeze({ id: "V2", name: "砂漠",     attribute: ATTRIBUTES.VOLCANO, type: "land" }),
    V3: Object.freeze({ id: "V3", name: "乾燥帯",   attribute: ATTRIBUTES.VOLCANO, type: "land" }),
    V4: Object.freeze({ id: "V4", name: "広葉樹林", attribute: ATTRIBUTES.VOLCANO, type: "land" }),

    /* ===== 風（TORNADO）===== */
    T1: Object.freeze({ id: "T1", name: "成層圏",   attribute: ATTRIBUTES.TORNADO, type: "land" }),
    T2: Object.freeze({ id: "T2", name: "山岳地帯", attribute: ATTRIBUTES.TORNADO, type: "land" }),
    T3: Object.freeze({ id: "T3", name: "高原",     attribute: ATTRIBUTES.TORNADO, type: "land" }),
    T4: Object.freeze({ id: "T4", name: "針葉樹林", attribute: ATTRIBUTES.TORNADO, type: "land" }),

    /* ===== 土（EARTHQUAKE）===== */
    E1: Object.freeze({ id: "E1", name: "地底",     attribute: ATTRIBUTES.EARTHQUAKE, type: "land" }),
    E2: Object.freeze({ id: "E2", name: "熱帯雨林", attribute: ATTRIBUTES.EARTHQUAKE, type: "land" }),
    E3: Object.freeze({ id: "E3", name: "熱帯",     attribute: ATTRIBUTES.EARTHQUAKE, type: "land" }),
    E4: Object.freeze({ id: "E4", name: "温帯草原", attribute: ATTRIBUTES.EARTHQUAKE, type: "land" }),

    /* ===== 水（STORM）陸上 ===== */
    S1: Object.freeze({ id: "S1", name: "絶対零度", attribute: ATTRIBUTES.STORM, type: "land" }),
    S2: Object.freeze({ id: "S2", name: "極寒地帯", attribute: ATTRIBUTES.STORM, type: "land" }),
    S3: Object.freeze({ id: "S3", name: "寒帯",     attribute: ATTRIBUTES.STORM, type: "land" }),
    S4: Object.freeze({ id: "S4", name: "寒帯草原", attribute: ATTRIBUTES.STORM, type: "land" }),

    /* ===== 水中（南海）===== */
    SS_SHALLOW: Object.freeze({ id: "SS_SHALLOW", name: "南海浅瀬", attribute: ATTRIBUTES.STORM, type: "sea", side: "south", depth: 0 }),
    SS_MID:     Object.freeze({ id: "SS_MID",     name: "南海水中", attribute: ATTRIBUTES.STORM, type: "sea", side: "south", depth: 50 }),
    SS_DEEP:    Object.freeze({ id: "SS_DEEP",    name: "南海深海", attribute: ATTRIBUTES.STORM, type: "sea", side: "south", depth: 100 }),

    /* ===== 水中（北海）===== */
    SN_SHALLOW: Object.freeze({ id: "SN_SHALLOW", name: "北海浅瀬", attribute: ATTRIBUTES.STORM, type: "sea", side: "north", depth: 0 }),
    SN_MID:     Object.freeze({ id: "SN_MID",     name: "北海水中", attribute: ATTRIBUTES.STORM, type: "sea", side: "north", depth: 50 }),
    SN_DEEP:    Object.freeze({ id: "SN_DEEP",    name: "北海深海", attribute: ATTRIBUTES.STORM, type: "sea", side: "north", depth: 100 })
  });

  /* =======================================================
     helpers
     ======================================================= */
  function getAreaById(id) {
    return AREAS[id] || null;
  }
  function getAreaName(id) {
    const a = AREAS[id];
    return a ? a.name : null;
  }
  function getAreaAttribute(id) {
    const a = AREAS[id];
    return a ? a.attribute : null;
  }
  function isSea(id) {
    const a = AREAS[id];
    return !!a && a.type === "sea";
  }

  // 公開
  window.TSP_AREAMAP = {
    ATTRIBUTES,
    AREAS,
    getAreaById,
    getAreaName,
    getAreaAttribute,
    isSea
  };
})();
