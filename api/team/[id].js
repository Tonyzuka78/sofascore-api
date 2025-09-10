import fs from "fs/promises";
import path from "path";

export default async function handler(req, res) {
  const { id } = req.query;

  try {
    let filePath;

    if (id.startsWith("NHL_")) {
      // Cas NHL → fichier : NHL_team_1234.json
      const cleanId = id.replace("NHL_", "");
      filePath = path.join(process.cwd(), "data", `NHL_team_${cleanId}.json`);
    } else {
      // Cas FOOT → fichier : team_4700.json
      filePath = path.join(process.cwd(), "data", `team_${id}.json`);
    }

    const fileData = await fs.readFile(filePath, "utf-8");
    res.status(200).json(JSON.parse(fileData));
  } catch (err) {
    console.error("❌ Erreur lecture fichier:", err.message);
    res.status(404).json({ error: "File not found" });
  }
}
