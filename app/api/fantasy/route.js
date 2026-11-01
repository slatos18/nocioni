const LEAGUE_ID = "130394";
const SEASON = "2027";

export async function GET() {
  try {
    const url =
      `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${SEASON}/segments/0/leagues/${LEAGUE_ID}?view=mTeam&view=mRoster`;

    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`ESPN returned status ${response.status}`);
    }

    const data = await response.json();

    const teams = (data.teams || []).map((team) => ({
      id: team.id,
      name:
        team.name ||
        `${team.location || ""} ${team.nickname || ""}`.trim() ||
        `Team ${team.id}`,
      players: (team.roster?.entries || []).map((entry) => ({
        id: entry.playerId,
        name: entry.playerPoolEntry?.player?.fullName || "Unknown Player",
      })),
    }));

    return Response.json({
      league: "Nocioni",
      teamCount: teams.length,
      rosteredPlayerCount: teams.reduce(
        (total, team) => total + team.players.length,
        0
      ),
      teams,
    });
  } catch (error) {
    return Response.json(
      {
        error: "Could not retrieve ESPN fantasy rosters",
        details: error.message,
      },
      { status: 500 }
    );
  }
}