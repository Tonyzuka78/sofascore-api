// Aperçus de partage de Statzuka (WhatsApp, X, Discord…) : une image PNG
// 1200×630 et un petit JSON {title, description, image} par match à venir et
// par joueur, écrits dans <sortie>/og/. Le site les lit avec une fonction
// Cloudflare qui place ces infos dans les balises og:* de la page.
//
// Les calculs (forme sur N matchs, adresse « slug » des joueurs) reprennent
// ceux du site (statzuka/src/lib/stats.ts et data.ts) : les garder alignés.
import fs from "fs"
import path from "path"
import { createRequire } from "module"
import satori from "satori"
import { Resvg } from "@resvg/resvg-js"

const require = createRequire(import.meta.url)
const SITE = "statzuka.pages.dev"
const W = 1200
const H = 630

const SPORTS = {
    foot: { tag: "FOOT", label: "Foot", fusionFile: "team_fusion.json" },
    nhl: { tag: "NHL", label: "NHL", fusionFile: "team_fusion_NHL.json" },
}

const C = {
    bg: "#0b1320",
    panel: "#141f33",
    line: "#24324d",
    text: "#f4f6fb",
    muted: "#93a1bd",
    accent: "#ff4d1a",
    assist: "#5b8cff",
    win: "#16a34a",
    draw: "#64748b",
    loss: "#dc2626",
}

// ─── Polices ────────────────────────────────────────────────────────────────

function fontFile(pkg, file) {
    return fs.readFileSync(path.join(path.dirname(require.resolve(`${pkg}/package.json`)), "files", file))
}

function loadFonts() {
    const fonts = []
    const add = (name, pkg, prefix, weight) => {
        for (const subset of ["latin", "latin-ext"]) {
            fonts.push({ name, weight, style: "normal", data: fontFile(pkg, `${prefix}-${subset}-${weight}-normal.woff`) })
        }
    }
    add("Big Shoulders", "@fontsource/big-shoulders-display", "big-shoulders-display", 800)
    add("Big Shoulders", "@fontsource/big-shoulders-display", "big-shoulders-display", 900)
    add("Public Sans", "@fontsource/public-sans", "public-sans", 400)
    add("Public Sans", "@fontsource/public-sans", "public-sans", 600)
    add("Public Sans", "@fontsource/public-sans", "public-sans", 700)
    return fonts
}

// ─── Données (mêmes règles que le site) ─────────────────────────────────────

// "dd/mm/yyyy hh:mm[:ss]" → nombre comparable (sans fuseau horaire)
function dateKey(s) {
    const [d, t = "00:00"] = String(s ?? "").trim().split(" ")
    const [day, month, year] = d.split("/").map(Number)
    const [h = 0, m = 0, sec = 0] = t.split(":").map(Number)
    if (!day || !month || !year) return 0
    return Date.UTC(year, month - 1, day, h, m, sec)
}

const WEEKDAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."]

// "28/10/2026 01:00" → "mer. 28/10 · 01:00" (heure de Paris, comme dans le fichier)
function kickoff(s) {
    const k = dateKey(s)
    if (!k) return s ?? ""
    const [d, t = ""] = s.trim().split(" ")
    const [day, month] = d.split("/")
    return `${WEEKDAYS[new Date(k).getUTCDay()]} ${day}/${month}${t ? ` · ${t.slice(0, 5)}` : ""}`
}

export function slugify(name) {
    return name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
}

const sortedLines = (data) => Object.values(data ?? {}).sort((a, b) => dateKey(b.date) - dateKey(a.date))

function summarize(p, lastN) {
    const lines = sortedLines(p.matchData).slice(0, lastN)
    const played = lines.filter((l) => l.played)
    const goals = played.reduce((s, l) => s + (l.goal ?? 0), 0)
    const assists = played.reduce((s, l) => s + (l.assist ?? 0), 0)
    return {
        name: p.player,
        teamId: p.teamId,
        teamName: p.teamName,
        games: lines.length,
        played: played.length,
        goals,
        assists,
        points: goals + assists,
        form: lines.map((l) => (l.played ? { goal: l.goal ?? 0, assist: l.assist ?? 0 } : null)),
    }
}

