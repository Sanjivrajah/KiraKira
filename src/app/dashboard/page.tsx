import { connection } from "next/server";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  await connection();
  return <DashboardClient now={new Date().toISOString()} />;
}
