import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) return res.status(400).json({ error: "Missing team id" });

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/115.0 Safari/537.36"
    );

    // Récupère l'équipe
    const teamInfo = await page.evaluate(async (teamId) => {
      const res = await fetch(`https://www.sofascore.com/api/v1/team/${teamId}`);
      const data = await res.json();
      return { name: data.team?.name || `Team_${teamId}`, raw: data };
    }, id);

    console.log("Données brutes de l'équipe:", JSON.stringify(teamInfo.raw, null, 2));

    // Récupère les derniers événements
    const events = await page.evaluate(async (teamId) => {
      const res = await fetch(`https://www.sofascore.com/api/v1/team/${teamId}/events/last/0`);
      const data = await res.json();
      return data.events || [];
    }, id);

    console.log("Données brutes des événements:", JSON.stringify(events, null, 2));

    await browser.close();

    res.status(200).json({
      teamId: id,
      teamName: teamInfo.name,
      matches: events, // pour l'instant on renvoie brut pour debug
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch team stats", details: err.message });
  }
}
