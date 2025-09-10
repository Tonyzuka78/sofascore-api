import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // Toujours envoyer les headers CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const { id } = req.query;
    if (!id) throw new Error("Missing team id");

    const dataDir = path.join(process.cwd(), 'data');
    const fileNames = [`team_${id}.json`, `NHL_team_${id}.json`];

    // Cherche le fichier existant
    const filePath = fileNames
      .map(f => path.join(dataDir, f))
      .find(fp => fs.existsSync(fp));

    if (!filePath) throw new Error("Team JSON not found");

    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawData);

    res.status(200).json(data);
  } catch (err) {
    console.error(err);
    // Retourne un JSON d’erreur mais toujours avec CORS
    res.status(200).json({ error: err.message });
  }
}
