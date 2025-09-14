export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const { id } = req.query;
    if (!id) throw new Error("Missing team id");

    const fileNames = [`team_${id}.json`, `NHL_team_${id}.json`];

    // teste l’URL publique
    for (const f of fileNames) {
      const url = `${process.env.VERCEL_URL 
        ? "https://" + process.env.VERCEL_URL 
        : "http://localhost:3000"}/teams/${f}`;

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        return res.status(200).json(data);
      }
    }

    throw new Error("Team JSON not found");
  } catch (err) {
    console.error(err);
    res.status(200).json({ error: err.message });
  }
}