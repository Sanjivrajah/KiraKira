import { beforeEach, describe, expect, it } from "vitest";
import { BrowserStorage } from "@/lib/storage/browser-storage";
import { LocalBusinessMembershipRepository, LocalBusinessRepository } from "@/repositories";
import { BusinessService } from "./business-service";

describe("BusinessService", () => {
  const storage = new BrowserStorage();
  const businesses = new LocalBusinessRepository(storage);
  const memberships = new LocalBusinessMembershipRepository(storage);
  const service = new BusinessService(businesses, memberships);
  const input = { name: "Warung Kak Lina", type: "food_beverage" as const, registrationNumber: "", tin: "", currency: "MYR" as const, preferredLanguage: "ms" as const };

  beforeEach(() => localStorage.clear());

  it("derives onboarding completion from a persisted user membership and business", async () => {
    expect(await service.getForUser("user-one")).toBeNull();
    const business = await service.saveForUser("user-one", input);
    expect(await service.getForUser("user-one")).toEqual(business);
    expect(await service.getForUser("user-two")).toBeNull();
  });
});
