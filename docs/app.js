/* Calc Tracker — 靜態版應用邏輯
 * 資料儲存：localStorage（不需要伺服器，可離線使用）
 */
(() => {
  "use strict";

  // ══════════════ 常數與工具 ══════════════
  const STORE_KEY = "calc-tracker-v1";
  const VIEWS = ["overview", "bank", "practice", "mistakes", "data"];

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const uid = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  const pad2 = (n) => String(n).padStart(2, "0");
  const nowISO = () => new Date().toISOString();

  function fmtDate(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function fmtClock(sec) {
    const s = Math.max(0, Math.round(sec));
    return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
  }

  /** ISO 週次標籤，例如 2026-W38 */
  function isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${pad2(week)}`;
  }

  let toastTimer = null;
  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
  }

  // ══════════════ 資料層 ══════════════
  const Store = {
    data: { problems: [], attempts: [] },

    load() {
      try {
        const raw = localStorage.getItem(STORE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          this.data.problems = Array.isArray(parsed.problems) ? parsed.problems : [];
          this.data.attempts = Array.isArray(parsed.attempts) ? parsed.attempts : [];
        }
      } catch (err) {
        console.warn("讀取本機資料失敗，改用空白資料集", err);
        this.data = { problems: [], attempts: [] };
      }
      return this.data;
    },

    save() {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(this.data));
        return true;
      } catch (err) {
        toast("儲存失敗：瀏覽器空間可能已滿");
        console.error(err);
        return false;
      }
    },

    addProblem(p) {
      const problem = {
        id: uid(),
        title: p.title,
        description: p.description || "",
        chapter: p.chapter,
        source: p.source || "",
        difficulty: Number(p.difficulty) || 2,
        createdAt: nowISO(),
      };
      this.data.problems.push(problem);
      this.save();
      return problem;
    },

    removeProblem(id) {
      this.data.problems = this.data.problems.filter((p) => p.id !== id);
      this.data.attempts = this.data.attempts.filter((a) => a.problemId !== id);
      this.save();
    },

    addAttempt(problemId, isCorrect, spentSeconds) {
      this.data.attempts.push({
        id: uid(),
        problemId,
        isCorrect: !!isCorrect,
        spentSeconds: spentSeconds == null ? null : Math.round(spentSeconds),
        createdAt: nowISO(),
      });
      this.save();
    },

    getProblem(id) {
      return this.data.problems.find((p) => p.id === id) || null;
    },

    /** 每題的作答統計：{ [problemId]: {total, correct, wrong, accuracy} } */
    attemptStats() {
      const map = {};
      for (const a of this.data.attempts) {
        const s = (map[a.problemId] = map[a.problemId] || {
          total: 0,
          correct: 0,
          wrong: 0,
          seconds: 0,
        });
        s.total += 1;
        if (a.isCorrect) s.correct += 1;
        else s.wrong += 1;
        s.seconds += a.spentSeconds || 0;
      }
      for (const k of Object.keys(map)) {
        const s = map[k];
        s.accuracy = s.total ? Math.round((s.correct * 100) / s.total) : null;
      }
      return map;
    },

    /** 每章統計 */
    chapterStats() {
      const byId = this.attemptStats();
      const map = {};
      for (const p of this.data.problems) {
        const c = (map[p.chapter] = map[p.chapter] || {
          chapter: p.chapter,
          problems: 0,
          total: 0,
          correct: 0,
          wrong: 0,
        });
        c.problems += 1;
        const s = byId[p.id];
        if (s) {
          c.total += s.total;
          c.correct += s.correct;
          c.wrong += s.wrong;
        }
      }
      return Object.values(map)
        .map((c) => ({
          ...c,
          accuracy: c.total ? Math.round((c.correct * 100) / c.total) : null,
        }))
        .sort((a, b) => {
          if (a.accuracy == null && b.accuracy == null) return a.chapter.localeCompare(b.chapter);
          if (a.accuracy == null) return 1;
          if (b.accuracy == null) return -1;
          return a.accuracy - b.accuracy;
        });
    },

    /** 近 N 週作答次數 */
    weeklyStats(weeks = 8) {
      const counts = {};
      for (const a of this.data.attempts) {
        const label = isoWeek(new Date(a.createdAt));
        counts[label] = (counts[label] || 0) + 1;
      }
      const out = [];
      const today = new Date();
      for (let i = weeks - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i * 7);
        const label = isoWeek(d);
        out.push({ week: label, count: counts[label] || 0 });
      }
      return out;
    },

    mistakes(minWrong = 2) {
      const byId = this.attemptStats();
      return this.data.problems
        .map((p) => ({ problem: p, stat: byId[p.id] || { total: 0, correct: 0, wrong: 0, accuracy: null, seconds: 0 } }))
        .filter((r) => r.stat.wrong >= minWrong)
        .sort((a, b) => b.stat.wrong - a.stat.wrong);
    },

    totals() {
      const total = this.data.attempts.length;
      const correct = this.data.attempts.filter((a) => a.isCorrect).length;
      return {
        problems: this.data.problems.length,
        attempts: total,
        correct,
        accuracy: total ? Math.round((correct * 100) / total) : null,
        mistakes: this.mistakes(2).length,
      };
    },
  };

  // ══════════════ 圖表（純 Canvas 手繪） ══════════════
  const Chart = {
    prepare(canvas, cssHeight) {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.parentElement.clientWidth || 320;
      const h = cssHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.height = h + "px";
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      return { ctx, w, h };
    },

    colors() {
      const cs = getComputedStyle(document.documentElement);
      return {
        text: cs.getPropertyValue("--text").trim() || "#16233a",
        muted: cs.getPropertyValue("--muted").trim() || "#63718c",
        border: cs.getPropertyValue("--border").trim() || "#dfe5ef",
        accent: cs.getPropertyValue("--accent").trim() || "#2563eb",
      };
    },

    empty(canvas, msg, cssHeight) {
      const { ctx, w, h } = this.prepare(canvas, cssHeight);
      const c = this.colors();
      ctx.fillStyle = c.muted;
      ctx.font = "13px -apple-system, 'PingFang TC', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(msg, w / 2, h / 2);
    },

    /** 縱向柱狀圖：正確率 */
    bars(canvas, rows, cssHeight) {
      const { ctx, w, h } = this.prepare(canvas, cssHeight);
      const c = this.colors();
      const padL = 40, padR = 12, padT = 14, padB = 46;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      // 格線與 y 軸刻度
      ctx.strokeStyle = c.border;
      ctx.fillStyle = c.muted;
      ctx.font = "11px -apple-system, sans-serif";
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = padT + (plotH * i) / 4;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(`${100 - i * 25}%`, padL - 7, y);
      }

      if (!rows.length) return;
      const slot = plotW / rows.length;
      const barW = Math.min(56, slot * 0.6);

      rows.forEach((r, i) => {
        const x = padL + slot * i + (slot - barW) / 2;
        const v = r.accuracy == null ? 0 : r.accuracy;
        const bh = (plotH * v) / 100;
        const y = padT + plotH - bh;

        const grad = ctx.createLinearGradient(0, y, 0, padT + plotH);
        const base = v >= 80 ? "#16a34a" : v >= 50 ? c.accent : "#dc2626";
        grad.addColorStop(0, base);
        grad.addColorStop(1, base + "99");
        ctx.fillStyle = grad;
        ctx.beginPath();
        const radius = Math.min(7, barW / 2, Math.max(0, bh));
        ctx.moveTo(x, padT + plotH);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.lineTo(x + barW - radius, y);
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
        ctx.lineTo(x + barW, padT + plotH);
        ctx.closePath();
        ctx.fill();

        // 數值標籤
        if (bh > 16) {
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.font = "bold 11px -apple-system, sans-serif";
          ctx.fillText(`${v}%`, x + barW / 2, y + 4);
        }

        // x 軸標籤（過長截斷）
        ctx.fillStyle = c.muted;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.font = "11px -apple-system, 'PingFang TC', sans-serif";
        let label = String(r.chapter);
        const maxChars = Math.max(3, Math.floor(slot / 8));
        if (label.length > maxChars) label = label.slice(0, maxChars) + "…";
        ctx.save();
        ctx.translate(x + barW / 2, padT + plotH + 8);
        if (rows.length > 5) {
          ctx.rotate(-Math.PI / 5);
          ctx.textAlign = "right";
        }
        ctx.fillText(label, 0, 0);
        ctx.restore();
      });
    },

    /** 折線圖：每週練習量 */
    line(canvas, rows, cssHeight) {
      const { ctx, w, h } = this.prepare(canvas, cssHeight);
      const c = this.colors();
      const padL = 36, padR = 14, padT = 16, padB = 34;
      const plotW = w - padL - padR;
      const plotH = h - padT - padB;

      const maxVal = Math.max(4, ...rows.map((r) => r.count));
      const niceMax = Math.ceil(maxVal / 4) * 4;

      ctx.strokeStyle = c.border;
      ctx.fillStyle = c.muted;
      ctx.font = "11px -apple-system, sans-serif";
      for (let i = 0; i <= 4; i++) {
        const y = padT + (plotH * i) / 4;
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(String(Math.round(niceMax - (niceMax * i) / 4)), padL - 7, y);
      }

      if (!rows.length) return;
      const stepX = rows.length > 1 ? plotW / (rows.length - 1) : 0;
      const pts = rows.map((r, i) => ({
        x: padL + stepX * i,
        y: padT + plotH - (plotH * r.count) / niceMax,
      }));

      // 面積
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.lineTo(pts[pts.length - 1].x, padT + plotH);
      ctx.lineTo(pts[0].x, padT + plotH);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
      grad.addColorStop(0, c.accent + "55");
      grad.addColorStop(1, c.accent + "05");
      ctx.fillStyle = grad;
      ctx.fill();

      // 折線
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.strokeStyle = c.accent;
      ctx.lineWidth = 2.4;
      ctx.lineJoin = "round";
      ctx.stroke();

      // 點與 x 標籤
      pts.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = c.accent;
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = c.muted;
        ctx.font = "10px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(rows[i].week.split("-")[1] || rows[i].week, p.x, padT + plotH + 8);
      });
    },
  };

  // ══════════════ 章節提示庫（離線啟發式） ══════════════
  const HINT_LIB = [
    { keys: ["極限", "limit"], text: "先判斷不定型（0/0、∞/∞、∞−∞、1^∞）。可用因式分解、有理化、羅必達法則或同除最高次項；遇到 e 或三角函數可先取對數再求極限。" },
    { keys: ["連續", "可微"], text: "連續要檢查三件事：極限存在、函數值存在、兩者相等。可微則要求左右導數相等，先把函數在分段點兩側分別求導再比較。" },
    { keys: ["分部積分", "integration by parts"], text: "使用 ∫u dv = uv − ∫v du。選 u 的順序建議 LIATE（對數 → 反三角 → 代數 → 三角 → 指數），剩下的當 dv 比較好積。" },
    { keys: ["代換", "變數變換", "substitution"], text: "設 u = 內層函數，並把 dx 換成 du。關鍵是題目裡是否出現 u 的導數（差一個常數倍也可以，把常數提出即可）。" },
    { keys: ["部分分式", "partial fraction"], text: "先把分母因式分解，再拆成 A/(x−a) + B/(x−b) 之類的形式，用代入特殊值或比較係數求出待定常數。" },
    { keys: ["瑕積分", "improper"], text: "把無窮或奇異點改成極限形式：∫ₐ^∞ = lim(b→∞)∫ₐ^b。分別求極限後判斷收斂或發散，若拆成兩段必須兩段都收斂才算收斂。" },
    { keys: ["級數", "收斂", "series"], text: "先看通項是否趨近 0（不趨近 0 必發散）。再依型態選比值審斂法（含階乘、指數）、比較審斂法、積分審斂法或交錯級數檢驗。" },
    { keys: ["泰勒", "麥克勞林", "taylor"], text: "先列出 f 在展開點的各階導數值，套入 Σ f⁽ⁿ⁾(a)/n!·(x−a)ⁿ，並寫出餘項或收斂區間；常用的 eˣ、sin、ln(1+x) 展開式建議直接記。" },
    { keys: ["偏導", "多變數", "梯", "gradient"], text: "對某個變數偏導時，其他變數視為常數。梯度方向是函數上升最快的方向，方向導數 = 梯度與單位方向向量的內積。" },
    { keys: ["重積分", "二重", "多重"], text: "先畫出積分區域並決定積分次序，內層上下限可以是外層變數的函數；若區域不好描述就換序或改用極座標（別忘了 r 的 Jacobian）。" },
    { keys: ["連鎖律", "chain rule", "合成"], text: "由外往內逐層微分再相乘：d/dx f(g(x)) = f′(g(x))·g′(x)。多層時就一路乘下去，別漏掉最內層。" },
    { keys: ["隱函數", "implicit"], text: "等式兩邊同時對 x 微分，遇到 y 時要乘上 dy/dx，最後把 dy/dx 的項集中到一邊再解出。" },
    { keys: ["微積分基本定理", "fundamental"], text: "d/dx ∫ₐ^{g(x)} f(t)dt = f(g(x))·g′(x)。注意上限是函數時要乘上它的導數，下限也含 x 時記得加負號。" },
    { keys: ["極值", "最大", "最小", "臨界"], text: "先找臨界點（f′=0 或不存在）與端點，再用一階導數正負變化或二階導數檢定判斷極大/極小，最後比較所有候選點的值。" },
    { keys: ["對數微分", "logarithmic differentiation"], text: "遇到底數與指數都含 x 的冪指函數，先取 ln 把指數降下來微分，再乘回原函數。" },
    { keys: ["旋轉體", "體積", "volume"], text: "圓盤法 V = π∫[R(x)]²dx；有洞用墊圈法 π∫(R²−r²)dx；繞 y 軸或殼層較方便時用圓柱殼法 2π∫x·f(x)dx。" },
    { keys: ["弧長", "表面積", "arc length"], text: "弧長 L = ∫√(1+[f′(x)]²)dx；參數式則是 ∫√[(dx/dt)²+(dy/dt)²]dt。先化簡根號內再積分會容易很多。" },
    { keys: ["向量", "vector", "平面", "直線"], text: "直線用點 + 方向向量，平面用點 + 法向量。兩向量平行則外積為零，垂直則內積為零。" },
  ];

  function hintFor(problem) {
    const hay = `${problem.chapter || ""} ${problem.title || ""} ${problem.description || ""}`.toLowerCase();
    const hits = HINT_LIB.filter((h) => h.keys.some((k) => hay.includes(k.toLowerCase())));
    if (hits.length) return hits.map((h) => h.text).join("\n\n");
    return "一般解題流程：① 先確認題目要你求什麼、已知什麼；② 判斷屬於哪個章節的標準題型；③ 寫下對應的定理或公式再代入；④ 檢查定義域、端點與特殊情況；⑤ 用數值或微分的方式驗算答案是否合理。";
  }

  // ══════════════ 分頁切換 ══════════════
  let currentView = "overview";
  function setView(name) {
    if (!VIEWS.includes(name)) name = "overview";
    currentView = name;
    VIEWS.forEach((v) => {
      const el = $("#view-" + v);
      if (el) el.hidden = v !== name;
    });
    $$("nav.tabs button").forEach((b) =>
      b.setAttribute("aria-selected", String(b.dataset.view === name))
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
    renderAll();
  }

  // ══════════════ 渲染：標頭 ══════════════
  function renderHeader() {
    const t = Store.totals();
    $("#headerStats").textContent = `${t.problems} 題 · ${t.attempts} 次作答`;
    $("#storageState").textContent = "本機儲存 · 可離線使用";
  }

  // ══════════════ 渲染：總覽 ══════════════
  function renderOverview() {
    const t = Store.totals();
    $("#kpiRow").innerHTML = [
      { cls: "accent", val: t.problems, lbl: "題庫題目數" },
      { cls: "", val: t.attempts, lbl: "累計作答次數" },
      { cls: "ok", val: t.accuracy == null ? "—" : t.accuracy + "%", lbl: "整體正確率" },
      { cls: "bad", val: t.mistakes, lbl: "需加強題目（錯 ≥2 次）" },
    ]
      .map(
        (k) =>
          `<div class="kpi-card ${k.cls}"><div class="val">${k.val}</div><div class="lbl">${k.lbl}</div></div>`
      )
      .join("");

    const chapters = Store.chapterStats();
    const tbody = $("#chapterTable tbody");
    $("#chapterEmpty").hidden = chapters.length > 0;
    $("#chapterTable").hidden = chapters.length === 0;

    tbody.innerHTML = chapters
      .map((c) => {
        const acc = c.accuracy == null ? "—" : c.accuracy + "%";
        const cls = c.accuracy == null ? "" : c.accuracy >= 80 ? "high" : c.accuracy >= 50 ? "" : "low";
        const w = c.accuracy == null ? 0 : c.accuracy;
        return `<tr>
          <td>${esc(c.chapter)}</td>
          <td class="num">${c.problems}</td>
          <td class="num">${c.total}</td>
          <td class="num">${c.correct}</td>
          <td class="num">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="min-width:38px">${acc}</span>
              <span class="bar" style="flex:1"><i class="${cls}" style="width:${w}%"></i></span>
            </div>
          </td>
        </tr>`;
      })
      .join("");

    const withAttempts = chapters.filter((c) => c.total > 0);
    if (withAttempts.length) Chart.bars($("#chapterChart"), withAttempts, 240);
    else Chart.empty($("#chapterChart"), "尚無作答紀錄", 240);

    Chart.line($("#weeklyChart"), Store.weeklyStats(8), 200);
  }

  // ══════════════ 渲染：題庫 ══════════════
  function chapterNames() {
    return Array.from(new Set(Store.data.problems.map((p) => p.chapter))).sort();
  }

  function refreshChapterOptions() {
    const names = chapterNames();
    const dl = $("#chapterList");
    if (dl) dl.innerHTML = names.map((n) => `<option value="${esc(n)}">`).join("");

    [["#filterChapter", "全部章節"], ["#practiceChapter", "全部章節"]].forEach(([sel, allLabel]) => {
      const el = $(sel);
      if (!el) return;
      const prev = el.value;
      el.innerHTML =
        `<option value="">${allLabel}</option>` +
        names.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join("");
      if (names.includes(prev)) el.value = prev;
    });
  }

  function renderBank() {
    const chapter = $("#filterChapter").value;
    const kw = $("#searchTitle").value.trim().toLowerCase();
    let rows = Store.data.problems.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    if (chapter) rows = rows.filter((p) => p.chapter === chapter);
    if (kw) rows = rows.filter((p) => (p.title + " " + (p.description || "")).toLowerCase().includes(kw));

    $("#bankCount").textContent = `${Store.data.problems.length} 題`;
    const byId = Store.attemptStats();
    const tbody = $("#problemTable tbody");
    $("#bankEmpty").hidden = rows.length > 0;
    $("#problemTable").hidden = rows.length === 0;

    tbody.innerHTML = rows
      .map((p) => {
        const s = byId[p.id];
        const perf = s
          ? `${s.total} 次 · ${s.accuracy}%`
          : `<span class="tag mute">尚未練習</span>`;
        return `<tr>
          <td>
            <div style="font-weight:600">${esc(p.title)}</div>
            ${p.description ? `<div class="hint" style="margin-top:2px">${esc(p.description).slice(0, 90)}</div>` : ""}
          </td>
          <td><span class="tag">${esc(p.chapter)}</span></td>
          <td>${"★".repeat(p.difficulty)}<span style="color:var(--border)">${"★".repeat(Math.max(0, 5 - p.difficulty))}</span></td>
          <td class="hint">${esc(p.source) || "—"}</td>
          <td class="num">${perf}</td>
          <td>
            <div class="btn-row">
              <button class="btn plain" data-practice="${p.id}" style="padding:5px 10px;font-size:.8rem">練習</button>
              <button class="btn danger" data-del="${p.id}" style="padding:5px 10px;font-size:.8rem">刪除</button>
            </div>
          </td>
        </tr>`;
      })
      .join("");
  }

  // ══════════════ 渲染：錯題 ══════════════
  function renderMistakes() {
    const rows = Store.mistakes(2);
    $("#mistakeCount").textContent = `${rows.length} 題`;
    const tbody = $("#mistakeTable tbody");
    $("#mistakeEmpty").hidden = rows.length > 0;
    $("#mistakeTable").hidden = rows.length === 0;

    tbody.innerHTML = rows
      .map(({ problem: p, stat: s }) => {
        const cls = s.accuracy >= 80 ? "high" : s.accuracy >= 50 ? "" : "low";
        return `<tr>
          <td><div style="font-weight:600">${esc(p.title)}</div>
            ${p.source ? `<div class="hint">來源：${esc(p.source)}</div>` : ""}</td>
          <td><span class="tag">${esc(p.chapter)}</span></td>
          <td class="num"><span class="tag bad">${s.wrong} 次</span></td>
          <td class="num">${s.total}</td>
          <td class="num">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="min-width:38px">${s.accuracy}%</span>
              <span class="bar" style="flex:1"><i class="${cls}" style="width:${s.accuracy}%"></i></span>
            </div>
          </td>
          <td><button class="btn plain" data-practice="${p.id}" style="padding:5px 10px;font-size:.8rem">再練一次</button></td>
        </tr>`;
      })
      .join("");
  }

  function renderAll() {
    renderHeader();
    refreshChapterOptions();
    if (currentView === "overview") renderOverview();
    if (currentView === "bank") renderBank();
    if (currentView === "mistakes") renderMistakes();
  }

  // ══════════════ 練習模式 ══════════════
  const Practice = {
    session: null,
    timer: null,
    elapsed: 0,
    paused: false,
    queue: [],

    start(chapter, order) {
      let pool = Store.data.problems.slice();
      if (chapter) pool = pool.filter((p) => p.chapter === chapter);
      if (!pool.length) {
        toast("這個範圍內沒有題目，請先新增題目");
        return;
      }
      const byId = Store.attemptStats();
      const wrongRank = (p) => (byId[p.id] ? byId[p.id].wrong : 0);

      if (order === "weak") pool.sort((a, b) => wrongRank(b) - wrongRank(a));
      else if (order === "hard") pool.sort((a, b) => b.difficulty - a.difficulty);
      else if (order === "new") pool.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      else pool.sort(() => Math.random() - 0.5);

      this.session = { correct: 0, wrong: 0, seconds: 0, answered: 0 };
      this.queue = pool.slice();
      this.elapsed = 0;
      this.paused = false;

      $("#practiceIdle").hidden = true;
      $("#practiceSummary").hidden = true;
      $("#practiceCard").hidden = false;
      this.startTimer();
      this.next();
      toast("練習開始");
    },

    startTimer() {
      clearInterval(this.timer);
      this.timer = setInterval(() => {
        if (this.paused) return;
        this.elapsed += 1;
        $("#timerDisplay").textContent = fmtClock(this.elapsed);
      }, 1000);
      $("#timerDisplay").textContent = fmtClock(this.elapsed);
    },

    pause() {
      this.paused = !this.paused;
      $("#pauseTimer").textContent = this.paused ? "▶ 繼續" : "⏸ 暫停";
      $("#timerDisplay").classList.toggle("paused", this.paused);
      toast(this.paused ? "計時已暫停" : "計時繼續");
    },

    next() {
      if (!this.queue.length) {
        this.finish();
        return;
      }
      const p = this.queue.shift();
      this.current = p;
      this.elapsed = 0;
      $("#timerDisplay").textContent = fmtClock(0);
      $("#qTitle").textContent = p.title;
      $("#qDesc").textContent = p.description || "";
      $("#practiceMeta").innerHTML = [
        `<span class="tag">${esc(p.chapter)}</span>`,
        `<span class="tag mute">難度 ${"★".repeat(p.difficulty)}</span>`,
        p.source ? `<span class="tag mute">${esc(p.source)}</span>` : "",
        `<span class="tag mute">剩餘 ${this.queue.length + 1} 題</span>`,
      ]
        .filter(Boolean)
        .join("");
      $("#hintBox").hidden = true;
      $("#showHint").textContent = "💡 提示";
    },

    answer(isCorrect) {
      if (!this.current) return;
      Store.addAttempt(this.current.id, isCorrect, this.elapsed);
      if (isCorrect) this.session.correct += 1;
      else this.session.wrong += 1;
      this.session.seconds += this.elapsed;
      this.session.answered += 1;
      toast(isCorrect ? "已記錄：答對" : "已記錄：答錯");
      this.next();
    },

    stop() {
      clearInterval(this.timer);
      this.timer = null;
      this.paused = false;
      $("#pauseTimer").textContent = "⏸ 暫停";
      $("#timerDisplay").classList.remove("paused");
      this.current = null;
      $("#practiceCard").hidden = true;
      $("#practiceIdle").hidden = false;
    },

    finish() {
      clearInterval(this.timer);
      this.timer = null;
      const s = this.session;
      if (s && s.answered > 0) {
        const acc = Math.round((s.correct * 100) / s.answered);
        $("#sessionKPI").innerHTML = [
          { cls: "accent", val: s.answered, lbl: "本次作答題數" },
          { cls: "ok", val: s.correct, lbl: "答對" },
          { cls: "bad", val: s.wrong, lbl: "答錯" },
          { cls: "", val: acc + "%", lbl: "本次正確率" },
          { cls: "", val: fmtClock(s.seconds), lbl: "累計作答時間" },
        ]
          .map((k) => `<div class="kpi-card ${k.cls}"><div class="val">${k.val}</div><div class="lbl">${k.lbl}</div></div>`)
          .join("");
        $("#practiceSummary").hidden = false;
      }
      this.current = null;
      $("#practiceCard").hidden = true;
      $("#practiceIdle").hidden = false;
      renderAll();
      toast("本輪練習結束");
    },

    reset() {
      this.session = null;
      this.queue = [];
      this.current = null;
      this.elapsed = 0;
      clearInterval(this.timer);
      this.timer = null;
      $("#practiceCard").hidden = true;
      $("#practiceSummary").hidden = true;
      $("#practiceIdle").hidden = false;
      $("#pauseTimer").textContent = "⏸ 暫停";
      $("#timerDisplay").textContent = "00:00";
      $("#timerDisplay").classList.remove("paused");
    },
  };

  // ══════════════ 匯出 / 匯入 ══════════════
  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function csvCell(v) {
    const s = String(v == null ? "" : v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function exportCsv() {
    if (!Store.data.attempts.length) {
      toast("目前沒有作答紀錄可匯出");
      return;
    }
    const header = ["題目ID", "題目標題", "章節", "難度", "來源", "是否正確", "花費秒數", "作答時間"];
    const lines = [header.map(csvCell).join(",")];
    const sorted = Store.data.attempts
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    for (const a of sorted) {
      const p = Store.getProblem(a.problemId) || {};
      lines.push(
        [
          p.id || a.problemId,
          p.title || "(題目已刪除)",
          p.chapter || "",
          p.difficulty || "",
          p.source || "",
          a.isCorrect ? "正確" : "錯誤",
          a.spentSeconds == null ? "" : a.spentSeconds,
          fmtDate(a.createdAt),
        ]
          .map(csvCell)
          .join(",")
      );
    }
    const d = new Date();
    const stamp = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
    download(`calc_tracker_export_${stamp}.csv`, "\ufeff" + lines.join("\r\n"), "text/csv;charset=utf-8");
    toast("CSV 已匯出");
  }

  function exportJson() {
    const payload = {
      app: "calc-tracker",
      version: 1,
      exportedAt: nowISO(),
      problems: Store.data.problems,
      attempts: Store.data.attempts,
    };
    const d = new Date();
    const stamp = `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
    download(`calc_tracker_backup_${stamp}.json`, JSON.stringify(payload, null, 2), "application/json");
    toast("備份已匯出");
  }

  function importJson(file, mode) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.problems)) throw new Error("格式不符");
        const incoming = {
          problems: parsed.problems.filter((p) => p && p.id && p.title && p.chapter),
          attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
        };
        if (!incoming.problems.length) throw new Error("檔案的題目清單是空的");

        if (mode === "replace") {
          Store.data = incoming;
        } else {
          const existing = new Set(Store.data.problems.map((p) => p.id));
          const existingAtt = new Set(Store.data.attempts.map((a) => a.id));
          Store.data.problems.push(...incoming.problems.filter((p) => !existing.has(p.id)));
          Store.data.attempts.push(...incoming.attempts.filter((a) => !existingAtt.has(a.id)));
        }
        Store.save();
        renderAll();
        toast(`匯入完成：${incoming.problems.length} 題`);
      } catch (err) {
        toast("匯入失敗：" + err.message);
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function clearAll() {
    if (!confirm("確定要清空所有題目與作答紀錄嗎？此動作無法復原，建議先匯出備份。")) return;
    Store.data = { problems: [], attempts: [] };
    Store.save();
    Practice.reset();
    renderAll();
    toast("已清空所有資料");
  }

  // ══════════════ 示範資料（明確標示為虛構） ══════════════
  function loadSample(silent) {
    if (!silent) {
      const conf = confirm(
        "將載入 12 題示範題目與對應的示範作答紀錄（虛構資料，僅供試用介面）。\n現有資料會被保留並合併。確定要載入嗎？"
      );
      if (!conf) return;
    }

    const seed = [
      ["lim(x→0) sin(3x)/x", "極限與連續", "示範題庫", 2, "先確認是 0/0 型"],
      ["lim(x→∞) (√(x²+2x) − x)", "極限與連續", "示範題庫", 3, "有理化後同除 x"],
      ["f(x)=|x−2| 在 x=2 是否可微", "極限與連續", "示範題庫", 2, "檢查左右導數"],
      ["d/dx [x²·ln x]", "微分技巧", "示範題庫", 2, "乘積法則"],
      ["d/dx [e^{sin x}]", "微分技巧", "示範題庫", 2, "連鎖律"],
      ["x³+y³=6xy 求 dy/dx", "微分技巧", "示範題庫", 4, "隱函數微分"],
      ["∫ x·e^x dx", "積分技巧", "示範題庫", 3, "分部積分"],
      ["∫ dx/(x²−1)", "積分技巧", "示範題庫", 3, "部分分式"],
      ["∫₀^1 x/(1+x²) dx", "積分技巧", "示範題庫", 2, "代換 u=1+x²"],
      ["∫₁^∞ dx/x²", "瑕積分", "示範題庫", 3, "改寫成極限形式"],
      ["Σ (n=1→∞) n/2ⁿ 收斂？", "數列與級數", "示範題庫", 3, "比值審斂法"],
      ["e^x 的麥克勞林展開前三項", "數列與級數", "示範題庫", 2, "套泰勒公式"],
    ];

    const created = [];
    const base = Date.now() - 1000 * 60 * 60 * 24 * 52;
    seed.forEach(([title, chapter, source, difficulty, description], i) => {
      const p = Store.addProblem({ title, chapter, source, difficulty, description });
      p.createdAt = new Date(base + i * 1000 * 60 * 60).toISOString();
      created.push(p);
    });
    Store.save();

    // 產生分佈在近 8 週的示範作答（每題都有不同正確率，讓圖表有變化）
    const weak = new Set([2, 5, 10]); // 這幾題刻意錯比較多，用來展示錯題統計
    const today = new Date();
    created.forEach((p, idx) => {
      const times = 2 + (idx % 4);
      for (let k = 0; k < times; k++) {
        const daysAgo = Math.floor((idx * 4 + k * 7) % 55);
        const when = new Date(today);
        when.setDate(when.getDate() - daysAgo);
        when.setHours(19 + (k % 3), (idx * 7) % 60, 0, 0);
        const wrongTurn = weak.has(idx) ? k < 2 : k === times - 1 && idx % 5 === 0;
        Store.data.attempts.push({
          id: uid(),
          problemId: p.id,
          isCorrect: !wrongTurn,
          spentSeconds: 45 + ((idx * 37 + k * 53) % 300),
          createdAt: when.toISOString(),
        });
      }
    });
    Store.save();
    renderAll();
    toast("示範資料已載入（虛構內容，可隨時清空）");
  }

  // ══════════════ 事件綁定 ══════════════
  function bind() {
    $$("nav.tabs button").forEach((b) =>
      b.addEventListener("click", () => setView(b.dataset.view))
    );

    // 題庫：新增
    $("#problemForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const title = $("#pTitle").value.trim();
      const chapter = $("#pChapter").value.trim();
      if (!title || !chapter) {
        toast("題目標題與章節為必填");
        return;
      }
      Store.addProblem({
        title,
        chapter,
        source: $("#pSource").value.trim(),
        difficulty: $("#pDifficulty").value,
        description: $("#pDesc").value.trim(),
      });
      e.target.reset();
      $("#pDifficulty").value = "2";
      renderAll();
      toast("題目已新增");
    });

    $("#filterChapter").addEventListener("change", renderBank);
    $("#searchTitle").addEventListener("input", renderBank);

    // 表格內的按鈕（事件委派）
    document.addEventListener("click", (e) => {
      const delId = e.target.getAttribute && e.target.getAttribute("data-del");
      if (delId) {
        const p = Store.getProblem(delId);
        if (p && confirm(`確定刪除「${p.title}」？相關作答紀錄也會一併移除。`)) {
          Store.removeProblem(delId);
          renderAll();
          toast("題目已刪除");
        }
        return;
      }
      const pid = e.target.getAttribute && e.target.getAttribute("data-practice");
      if (pid) {
        const p = Store.getProblem(pid);
        if (!p) return;
        setView("practice");
        $("#practiceChapter").value = "";
        Practice.start("", "random");
        Practice.queue = [p];
        Practice.next();
        toast("已載入指定題目");
      }
    });

    // 練習
    $("#startPractice").addEventListener("click", () => {
      Practice.reset();
      Practice.start($("#practiceChapter").value, $("#practiceOrder").value);
    });
    $("#startTimer").addEventListener("click", () => {
      Practice.reset();
      $("#practiceIdle").hidden = true;
      $("#practiceCard").hidden = false;
      Practice.elapsed = 0;
      Practice.paused = false;
      Practice.startTimer();
      $("#qTitle").textContent = "計時模式";
      $("#qDesc").textContent = "手邊有紙本題目時，可用這個計時器記錄花費時間。";
      $("#practiceMeta").innerHTML = "";
      toast("計時器已啟動");
    });
    $("#markCorrect").addEventListener("click", () => Practice.answer(true));
    $("#markWrong").addEventListener("click", () => Practice.answer(false));
    $("#pauseTimer").addEventListener("click", () => Practice.pause());
    $("#stopPractice").addEventListener("click", () => {
      Practice.stop();
      renderAll();
    });
    $("#showHint").addEventListener("click", () => {
      if (!Practice.current) {
        toast("目前沒有進行中的題目");
        return;
      }
      const box = $("#hintBox");
      if (box.hidden) {
        box.textContent = "💡 " + hintFor(Practice.current);
        box.hidden = false;
        $("#showHint").textContent = "隱藏提示";
      } else {
        box.hidden = true;
        $("#showHint").textContent = "💡 提示";
      }
    });
    $("#continuePractice").addEventListener("click", () => {
      Practice.reset();
      Practice.start($("#practiceChapter").value, $("#practiceOrder").value);
    });
    $("#gotoMistakes").addEventListener("click", () => {
      Practice.reset();
      setView("mistakes");
    });

    // 資料
    $("#exportCsv").addEventListener("click", exportCsv);
    $("#exportJson").addEventListener("click", exportJson);
    $("#importJson").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      importJson(file, $("#importMode").value);
      e.target.value = "";
    });
    $("#loadSample").addEventListener("click", loadSample);
    $("#clearAll").addEventListener("click", clearAll);

    // 視窗尺寸變化時重繪圖表
    let rzTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(rzTimer);
      rzTimer = setTimeout(() => {
        if (currentView === "overview") renderOverview();
      }, 180);
    });

    // 深色/淺色模式切換時重繪圖表
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      if (mq.addEventListener) {
        mq.addEventListener("change", () => {
          if (currentView === "overview") renderOverview();
        });
      }
    }
  }

  // ══════════════ 啟動 ══════════════
  Store.load();
  bind();

  // ?demo=1 — 在資料為空時自動載入示範資料（方便展示統計與圖表）
  if (new URLSearchParams(location.search).has("demo") && Store.data.problems.length === 0) {
    loadSample(true);
  }

  setView("overview");

  // 註冊 Service Worker（PWA 離線）
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((err) =>
        console.warn("Service Worker 註冊失敗", err)
      );
    });
  }
})();
