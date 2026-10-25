/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script, run with `node` */
// Graphic versions (G1-G4) of the report's "Where you left off" section,
// injected into the REAL linked report (mock mode), plus a check of the real
// Next step card. Builds Issue 1's report, marks 2 tasks done, adds a linked
// Follows up Issue 2 and opens its report.
// Usage: start the dev server on :3000 (npm run dev), then from the repo root:
//   node docs/handoffs/2026-10-25/graphic-variants.cjs <outDir>
// Writes <outDir>/g1..g4.png (page), g1..g4-section.png (section) and check.json.
const path = require("path"), fs = require("fs");
const { chromium } = require("playwright");
const OUT = process.argv[2] || "gvar";
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.5 });
  p.setDefaultTimeout(30000);
  const endCard = () => p.locator(".react-flow button", { hasText: /view report/i });
  const preferUntil = async (n) => {
    for (let i = 0; i < 12 && (await endCard().count()) < n; i++) {
      await p.getByRole("button", { name: /prefer this option/i }).last().click();
      await p.waitForTimeout(4200);
    }
  };
  const waitReport = async () => {
    await p.getByRole("heading", { level: 1, name: /your prescription/i }).waitFor({ timeout: 40000 });
    await p.waitForTimeout(1800);
  };
  const nextStep = () =>
    p.evaluate(() => {
      const card = [...document.querySelectorAll(".next-steps-card")].find((c) => c.offsetParent !== null);
      return card ? card.innerText : null;
    });

  await p.goto("http://localhost:3000");
  await p.getByRole("textbox").first().fill("Our hiring managers take three weeks to give feedback on candidates, and we keep losing the strong ones to faster offers.");
  await p.getByRole("button", { name: /send/i }).click();
  await preferUntil(1);
  await endCard().first().click();
  await waitReport();
  await p.getByRole("tab", { name: /my tasks/i }).click();
  await p.waitForTimeout(600);
  const boxes = p.getByRole("checkbox", { name: /^Mark .* done$/ });
  const doneTitles = [];
  for (let k = 0; k < 2; k++) {
    doneTitles.push((await boxes.nth(0).getAttribute("aria-label")).replace(/^Mark | done$/g, ""));
    await boxes.nth(0).click();
    await p.waitForTimeout(300);
  }
  await p.getByRole("tab", { name: /^report$/i }).click();
  await p.waitForTimeout(800);
  const issue1Next = await nextStep();
  await p.getByRole("button", { name: /back to canvas/i }).click();
  await p.waitForTimeout(800);
  await p.keyboard.press("n");
  const field = p.getByPlaceholder("What else is weighing on you?");
  await field.waitFor();
  await field.fill("We added a 48-hour rule, but two managers still miss it.");
  await p.locator(".react-flow button", { hasText: /add issue/i }).click();
  await p.waitForTimeout(9000);
  await preferUntil(2);
  await endCard().last().click();
  await waitReport();
  const issue2Next = await nextStep();
  await p.evaluate(() => document.querySelector("[tabindex='-1']")?.scrollTo({ top: 0 }));
  await p.screenshot({ path: path.join(OUT, "0-real.png") });
  await p.getByRole("tab", { name: /my tasks/i }).click();
  await p.waitForTimeout(800);
  const issue2Tasks = await p.evaluate(() =>
    [...document.querySelectorAll("[aria-label^='Mark ']")].map((e) => e.getAttribute("aria-label"))
  );
  await p.getByRole("tab", { name: /^report$/i }).click();
  await p.waitForTimeout(1200);
  fs.writeFileSync(path.join(OUT, "check.json"), JSON.stringify({ doneTitles, issue1Next, issue2Next, issue2Tasks }, null, 2));


  // Graphic versions of "Where you left off". Real numbers from the page.
  const total2 = issue2Tasks.length;
  const data = {
    i1: [
      { t: doneTitles[0], s: "done" },
      { t: doneTitles[1], s: "done" },
      { t: "Check the rule at the next retro", s: "open" },
    ],
    total2,
    q1: "Our hiring managers take three weeks to give feedback on candidates, and we keep losing the strong ones.",
    q2: "We added a 48-hour rule, but two managers still miss it.",
  };

  await p.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((x) => /carried over/i.test(x.textContent));
    if (h) h.closest(".report-reveal-in").style.display = "none";
  });

  for (const key of ["g1", "g2", "g3", "g4"]) {
    await p.evaluate(({ key, d }) => {
      document.querySelectorAll("[data-variant]").forEach((e) => e.remove());
      const h2 = [...document.querySelectorAll("h2")].find((x) => /what we understood/i.test(x.textContent));
      const section = h2.closest(".report-reveal-in");
      const copy = section.cloneNode(true);
      copy.dataset.variant = "1";
      copy.style.animation = "none";
      copy.style.opacity = "1";
      copy.style.transform = "none";
      copy.querySelector("h2").textContent = "Where you left off";
      const host = document.createElement("div");
      copy.querySelector(".report-card-surface").replaceWith(host);
      section.before(copy);
      section.style.marginTop = "22px";
      const heads = [...document.querySelectorAll("h2")].filter(
        (x) => x.offsetParent && /^\d\d$/.test(x.previousElementSibling?.textContent ?? "")
      );
      heads.forEach((x, i) => (x.previousElementSibling.textContent = String(i + 1).padStart(2, "0")));

      const GRAY = "hsl(100 4% 44%)";
      const F = "font-family: var(--font-geist), sans-serif;";
      const label = (txt, num) =>
        `<div style="${F} font-size:13px; color: var(--muted-foreground); display:flex; gap:8px; align-items:baseline;">${txt}${
          num ? `<span style="font-variant-numeric: tabular-nums; color: var(--foreground); font-weight:600;">${num}</span>` : ""
        }</div>`;
      const cell = (s, title, size = 18, attr = "") => {
        const base = `width:${size}px; height:${size}px; border-radius:${Math.round(size / 3.6)}px; flex:none; box-sizing:border-box;`;
        const look = {
          done: "background: var(--primary);",
          open: "background: color-mix(in oklab, var(--foreground) 10%, transparent);",
          ghost: `border: 1.5px dashed ${GRAY};`,
          carried: "background: var(--cta);",
        }[s];
        return `<span ${attr} title="${title ?? ""}" style="display:block; ${base} ${look}"></span>`;
      };
      const opens = (n, size) => Array.from({ length: n }, () => cell("open", "", size)).join("");

      // Dashed curved arrow between two elements, drawn after layout.
      const arrow = (root, from, to, bend = -26) => {
        const r = root.getBoundingClientRect();
        const a = root.querySelector(from).getBoundingClientRect();
        const b = root.querySelector(to).getBoundingClientRect();
        const x1 = a.left + a.width / 2 - r.left, y1 = a.top - r.top - 5;
        const x2 = b.left + b.width / 2 - r.left, y2 = b.top - r.top - 5;
        const mx = (x1 + x2) / 2;
        root.insertAdjacentHTML(
          "beforeend",
          `<svg style="position:absolute; left:0; top:0; overflow:visible; pointer-events:none" width="1" height="1">
          <defs><marker id="ah-${key}" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 7 4 1 7" fill="none" stroke="${GRAY}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>
          <path d="M${x1} ${y1} Q ${mx} ${Math.min(y1, y2) + bend} ${x2} ${y2}" fill="none" stroke="${GRAY}" stroke-width="1.4" stroke-dasharray="3 3" marker-end="url(#ah-${key})"/></svg>`
        );
      };

      if (key === "g1") {
        // Relay track: Issue 1's cells; the open one rolls over as Issue 2's first.
        host.innerHTML = `<div data-root style="position:relative; display:flex; align-items:flex-end; gap:44px; padding-top:38px;">
          <div style="display:flex; flex-direction:column; gap:10px;">
            <div style="display:flex; gap:5px;">${cell("done", d.i1[0].t)}${cell("done", d.i1[1].t)}${cell("ghost", d.i1[2].t, 18, "data-from")}</div>
            ${label("Issue 1", "2/3")}
          </div>
          <div style="display:flex; flex-direction:column; gap:10px;">
            <div style="display:flex; gap:5px;">${cell("carried", d.i1[2].t, 18, "data-to")}${opens(d.total2 - 1, 18)}</div>
            ${label("Issue 2", `0/${d.total2}`)}
          </div></div>`;
        arrow(host.querySelector("[data-root]"), "[data-from]", "[data-to]");
      }

      if (key === "g2") {
        // Two rings; the open arc of Issue 1 becomes the first arc of Issue 2.
        const R = 40, C = 2 * Math.PI * R, GAP = 3;
        const pt = (f) => [50 + R * Math.sin(2 * Math.PI * f), 50 - R * Math.cos(2 * Math.PI * f)];
        const arc = (f1, f2) => {
          const [x1, y1] = pt(f1), [x2, y2] = pt(f2);
          return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 ${f2 - f1 > 0.5 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
        };
        const ring = (segs, center, id) => {
          const f = 1 / segs.length, g = GAP / C;
          const paths = segs
            .map((s, i) => {
              const stroke = {
                done: "var(--primary)",
                open: "color-mix(in oklab, var(--foreground) 12%, transparent)",
                ghost: GRAY,
                carried: "var(--cta)",
              }[s];
              const extra = s === "ghost" ? `stroke-width="2" stroke-dasharray="3 3"` : `stroke-width="9"`;
              return `<path data-arc="${id}-${i}" d="${arc(i * f + g / 2, (i + 1) * f - g / 2)}" fill="none" stroke="${stroke}" ${extra}/>`;
            })
            .join("");
          return `<svg width="116" height="116" viewBox="0 0 100 100" style="overflow:visible">${paths}
            <text x="50" y="56" text-anchor="middle" style="${F} font-size:17px; font-weight:600; fill: var(--foreground); font-variant-numeric: tabular-nums;">${center}</text></svg>`;
        };
        host.innerHTML = `<div data-root style="position:relative; display:flex; align-items:center; gap:84px; padding-top:18px;">
          <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">${ring(["done", "done", "ghost"], "2/3", "a")}${label("Issue 1")}</div>
          <div style="display:flex; flex-direction:column; align-items:center; gap:8px;">${ring(["carried", ...Array(d.total2 - 1).fill("open")], `0/${d.total2}`, "b")}${label("Issue 2")}</div>
        </div>`;
        arrow(host.querySelector("[data-root]"), "[data-arc='a-2']", "[data-arc='b-0']", -34);
      }

      if (key === "g3") {
        // Canvas echo: the two quote cards and the link, as on the canvas.
        const mini = (q, cells) => `<div style="flex:1; min-width:0; background: var(--paper-card); border-radius: var(--radius-card-shaped, 18px); corner-shape: var(--card-corner-shape); padding:14px 16px; display:flex; flex-direction:column; gap:12px;">
            <p style="${F} font-size:14px; font-style:italic; line-height:1.45; color: color-mix(in oklab, var(--foreground) 80%, transparent); margin:0; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">“${q}”</p>
            <div style="display:flex; gap:4px; flex-wrap:wrap;">${cells}</div></div>`;
        host.innerHTML = `<div style="display:flex; align-items:center;">
          ${mini(d.q1, cell("done", d.i1[0].t, 12) + cell("done", d.i1[1].t, 12) + cell("ghost", d.i1[2].t, 12))}
          <div style="flex:none; width:170px; position:relative; height:34px; display:flex; align-items:center; justify-content:center;">
            <div style="position:absolute; left:0; right:0; top:50%; border-top:1.75px solid var(--primary);"></div>
            <span class="link-pill" style="position:relative;"><span class="link-pill-issue">Follows up</span><span class="link-pill-status">2/3</span></span>
          </div>
          ${mini(d.q2, cell("carried", d.i1[2].t, 12) + opens(d.total2 - 1, 12))}
        </div>`;
      }

      if (key === "g4") {
        // Three numbers.
        const stat = (n, txt, color) => `<div style="display:flex; flex-direction:column; gap:6px; min-width:150px;">
            <span style="${F} font-size:44px; line-height:1; font-weight:600; letter-spacing:-0.02em; color:${color}; font-variant-numeric: tabular-nums;">${n}</span>
            <span style="${F} font-size:13px; color: var(--muted-foreground);">${txt}</span></div>`;
        const sep = `<span style="width:1px; align-self:stretch; background: var(--border);"></span>`;
        host.innerHTML = `<div style="display:flex; gap:28px; align-items:stretch;">
          ${stat("2", "done in Issue 1", "var(--primary)")}${sep}
          ${stat("1", "carried over, first step", "var(--cta)")}${sep}
          ${stat(String(d.total2 - 1), "new in Issue 2", "var(--foreground)")}
        </div>`;
      }
    }, { key, d: data });
    await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector("[tabindex='-1']")?.scrollTo({ top: 0 }));
    await p.screenshot({ path: path.join(OUT, `${key}.png`) });
    await p.locator("[data-variant]").first().screenshot({ path: path.join(OUT, `${key}-section.png`) });
  }
  await b.close();
  console.log("ok");
})().catch((e) => { console.error(e); process.exit(1); });
