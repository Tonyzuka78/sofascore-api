export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) return res.status(400).json({ error: "Missing match id" });

  try {
    const response = await fetch(`https://www.sofascore.com/api/v1/event/${id}/incidents`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/115.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.sofascore.com/"
      }
    });

    if (!response.ok) throw new Error(`Sofascore error ${response.status}`);

    const data = await response.json();

    // On peut filtrer les buts uniquement
    const goals = (data.incidents || []).filter(i => i.incidentType === "goal");

    res.status(200).json({ matchId: id, goals });
  } catch (err) {
    console.error("API error:", err);
    res.status(500).json({ error: "Failed to fetch match incidents", details: err.message });
  }
}
