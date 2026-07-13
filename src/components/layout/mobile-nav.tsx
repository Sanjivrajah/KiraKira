import Link from "next/link";
import { FileText, Gauge, Menu, Plus, ReceiptText } from "lucide-react";

export function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <Link className="active" href="/dashboard" aria-current="page">
        <Gauge aria-hidden="true" size={20} />
        Home
      </Link>
      <Link href="/dashboard">
        <ReceiptText aria-hidden="true" size={20} />
        Records
      </Link>
      <button className="mobile-add" type="button" aria-label="Add a record">
        <span><Plus aria-hidden="true" size={23} /></span>
        Add
      </button>
      <Link href="/dashboard">
        <FileText aria-hidden="true" size={20} />
        Invoices
      </Link>
      <Link href="/dashboard">
        <Menu aria-hidden="true" size={20} />
        More
      </Link>
    </nav>
  );
}
