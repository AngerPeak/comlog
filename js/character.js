/* Персонаж: SVG-рисовка тела, косметики, питомцев и стадий эволюции. viewBox 0 0 300 300. */
const SKINS = {
  skin_graphite: { light: "#e1e4d2", mid: "#aeb29c", dark: "#6c705c", inner: "#8d8478", belly: "#eef0e2" },
  skin_mint: { light: "#dcfbef", mid: "#92dcc1", dark: "#4b957b", inner: "#5fae94", belly: "#effff8" },
  skin_lavender: { light: "#efe7ff", mid: "#bba6f3", dark: "#7259b6", inner: "#8f77cf", belly: "#f7f2ff" },
  skin_peach: { light: "#ffeadc", mid: "#f6b593", dark: "#bd6e4b", inner: "#d98a68", belly: "#fff4ec" },
  skin_lime: { light: "#f0ffb8", mid: "#c2f02f", dark: "#5f8a0b", inner: "#86b316", belly: "#f6ffd6" },
  skin_night: { light: "#5b6170", mid: "#2f333d", dark: "#121419", inner: "#1d2027", belly: "#454a57", glow: true },
  skin_gold: { light: "#fff6c8", mid: "#ffcf4a", dark: "#a8740d", inner: "#c9921c", belly: "#fff3c2" },
  skin_holo: { light: "#bff6ff", mid: "#e2b6ff", dark: "#7f8cff", inner: "#a58cff", belly: "#f4f0ff", holo: true },
};

let charSeq = 0;

