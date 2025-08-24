import fs from 'fs';
import path from 'path';


export default function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing team id' });

  const filePath = path.join(process.cwd(), 'data', `team_${id}.json`);

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Team JSON not found' });
    }

    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawData);

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read JSON', details: err.message });
  }
}
