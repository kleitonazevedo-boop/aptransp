import { beforeEach, describe, expect, it, vi } from "vitest";
import { gtfsRepository } from "@/repositories/gtfsRepository";
import { connectivityService } from "@/services/connectivityService";
import { queryNearbyTransit, NearbyDataError } from "@/services/nearbyTransitService";

vi.mock("@/repositories/gtfsRepository", () => ({
  gtfsRepository: {
    validateDataset: vi.fn(),
    nearbyStops: vi.fn(),
    nearbyLines: vi.fn(),
  },
}));

describe("local GTFS nearby query", () => {
  beforeEach(() => vi.resetAllMocks());

  it("queries stops and lines from local SQLite while offline", async () => {
    vi.spyOn(connectivityService, "isOnline").mockReturnValue(false);
    vi.mocked(gtfsRepository.validateDataset).mockResolvedValue({ valid: true } as never);
    vi.mocked(gtfsRepository.nearbyStops).mockResolvedValue([{ stop_id: "s1" }] as never);
    vi.mocked(gtfsRepository.nearbyLines).mockResolvedValue([{ route_id: "r1" }] as never);

    const result = await queryNearbyTransit({ latitude: -23.5, longitude: -46.6 }, "lines");

    expect(result.lines).toHaveLength(1);
    expect(gtfsRepository.validateDataset).toHaveBeenCalledOnce();
    expect(gtfsRepository.nearbyStops).toHaveBeenCalledWith(-23.5, -46.6, 1000);
    expect(gtfsRepository.nearbyLines).toHaveBeenCalledWith(-23.5, -46.6, 1000, 40, [{ stop_id: "s1" }]);
  });

  it("does not convert invalid coordinates into an empty nearby result", async () => {
    await expect(queryNearbyTransit({ latitude: Number.NaN, longitude: -46.6 }, "lines"))
      .rejects.toMatchObject({ code: "INVALID_LOCATION" });
    expect(gtfsRepository.validateDataset).not.toHaveBeenCalled();
    expect(gtfsRepository.nearbyLines).not.toHaveBeenCalled();
  });

  it("keeps a valid dataset distinct from a real zero-result nearby search", async () => {
    vi.mocked(gtfsRepository.validateDataset).mockResolvedValue({ valid: true, status: "valid" } as never);
    vi.mocked(gtfsRepository.nearbyStops).mockResolvedValue([] as never);

    await expect(queryNearbyTransit({ latitude: -23.5, longitude: -46.6 }, "stops"))
      .resolves.toMatchObject({ stops: [], lines: [] });
  });

  it("reports an absent or invalid snapshot distinctly", async () => {
    vi.mocked(gtfsRepository.validateDataset).mockResolvedValue({ valid: false, status: "missing" } as never);
    await expect(queryNearbyTransit({ latitude: -23.5, longitude: -46.6 }, "lines"))
      .rejects.toMatchObject({ code: "GTFS_NOT_INSTALLED" } satisfies Partial<NearbyDataError>);
    expect(gtfsRepository.nearbyStops).not.toHaveBeenCalled();
  });
});