// Derniers résultats d'une équipe, pris dans la plus grande grille de ses joueurs.
function teamResults(rows, n) {
    let ref = null
    for (const r of rows) if (!ref || Object.keys(r.matchData ?? {}).length > Object.keys(ref.matchData ?? {}).length) ref = r
    if (!ref) return []
    return sortedLines(ref.matchData)
        .filter((l) => l.teamScore != null && l.oppScore != null)
        .slice(0, n)
        .map((l) => ({ r: l.teamScore > l.oppScore ? "V" : l.teamScore < l.oppScore ? "D" : "N", score: `${l.teamScore}-${l.oppScore}` }))
}

const plural = (n, word) => `${n} ${word}${n > 1 ? "s" : ""}`

// ─── Mise en page (objets lus par satori, façon JSX) ───────────────────────

function h(type, style, ...children) {
    const kids = children.flat().filter((c) => c !== null && c !== undefined && c !== false)
    return { type, props: { style: { display: "flex", ...style }, children: kids.length === 1 ? kids[0] : kids } }
}

const text = (s, style) => h("div", style, String(s))

function frame(rightLabel, showAbsent, ...content) {
    return h(
        "div",
        { width: W, height: H, flexDirection: "column", background: C.bg, color: C.text, fontFamily: "Public Sans" },
        h("div", { height: 10, background: C.accent }),
        h(
            "div",
            { flexDirection: "column", flexGrow: 1, padding: "34px 56px 30px" },
            h(
                "div",
                { alignItems: "center", justifyContent: "space-between" },
                h(
                    "div",
                    { alignItems: "center", gap: 14 },
                    h(
                        "div",
                        { width: 46, height: 46, borderRadius: 8, background: C.accent, alignItems: "center", justifyContent: "center", fontFamily: "Big Shoulders", fontWeight: 900, fontSize: 34, color: "#fff" },
                        "S",
                    ),
                    text("STATZUKA", { fontFamily: "Big Shoulders", fontWeight: 900, fontSize: 36, letterSpacing: 1 }),
                ),
                text(rightLabel, { fontSize: 24, color: C.muted, fontWeight: 600 }),
            ),
            h("div", { flexDirection: "column", flexGrow: 1 }, ...content),
            h(
                "div",
                { justifyContent: "space-between", alignItems: "center", fontSize: 22, color: C.muted },
                h("div", { gap: 18, alignItems: "center" }, legendItem(C.accent, showAbsent ? "B = but" : "but"), legendItem(C.assist, showAbsent ? "P = passe" : "passe"), showAbsent && legendItem("#3a4660", "n'a pas joué")),
                text(SITE, { fontWeight: 600, color: C.text }),
            ),
        ),
    )
}

function legendItem(color, label) {
    return h("div", { alignItems: "center", gap: 8 }, h("div", { width: 18, height: 18, borderRadius: 4, background: color }), label)
}

function bigTitle(s, max) {
    const size = s.length > max * 1.5 ? 54 : s.length > max ? 64 : 80
    return text(s.toUpperCase(), { fontFamily: "Big Shoulders", fontWeight: 900, fontSize: size, lineHeight: 1, marginTop: 26 })
}

function statPair(goals, assists, size) {
    const one = (n, word, color) =>
        h(
            "div",
            { flexDirection: "column", alignItems: "center", minWidth: size * 1.6 },
            text(n, { fontFamily: "Big Shoulders", fontWeight: 900, fontSize: size, lineHeight: 1, color }),
            text(n > 1 ? `${word}S` : word, { fontSize: size * 0.3, fontWeight: 700, color: C.muted, letterSpacing: 1 }),
        )
    return h("div", { gap: size * 0.25 }, one(goals, "BUT", C.accent), one(assists, "PASSE", C.assist))
}

// Forme comme sur le site : une colonne par match, ligne B = buts (orange),
// ligne P = passes (bleu), nombre exact dans la case ; grisé = n'a pas joué.
function formDots(form, size) {
    const base = { width: size, height: size, borderRadius: size * 0.22, alignItems: "center", justifyContent: "center", fontSize: size * 0.52, fontWeight: 700, color: "#fff" }
    const row = (kind, label, color) =>
        h(
            "div",
            { gap: size * 0.22, alignItems: "center" },
            text(label, { width: size * 0.6, fontSize: size * 0.5, fontWeight: 700, color }),
            form.map((g) => {
                if (!g) return h("div", { ...base, background: "#3a4660" })
                const n = kind === "goal" ? g.goal : g.assist
                if (n === 0) return h("div", { ...base, background: C.panel, border: `2px solid ${C.line}` })
                return h("div", { ...base, background: color }, String(n))
            }),
        )
    return h("div", { flexDirection: "column", gap: size * 0.18 }, row("goal", "B", C.accent), row("assist", "P", C.assist))
}

