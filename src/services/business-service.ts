import type { BusinessMembershipRepository, BusinessRepository } from "@/repositories/contracts";
import type { Business, BusinessInput } from "@/types";

export class BusinessService {
  constructor(
    private readonly businesses: BusinessRepository,
    private readonly memberships: BusinessMembershipRepository,
  ) {}

  async getForUser(userId: string) {
    let membership = (await this.memberships.listForUser({ userId }))[0];
    if (!membership && userId === "demo-lina" && await this.businesses.getById({ businessId: "business_demo" })) {
      membership = await this.createMembership(userId, "business_demo");
    }
    return membership ? this.businesses.getById({ businessId: membership.businessId }) : null;
  }

  async saveForUser(userId: string, input: BusinessInput) {
    const existing = await this.getForUser(userId);
    const now = new Date().toISOString();
    if (existing) {
      return this.businesses.update({ businessId: existing.id, changes: this.toBusiness(input, existing.id, existing.createdAt, now) });
    }
    const businessId = userId === "demo-lina" ? "business_demo" : `business_${userId}`;
    const stored = await this.businesses.getById({ businessId });
    const business = stored
      ? await this.businesses.update({ businessId, changes: this.toBusiness(input, businessId, stored.createdAt, now) })
      : await this.businesses.create({ business: this.toBusiness(input, businessId, now, now) });
    await this.createMembership(userId, businessId);
    return business;
  }

  private createMembership(userId: string, businessId: string) {
    const now = new Date().toISOString();
    return this.memberships.create({ membership: {
      id: `membership_${userId}_${businessId}`,
      userId,
      businessId,
      role: "owner",
      createdAt: now,
      updatedAt: now,
    } });
  }

  private toBusiness(input: BusinessInput, id: string, createdAt: string, updatedAt: string): Business {
    return { ...input, id, registrationNumber: input.registrationNumber || null, tin: input.tin || null, createdAt, updatedAt };
  }
}
