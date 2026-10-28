/* Shared, inspectable initial rules; scores are not probabilities. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ScentRecommendation = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function list(value) { return Array.isArray(value) ? value : []; }
  function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
  function temperatureBucket(t) {
    if (!finite(t)) return null;
    if (t >= 25) return '25℃+';
    if (t >= 18) return '18-25℃';
    if (t >= 10) return '10-18℃';
    return '10℃以下';
  }
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rank(data, ctx) {
    ctx = ctx || {};
    var scenes = list(ctx.scenes), excluded = list(ctx.excludedNames);
    var bucket = temperatureBucket(ctx.temperature);
    var temps = list(ctx.temperatureBuckets).length ? ctx.temperatureBuckets : (bucket ? [bucket] : []);
    var validHumidity = finite(ctx.humidity) && ctx.humidity >= 0 && ctx.humidity <= 100;
    var denominator = (temps.length ? 90 : 0) + (ctx.season ? 10 : 0);
    return list(data).filter(function (b) {
      return b && b.n && excluded.indexOf(b.n) < 0 && (!scenes.length || scenes.some(function (s) { return list(b.sc).indexOf(s) >= 0; }));
    }).map(function (b) {
      var temperatureMatch = temps.length ? temps.some(function (t) { return list(b.t).indexOf(t) >= 0; }) : null;
      var seasonMatch = ctx.season ? list(b.s).indexOf(ctx.season) >= 0 : null;
      var baseScore = denominator ? ((temperatureMatch ? 90 : 0) + (seasonMatch ? 10 : 0)) * 100 / denominator : 0;
      var adjustment = 0, humidityTag = String(b.h || '').trim();
      if (validHumidity) {
        if (ctx.humidity > 70 && /^(高湿慎喷|潮湿慎喷)$/.test(humidityTag)) adjustment = -5;
        if (ctx.humidity < 40 && humidityTag === '干燥更出彩') adjustment = 2;
      }
      return {b:b, baseScore:baseScore, humidityAdjustment:adjustment, score:baseScore+adjustment,
        temperatureMatch:temperatureMatch, seasonMatch:seasonMatch,
        tie:hash(String(ctx.date || '')+'|'+b.n)};
    }).sort(function (a,b) { return b.score-a.score || a.tie-b.tie || a.b.n.localeCompare(b.b.n); });
  }
  function select(ranked, count) {
    var seen = new Set(), out = [];
    list(ranked).some(function (r) {
      // Keep incompatible scored rows inspectable, but never fill the display
      // with a bottle whose stored temperature range does not match.
      if (r.temperatureMatch === false) return false;
      var brand = String(r.b.b || r.b.n).trim().toLowerCase();
      if (!seen.has(brand)) { seen.add(brand); out.push(r); }
      return out.length >= (count || 3);
    });
    return out;
  }
  return {rank:rank, select:select, temperatureBucket:temperatureBucket,
    rules:Object.freeze({version:'2026-10-28-v1', temperature:90, season:10, humidPenalty:-5, dryBonus:2, historyEnabled:false})};
}));
