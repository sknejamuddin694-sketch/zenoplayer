import { describe, expect, it } from "vitest";
import { audioLanguages, seriesSeasons } from "./playback";

describe("Playback selection", () => {
  it("plays movie resources at season 0 instead of S1 E1", () => {
    expect(seriesSeasons([{ season: 0, episode_count: 1 }])).toEqual([]);
    expect(seriesSeasons([{ season: 1, episode_count: 12 }])).toEqual([{ season: 1, episode_count: 12 }]);
  });
  it("offers Hindi and English audio using their own provider IDs", () => {
    const options = audioLanguages([
      { subjectId: "200", detailPath: "movie-hindi", lanName: "Hindi" },
      { subjectId: "100", detailPath: "movie", lanName: "English" },
    ], "100", "movie");
    expect(options.find((d) => d.lanName === "Hindi")).toEqual({ subjectId: "200", detailPath: "movie-hindi", lanName: "Hindi" });
    expect(options.find((d) => d.subjectId === "100")?.lanName).toBe("English");
  });
});