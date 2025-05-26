// app/dashboard/page.tsx
import { link } from 'fs';
import Link from 'next/link';
export default function DashboardPage() {
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p className="mb-4">Welcome to the School Fee Manager Dashboard!</p>

      <ul className="list-disc pl-5 space-y-1">
        <li>
          <Link
            href="/dashboard/student-registration"
            className="text-blue-600 underline hover:text-blue-800"
          >
            Students
          </Link>
        </li>
        <li>
          <Link
            href="/dashboard/fee-types"
            className="text-blue-600 underline hover:text-blue-800"
          >
            Fee Types
          </Link>
        </li>
        <li>
          <Link
            href="/dashboard/record-payment"
            className="text-blue-600 underline hover:text-blue-800"
          >
            Record Payment
          </Link>
        </li>
        <li>
          <Link
            href="/dashboard/master-ledger"
            className="text-blue-600 underline hover:text-blue-800"
          >
            Master Ledger
          </Link>
        </li>
        <li>Settings</li>
      </ul>
    </main>
  );
}
