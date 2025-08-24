// /api/match/[id].js
export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) return res.status(400).json({ error: "Missing match id" });

  try {
    const response = await fetch(`https://www.sofascore.com/api/v1/event/${id}/incidents`, {
      headers: { "User-Agent": "Mozilla/5.0" } // parfois nécessaire
    });

    if (!response.ok) throw new Error(`Sofascore error ${response.status}`);

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    console.error("API error:", err);
    res.status(500).json({ error: "Failed to fetch match incidents", details: err.message });
  }
}
