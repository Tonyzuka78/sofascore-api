// /api/team/[id].js
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

    // Récupère infos équipe
    const teamInfo = await page.evaluate(async (teamId) => {
      const res = await fetch(`https://www.sofascore.com/api/v1/team/${teamId}`);
      const data = await res.json();
      return { name: data.team?.name || `Team_${teamId}` };
    }, id);

    // Récupère les derniers événements (matches)
    const events = await page.evaluate(async (teamId) => {
      const res = await fetch(`https://www.sofascore.com/api/v1/team/${teamId}/events/last/0`);
      const data = await res.json();
      return data.events || [];
    }, id);

    const matchesJSON = [];

    for (const match of events) {
      const matchId = match.id;
      const isHome = match.homeTeam.id === parseInt(id);
      const opponent = isHome ? match.awayTeam : match.homeTeam;
      const homeAway = isHome ? "Home" : "Away";

      // Incidents & lineup
      const [incidents, lineup] = await Promise.all([
        page.evaluate(async (matchId) => {
          const res = await fetch(`https://www.sofascore.com/api/v1/event/${matchId}/incidents`);
          return (await res.json()).incidents || [];
        }, matchId),
        page.evaluate(async (matchId) => {
          const res = await fetch(`https://www.sofascore.com/api/v1/event/${matchId}/lineups`);
          return (await res.json()) || {};
        }, matchId),
      ]);

      const goals = incidents.filter(
        i => i.incidentType === "goal" && !i.isOwnGoal && ((i.isHome && isHome) || (!i.isHome && !isHome))
      );

      const goalMap = {};
      for (const g of goals) {
        const player = g.player?.name?.replace(/,/g, "") || "";
        const assist = g.assist1?.name?.replace(/,/g, "") || "";
        const goalType = g.incidentClass === "penalty" ? "penalty" : "regular";

        if (player) {
          goalMap[player] = goalMap[player] || { goal: 0, assist: 0, goalType };
          goalMap[player].goal += 1;
        }
        if (assist) {
          goalMap[assist] = goalMap[assist] || { goal: 0, assist: 0 };
          goalMap[assist].assist += 1;
        }
      }

      const teamLineup = isHome ? lineup.home?.players ?? [] : lineup.away?.players ?? [];
      const players = teamLineup.map(p => {
        const name = p.player?.name?.replace(/,/g, "") || "Inconnu";
        const { goal = 0, assist = 0, goalType = "regular" } = goalMap[name] || {};
        return { name, goal, assist, goalType };
      });

      matchesJSON.push({
        matchId,
        date: new Date(match.startTimestamp * 1000).toISOString().split("T")[0],
        opponent: opponent.name,
        homeAway,
        teamScore: isHome ? match.homeScore?.current ?? 0 : match.awayScore?.current ?? 0,
        oppScore: isHome ? match.awayScore?.current ?? 0 : match.homeScore?.current ?? 0,
        players
      });
    }

    await browser.close();

    res.status(200).json({ teamId: id, teamName: teamInfo.name, matches: matchesJSON });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch team stats", details: err.message });
  }
}
