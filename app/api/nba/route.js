const SEASON_START = "2026-10-19";

const categories = {
  PTS: { field: "points" },
  REB: { field: "rebounds" },
  AST: { field: "assists" },
  STL: { field: "steals" },
  BLK: { field: "blocks" },
  "3PM": { field: "threes" },
  "FG%": { minimum: 10, attempts: "fgAttempts" },
  "FT%": { minimum: 10, attempts: "ftAttempts" },
  "A/TO": { minimum: 10, assists: "assists" },
};

function formatDate(date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function parseShooting(value) {
  const [made, attempted] = String(value ?? "0-0")
    .split("-")
    .map(Number);

  return [
    Number.isFinite(made) ? made : 0,
    Number.isFinite(attempted) ? attempted : 0,
  ];
}

function emptyPlayer(id, name, team) {
  return {
    id,
    name,
    team,
    gamesPlayed: 0,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    threes: 0,
    fgMade: 0,
    fgAttempts: 0,
    ftMade: 0,
    ftAttempts: 0,
    turnovers: 0,
  };
}

function valueFor(player, category) {
  switch (category) {
    case "FG%":
      return player.fgAttempts
        ? player.fgMade / player.fgAttempts
        : 0;

    case "FT%":
      return player.ftAttempts
        ? player.ftMade / player.ftAttempts
        : 0;

    case "A/TO":
      return player.turnovers === 0
        ? Infinity
        : player.assists / player.turnovers;

    default:
      return player[categories[category].field];
  }
}

function leadersFor(allPlayers, category) {
  const rule = categories[category];

  return allPlayers
    .filter((player) => {
      if (category === "FG%" || category === "FT%") {
        return player[rule.attempts] >= rule.minimum;
      }

      if (category === "A/TO") {
        return player.assists >= rule.minimum;
      }

      return true;
    })
    .sort((a, b) => {
      const aValue = valueFor(a, category);
      const bValue = valueFor(b, category);

      if (aValue !== bValue) {
        return bValue - aValue;
      }

      if (category === "FG%" || category === "FT%") {
        return b[rule.attempts] - a[rule.attempts];
      }

      if (category === "A/TO") {
        return b.assists - a.assists;
      }

      return a.name.localeCompare(b.name);
    })
    .slice(0, 10)
    .map((player) => {
      const value = valueFor(player, category);
      let display;

      if (category === "FG%") {
        display =
          `${(value * 100).toFixed(1)}% ` +
          `(${player.fgMade}/${player.fgAttempts})`;
      } else if (category === "FT%") {
        display =
          `${(value * 100).toFixed(1)}% ` +
          `(${player.ftMade}/${player.ftAttempts})`;
      } else if (category === "A/TO") {
        display =
          `${value === Infinity ? "∞" : value.toFixed(2)} ` +
          `(${player.assists} AST / ${player.turnovers} TO)`;
      } else {
        display = String(value);
      }

      return {
        id: player.id,
        name: player.name,
        team: player.team,
        gamesPlayed: player.gamesPlayed,
        value: Number.isFinite(value) ? value : null,
        display,
      };
    });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Current calendar date in Eastern Time.
    const easternToday = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const today = new Date(`${easternToday}T00:00:00Z`);
    const seasonStart = new Date(`${SEASON_START}T00:00:00Z`);

    const millisecondsPerWeek = 7 * 24 * 60 * 60 * 1000;

    const currentWeek = Math.max(
      1,
      Math.floor((today - seasonStart) / millisecondsPerWeek) + 1
    );

    const requestedWeek = Number(
      searchParams.get("week") ?? currentWeek
    );

    if (
      !Number.isInteger(requestedWeek) ||
      requestedWeek < 1 ||
      requestedWeek > currentWeek
    ) {
      return Response.json(
        { error: "Invalid matchup selection" },
        { status: 400 }
      );
    }

    // Calculate the selected matchup's Monday and Sunday.
    const monday = new Date(seasonStart);
    monday.setUTCDate(
      monday.getUTCDate() + (requestedWeek - 1) * 7
    );

    const sunday = new Date(monday);
    sunday.setUTCDate(sunday.getUTCDate() + 6);

    // Only fetch days that have already occurred.
    const finalDate =
      requestedWeek === currentWeek ? today : sunday;

    const dates = [];

    for (
      let date = new Date(monday);
      date <= finalDate;
      date.setUTCDate(date.getUTCDate() + 1)
    ) {
      dates.push(formatDate(date));
    }

    // Fetch NBA schedules for the selected week.
    const scoreboards = await Promise.all(
      dates.map(async (date) => {
        const response = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${date}&limit=100`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error(`Could not load NBA schedule for ${date}`);
        }

        return response.json();
      })
    );

    const gameMap = new Map();

    for (const scoreboard of scoreboards) {
      for (const game of scoreboard.events ?? []) {
        gameMap.set(game.id, game);
      }
    }

    const games = [...gameMap.values()].filter(
      (game) => game.status?.type?.completed === true
    );

    const boxscores = await Promise.all(
      games.map(async (game) => {
        const response = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${game.id}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error(`Could not load box score ${game.id}`);
        }

        return response.json();
      })
    );

    const players = new Map();

    for (const boxscore of boxscores) {
      for (const team of boxscore.boxscore?.players ?? []) {
        for (const group of team.statistics ?? []) {
          const labels = group.labels ?? [];

          function stat(athlete, label) {
            const index = labels.indexOf(label);
            if (index === -1) return 0;
            return Number(athlete.stats?.[index]) || 0;
          }

          function shooting(athlete, label) {
            const index = labels.indexOf(label);
            if (index === -1) return [0, 0];
            return parseShooting(athlete.stats?.[index]);
          }

          for (const athlete of group.athletes ?? []) {
            if (athlete.didNotPlay) continue;

            const id = athlete.athlete?.id;
            if (!id) continue;

            const player =
              players.get(id) ??
              emptyPlayer(
                id,
                athlete.athlete?.displayName ?? "Unknown",
                team.team?.abbreviation ?? ""
              );

            const [fgMade, fgAttempts] = shooting(athlete, "FG");
            const [ftMade, ftAttempts] = shooting(athlete, "FT");
            const [threesMade] = shooting(athlete, "3PT");

            player.gamesPlayed += 1;
            player.points += stat(athlete, "PTS");
            player.rebounds += stat(athlete, "REB");
            player.assists += stat(athlete, "AST");
            player.steals += stat(athlete, "STL");
            player.blocks += stat(athlete, "BLK");

            player.threes += labels.includes("3PT")
              ? threesMade
              : stat(athlete, "3PM");

            player.turnovers += stat(athlete, "TO");

            player.fgMade += fgMade;
            player.fgAttempts += fgAttempts;
            player.ftMade += ftMade;
            player.ftAttempts += ftAttempts;

            players.set(id, player);
          }
        }
      }
    }

    const allPlayers = [...players.values()];
    const leaders = {};

    for (const category of Object.keys(categories)) {
      leaders[category] = leadersFor(allPlayers, category);
    }

    return Response.json({
      period:
        requestedWeek === currentWeek
          ? `Week ${requestedWeek} — Current`
          : `Week ${requestedWeek}`,
      week: requestedWeek,
      currentWeek,
      startDate: formatDate(monday),
      endDate: formatDate(sunday),
      leaders,
    });
  } catch (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}