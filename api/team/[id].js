// /sofascore-api/api/team/[id].js

import fetch from "node-fetch"; // Vercel supporte, sinon utilise global fetch

export default async function handler(req, res) {
  const { id } = req.query; // id = l'équipe

  if (!id) {
    return res.status(400).json({ error: "Missing team id" });
  }

  try {
    // Exemple d'appel à Sofascore (à adapter selon ton script actuel)
    const response = await fetch(`https://api.sofascore.com/api/v1/team/${id}/players`);
    const data = await response.json();

    // Ici tu filtres et renvoies seulement ce qui t’intéresse
    const topScorers = data.players
      .filter(p => p.statistics.goals > 0)
      .sort((a, b) => b.statistics.goals - a.statistics.goals)
      .slice(0, 5);

    res.status(200).json({ teamId: id, topScorers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch team stats" });
  }
}
