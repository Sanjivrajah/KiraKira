import Link from "next/link";
import { Plus } from "lucide-react";
import { FeaturePlaceholder } from "@/components/shared/feature-placeholder";

export default function TransactionsPage() {
  return <FeaturePlaceholder title="Transactions" description="Keep sales and expenses organised in one place." emptyTitle="No transactions yet" emptyDescription="Your recorded sales and expenses will appear here. The capture and review flow is planned for the next build session." action={<Link className="button button-primary" href="/transactions/new"><Plus aria-hidden="true" size={18} />Add transaction</Link>} />;
}
