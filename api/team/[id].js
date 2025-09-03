import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Missing team id" });

  const dataDir = path.join(process.cwd(), 'data');

  // 🔹 Essayer FOOT d'abord puis NHL
  const fileNames = [`team_${id}.json`, `NHL_team_${id}.json`];
  let filePath = null;

  for (const f of fileNames) {
    const fullPath = path.join(dataDir, f);
    if (fs.existsSync(fullPath)) {
      filePath = fullPath;
      break;
    }
  }

  if (!filePath) {
    return res.status(404).json({ error: 'Team JSON not found' });
  }

  try {
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawData);

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read JSON', details: err.message });
  }
}