// Build Cloudflare Pages : copie public/ dans cf-dist/ pour servir les JSON
// gratuitement depuis Cloudflare (en plus de Vercel).
//   - saute les fichiers de plus de 25 Mio, la limite par fichier de Pages
//     (ex. players_stats.json), en le signalant dans le journal de build ;
//   - ajoute un fichier _headers avec l'en-tête CORS que vercel.json pose
//     côté Vercel, pour que Statzuka puisse lire les JSON ;
//   - génère les aperçus de partage de Statzuka dans og/ (voir og-images.mjs).
//     Un échec n'empêche pas la publication des données. SKIP_OG=1 les saute.
// Réglages Pages : commande `node scripts/cloudflare-pages.mjs`, sortie `cf-dist`.
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { buildOgImages } from "./og-images.mjs"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const SRC = path.join(ROOT, "public")
const OUT = path.join(ROOT, process.argv[2] ?? "cf-dist")
const MAX_BYTES = 25 * 1024 * 1024

fs.rmSync(OUT, { recursive: true, force: true })

let copied = 0
const skipped = []

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true })
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const from = path.join(src, entry.name)
        const to = path.join(dest, entry.name)
        if (entry.isDirectory()) {
            copyDir(from, to)
        } else {
            const size = fs.statSync(from).size
            if (size > MAX_BYTES) {
                skipped.push(`${path.relative(SRC, from)} (${(size / 1048576).toFixed(1)} Mo)`)
                continue
            }
            fs.copyFileSync(from, to)
            copied++
        }
    }
}

copyDir(SRC, OUT)

fs.writeFileSync(
    path.join(OUT, "_headers"),
    ["/*", "  Access-Control-Allow-Origin: *", "  Cache-Control: public, max-age=300", ""].join("\n"),
)

console.log(`✅ ${copied} fichiers copiés dans ${path.relative(ROOT, OUT)}/`)
if (skipped.length) console.log(`⚠️  Ignorés (plus de 25 Mio, limite Cloudflare Pages) : ${skipped.join(", ")}`)

if (process.env.SKIP_OG) {
    console.log("⏭️  Aperçus de partage sautés (SKIP_OG)")
} else {
    try {
        await buildOgImages(SRC, OUT)
    } catch (e) {
        console.log(`⚠️  Aperçus de partage non générés : ${e.message}`)
    }
}
