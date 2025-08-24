// /sofascore-api/api/match/[id].js

export default async function handler(req, res) {
  const { id } = req.query; // id = matchId

  if (!id) {
    return res.status(400).json({ error: "Missing match id" });
  }

  try {
    const response = await fetch(`https://www.sofascore.com/api/v1/event/${id}/incidents`);
    
    if (!response.ok) {
      throw new Error(`Sofascore error ${response.status}`);
    }

    const data = await response.json();

    // Ici tu peux filtrer/transformer ce que tu veux
    // Exemple : ne garder que les buts
    const goals = (data.incidents || []).filter(i => i.incidentType === "goal");

    res.status(200).json({
      matchId: id,
      goals,
    });
  } catch (err) {
    console.error("Error fetching incidents:", err);
    res.status(500).json({ error: "Failed to fetch match incidents" });
  }
}
