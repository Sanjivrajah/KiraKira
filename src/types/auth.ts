import type { AuditableEntity } from "./common";

export interface UserProfile extends AuditableEntity {
  name: string;
  email: string;
}

export type UserProfileInput = Pick<UserProfile, "id" | "name" | "email">;
