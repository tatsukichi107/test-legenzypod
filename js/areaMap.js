// FILE: js/areaMap.js
/* =========================================================
   TalisPod v0.79
   areaMap.js（module不使用）
   エリア定義データ（ID / 名称 / 英語名 / 属性 / 種別）
   - file:// でも確実に動くように import/export を使わない
   - window.TSP_AREAMAP として公開
   ========================================================= */
(function () {
  "use strict";

  /* =======================================================
     属性定義（英名は世界観の名称を優先）
     ======================================================= */
  const ATTRIBUTES = {
    VOLCANO: "VOLCANO",       // 火
    TORNADO: "TORNADO",       // 風
    EARTHQUAKE: "EARTHQUAKE", // 土
    STORM: "STORM"            // 水
  };

  /* =======================================================
     エリアマスタ（IDと名称をセットで覚える）
     - name: 日本語
     - enName: 英語（表示用）
     ======================================================= */
  const AREAS = {
    /* ===== 火（VOLCANO）===== */
    V1: { id: "V1", name: "火山",     enName: "Volcano",             attribute: ATTRIBUTES.VOLCANO, type: "land" },
    V2: { id: "V2", name: "砂漠",     enName: "Desert",              attribute: ATTRIBUTES.VOLCANO, type: "land" },
    V3: { id: "V3", name: "乾燥帯",   enName: "Arid Zone",           attribute: ATTRIBUTES.VOLCANO, type: "land" },
    V4: { id: "V4", name: "広葉樹林", enName: "Broadleaf Forest",    attribute: ATTRIBUTES.VOLCANO, type: "land" },

    /* ===== 風（TORNADO）===== */
    T1: { id: "T1", name: "成層圏",   enName: "Stratosphere",        attribute: ATTRIBUTES.TORNADO, type: "land" },
    T2: { id: "T2", name: "山岳地帯", enName: "Mountain Range",      attribute: ATTRIBUTES.TORNADO, type: "land" },
    T3: { id: "T3", name: "高原",     enName: "Plateau",             attribute: ATTRIBUTES.TORNADO, type: "land" },
    T4: { id: "T4", name: "針葉樹林", enName: "Conifer Forest",      attribute: ATTRIBUTES.TORNADO, type: "land" },

    /* ===== 土（EARTHQUAKE）===== */
    E1: { id: "E1", name: "地底",     enName: "Subterranean",        attribute: ATTRIBUTES.EARTHQUAKE, type: "land" },
    E2: { id: "E2", name: "熱帯雨林", enName: "Tropical Rainforest", attribute: ATTRIBUTES.EARTHQUAKE, type: "land" },
    E3: { id: "E3", name: "熱帯",     enName: "Tropics",             attribute: ATTRIBUTES.EARTHQUAKE, type: "land" },
    E4: { id: "E4", name: "温帯草原", enName: "Temperate Grassland", attribute: ATTRIBUTES.EARTHQUAKE, type: "land" },

    /* ===== 水（STORM）陸上 ===== */
    S1: { id: "S1", name: "絶対零度", enName: "Absolute Zero",       attribute: ATTRIBUTES.STORM, type: "land" },
    S2: { id: "S2", name: "極寒地帯", enName: "Polar Frigid Zone",   attribute: ATTRIBUTES.STORM, type: "land" },
    S3: { id: "S3", name: "寒帯",     enName: "Cold Zone",           attribute: ATTRIBUTES.STORM, type: "land" },
    S4: { id: "S4", name: "寒帯草原", enName: "Cold Steppe",         attribute: ATTRIBUTES.STORM, type: "land" },

    /* ===== 水中（南海）===== */
    SS_SHALLOW: { id: "SS_SHALLOW", name: "南海浅瀬", enName: "South Sea Shallows",  attribute: ATTRIBUTES.STORM, type: "sea", side: "south", depth: 0 },
    SS_MID:     { id: "SS_MID",     name: "南海水中", enName: "South Sea Midwater", attribute: ATTRIBUTES.STORM, type: "sea", side: "south", depth: 50 },
    SS_DEEP:    { id: "SS_DEEP",    name: "南海深海", enName: "South Sea Deep",     attribute: ATTRIBUTES.STORM, type: "sea", side: "south", depth: 100 },

    /* ===== 水中（北海）===== */
    SN_SHALLOW: { id: "SN_SHALLOW", name: "北海浅瀬", enName: "North Sea Shallows",  attribute: ATTRIBUTES.STORM, type: "sea", side: "north", depth: 0 },
    SN_MID:     { id: "SN_MID",     name: "北海水中", enName: "North Sea Midwater", attribute: ATTRIBUTES.STORM, type: "sea", side: "north", depth: 50 },
    SN_DEEP:    { id: "SN_DEEP",    name: "北海深海", enName: "North Sea Deep",     attribute: ATTRIBUTES.STORM, type: "sea", side: "north", depth: 100 }
  };

  function getAreaById(id) {
    return AREAS[id] || null;
  }
  function getAreaName(id) {
    return AREAS[id] ? AREAS[id].name : null;
  }
  function getAreaEnName(id) {
    return AREAS[id] ? (AREAS[id].enName || null) : null;
  }
  function getAreaAttribute(id) {
    return AREAS[id] ? AREAS[id].attribute : null;
  }

  // 公開
  window.TSP_AREAMAP = {
    ATTRIBUTES,
    AREAS,
    getAreaById,
    getAreaName,
    getAreaEnName,
    getAreaAttribute
  };
})();
