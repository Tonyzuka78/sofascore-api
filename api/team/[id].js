// /api/team/[id].js
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) return res.status(400).json({ error: "Missing team id" });

  try {
    // Lance Chromium compatible Vercel
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

    // Récupère le nom de l'équipe
    const teamInfo = await page.evaluate(async (teamId) => {
      const res = await fetch(`https://www.sofascore.com/api/v1/team/${teamId}`);
      const data = await res.json();
      return { name: data.team?.name || `Team_${teamId}` };
    }, id);

    const ONE_YEAR_AGO = Date.now() - 365 * 24 * 60 * 60 * 1000;
let pageNum = 0;
let done = false;
//const MAX_PAGES = 5; // ← on limite à 1 page / 1 match
    const matchesJSON = [];

    while (!done) {
      const events = await page.evaluate(async (teamId, pageNum) => {
        const res = await fetch(`https://www.sofascore.com/api/v1/team/${teamId}/events/last/${pageNum}`);
        const data = await res.json();
        return data.events || [];
      }, id, pageNum);

      if (!events.length) break;

      // Trier du plus récent au plus ancien
      events.sort((a, b) => b.startTimestamp - a.startTimestamp);

      let recentMatchesInPage = 0;

      for (const match of events) {
        const timestamp = match.startTimestamp * 1000;
        if (timestamp < ONE_YEAR_AGO) continue;
        recentMatchesInPage++;

        const matchId = match.id;
        const isHome = match.homeTeam.id === parseInt(id);
        const opponent = isHome ? match.awayTeam : match.homeTeam;
        const homeAway = isHome ? "Home" : "Away";
        const date = new Date(timestamp).toISOString().split("T")[0];
        const teamScore = isHome ? match.homeScore?.current ?? 0 : match.awayScore?.current ?? 0;
        const oppScore = isHome ? match.awayScore?.current ?? 0 : match.homeScore?.current ?? 0;
        let result = "DRAW";
        if (teamScore > oppScore) result = "WIN";
        else if (teamScore < oppScore) result = "LOOSE";

        // Récupère incidents et lineup
        const [incidents, lineup] = await Promise.all([
          page.evaluate(async (matchId) => {
            const res = await fetch(`https://www.sofascore.com/api/v1/event/${matchId}/incidents`);
            const data = await res.json();
            return data.incidents || [];
          }, matchId),
          page.evaluate(async (matchId) => {
            const res = await fetch(`https://www.sofascore.com/api/v1/event/${matchId}/lineups`);
            return (await res.json()) || {};
          }, matchId),
        ]);

        // Filtre buts de l'équipe
        const goals = incidents.filter(
          (i) =>
            i.incidentType === "goal" &&
            !i.isOwnGoal &&
            ((i.isHome && isHome) || (!i.isHome && !isHome))
        );

        const goalMap = {};
        for (const g of goals) {
          const player = g.player?.name?.replace(/,/g, "") || "";
          const assist = g.assist1?.name?.replace(/,/g, "") || "";
          const minute = g.time || "";
          const goalType = g.incidentClass === "penalty" ? "penalty" : "regular";

          if (player) {
            goalMap[player] = goalMap[player] || { goal: 0, assist: 0, minute, goalType: "regular" };
            goalMap[player].goal += 1;
            if (goalType === "penalty") goalMap[player].goalType = "penalty";
          }
          if (assist) {
            goalMap[assist] = goalMap[assist] || { goal: 0, assist: 0, minute };
            goalMap[assist].assist += 1;
          }
        }

        // Récupère lineup de l'équipe
        const teamLineup = isHome ? lineup.home?.players ?? [] : lineup.away?.players ?? [];
        const players = teamLineup.map((p) => {
          const name = p.player?.name?.replace(/,/g, "") || "Inconnu";
          const { goal = 0, assist = 0, minute = "" , goalType} = goalMap[name] || {};
          return { name, goal, assist, minute, goalType };
        });

        matchesJSON.push({
          matchId,
          date,
          opponent: opponent.name,
          homeAway,
          result,
          teamScore,
          oppScore,
          players,
        });
      }

      if (recentMatchesInPage === 0) done = true;
      else pageNum++;
  	//if (pageNum >= MAX_PAGES) done = true; // ← stoppe après 1 page
    }

    await browser.close();

    res.status(200).json({
      teamId: id,
      teamName: teamInfo.name,
      matches: matchesJSON,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch team stats", details: err.message });
  }
}