function renderCharacter(opt = {}) {
  const p = "c" + (++charSeq);
  const eq = { skin: "skin_graphite", ...opt };
  const sk = SKINS[eq.skin] || SKINS.skin_graphite;
  const stage = opt.stage || 0;
  const glowEyes = sk.glow || stage >= 4;
  const cls = opt.animate ? "ch-anim" : "";

  const defs = `
    ${sk.holo ? `<linearGradient id="${p}sk" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#a6f4ff"/><stop offset=".35" stop-color="#f0b8ff"/><stop offset=".65" stop-color="#fff3a8"/><stop offset="1" stop-color="#9dffb8"/></linearGradient>`
    : `<radialGradient id="${p}sk" cx=".36" cy=".28" r=".9">
      <stop offset="0" stop-color="${sk.light}"/><stop offset=".55" stop-color="${sk.mid}"/><stop offset="1" stop-color="${sk.dark}"/>
    </radialGradient>`}
    <radialGradient id="${p}ear" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="${sk.mid}"/><stop offset="1" stop-color="${sk.dark}"/></radialGradient>
    <radialGradient id="${p}shadow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <linearGradient id="${p}gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2a6"/><stop offset=".5" stop-color="#ffcc3d"/><stop offset="1" stop-color="#b37a0e"/></linearGradient>
    <linearGradient id="${p}lime" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4ff8a"/><stop offset="1" stop-color="#6f9a10"/></linearGradient>
    <filter id="${p}blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
    <filter id="${p}soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
    <clipPath id="${p}eL"><ellipse cx="122" cy="160" rx="17" ry="15"/></clipPath>
    <clipPath id="${p}eR"><ellipse cx="178" cy="160" rx="17" ry="15"/></clipPath>`;

  const art = id => (ITEM_ART[id] ? ITEM_ART[id](p, sk) : { back: "", front: "" });
  const aura = eq.aura ? art(eq.aura) : { back: "", front: "" };
  const head = eq.head ? art(eq.head) : { back: "", front: "" };
  const eyes = eq.eyes ? art(eq.eyes) : { back: "", front: "" };
  const neck = eq.neck ? art(eq.neck) : { back: "", front: "" };
  const pet = eq.pet ? art(eq.pet) : { back: "", front: "" };

  const evoBack = stage >= 4 && eq.head !== "head_halo"
    ? `<circle cx="150" cy="165" r="105" style="fill:var(--accent)" opacity=".14" filter="url(#${p}blur)" class="ch-pulse"/>` : "";
  const evoOrbit = stage >= 3 ? `<g class="ch-spin">
      <circle cx="150" cy="35" r="5" style="fill:var(--accent)"/><circle cx="262" cy="230" r="4" style="fill:var(--accent)" opacity=".8"/>
      <circle cx="38" cy="230" r="3.5" style="fill:var(--accent)" opacity=".6"/>
      <circle cx="150" cy="165" r="130" fill="none" style="stroke:var(--accent)" stroke-opacity=".12" stroke-dasharray="2 10"/></g>` : "";
  const sprout = stage >= 1 && !["head_wizard", "head_tophat"].includes(eq.head) ? `
      <path d="M150 96 C150 84 151 76 154 66" stroke="#6f9a10" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M154 68 C164 54 180 54 184 60 C176 70 164 72 154 68 Z" fill="url(#${p}lime)"/>
      <path d="M152 74 C142 64 128 66 125 72 C133 80 145 79 152 74 Z" fill="url(#${p}lime)"/>` : "";
  const emblem = stage >= 2 ? `
      <g transform="translate(150 212)" opacity=".95">
        <circle r="13" fill="#0b0b0b" opacity=".85"/>
        <path d="M0 -7.5v15M-6.5 -3.75l13 7.5M-6.5 3.75l13 -7.5" style="stroke:var(--accent)" stroke-width="2.6" stroke-linecap="round"/>
        <circle r="13" fill="none" style="stroke:var(--accent)" stroke-width="1.5" opacity=".6"/>
      </g>` : "";

  const pupil = glowEyes ? "var(--accent)" : "#1b1a19";
  const eye = (cx, clip) => `
    <ellipse cx="${cx}" cy="160" rx="17" ry="15" fill="${glowEyes ? "#10140a" : "#f6f2e6"}"/>
    <g clip-path="url(#${p}${clip})">
      <circle cx="${cx + 2}" cy="164" r="8.5" style="fill:${pupil}" ${glowEyes ? `filter="url(#${p}soft)"` : ""}/>
      <circle cx="${cx + 2}" cy="164" r="7" style="fill:${pupil}"/>
      <circle cx="${cx + 5}" cy="161" r="2.4" fill="#fff" opacity="${glowEyes ? .5 : .9}"/>
      <path d="M${cx - 20} 158 Q${cx} 152 ${cx + 20} 158 L${cx + 20} 140 L${cx - 20} 140 Z" fill="url(#${p}sk)"/>
      <path d="M${cx - 20} 158 Q${cx} 152 ${cx + 20} 158" stroke="${sk.dark}" stroke-width="2.4" fill="none" opacity=".7"/>
    </g>`;

  return `<svg viewBox="0 0 300 300" class="${cls}" xmlns="http://www.w3.org/2000/svg">
    <defs>${defs}</defs>
    ${aura.back}${evoBack}
    <ellipse cx="150" cy="262" rx="78" ry="10" fill="url(#${p}shadow)"/>
    ${neck.back}
    <g class="ch-body">
      <g class="${sk.holo ? "ch-holo" : ""}">
        <circle cx="92" cy="110" r="27" fill="url(#${p}ear)"/><circle cx="92" cy="110" r="14" fill="${sk.inner}"/>
        <circle cx="208" cy="110" r="27" fill="url(#${p}ear)"/><circle cx="208" cy="110" r="14" fill="${sk.inner}"/>
        ${sprout}
        <ellipse cx="118" cy="248" rx="23" ry="12" fill="${sk.dark}"/>
        <ellipse cx="182" cy="248" rx="23" ry="12" fill="${sk.dark}"/>
        <path d="M150 92 C206 92 234 130 234 173 C234 222 198 250 150 250 C102 250 66 222 66 173 C66 130 94 92 150 92 Z" fill="url(#${p}sk)"/>
        <ellipse cx="150" cy="210" rx="46" ry="34" fill="${sk.belly}" opacity=".35"/>
        <ellipse cx="112" cy="122" rx="26" ry="14" fill="#fff" opacity=".22" transform="rotate(-25 112 122)"/>
        <ellipse cx="72" cy="194" rx="13" ry="22" fill="${sk.mid}" transform="rotate(18 72 194)"/>
        <ellipse cx="228" cy="194" rx="13" ry="22" fill="${sk.mid}" transform="rotate(-18 228 194)"/>
      </g>
      ${emblem}
      <g class="ch-eyes">${eye(122, "eL")}${eye(178, "eR")}</g>
      <ellipse cx="102" cy="186" rx="11" ry="6" fill="#ff7f7f" opacity=".32"/>
      <ellipse cx="198" cy="186" rx="11" ry="6" fill="#ff7f7f" opacity=".32"/>
      <ellipse cx="150" cy="180" rx="7" ry="4.5" fill="#3b2f2c"/>
      <path d="M141 191 Q150 198 159 191" stroke="#3b2f2c" stroke-width="3" fill="none" stroke-linecap="round"/>
      ${neck.front}${eyes.front}${head.back}${head.front}
    </g>
    ${evoOrbit}
    ${pet.front ? `<g class="ch-pet">${pet.front}</g>` : ""}
    ${aura.front}
  </svg>`;
}

/* ---------- Арт предметов: функция (prefix, skin) → { back, front } ---------- */
const STAR = (x, y, r, fill, cls = "ch-tw", delay = 0) =>
  `<path class="${cls}" style="animation-delay:${delay}s" transform="translate(${x} ${y}) scale(${r / 10})" d="M0 -10 L2.4 -2.4 L10 0 L2.4 2.4 L0 10 L-2.4 2.4 L-10 0 L-2.4 -2.4 Z" fill="${fill}"/>`;

const ITEM_ART = {
  /* ----- головные уборы ----- */
  head_cap: p => ({ front: `
    <path d="M90 124 C88 74 212 74 210 124 Z" fill="#1c1c1c"/>
    <path d="M90 124 C88 74 212 74 210 124" fill="none" stroke="#2c2c2c" stroke-width="2"/>
    <path d="M150 80 V122" stroke="#2a2a2a" stroke-width="2"/>
    <path d="M190 116 Q246 108 258 124 Q222 132 190 126 Z" fill="#151515"/>
    <circle cx="150" cy="80" r="5" fill="#2a2a2a"/>
    <g transform="translate(128 100)"><circle r="10" style="fill:var(--accent)"/><path d="M0 -5v10M-4.3 -2.5l8.6 5M-4.3 2.5l8.6 -5" stroke="#0b0b0b" stroke-width="2" stroke-linecap="round"/></g>` }),
  head_beanie: p => ({ front: `
    <path d="M86 126 C84 60 216 60 214 126 Z" fill="#ff7a45"/>
    <path d="M86 126 C84 60 216 60 214 126" fill="none" stroke="#c9532a" stroke-width="2"/>
    ${[104, 122, 140, 158, 176, 194].map(x => `<path d="M${x} 82 V116" stroke="#e8663a" stroke-width="5" stroke-linecap="round" opacity=".6"/>`).join("")}
    <rect x="82" y="112" width="136" height="22" rx="11" fill="#e8663a"/>
    ${[96, 112, 128, 144, 160, 176, 192, 206].map(x => `<path d="M${x} 116 V130" stroke="#c9532a" stroke-width="3" stroke-linecap="round"/>`).join("")}
    <circle cx="150" cy="62" r="14" fill="#fff4ea"/><circle cx="146" cy="58" r="5" fill="#fff" opacity=".7"/>` }),
  head_phones: p => ({ front: `
    <path d="M78 150 C76 62 224 62 222 150" fill="none" stroke="#1a1a1a" stroke-width="12" stroke-linecap="round"/>
    <path d="M86 112 C100 80 200 80 214 112" fill="none" style="stroke:var(--accent)" stroke-width="3" stroke-linecap="round" opacity=".8"/>
    <rect x="58" y="126" width="32" height="52" rx="15" fill="#1d1d1d"/><rect x="64" y="134" width="20" height="36" rx="10" style="fill:var(--accent)"/>
    <rect x="210" y="126" width="32" height="52" rx="15" fill="#1d1d1d"/><rect x="216" y="134" width="20" height="36" rx="10" style="fill:var(--accent)"/>` }),
  head_horns: p => ({ back: `
    <defs><linearGradient id="${p}horn" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#7a1414"/><stop offset="1" stop-color="#ff6b5b"/></linearGradient></defs>
    <path d="M112 108 C96 86 94 62 108 42 C112 66 122 84 134 100 Z" fill="url(#${p}horn)"/>
    <path d="M188 108 C204 86 206 62 192 42 C188 66 178 84 166 100 Z" fill="url(#${p}horn)"/>`, front: "" }),
  head_wizard: p => ({ front: `
    <defs><linearGradient id="${p}wz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b3fc4"/><stop offset="1" stop-color="#2a1b6e"/></linearGradient></defs>
    <path d="M92 116 C120 92 136 50 168 18 C176 12 184 16 178 26 C168 50 196 86 208 116 Z" fill="url(#${p}wz)"/>
    <ellipse cx="150" cy="116" rx="80" ry="15" fill="#22165c"/>
    <path d="M100 108 Q150 98 200 108" stroke="#ffd257" stroke-width="5" fill="none" stroke-linecap="round"/>
    ${STAR(140, 70, 8, "#ffd257", "ch-tw", 0)}${STAR(166, 50, 5, "#fff3b0", "ch-tw", .7)}${STAR(176, 88, 6, "#ffd257", "ch-tw", 1.3)}` }),
  head_tophat: p => ({ front: `
    <rect x="112" y="38" width="76" height="70" rx="7" fill="#151515"/>
    <rect x="112" y="38" width="76" height="12" rx="6" fill="#222"/>
    <rect x="112" y="88" width="76" height="13" style="fill:var(--accent)"/>
    <ellipse cx="150" cy="108" rx="62" ry="11" fill="#101010"/>
    <path d="M122 46 V96" stroke="#fff" stroke-width="4" opacity=".08" stroke-linecap="round"/>` }),
  head_crown: p => ({ front: `
    <path d="M106 108 L100 66 L126 88 L150 56 L174 88 L200 66 L194 108 Z" fill="url(#${p}gold)" stroke="#9a6a0a" stroke-width="2" stroke-linejoin="round"/>
    <rect x="104" y="100" width="92" height="12" rx="4" fill="url(#${p}gold)" stroke="#9a6a0a" stroke-width="2"/>
    <circle cx="150" cy="84" r="7" fill="#ff5d7a"/><circle cx="124" cy="96" r="4.5" fill="#6fb6ff"/><circle cx="176" cy="96" r="4.5" style="fill:var(--accent)"/>
    <circle cx="100" cy="64" r="5" fill="#fff2a6"/><circle cx="150" cy="54" r="5" fill="#fff2a6"/><circle cx="200" cy="64" r="5" fill="#fff2a6"/>
    ${STAR(186, 74, 6, "#fff", "ch-tw", .4)}` }),
  head_halo: p => ({ front: `
    <ellipse cx="150" cy="64" rx="50" ry="13" fill="none" stroke="#ffe680" stroke-width="12" opacity=".5" filter="url(#${p}soft)" class="ch-pulse"/>
    <ellipse cx="150" cy="64" rx="50" ry="13" fill="none" stroke="url(#${p}gold)" stroke-width="7"/>
    <ellipse cx="150" cy="61" rx="46" ry="10" fill="none" stroke="#fff8d6" stroke-width="1.5" opacity=".8"/>` }),

  /* ----- очки ----- */
  eyes_round: p => ({ front: `
    <circle cx="122" cy="161" r="22" fill="#ffffff" fill-opacity=".07" stroke="#1d1d1d" stroke-width="4.5"/>
    <circle cx="178" cy="161" r="22" fill="#ffffff" fill-opacity=".07" stroke="#1d1d1d" stroke-width="4.5"/>
    <path d="M144 158 Q150 152 156 158" stroke="#1d1d1d" stroke-width="4" fill="none"/>
    <path d="M100 156 L84 150 M200 156 L216 150" stroke="#1d1d1d" stroke-width="4" stroke-linecap="round"/>
    <path d="M110 150 Q116 144 124 145" stroke="#fff" stroke-width="2.5" fill="none" opacity=".5" stroke-linecap="round"/>` }),
  eyes_shades: p => ({ front: `
    <path d="M96 148 H146 C147 170 138 180 122 180 C104 180 96 168 96 148 Z" fill="#0c0c0c"/>
    <path d="M154 148 H204 C204 168 196 180 178 180 C162 180 153 170 154 148 Z" fill="#0c0c0c"/>
    <path d="M90 148 H210" stroke="#0c0c0c" stroke-width="6" stroke-linecap="round"/>
    <path d="M104 156 L120 156 M162 156 L176 156" stroke="#fff" stroke-width="3" opacity=".28" stroke-linecap="round"/>
    <path d="M100 166 Q122 150 142 160" style="stroke:var(--accent)" stroke-width="2" opacity=".35" fill="none"/>` }),
  eyes_monocle: p => ({ front: `
    <circle cx="178" cy="161" r="23" fill="#fff" fill-opacity=".08" stroke="url(#${p}gold)" stroke-width="5"/>
    <path d="M196 176 C210 196 214 212 206 232" stroke="#d9a62a" stroke-width="2" fill="none" stroke-dasharray="3 3"/>
    <path d="M166 148 Q172 143 180 144" stroke="#fff" stroke-width="2.5" fill="none" opacity=".55" stroke-linecap="round"/>` }),
  eyes_visor: p => ({ front: `
    <defs><linearGradient id="${p}vz" x1="0" x2="1"><stop offset="0" stop-color="#C2F02F" stop-opacity=".95"/><stop offset=".5" stop-color="#7cff9b" stop-opacity=".8"/><stop offset="1" stop-color="#C2F02F" stop-opacity=".95"/></linearGradient></defs>
    <rect x="88" y="144" width="124" height="32" rx="16" fill="#0b0b0b"/>
    <rect x="94" y="149" width="112" height="22" rx="11" fill="url(#${p}vz)" class="ch-pulse"/>
    <path d="M100 160 H200" stroke="#0b0b0b" stroke-width="1.5" stroke-dasharray="4 4" opacity=".4"/>
    <rect x="80" y="152" width="10" height="16" rx="4" fill="#1d1d1d"/><rect x="210" y="152" width="10" height="16" rx="4" fill="#1d1d1d"/>` }),

  /* ----- аксессуары на шею / спину ----- */
  neck_bow: p => ({ front: `
    <path d="M150 218 L124 204 C118 202 116 206 116 214 V222 C116 230 118 234 124 232 Z" fill="#ff5d5d"/>
    <path d="M150 218 L176 204 C182 202 184 206 184 214 V222 C184 230 182 234 176 232 Z" fill="#ff5d5d"/>
    <rect x="142" y="210" width="16" height="16" rx="5" fill="#d93b3b"/>` }),
  neck_scarf: p => ({ front: `
    <path d="M84 196 Q150 228 216 196 L220 214 Q150 248 80 214 Z" style="fill:var(--accent)"/>
    <path d="M84 196 Q150 228 216 196" stroke="#8fbf1f" stroke-width="3" fill="none"/>
    <path d="M172 222 L186 266 L166 270 L160 228 Z" fill="#a8d625"/>
    <path d="M176 236 L170 238 M180 250 L172 252" stroke="#6f9a10" stroke-width="3" stroke-linecap="round"/>
    <path d="M100 212 Q150 236 200 212" stroke="#6f9a10" stroke-width="3" fill="none" stroke-dasharray="6 6"/>` }),
  neck_chain: p => ({ front: `
    <path d="M100 196 Q150 250 200 196" stroke="url(#${p}gold)" stroke-width="6" fill="none" stroke-dasharray="7 3" stroke-linecap="round"/>
    <g transform="translate(150 232)"><circle r="15" fill="url(#${p}gold)" stroke="#9a6a0a" stroke-width="2"/>
      <path d="M0 -8v16M-7 -4l14 8M-7 4l14 -8" stroke="#6b4a06" stroke-width="2.6" stroke-linecap="round"/></g>` }),
  neck_cape: p => ({
    back: `<defs><linearGradient id="${p}cp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4243a"/><stop offset="1" stop-color="#5c0816"/></linearGradient></defs>
      <path d="M96 170 C70 214 52 252 46 274 Q150 290 254 274 C248 252 230 214 204 170 Z" fill="url(#${p}cp)"/>
      <path d="M60 268 Q150 284 240 268" stroke="#ffd257" stroke-width="3" fill="none" opacity=".7"/>`,
    front: `<circle cx="106" cy="200" r="8" fill="url(#${p}gold)"/><circle cx="194" cy="200" r="8" fill="url(#${p}gold)"/>
      <path d="M106 200 Q150 214 194 200" stroke="#ffd257" stroke-width="3" fill="none"/>` }),

  /* ----- ауры ----- */
  aura_ring: p => ({ back: `
    <circle cx="150" cy="165" r="122" fill="none" style="stroke:var(--accent)" stroke-width="10" opacity=".22" filter="url(#${p}soft)"/>
    <circle cx="150" cy="165" r="122" fill="none" style="stroke:var(--accent)" stroke-width="2.5"/>
    <g class="ch-spin"><circle cx="150" cy="165" r="136" fill="none" style="stroke:var(--accent)" stroke-width="2" stroke-dasharray="14 18" opacity=".5"/></g>`, front: "" }),
  aura_stars: p => ({ back: `<circle cx="150" cy="160" r="120" fill="#6fb6ff" opacity=".1" filter="url(#${p}blur)"/>`,
    front: [[40, 60, 7], [262, 70, 9], [30, 180, 5], [270, 170, 6], [70, 270, 4], [240, 40, 4], [50, 120, 3], [252, 250, 5], [150, 22, 5], [96, 34, 3]]
      .map(([x, y, r], i) => STAR(x, y, r, i % 3 ? "#fff" : "#C2F02F", "ch-tw", (i * 0.37) % 2)).join("") }),
  aura_flame: p => ({ back: `
    <defs><linearGradient id="${p}fl" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff3d1f"/><stop offset=".6" stop-color="#ff9a1f" stop-opacity=".8"/><stop offset="1" stop-color="#ffd257" stop-opacity="0"/></linearGradient></defs>
    <g class="ch-flame">
      <path d="M48 270 C30 200 70 170 66 110 C96 150 92 120 110 70 C120 120 140 110 150 40 C162 110 182 120 190 70 C208 120 206 150 236 110 C232 170 272 200 252 270 Z" fill="url(#${p}fl)" opacity=".85" filter="url(#${p}soft)"/>
    </g>`, front: "" }),
  aura_aurora: p => ({ back: `
    <defs><linearGradient id="${p}au" x1="0" x2="1"><stop offset="0" stop-color="#5ee0b5"/><stop offset=".5" stop-color="#b48cff"/><stop offset="1" stop-color="#C2F02F"/></linearGradient></defs>
    <g filter="url(#${p}blur)" class="ch-pulse">
      <path d="M10 120 C70 60 120 140 170 80 C220 30 260 90 295 60 L295 110 C250 140 220 90 170 130 C120 180 70 110 10 170 Z" fill="url(#${p}au)" opacity=".55"/>
      <path d="M10 190 C80 150 120 210 180 170 C230 140 260 180 295 160 L295 190 C250 210 220 180 170 210 C120 240 70 200 10 220 Z" fill="url(#${p}au)" opacity=".35"/>
    </g>`, front: "" }),

  /* ----- питомцы (справа внизу) ----- */
  pet_slime: p => ({ front: `<g transform="translate(250 238)">
    <ellipse cx="0" cy="24" rx="24" ry="5" fill="#000" opacity=".35"/>
    <path d="M0 -26 C10 -12 26 -2 26 10 C26 22 14 26 0 26 C-14 26 -26 22 -26 10 C-26 -2 -10 -12 0 -26 Z" fill="#7dff8e" opacity=".9"/>
    <ellipse cx="-8" cy="-2" rx="6" ry="9" fill="#fff" opacity=".35" transform="rotate(-20)"/>
    <circle cx="-8" cy="8" r="4" fill="#0f3d17"/><circle cx="8" cy="8" r="4" fill="#0f3d17"/>
    <path d="M-4 16 Q0 19 4 16" stroke="#0f3d17" stroke-width="2" fill="none" stroke-linecap="round"/></g>` }),
  pet_cat: p => ({ front: `<g transform="translate(250 236)">
    <ellipse cx="0" cy="28" rx="24" ry="5" fill="#000" opacity=".35"/>
    <path d="M22 18 C38 14 40 -6 30 -12" stroke="#262626" stroke-width="7" fill="none" stroke-linecap="round"/>
    <ellipse cx="0" cy="14" rx="22" ry="16" fill="#262626"/>
    <path d="M-20 -8 L-18 -30 L-4 -18 Z M20 -8 L18 -30 L4 -18 Z" fill="#262626"/>
    <circle cx="0" cy="-6" r="20" fill="#2c2c2c"/>
    <path d="M-16 -14 L-15 -24 L-8 -18 Z M16 -14 L15 -24 L8 -18 Z" fill="#ff8fb1" opacity=".7"/>
    <ellipse cx="-8" cy="-6" rx="4.5" ry="5.5" style="fill:var(--accent)"/><ellipse cx="8" cy="-6" rx="4.5" ry="5.5" style="fill:var(--accent)"/>
    <ellipse cx="-8" cy="-6" rx="1.6" ry="4.5" fill="#0b0b0b"/><ellipse cx="8" cy="-6" rx="1.6" ry="4.5" fill="#0b0b0b"/>
    <path d="M-2 3 L2 3 L0 5.5 Z" fill="#ff8fb1"/></g>` }),
  pet_owl: p => ({ front: `<g transform="translate(250 234)">
    <ellipse cx="0" cy="30" rx="22" ry="5" fill="#000" opacity=".35"/>
    <path d="M-20 -18 L-14 -32 L-6 -22 Z M20 -18 L14 -32 L6 -22 Z" fill="#8a5a34"/>
    <ellipse cx="0" cy="4" rx="24" ry="27" fill="#a0693d"/>
    <ellipse cx="0" cy="12" rx="15" ry="16" fill="#e8c9a0"/>
    ${[[-6, 6], [6, 6], [0, 14], [-7, 20], [7, 20]].map(([x, y]) => `<path d="M${x - 3} ${y} Q${x} ${y + 4} ${x + 3} ${y}" stroke="#b98b5a" stroke-width="1.8" fill="none"/>`).join("")}
    <circle cx="-10" cy="-8" r="10" fill="#fff6e4"/><circle cx="10" cy="-8" r="10" fill="#fff6e4"/>
    <circle cx="-9" cy="-7" r="5.5" fill="#1b1a19"/><circle cx="11" cy="-7" r="5.5" fill="#1b1a19"/>
    <circle cx="-7" cy="-9" r="1.8" fill="#fff"/><circle cx="13" cy="-9" r="1.8" fill="#fff"/>
    <path d="M-3 0 L3 0 L0 6 Z" fill="#ffb547"/></g>` }),
  pet_ghost: p => ({ front: `<g transform="translate(252 230)" opacity=".92">
    <ellipse cx="0" cy="36" rx="18" ry="4" fill="#000" opacity=".3"/>
    <path d="M-22 26 V-4 C-22 -20 -12 -30 0 -30 C12 -30 22 -20 22 -4 V26 L15 20 L8 27 L0 20 L-8 27 L-15 20 Z" fill="#f4f6ff"/>
    <path d="M-22 26 V-4 C-22 -20 -12 -30 0 -30" fill="none" stroke="#c9d0ff" stroke-width="2"/>
    <ellipse cx="-8" cy="-6" rx="4" ry="6" fill="#2a2a3a"/><ellipse cx="8" cy="-6" rx="4" ry="6" fill="#2a2a3a"/>
    <ellipse cx="0" cy="8" rx="4" ry="5" fill="#2a2a3a"/>
    <ellipse cx="-14" cy="4" rx="4" ry="2.5" fill="#ff8fb1" opacity=".5"/><ellipse cx="14" cy="4" rx="4" ry="2.5" fill="#ff8fb1" opacity=".5"/></g>` }),
  pet_dragon: p => ({ front: `<g transform="translate(246 232)">
    <defs><linearGradient id="${p}dr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b48cff"/><stop offset="1" stop-color="#5a33b8"/></linearGradient></defs>
    <ellipse cx="0" cy="32" rx="26" ry="5" fill="#000" opacity=".35"/>
    <path d="M-10 -2 C-34 -26 -44 -10 -40 6 C-32 -2 -24 2 -14 8 Z" style="fill:var(--accent)" opacity=".85"/>
    <path d="M10 -2 C34 -26 44 -10 40 6 C32 -2 24 2 14 8 Z" style="fill:var(--accent)" opacity=".85"/>
    <path d="M16 22 C34 26 38 10 30 4" stroke="#6b44cc" stroke-width="6" fill="none" stroke-linecap="round"/>
    <ellipse cx="0" cy="14" rx="18" ry="16" fill="url(#${p}dr)"/>
    <ellipse cx="0" cy="18" rx="10" ry="9" fill="#e6dbff" opacity=".6"/>
    <circle cx="0" cy="-10" r="17" fill="url(#${p}dr)"/>
    <path d="M-10 -24 L-14 -36 L-4 -26 Z M10 -24 L14 -36 L4 -26 Z" fill="#ffd257"/>
    <ellipse cx="-6" cy="-11" rx="4" ry="5" fill="#fff"/><ellipse cx="7" cy="-11" rx="4" ry="5" fill="#fff"/>
    <circle cx="-5" cy="-10" r="2.6" fill="#1b1a19"/><circle cx="8" cy="-10" r="2.6" fill="#1b1a19"/>
    <path d="M-4 -1 Q1 2 6 -1" stroke="#2a1660" stroke-width="2" fill="none" stroke-linecap="round"/></g>` }),
};

/** Маленький аватар для боковой панели. */
function renderAvatarMini(eq, stage) {
  return renderCharacter({ ...eq, pet: null, aura: null, stage: Math.min(stage, 2) }).replace("viewBox=\"0 0 300 300\"", 'viewBox="40 40 220 220"');
}
