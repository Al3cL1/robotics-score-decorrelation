// Interactive toy figure: the two factor-dominant vector fields of the 2-D navigation task for
// each trained lambda, redrawn from static/data/toy_fields.json as the slider moves. The data
// comes from decorrelation/website/toy_fields.py; the drawing mirrors paper Fig. 1
// (paper_figures/fig1_toy_fields.py and style.py).
(function () {
  const root = document.getElementById("toy-demo");
  if (!root) return;
  const slider = root.querySelector("#toy-lambda");
  const readout = root.querySelector("#toy-lambda-value");
  const status = root.querySelector(".toy-status");
  const canvases = Array.from(root.querySelectorAll("canvas[data-factor]"));

  // Fig. 1: arrows coloured by magnitude with seaborn mako_r (16 stops, low to high), goal in
  // Okabe-Ito vermillion, grey left/bottom spines, axes [-1.08, 1.08], quiver scale 1.2.
  const MAKO_R = ["#def5e5", "#bbe7c8", "#91dbb4", "#60ceac", "#45bdad", "#38aaac", "#3497a9",
    "#3484a5", "#3671a0", "#395d9c", "#40498e", "#403872", "#382a54", "#2d1d38", "#1d111d", "#0b0405"]
    .map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  const GOAL = "#D55E00", SPINE = "#999999";
  const INK = "#141413", MUTED = "#87867f", HAIR = "#cccbc8";   // paper_figures/style.py
  const FACTOR_COLORS = ["#4E79A7", "#F28E2B", "#59A14F", "#B07AA1"]; // style.py: factor k, everywhere
  const oodParts = Array.from(root.querySelectorAll(".toy-ood"));
  const c3d = root.querySelector("#toy-3d"), out3d = root.querySelector("#toy-3d-success");
  const chips = Array.from(root.querySelectorAll(".toy-chip"));
  const axisCanvases = Array.from(root.querySelectorAll("canvas.toy-axis"));
  let ood = null;
  const LIM = 1.08, QUIVER_SCALE = 1.2;
  // matplotlib quiver geometry from Fig. 1, in shaft widths (width is a fraction of the axes).
  const WIDTH = 0.012, HEAD_W = 2.8, HEAD_L = 2.8, HEAD_AXIS_L = 2.4;
  let data = null;

  const fmt = (l) => String(+l.toFixed(4));

  function mako(t) {
    const x = Math.min(Math.max(t, 0), 1) * (MAKO_R.length - 1);
    const i = Math.min(Math.floor(x), MAKO_R.length - 2), f = x - i;
    const c = MAKO_R[i].map((v, j) => Math.round(v + (MAKO_R[i + 1][j] - v) * f));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  // Filled quiver arrow from (x0, y0) to (x1, y1); arrows shorter than the head shrink whole.
  function drawArrow(ctx, x0, y0, x1, y1, w) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 0.3) return;
    const s = Math.min(1, len / (HEAD_L * w)), sw = w * s;
    const ux = (x1 - x0) / len, uy = (y1 - y0) / len, nx = -uy, ny = ux;
    const at = (d, o) => [x0 + ux * d + nx * o, y0 + uy * d + ny * o];
    const pts = [
      at(0, sw / 2), at(len - HEAD_AXIS_L * sw, sw / 2), at(len - HEAD_L * sw, (HEAD_W * sw) / 2),
      at(len, 0),
      at(len - HEAD_L * sw, (-HEAD_W * sw) / 2), at(len - HEAD_AXIS_L * sw, -sw / 2), at(0, -sw / 2),
    ];
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  }

  function drawStar(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.4 : r;
      ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
    }
    ctx.closePath();
    ctx.fillStyle = GOAL;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function draw(canvas, field) {
    const size = canvas.clientWidth;
    if (!size) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.height = Math.round(size * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const px = (v) => ((v + LIM) / (2 * LIM)) * size;
    const py = (v) => ((LIM - v) / (2 * LIM)) * size;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = SPINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0.5, 0); ctx.lineTo(0.5, size - 0.5); ctx.lineTo(size, size - 0.5);
    ctx.stroke();

    // Colour by magnitude, normalised within the panel like matplotlib's default quiver norm.
    const grid = data.grid, n = grid.length, mags = [];
    for (let i = 0; i < n * n; i++) mags.push(Math.hypot(field[2 * i], field[2 * i + 1]));
    const lo = Math.min(...mags), span = Math.max(...mags) - lo || 1;
    const w = WIDTH * size;
    for (let i = 0; i < n * n; i++) {
      const x = grid[i % n], y = grid[Math.floor(i / n)];
      const dx = field[2 * i] / QUIVER_SCALE, dy = field[2 * i + 1] / QUIVER_SCALE;
      ctx.fillStyle = mako((mags[i] - lo) / span);
      drawArrow(ctx, px(x), py(y), px(x + dx), py(y + dy), w);
    }
    drawStar(ctx, px(data.goal[0]), py(data.goal[1]), Math.max(5, size * 0.04));
  }

  function setup(canvas) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return null;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    return { ctx, w, h };
  }

  // One held-out 3-D task as the three 1-D moves its factor copies make: from the start (hollow
  // dot) along x, then y, then z, to where the rollout ends (filled dot). In the factor's colour
  // if it ends within the success tolerance of the goal (Fig. 1 star), dashed grey if not. Only
  // the end is used because the evals score only the final state.
  // state: "solved" (solid, factor colour), "partial" (this copy reached its target but the task is
  // not solved yet: light dashes in the factor colour), or "miss" (short grey dashes).
  const DASH = { solved: [], partial: [6, 3], miss: [3, 3] };
  function drawTask(ctx, pts, goalPt, state, color) {
    const c = state === "miss" ? MUTED : color, alpha = state === "partial" ? 0.5 : 1;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.setLineDash(DASH[state]);
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    drawStar(ctx, goalPt[0], goalPt[1], 6);
    ctx.globalAlpha = alpha;
    const [ex, ey] = pts[pts.length - 1], [sx, sy] = pts[0];
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(ex, ey, 2.75, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = c;
    ctx.lineWidth = 1.5;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Whether 3-D task j ends within the success tolerance of its goal (Euclidean, as compose_cube.py).
  const cubeOk = (frame, j) => {
    const e = frame.cube[j], g = ood.cube.goals[j];
    return Math.hypot(e[0] - g[0], e[1] - g[1], e[2] - g[2]) < ood.tol;
  };

  // One factor copy's 1-D move along axis a for every task: a track over [-1, 1] per task (numbered
  // as in the cube). Solid if the whole 3-D task succeeds (matching the cube), light coloured dashes
  // if this copy reached its target but the task is not solved yet, short grey dashes if it missed.
  function drawAxis(canvas, a, frame, color) {
    const s = setup(canvas);
    if (!s) return;
    const { ctx, w, h } = s, R = 1.3, left = 20, right = 8, padY = 6;
    const px = (v) => left + ((Math.max(-R, Math.min(R, v)) + R) / (2 * R)) * (w - left - right);
    const n = ood.cube.starts.length, rowH = (h - 2 * padY) / n;
    ctx.font = "11px 'Noto Sans', sans-serif";
    ctx.textBaseline = "middle";
    ood.cube.starts.forEach((start, j) => {
      const y = padY + rowH * (j + 0.5), end = frame.cube[j][a], goal = ood.cube.goals[j][a];
      ctx.strokeStyle = HAIR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px(-1), y);
      ctx.lineTo(px(1), y);
      ctx.stroke();
      ctx.fillStyle = MUTED;
      ctx.fillText(String(j + 1), 6, y);
      // A copy counts as on target within tol/sqrt(3): if all three copies are, the 3-D error is
      // under tol, so an unsolved task always shows at least one copy still missing.
      const state = cubeOk(frame, j) ? "solved"
        : Math.abs(end - goal) < ood.tol / Math.sqrt(3) ? "partial" : "miss";
      drawTask(ctx, [[px(start[a]), y], [px(end), y]], [px(goal), y], state, color);
    });
  }

  // 3-D: the held-out cube tasks in a fixed oblique view of [-1, 1]^3.
  const AZ = (-35 * Math.PI) / 180, EL = (22 * Math.PI) / 180;
  const project = ([x, y, z]) => {
    const u = x * Math.cos(AZ) - y * Math.sin(AZ), d = x * Math.sin(AZ) + y * Math.cos(AZ);
    return [u, z * Math.cos(EL) - d * Math.sin(EL)];
  };
  const CORNERS = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) CORNERS.push([x, y, z]);

  function draw3d(frame) {
    const s = setup(c3d);
    if (!s) return;
    const { ctx, w, h } = s, P = CORNERS.map(project);
    const us = P.map((p) => p[0]), vs = P.map((p) => p[1]);
    const umin = Math.min(...us), vmin = Math.min(...vs), umax = Math.max(...us), vmax = Math.max(...vs);
    const k = 0.88 * Math.min(w / (umax - umin), h / (vmax - vmin));   // room for ends outside
    const ox = w / 2 - (k * (umin + umax)) / 2, oy = h / 2 + (k * (vmin + vmax)) / 2;
    const toPx = (p3) => { const [u, v] = project(p3); return [ox + k * u, oy - k * v]; };
    ctx.strokeStyle = HAIR;
    ctx.lineWidth = 1;
    CORNERS.forEach((a, i) => CORNERS.forEach((b, j) => {
      if (j > i && a.filter((v, m) => v !== b[m]).length === 1) {
        const [x0, y0] = toPx(a), [x1, y1] = toPx(b);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
    }));
    // Name the axes on the silhouette: x and y on the two bottom edges leaving the lowest corner,
    // z on the leftmost vertical edge, each just outside the cube.
    const base = CORNERS.filter((c) => c[2] === -1).reduce((a, b) => (toPx(a)[1] > toPx(b)[1] ? a : b));
    const left = CORNERS.filter((c) => c[2] === -1).reduce((a, b) => (toPx(a)[0] < toPx(b)[0] ? a : b));
    const [cx, cy] = toPx([0, 0, 0]);
    ctx.font = "italic 13px 'Noto Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = MUTED;
    [["x", base, 0], ["y", base, 1], ["z", left, 2]].forEach(([name, from, a]) => {
      const tip = from.slice();
      tip[a] = -tip[a];
      const [mx, my] = toPx(from.map((v, m) => (v + tip[m]) / 2));
      const dx = a === 2 ? -1 : mx - cx, dy = a === 2 ? 0 : my - cy, n = Math.hypot(dx, dy) || 1;
      ctx.fillText(name, mx + (dx / n) * 12, my + (dy / n) * 12);
    });

    const color = FACTOR_COLORS[ood.factor];
    ood.cube.starts.forEach((start, j) => {
      const end = frame.cube[j], goal = ood.cube.goals[j];
      const steps = [start, [end[0], start[1], start[2]], [end[0], end[1], start[2]], end];
      drawTask(ctx, steps.map(toPx), toPx(goal), cubeOk(frame, j) ? "solved" : "miss", color);
    });
    ctx.font = "11px 'Noto Sans', sans-serif";
    ctx.fillStyle = MUTED;
    ood.cube.starts.forEach((start, j) => {
      const [sx, sy] = toPx(start);
      ctx.fillText(String(j + 1), sx - 9, sy - 9);
    });
  }

  const pct = (v) => Math.round(v * 100) + "%";

  function render() {
    if (!data) return;
    const i = +slider.value, lam = fmt(data.lambdas[i]);
    readout.textContent = lam;
    slider.setAttribute("aria-valuetext", "lambda " + lam);
    canvases.forEach((c) => {
      const k = +c.dataset.factor;
      draw(c, data.factors[i][k]);
      c.setAttribute("aria-label", `Factor ${k + 1} vector field at lambda ${lam}`);
    });
    if (ood) {
      const frame = ood.frames[i];
      out3d.textContent = pct(frame.s3d);
      axisCanvases.forEach((c) => drawAxis(c, +c.dataset.axis, frame, FACTOR_COLORS[ood.factor]));
      draw3d(frame);
    }
  }

  fetch("./static/data/toy_fields.json")
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((d) => {
      data = d;
      slider.max = d.lambdas.length - 1;
      slider.disabled = false;
      status.hidden = true;
      render();
    })
    .catch(() => { status.textContent = "The interactive figure could not be loaded."; });

  // Held-out 3-D rollouts (decorrelation/website/toy_ood.py); the figure works without them.
  fetch("./static/data/toy_ood.json")
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((d) => {
      ood = d;
      out3d.style.color = FACTOR_COLORS[d.factor];
      chips.forEach((chip) => {
        chip.style.color = FACTOR_COLORS[d.factor];
        chip.querySelector(".toy-k").textContent = d.factor + 1;
      });
      oodParts.forEach((el) => { el.hidden = false; });
      render();
    })
    .catch(() => {});

  slider.addEventListener("input", render);
  if (window.ResizeObserver) new ResizeObserver(render).observe(root);
})();