function resultChips(results) {
    const color = { V: C.win, N: C.draw, D: C.loss }
    return h(
        "div",
        { gap: 8 },
        results.map((x) =>
            h(
                "div",
                { alignItems: "center", gap: 6, padding: "4px 10px 4px 4px", borderRadius: 8, background: C.panel, fontSize: 20, fontWeight: 600 },
                text(x.r, { width: 28, height: 28, borderRadius: 6, background: color[x.r], alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700 }),
                x.score,
            ),
        ),
    )
}

function teamColumn(team, players, results) {
    return h(
        "div",
        { flexDirection: "column", flex: 1, gap: 12, background: C.panel, borderRadius: 16, padding: "20px 24px", minWidth: 0 },
        text(team.toUpperCase(), { fontFamily: "Big Shoulders", fontWeight: 800, fontSize: 30, lineHeight: 1 }),
        results.length ? resultChips(results) : null,
        players.length
            ? players.map((p) =>
                  h(
                      "div",
                      { alignItems: "center", justifyContent: "space-between", gap: 12 },
                      text(p.name, { fontSize: 26, fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", flexShrink: 1 }),
                      statPair(p.goals, p.assists, 34),
                  ),
              )
            : text("Pas encore de statistiques joueurs", { fontSize: 22, color: C.muted }),
    )
}

// ─── Cartes ─────────────────────────────────────────────────────────────────

const MATCH_FORM_GAMES = 5
const MATCH_PLAYERS = 3
const PLAYER_FORM_GAMES = 10

function topPlayers(rows) {
    return rows
        .map((r) => summarize(r, MATCH_FORM_GAMES))
        .filter((s) => s.played > 0 && s.points > 0)
        .sort((a, b) => b.points - a.points || b.goals - a.goals || a.name.localeCompare(b.name))
        .slice(0, MATCH_PLAYERS)
}

function matchCard(sport, m, rowsByTeam) {
    const home = rowsByTeam.get(m.homeId) ?? []
    const away = rowsByTeam.get(m.awayId) ?? []
    const homeTop = topPlayers(home)
    const awayTop = topPlayers(away)
    const title = `${m.homeTeam} – ${m.awayTeam}`
    const tree = frame(
        [...new Set([SPORTS[sport].label, m.league.trim()])].join(" · ") + ` · ${kickoff(m.date)}`,
        false,
        bigTitle(title, 30),
        text(`En forme sur les ${MATCH_FORM_GAMES} derniers matchs`, { fontSize: 22, color: C.muted, marginTop: 10, marginBottom: 14 }),
        h(
            "div",
            { gap: 20, flexGrow: 1, marginBottom: 18 },
            teamColumn(m.homeTeam, homeTop, teamResults(home, MATCH_FORM_GAMES)),
            teamColumn(m.awayTeam, awayTop, teamResults(away, MATCH_FORM_GAMES)),
        ),
    )
    const names = [...homeTop, ...awayTop].slice(0, 4).map((p) => `${p.name} (${plural(p.goals, "but")}, ${plural(p.assists, "passe")})`)
    return {
        tree,
        meta: {
            title: `${title} : joueurs en forme | Statzuka`,
            description:
                `${m.league.trim()}, ${kickoff(m.date)}. Forme des deux équipes et joueurs en forme sur les ${MATCH_FORM_GAMES} derniers matchs` +
                (names.length ? ` : ${names.join(", ")}.` : "."),
        },
    }
}

function playerCard(sport, row, next) {
    const s = summarize(row, PLAYER_FORM_GAMES)
    const box = (value, label, color) =>
        h(
            "div",
            { flexDirection: "column", background: C.panel, borderRadius: 16, padding: "10px 28px", minWidth: 210 },
            text(value, { fontFamily: "Big Shoulders", fontWeight: 900, fontSize: 80, lineHeight: 1, color }),
            text(label, { fontSize: 24, fontWeight: 700, color: C.muted }),
        )
    const tree = frame(
        `${SPORTS[sport].label} · ${row.teamName}`,
        true,
        bigTitle(row.player, 22),
        text(`Sur les ${s.games} derniers matchs de ${row.teamName}`, { fontSize: 24, color: C.muted, marginTop: 10, marginBottom: 20 }),
        h(
            "div",
            { gap: 20 },
            box(s.goals, s.goals > 1 ? "buts" : "but", C.accent),
            box(s.assists, s.assists > 1 ? "passes" : "passe", C.assist),
            box(s.played, "matchs joués", C.text),
        ),
        h(
            "div",
            { flexDirection: "column", gap: 8, marginTop: 16, marginBottom: 14, flexGrow: 1 },
            text("Forme, du plus récent au plus ancien", { fontSize: 20, color: C.muted, fontWeight: 600 }),
            formDots(s.form, 38),
        ),
        next ? text(`Prochain match : ${next.homeTeam} – ${next.awayTeam} · ${kickoff(next.date)}`, { fontSize: 24, fontWeight: 600, marginBottom: 16 }) : null,
    )
    return {
        tree,
        meta: {
            title: `${row.player} (${row.teamName}) : buts et passes | Statzuka`,
            description:
                `${plural(s.goals, "but")} et ${plural(s.assists, "passe")} sur les ${s.games} derniers matchs de ${row.teamName} (${s.played} joués).` +
                (next ? ` Prochain match : ${next.homeTeam} – ${next.awayTeam}, ${kickoff(next.date)}.` : ""),
        },
    }
}

// ─── Génération ─────────────────────────────────────────────────────────────

async function render(tree, fonts) {
    const svg = await satori(tree, { width: W, height: H, fonts })
    return new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng()
}

function readJson(file) {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null
}

// srcDir : dossier des JSON (public/) ; outDir : dossier publié (cf-dist/).
export async function buildOgImages(srcDir, outDir, { onlyPlayers = Infinity } = {}) {
    const started = Date.now()
    const fonts = loadFonts()
    const matches = readJson(path.join(srcDir, "matches.json")) ?? []
    let count = 0
    let failed = 0

    async function write(rel, card) {
        try {
            const png = await render(card.tree, fonts)
            const file = path.join(outDir, "og", rel)
            fs.mkdirSync(path.dirname(file), { recursive: true })
            fs.writeFileSync(`${file}.png`, png)
            fs.writeFileSync(`${file}.json`, JSON.stringify({ ...card.meta, image: `og/${rel}.png` }))
            count++
        } catch (e) {
            failed++
            if (failed <= 5) console.log(`   ⚠️  Aperçu ${rel} : ${e.message}`)
        }
    }

    for (const [sport, cfg] of Object.entries(SPORTS)) {
        const rows = readJson(path.join(srcDir, cfg.fusionFile)) ?? []
        const rowsByTeam = new Map()
        for (const r of rows) {
            if (!rowsByTeam.has(r.teamId)) rowsByTeam.set(r.teamId, [])
            rowsByTeam.get(r.teamId).push(r)
        }
        const sportMatches = matches.filter((m) => m.sport === cfg.tag).sort((a, b) => dateKey(a.date) - dateKey(b.date))

        for (const m of sportMatches) await write(`${sport}/match/${m.matchId}`, matchCard(sport, m, rowsByTeam))

        let done = 0
        for (const r of rows) {
            if (done >= onlyPlayers) break
            // Pas d'image pour qui n'a joué aucun des derniers matchs : le site
            // garde alors l'aperçu général.
            if (summarize(r, PLAYER_FORM_GAMES).played === 0) continue
            const next = sportMatches.find((m) => m.homeId === r.teamId || m.awayId === r.teamId)
            await write(`${sport}/joueur/${r.teamId}/${slugify(r.player)}`, playerCard(sport, r, next))
            done++
        }
    }

    console.log(`🖼️  ${count} aperçus de partage générés en ${((Date.now() - started) / 1000).toFixed(0)} s` + (failed ? ` (${failed} en échec)` : ""))
}
