"use client";

import { useEffect, useState } from "react";

const categories = [
  "PTS",
  "REB",
  "AST",
  "STL",
  "BLK",
  "3PM",
  "FG%",
  "FT%",
  "A/TO",
];

function normalizeName(name) {
  return (name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.'’\-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function formatDate(dateString) {
  if (!dateString || dateString.length !== 8) return "";

  const month = Number(dateString.slice(4, 6));
  const day = Number(dateString.slice(6, 8));

  return `${month}/${day}`;
}

export default function Home() {
  const [data, setData] = useState(null);
  const [fantasyData, setFantasyData] = useState(null);
  const [category, setCategory] = useState("PTS");
  const [week, setWeek] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fantasyLoading, setFantasyLoading] = useState(true);
  const [error, setError] = useState("");
  const [fantasyError, setFantasyError] = useState("");

  // Load NBA matchup statistics.
  useEffect(() => {
    const controller = new AbortController();

    async function loadLeaders() {
      setLoading(true);
      setError("");
      setData(null);

      try {
        const url =
          week === null
            ? "/api/nba"
            : `/api/nba?week=${week}`;

        const response = await fetch(url, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Could not load NBA statistics");
        }

        const result = await response.json();

        if (result.error) {
          throw new Error(result.error);
        }

        setData(result);

        if (week === null) {
          setWeek(result.currentWeek);
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadLeaders();

    return () => controller.abort();
  }, [week]);

  // Load ESPN fantasy rosters.
  useEffect(() => {
    const controller = new AbortController();

    async function loadFantasyRosters() {
      setFantasyLoading(true);
      setFantasyError("");

      try {
        const response = await fetch("/api/fantasy", {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Could not load Nocioni rosters");
        }

        const result = await response.json();

        if (result.error) {
          throw new Error(result.error);
        }

        setFantasyData(result);
      } catch (err) {
        if (err.name !== "AbortError") {
          setFantasyError(err.message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setFantasyLoading(false);
        }
      }
    }

    loadFantasyRosters();

    return () => controller.abort();
  }, []);

  // Match NBA players to their fantasy owners.
  const ownershipById = new Map();
  const ownershipByName = new Map();

  for (const team of fantasyData?.teams || []) {
    for (const player of team.players || []) {
      if (player.id != null) {
        ownershipById.set(String(player.id), team.name);
      }

      if (player.name && player.name !== "Unknown Player") {
        ownershipByName.set(
          normalizeName(player.name),
          team.name
        );
      }
    }
  }

  function getNocioniTeam(player) {
    if (!fantasyData) return "Unavailable";

    return (
      ownershipById.get(String(player.id)) ||
      ownershipByName.get(normalizeName(player.name)) ||
      "Free Agent"
    );
  }

  const selectedLeaders = data?.leaders?.[category] ?? [];
  const currentWeek = data?.currentWeek ?? 1;

  const matchups = Array.from(
    { length: currentWeek },
    (_, index) => {
      const number = currentWeek - index;

      return {
        value: number,
        label:
          number === currentWeek
            ? `Week ${number} — Current`
            : `Week ${number}`,
      };
    }
  );

  return (
    <main className="nocioni-page">
      {/* COMPACT VINTAGE HEADER */}
      <header className="nocioni-header">
        <div className="nocioni-container nocioni-header-inner">
          <h1 className="sports-display nocioni-brand">
            NOCIONI
          </h1>

          <div className="nocioni-season">
            <div
              className="sports-label"
              style={{
                fontSize: "20px",
                lineHeight: 1,
              }}
            >
              FANTASY
              <br />
              BASKETBALL
            </div>

            <div
              className="sports-label"
              style={{
                display: "inline-block",
                marginTop: "5px",
                background: "#CE1141",
                color: "white",
                padding: "2px 7px",
                fontSize: "21px",
                lineHeight: 1,
              }}
            >
              2026–27
            </div>
          </div>

          <div className="nocioni-tagline">
            THE LEAGUE. THE LEGEND.
            <div
              style={{
                height: "4px",
                background: "#ED174C",
                marginTop: "7px",
              }}
            />
          </div>
        </div>
      </header>

      <div className="nocioni-container nocioni-content">
        {/* MATCHUP LEADERS HEADING */}
        <section className="leaders-heading">
          <img
            src="/nocioni.jpg"
            alt="Andres Nocioni mugshot"
            className="nocioni-mugshot"
          />

          <div className="leaders-heading-copy">
            <div
              className="sports-label"
              style={{
                color: "#ED174C",
                fontSize: "20px",
              }}
            >
              LEAGUE ANALYTICS
            </div>

            <h2 className="sports-display leaders-title">
              TOP DOGS
            </h2>

            <div
              className="sports-label"
              style={{
                color: "#999",
                fontSize: "16px",
                letterSpacing: "0.09em",
              }}
            >
              TOP PERFORMERS ACROSS ALL NINE CATEGORIES
            </div>
          </div>

          <div className="matchup-selector">
            <label
              htmlFor="matchup-select"
              className="sports-label"
              style={{
                display: "block",
                color: "#aaa",
                fontSize: "19px",
                marginBottom: "6px",
              }}
            >
              MATCHUP WEEK
            </label>

            <select
              id="matchup-select"
              className="matchup-select"
              value={week ?? ""}
              disabled={loading}
              onChange={(event) =>
                setWeek(Number(event.target.value))
              }
            >
              {week === null && (
                <option value="">Loading...</option>
              )}

              {matchups.map((matchup) => (
                <option
                  key={matchup.value}
                  value={matchup.value}
                >
                  {matchup.label}
                </option>
              ))}
            </select>

            {data && (
              <div
                className="sports-label"
                style={{
                  color: "#999",
                  fontSize: "14px",
                  marginTop: "7px",
                }}
              >
                {formatDate(data.startDate)} –{" "}
                {formatDate(data.endDate)}
              </div>
            )}
          </div>
        </section>
{/* MOBILE CATEGORY DROPDOWN */}
<div className="mobile-category-selector">
  <label
    htmlFor="mobile-category"
    className="sports-label"
  >
    SELECT STAT CATEGORY
  </label>

  <select
    id="mobile-category"
    className="matchup-select mobile-category-select"
    value={category}
    onChange={(event) => setCategory(event.target.value)}
  >
    {categories.map((item) => (
      <option key={item} value={item}>
        {item}
      </option>
    ))}
  </select>
</div>
        {/* NINE FANTASY CATEGORIES */}
        <nav
          className="category-strip"
          aria-label="Fantasy statistical categories"
        >
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              className={
                "category-button" +
                (category === item ? " active" : "")
              }
              aria-pressed={category === item}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        {loading && (
          <p className="sports-label">
            LOADING MATCHUP STATISTICS...
          </p>
        )}

        {fantasyLoading && (
          <p className="sports-label">
            LOADING NOCIONI ROSTERS...
          </p>
        )}

        {error && (
          <p style={{ color: "#ED174C" }}>{error}</p>
        )}

        {fantasyError && (
          <p style={{ color: "#ED174C" }}>
            Fantasy ownership unavailable: {fantasyError}
          </p>
        )}

        {/* SCOREBOARD LEADERBOARD */}
        {data && !loading && (
          <section className="leaderboard">
            <div className="leaderboard-banner">
              <div
                className="sports-display"
                style={{
                  fontSize: "38px",
                }}
              >
                {category} LEADERS
              </div>

              <div
                className="sports-label"
                style={{
                  fontSize: "20px",
                  whiteSpace: "nowrap",
                }}
              >
                TOP 10 PLAYERS
              </div>
            </div>

            <div className="leaderboard-table-wrap">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>RK</th>
                    <th>PLAYER</th>
                    <th>NBA TEAM</th>
                    <th>NOCIONI TEAM</th>
                    <th>GP</th>
                    <th>{category}</th>
                  </tr>
                </thead>

                <tbody>
                  {selectedLeaders.map((player, index) => (
                    <tr key={player.id}>
                      <td className="rank-cell">
                        {String(index + 1).padStart(2, "0")}
                      </td>

                      <td>{player.name}</td>

                      <td>{player.team}</td>

                      <td className="team-cell">
                        {fantasyLoading
                          ? "Loading..."
                          : getNocioniTeam(player)}
                      </td>

                      <td>{player.gamesPlayed}</td>

                      <td className="stat-cell">
                        {player.display}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedLeaders.length === 0 && (
              <p
                className="sports-label"
                style={{
                  padding: "18px",
                  color: "#aaa",
                }}
              >
                NO QUALIFYING PLAYERS FOUND
              </p>
            )}
          </section>
        )}

        <footer className="nocioni-footer">
          NOCIONI FANTASY BASKETBALL · EST. IN GLORY
        </footer>
      </div>
    </main>
  );
}