/* ============================================
   Quick-Dart Stats - Application Logic
   ============================================ */

(function () {
  'use strict';

  // ============================================
  //  DARTSLIVE レーティング算出テーブル
  // ============================================
  // 01系（BULL）: PPR(Points Per Round)ベース ※DARTSLIVE2 80%スタッツ準拠
  // PPR = (ヒット数 × 50) / ラウンド数  ※BULLは50点として計算
  const RATING_TABLE_01 = [
    { rating: 1,  minPPR: 0 },
    { rating: 2,  minPPR: 40.00 },
    { rating: 3,  minPPR: 45.00 },
    { rating: 4,  minPPR: 50.00 },
    { rating: 5,  minPPR: 55.00 },
    { rating: 6,  minPPR: 60.00 },
    { rating: 7,  minPPR: 65.00 },
    { rating: 8,  minPPR: 70.00 },
    { rating: 9,  minPPR: 75.00 },
    { rating: 10, minPPR: 80.00 },
    { rating: 11, minPPR: 85.00 },
    { rating: 12, minPPR: 90.00 },
    { rating: 13, minPPR: 95.00 },
    { rating: 14, minPPR: 102.00 },
    { rating: 15, minPPR: 109.00 },
    { rating: 16, minPPR: 116.00 },
    { rating: 17, minPPR: 123.00 },
    { rating: 18, minPPR: 130.00 },
  ];

  // CRICKET系: MPR(Marks Per Round)ベース
  const RATING_TABLE_CR = [
    { rating: 1,  minMPR: 0 },
    { rating: 2,  minMPR: 1.30 },
    { rating: 3,  minMPR: 1.50 },
    { rating: 4,  minMPR: 1.70 },
    { rating: 5,  minMPR: 1.90 },
    { rating: 6,  minMPR: 2.10 },
    { rating: 7,  minMPR: 2.30 },
    { rating: 8,  minMPR: 2.50 },
    { rating: 9,  minMPR: 2.70 },
    { rating: 10, minMPR: 2.90 },
    { rating: 11, minMPR: 3.10 },
    { rating: 12, minMPR: 3.30 },
    { rating: 13, minMPR: 3.50 },
    { rating: 14, minMPR: 3.75 },
    { rating: 15, minMPR: 4.00 },
    { rating: 16, minMPR: 4.25 },
    { rating: 17, minMPR: 4.50 },
    { rating: 18, minMPR: 4.75 },
  ];

  // ============================================
  //  State
  // ============================================
  let state = {
    mode: null,            // 'bull' | 'cricket' | 'random'
    cricketType: null,     // '20-15' | '15-20' | 'cricket-random' | '15'...'20' | 'BULL'
    rounds: [],            // [{hits: 0-3(bull) or 0-9(marks), target: number|string|null}]
    currentTarget: null,   // ランダム/クリケット用
    cricketSequence: [],   // クリケット順序で回す用
    cricketIndex: 0,
    ratingHistory: [],     // 各ラウンド後のレーティング
    prevRating: null,
  };

  // ============================================
  //  DOM Elements
  // ============================================
  const $ = (id) => document.getElementById(id);

  const screens = {
    menu: $('screen-menu'),
    cricketSelect: $('screen-cricket-select'),
    practice: $('screen-practice'),
    result: $('screen-result'),
  };

  const els = {
    practiceModeLabel: $('practice-mode-label'),
    ratingValue: $('rating-value'),
    ratingDelta: $('rating-delta'),
    ratingGaugeFill: $('rating-gauge-fill'),
    ratingGaugeMarker: $('rating-gauge-marker'),
    statLabelMain: $('stat-label-main'),
    statValueMain: $('stat-value-main'),
    statRounds: $('stat-rounds'),
    statHitrate: $('stat-hitrate'),
    targetDisplay: $('target-display'),
    targetNumber: $('target-number'),
    targetProgress: $('target-progress'),
    historyScroll: $('history-scroll'),
    historyContainer: $('history-container'),
    btnUndo: $('btn-undo'),
    toast: $('toast'),
    hitButtonsBull: $('hit-buttons-bull'),
    hitButtonsMarks: $('hit-buttons-marks'),
    hitLabel: $('hit-label'),
    dartCounter: $('dart-counter'),
    dartCounterValue: $('dart-counter-value'),
  };

  // ============================================
  //  Helpers
  // ============================================

  /** モードがマーク入力(0-9)かヒット入力(0-3)かを判定 */
  function isMarkMode() {
    return state.mode === 'cricket' || state.mode === 'random';
  }

  /** 最大入力値を返す */
  function getMaxHits() {
    return isMarkMode() ? 9 : 3;
  }

  // ============================================
  //  Screen Navigation
  // ============================================
  function showScreen(screenKey) {
    Object.values(screens).forEach(s => {
      if (s.classList.contains('active')) {
        s.classList.add('exiting');
        s.classList.remove('active');
        setTimeout(() => s.classList.remove('exiting'), 350);
      }
    });
    setTimeout(() => {
      screens[screenKey].classList.add('active');
    }, 50);
  }

  // ============================================
  //  Button Layout Switching
  // ============================================
  function showBullButtons() {
    els.hitButtonsBull.style.display = 'grid';
    els.hitButtonsMarks.style.display = 'none';
    els.hitLabel.textContent = 'ヒット数を記録';
  }

  function showMarkButtons() {
    els.hitButtonsBull.style.display = 'none';
    els.hitButtonsMarks.style.display = 'grid';
    els.hitLabel.textContent = 'マーク数を記録';
  }

  // ============================================
  //  Mode Start
  // ============================================
  function startMode(mode, cricketType) {
    state = {
      mode,
      cricketType: cricketType || null,
      rounds: [],
      currentTarget: null,
      cricketSequence: [],
      cricketIndex: 0,
      ratingHistory: [],
      prevRating: null,
    };

    // ラベル設定 & ボタン切り替え
    if (mode === 'bull') {
      els.practiceModeLabel.textContent = 'BULL練習';
      els.statLabelMain.textContent = 'PPR';
      els.targetDisplay.classList.remove('visible');
      showBullButtons();
    } else if (mode === 'cricket') {
      els.statLabelMain.textContent = 'MPR';
      els.targetDisplay.classList.add('visible');
      showMarkButtons();

      if (cricketType === '20-15') {
        els.practiceModeLabel.textContent = 'CRICKET 20→15';
        state.cricketSequence = [20, 19, 18, 17, 16, 15];
      } else if (cricketType === '15-20') {
        els.practiceModeLabel.textContent = 'CRICKET 15→20';
        state.cricketSequence = [15, 16, 17, 18, 19, 20];
      } else if (cricketType === 'cricket-random') {
        els.practiceModeLabel.textContent = 'CRICKET RANDOM';
        state.cricketSequence = [];
        state.currentTarget = getCricketRandomTarget();
        updateTargetDisplay();
      } else if (cricketType === 'BULL') {
        els.practiceModeLabel.textContent = 'CRICKET BULL';
        state.cricketSequence = ['BULL'];
        state.currentTarget = 'BULL';
        updateTargetDisplay();
      } else {
        const num = parseInt(cricketType);
        els.practiceModeLabel.textContent = `CRICKET ${num}`;
        state.cricketSequence = [num];
      }

      if (cricketType !== 'cricket-random') {
        state.cricketIndex = 0;
        if (state.cricketSequence.length > 0) {
          state.currentTarget = state.cricketSequence[0];
        }
        updateTargetDisplay();
      }
    } else if (mode === 'random') {
      els.practiceModeLabel.textContent = 'ランダムターゲット';
      els.statLabelMain.textContent = 'MPR';
      els.targetDisplay.classList.add('visible');
      showMarkButtons();
      state.currentTarget = getRandomTarget();
      updateTargetDisplay();
    }

    // Reset UI
    els.ratingValue.textContent = '—';
    els.ratingDelta.textContent = '';
    els.ratingDelta.className = 'rating-delta';
    els.ratingGaugeFill.style.width = '0%';
    els.ratingGaugeMarker.style.left = '0%';
    els.statValueMain.textContent = '—';
    els.statRounds.textContent = '0';
    els.statHitrate.textContent = '—';
    els.historyScroll.innerHTML = '';
    els.btnUndo.disabled = true;

    // Dart counter reset
    updateDartCounter();

    showScreen('practice');
  }

  // ============================================
  //  Random Target Generators
  // ============================================
  function getRandomTarget() {
    const targets = [];
    for (let i = 1; i <= 20; i++) targets.push(i);
    let t;
    do {
      t = targets[Math.floor(Math.random() * targets.length)];
    } while (t === state.currentTarget && targets.length > 1);
    return t;
  }

  function getCricketRandomTarget() {
    const targets = [15, 16, 17, 18, 19, 20, 'BULL'];
    let t;
    do {
      t = targets[Math.floor(Math.random() * targets.length)];
    } while (t === state.currentTarget && targets.length > 1);
    return t;
  }

  // ============================================
  //  Target Display
  // ============================================
  function updateTargetDisplay() {
    const target = state.currentTarget;
    const isBull = target === 'BULL';

    els.targetNumber.textContent = isBull ? 'BULL' : target;

    if (isBull) {
      els.targetNumber.classList.add('is-bull');
    } else {
      els.targetNumber.classList.remove('is-bull');
    }

    els.targetNumber.classList.add('changing');
    setTimeout(() => els.targetNumber.classList.remove('changing'), 400);

    // Progress for sequential cricket modes
    if (state.mode === 'cricket' && state.cricketSequence.length > 1 && state.cricketType !== 'cricket-random') {
      els.targetProgress.textContent = `${state.cricketIndex + 1} / ${state.cricketSequence.length}`;
    } else {
      els.targetProgress.textContent = '';
    }
  }

  // ============================================
  //  Dart Counter
  // ============================================
  function updateDartCounter() {
    const totalDarts = state.rounds.length * 3;
    els.dartCounterValue.textContent = totalDarts;

    if (totalDarts > 0) {
      els.dartCounter.classList.add('has-darts');
    } else {
      els.dartCounter.classList.remove('has-darts');
    }
  }

  function animateDartCounter() {
    els.dartCounterValue.classList.remove('pulse');
    void els.dartCounterValue.offsetWidth; // Force reflow
    els.dartCounterValue.classList.add('pulse');
  }

  // ============================================
  //  Hit Recording
  // ============================================
  function recordHit(hits) {
    let missScore = 0;
    if (state.mode === 'bull') {
      const misses = 3 - hits;
      for (let i = 0; i < misses; i++) {
        missScore += Math.floor(Math.random() * 20) + 1;
      }
      
      if (misses > 0) {
        showRandomScoreDisplay(missScore);
      }
    }

    const round = {
      hits,
      missScore,
      target: state.currentTarget,
    };
    state.rounds.push(round);

    // Update stats & rating
    updateStats();

    // Update dart counter
    updateDartCounter();
    animateDartCounter();

    // History item
    addHistoryItem(hits);

    // Undo button
    els.btnUndo.disabled = false;

    // Next target for relevant modes
    if (state.mode === 'random') {
      state.currentTarget = getRandomTarget();
      updateTargetDisplay();
    } else if (state.mode === 'cricket' && state.cricketType === 'cricket-random') {
      // クリケットランダム: 毎ラウンド新しいターゲット
      state.currentTarget = getCricketRandomTarget();
      updateTargetDisplay();
    } else if (state.mode === 'cricket' && state.cricketSequence.length > 1) {
      // クリケット順序: 各ナンバー5ラウンドずつ
      const roundsPerNumber = 1;
      const roundsOnCurrent = state.rounds.filter(r => r.target === state.currentTarget).length;
      if (roundsOnCurrent >= roundsPerNumber) {
        state.cricketIndex++;
        if (state.cricketIndex >= state.cricketSequence.length) {
          // 全ナンバー完了
          setTimeout(() => showResult(), 500);
          return;
        }
        state.currentTarget = state.cricketSequence[state.cricketIndex];
        updateTargetDisplay();
        showToast(`次のターゲット: ${state.currentTarget}`);
      }
    }

    // Effects
    const maxHits = getMaxHits();
    if (hits === maxHits) {
      spawnConfetti();
    }

    // Sound
    let soundType = 'hit';
    if (hits === 0) soundType = 'miss';
    else if (hits === maxHits) soundType = 'max';
    playSound(soundType);

    // Vibration feedback
    if (navigator.vibrate) {
      if (hits === 0) navigator.vibrate(50);
      else if (hits >= maxHits - 1) navigator.vibrate([30, 30, 30]);
      else navigator.vibrate(20);
    }
  }

  function undoLastRound() {
    if (state.rounds.length === 0) return;

    const removed = state.rounds.pop();

    // クリケットモードで前のターゲットに戻る
    if (state.mode === 'cricket' && state.cricketSequence.length > 1 && state.cricketType !== 'cricket-random') {
      if (removed.target !== state.currentTarget) {
        state.currentTarget = removed.target;
        state.cricketIndex = state.cricketSequence.indexOf(removed.target);
        updateTargetDisplay();
      }
    }

    // レーティング履歴も戻す
    if (state.ratingHistory.length > 0) {
      state.ratingHistory.pop();
    }

    // 履歴UIから最後の要素を削除
    const lastItem = els.historyScroll.lastElementChild;
    if (lastItem) {
      lastItem.style.animation = 'none';
      lastItem.style.transform = 'scale(0)';
      lastItem.style.opacity = '0';
      lastItem.style.transition = 'transform 0.2s, opacity 0.2s';
      setTimeout(() => lastItem.remove(), 200);
    }

    // Stats再計算
    updateStats();

    // Dart counter update
    updateDartCounter();
    animateDartCounter();

    if (state.rounds.length === 0) {
      els.btnUndo.disabled = true;
    }

    showToast('1ラウンド取り消し');
  }

  // ============================================
  //  Stats Calculation
  // ============================================
  function updateStats() {
    const totalRounds = state.rounds.length;
    const totalHits = state.rounds.reduce((sum, r) => sum + r.hits, 0);
    const totalMissScore = state.rounds.reduce((sum, r) => sum + (r.missScore || 0), 0);
    const totalDarts = totalRounds * 3;

    els.statRounds.textContent = totalRounds;

    if (totalRounds === 0) {
      els.statValueMain.textContent = '—';
      els.statHitrate.textContent = '—';
      els.ratingValue.textContent = '—';
      els.ratingDelta.textContent = '';
      els.ratingDelta.className = 'rating-delta';
      els.ratingGaugeFill.style.width = '0%';
      els.ratingGaugeMarker.style.left = '0%';
      state.prevRating = null;
      return;
    }

    let rating;

    if (state.mode === 'bull') {
      // BULL: PPR = (totalHits × 50) / totalRounds ※80%スタッツ
      const ppr = ((totalHits * 50) + totalMissScore) / totalRounds;
      els.statValueMain.textContent = ppr.toFixed(2);

      // Hit rate: ブル命中率
      const hitRate = (totalHits / totalDarts * 100).toFixed(1);
      els.statHitrate.textContent = hitRate + '%';

      rating = getRating01(ppr);
    } else {
      // Cricket / Random: MPR = totalMarks / totalRounds
      const mpr = totalHits / totalRounds;
      els.statValueMain.textContent = mpr.toFixed(2);

      // マーク効率: marks / (max possible = rounds × 9) × 100
      const efficiency = (totalHits / (totalRounds * 9) * 100).toFixed(1);
      els.statHitrate.textContent = efficiency + '%';

      rating = getRatingCR(mpr);
    }

    // Rating update with delta
    const oldRating = state.prevRating;
    state.prevRating = rating;
    state.ratingHistory.push(rating);

    // Display rating with decimal interpolation
    const displayRating = getInterpolatedRating(state.mode, totalHits, totalRounds, totalMissScore);
    els.ratingValue.textContent = displayRating.toFixed(1);

    // Delta
    if (oldRating !== null && state.ratingHistory.length >= 2) {
      const prevDisplayRating = getInterpolatedRatingFromHistory(state.ratingHistory.length - 2);
      const delta = displayRating - prevDisplayRating;
      if (Math.abs(delta) > 0.01) {
        const sign = delta > 0 ? '+' : '';
        els.ratingDelta.textContent = `${sign}${delta.toFixed(2)}`;
        els.ratingDelta.className = 'rating-delta ' + (delta > 0 ? 'up' : 'down');

        // Bump animation
        els.ratingValue.classList.remove('bump-up', 'bump-down');
        void els.ratingValue.offsetWidth;
        els.ratingValue.classList.add(delta > 0 ? 'bump-up' : 'bump-down');
      }
    } else {
      els.ratingDelta.textContent = '';
      els.ratingDelta.className = 'rating-delta';
    }

    // Gauge (1-18 mapped to 0-100%)
    const gaugePercent = Math.min(100, Math.max(0, ((displayRating - 1) / 17) * 100));
    els.ratingGaugeFill.style.width = gaugePercent + '%';
    els.ratingGaugeMarker.style.left = gaugePercent + '%';
  }

  function getInterpolatedRating(mode, totalHits, totalRounds, totalMissScore = 0) {
    if (totalRounds === 0) return 1;

    if (mode === 'bull') {
      const ppr = ((totalHits * 50) + totalMissScore) / totalRounds;
      return interpolateFromTable(RATING_TABLE_01, 'minPPR', ppr);
    } else {
      const mpr = totalHits / totalRounds;
      return interpolateFromTable(RATING_TABLE_CR, 'minMPR', mpr);
    }
  }

  function getInterpolatedRatingFromHistory(index) {
    const rounds = state.rounds.slice(0, index + 1);
    const totalRounds = rounds.length;
    const totalHits = rounds.reduce((sum, r) => sum + r.hits, 0);
    const totalMissScore = rounds.reduce((sum, r) => sum + (r.missScore || 0), 0);
    return getInterpolatedRating(state.mode, totalHits, totalRounds, totalMissScore);
  }

  function interpolateFromTable(table, key, value) {
    let lower = table[0];
    let upper = null;

    for (let i = 1; i < table.length; i++) {
      if (value < table[i][key]) {
        upper = table[i];
        break;
      }
      lower = table[i];
    }

    if (!upper) return lower.rating;

    const range = upper[key] - lower[key];
    const progress = (value - lower[key]) / range;
    return lower.rating + progress;
  }

  function getRating01(ppr) {
    let rating = 1;
    for (const entry of RATING_TABLE_01) {
      if (ppr >= entry.minPPR) rating = entry.rating;
      else break;
    }
    return rating;
  }

  function getRatingCR(mpr) {
    let rating = 1;
    for (const entry of RATING_TABLE_CR) {
      if (mpr >= entry.minMPR) rating = entry.rating;
      else break;
    }
    return rating;
  }

  // ============================================
  //  History
  // ============================================
  function addHistoryItem(hits) {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.setAttribute('data-hits', Math.min(hits, 9));
    item.textContent = hits;
    els.historyScroll.appendChild(item);

    requestAnimationFrame(() => {
      els.historyScroll.scrollLeft = els.historyScroll.scrollWidth;
    });
  }

  // ============================================
  //  Result Screen
  // ============================================
  function showResult() {
    const totalRounds = state.rounds.length;
    const totalHits = state.rounds.reduce((sum, r) => sum + r.hits, 0);
    const totalMissScore = state.rounds.reduce((sum, r) => sum + (r.missScore || 0), 0);
    const totalDarts = totalRounds * 3;

    const displayRating = totalRounds > 0 ? getInterpolatedRating(state.mode, totalHits, totalRounds, totalMissScore) : 0;

    $('result-rating').textContent = displayRating.toFixed(1);
    $('result-rounds').textContent = totalRounds;

    if (state.mode === 'bull') {
      $('result-main-label').textContent = 'PPR';
      const ppr = totalRounds > 0 ? (((totalHits * 50) + totalMissScore) / totalRounds).toFixed(2) : '—';
      $('result-main-stat').textContent = ppr;
      $('result-hitrate').textContent = totalDarts > 0 ? (totalHits / totalDarts * 100).toFixed(1) + '%' : '—';
    } else {
      $('result-main-label').textContent = 'MPR';
      const mpr = totalRounds > 0 ? (totalHits / totalRounds).toFixed(2) : '—';
      $('result-main-stat').textContent = mpr;
      $('result-hitrate').textContent = totalRounds > 0 ? (totalHits / (totalRounds * 9) * 100).toFixed(1) + '%' : '—';
    }

    $('result-total-darts').textContent = totalDarts;

    drawResultChart();
    showScreen('result');
  }

  function drawResultChart() {
    const canvas = $('result-chart');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;

    ctx.clearRect(0, 0, w, h);

    if (state.ratingHistory.length < 2) {
      ctx.fillStyle = '#555577';
      ctx.font = '12px "Noto Sans JP"';
      ctx.textAlign = 'center';
      ctx.fillText('データが不足しています', w / 2, h / 2);
      return;
    }

    // Recalculate all interpolated ratings
    const ratings = [];
    for (let i = 0; i < state.rounds.length; i++) {
      const rounds = state.rounds.slice(0, i + 1);
      const totalHits = rounds.reduce((sum, r) => sum + r.hits, 0);
      const totalMissScore = rounds.reduce((sum, r) => sum + (r.missScore || 0), 0);
      ratings.push(getInterpolatedRating(state.mode, totalHits, rounds.length, totalMissScore));
    }

    const padding = { top: 10, right: 10, bottom: 20, left: 30 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    const minR = Math.max(1, Math.floor(Math.min(...ratings)) - 1);
    const maxR = Math.min(18, Math.ceil(Math.max(...ratings)) + 1);
    const rangeR = maxR - minR || 1;

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let r = minR; r <= maxR; r++) {
      const y = padding.top + chartH - ((r - minR) / rangeR) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();

      ctx.fillStyle = '#555577';
      ctx.font = '9px "Inter"';
      ctx.textAlign = 'right';
      ctx.fillText(r, padding.left - 6, y + 3);
    }

    // Line
    const gradient = ctx.createLinearGradient(padding.left, 0, w - padding.right, 0);
    gradient.addColorStop(0, '#00e5ff');
    gradient.addColorStop(1, '#7c4dff');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();

    const points = ratings.map((r, i) => ({
      x: padding.left + (i / (ratings.length - 1)) * chartW,
      y: padding.top + chartH - ((r - minR) / rangeR) * chartH,
    }));

    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // Area fill
    const areaGrad = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
    areaGrad.addColorStop(0, 'rgba(0, 229, 255, 0.15)');
    areaGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');

    ctx.fillStyle = areaGrad;
    ctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.lineTo(points[points.length - 1].x, h - padding.bottom);
    ctx.lineTo(points[0].x, h - padding.bottom);
    ctx.closePath();
    ctx.fill();

    // End dot
    const lastP = points[points.length - 1];
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(lastP.x, lastP.y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(0, 229, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(lastP.x, lastP.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // ============================================
  //  Visual Effects
  // ============================================
  function spawnConfetti() {
    const colors = ['#00e5ff', '#7c4dff', '#ff4081', '#00e676', '#ff9100'];
    for (let i = 0; i < 15; i++) {
      const particle = document.createElement('div');
      particle.className = 'confetti-particle';
      particle.style.left = (40 + Math.random() * 20) + '%';
      particle.style.top = (60 + Math.random() * 10) + '%';
      particle.style.background = colors[Math.floor(Math.random() * colors.length)];
      particle.style.animationDuration = (0.6 + Math.random() * 0.6) + 's';
      particle.style.animationDelay = (Math.random() * 0.2) + 's';

      const drift = (Math.random() - 0.5) * 80;
      particle.style.setProperty('--drift', drift + 'px');
      particle.style.animation = `confettiFall ${0.6 + Math.random() * 0.6}s ease-out forwards`;
      particle.style.transform = `translateX(${drift}px)`;

      document.body.appendChild(particle);
      setTimeout(() => particle.remove(), 1500);
    }
  }

  // ============================================
  //  Audio Effects
  // ============================================
  let audioCtx;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playSound(type) {
    if (!audioCtx) return;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    if (type === 'hit') {
      // 小気味よいヒット音
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, now);
      osc.frequency.exponentialRampToValueAtTime(500, now + 0.05);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'miss') {
      // 低めのミス音
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'max') {
      // マックスヒット時のチャイム音
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.linearRampToValueAtTime(1600, now + 0.05);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.35);
    } else {
      // その他のUIクリック音
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.1, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.06);
    }
  }

  function showRandomScoreDisplay(score) {
    const display = $('random-score-display');
    if (!display) return;
    display.textContent = `MISS BONUS: +${score}`;
    display.classList.add('visible', 'bump');
    clearTimeout(display._timer);
    // Remove bump class so it can be triggered again
    setTimeout(() => display.classList.remove('bump'), 400);
    
    display._timer = setTimeout(() => {
      display.classList.remove('visible');
    }, 2000);
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('visible');
    clearTimeout(els.toast._timer);
    els.toast._timer = setTimeout(() => {
      els.toast.classList.remove('visible');
    }, 1800);
  }

  // ============================================
  //  Reset Confirmation
  // ============================================
  function resetPractice() {
    if (state.rounds.length === 0) return;

    if (confirm('練習データをリセットしますか？')) {
      state.rounds = [];
      state.ratingHistory = [];
      state.prevRating = null;

      if (state.mode === 'cricket') {
        if (state.cricketType === 'cricket-random') {
          state.currentTarget = getCricketRandomTarget();
          updateTargetDisplay();
        } else if (state.cricketSequence.length > 1) {
          state.cricketIndex = 0;
          state.currentTarget = state.cricketSequence[0];
          updateTargetDisplay();
        }
      } else if (state.mode === 'random') {
        state.currentTarget = getRandomTarget();
        updateTargetDisplay();
      }

      updateStats();
      updateDartCounter();
      els.historyScroll.innerHTML = '';
      els.btnUndo.disabled = true;
      showToast('リセットしました');
    }
  }

  // ============================================
  //  Event Binding
  // ============================================
  function init() {
    // Global Audio Init & UI Click Sound
    document.addEventListener('click', (e) => {
      initAudio();
      const btn = e.target.closest('button');
      if (btn && !btn.classList.contains('hit-btn') && !btn.disabled) {
        playSound('click');
      }
    });

    // Mode selection
    $('btn-mode-bull').addEventListener('click', () => startMode('bull'));
    $('btn-mode-cricket').addEventListener('click', () => showScreen('cricketSelect'));
    $('btn-mode-random').addEventListener('click', () => startMode('random'));

    // Cricket sub-select
    $('btn-back-cricket').addEventListener('click', () => showScreen('menu'));

    document.querySelectorAll('.cricket-option-card').forEach(btn => {
      btn.addEventListener('click', () => {
        startMode('cricket', btn.dataset.cricket);
      });
    });

    document.querySelectorAll('.cricket-num-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        startMode('cricket', btn.dataset.cricket);
      });
    });

    // Practice screen
    $('btn-back-practice').addEventListener('click', () => {
      if (state.rounds.length > 0) {
        if (confirm('練習を終了して結果を見ますか？\n\n「キャンセル」を押すとモード選択に戻ります。')) {
          showResult();
          return;
        }
      }
      showScreen('menu');
    });

    $('btn-reset').addEventListener('click', resetPractice);

    // Hit buttons (both bull and mark)
    document.querySelectorAll('.hit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const hits = parseInt(btn.dataset.hits);
        recordHit(hits);
      });
    });

    // Undo
    $('btn-undo').addEventListener('click', undoLastRound);

    // Result buttons
    $('btn-result-retry').addEventListener('click', () => {
      startMode(state.mode, state.cricketType);
    });

    $('btn-result-home').addEventListener('click', () => {
      showScreen('menu');
    });

    // Prevent double-tap zoom
    document.addEventListener('dblclick', (e) => {
      e.preventDefault();
    });

    // Prevent pull-to-refresh
    document.body.addEventListener('touchmove', (e) => {
      if (e.target.closest('.practice-top') || e.target.closest('.history-scroll') || e.target.closest('.cricket-options') || e.target.closest('.result-container')) {
        return;
      }
      e.preventDefault();
    }, { passive: false });
  }

  // ============================================
  //  Start
  // ============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
