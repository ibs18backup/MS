// sfms/app/dashboard/page.tsx
'use client';

import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { useAuth } from '@/components/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/lib/database.types';
import { toast } from 'sonner';
import {
  UsersIcon,
  BanknotesIcon,
  ReceiptPercentIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  Cog8ToothIcon,
  ClipboardDocumentListIcon,
  ArrowRightCircleIcon,
  XMarkIcon,
  UserPlusIcon, // Added for consistency with ActionCard
} from '@heroicons/react/24/outline';
import { Dialog, Transition } from '@headlessui/react';

// Type definitions
type DashboardStats = {
  studentCount: number | null;
  totalAssignedFees: number | null;
  totalCollectedFees: number | null;
  totalOutstandingFees: number | null;
};

type StudentFeeDetail = { id: string; name: string; roll_no: string | null; class_name: string | null; total_fees: number | null; paid: number; outstanding: number; status: string };
type PaymentDetail = { id: string; student_name: string | null; student_roll_no: string | null; amount_paid: number; date: string; receipt_number: string | null; mode_of_payment: string };

type DetailViewData = StudentFeeDetail[] | PaymentDetail[];
type DetailViewType = 'assigned_fees' | 'collected_fees' | 'outstanding_fees';


// Reusable Card Components
interface StatCardProps {
  title: string;
  value: string | number | null;
  icon: React.ReactNode;
  action?: () => void;
  isLoading: boolean;
  colorClass: string;
}
const StatCard: React.FC<StatCardProps> = ({ title, value, icon, action, isLoading, colorClass }) => (
  <div
    onClick={action}
    className={`p-5 rounded-xl shadow-lg transition-all duration-300 ease-in-out transform hover:-translate-y-1 bg-white hover:shadow-xl ${action ? 'cursor-pointer' : 'cursor-default'}`}
  >
    <div className="flex items-center justify-between">
      <div className={`p-3 rounded-full ${colorClass}`}>
        {icon}
      </div>
    </div>
    <p className="mt-3 text-sm font-medium text-gray-500 uppercase tracking-wider">{title}</p>
    {isLoading ? (
      <div className="h-8 w-3/4 bg-gray-200 animate-pulse rounded-md mt-1"></div>
    ) : (
      <p className="mt-1 text-3xl font-semibold text-gray-900">
        {typeof value === 'number' && !title.toLowerCase().includes('students') ? `₹${value.toLocaleString('en-IN')}` : value ?? 'N/A'}
      </p>
    )}
  </div>
);

interface ActionCardProps {
  title: string;
  href: string;
  icon: React.ReactNode;
  colorTheme: string;
}
const ActionCard: React.FC<ActionCardProps> = ({ title, href, icon, colorTheme }) => (
  <Link href={href} className={`group block p-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out transform hover:-translate-y-1 ${colorTheme} text-white`}>
    <div className="flex flex-col items-center text-center">
      <span className="p-3 rounded-full bg-white bg-opacity-20 group-hover:bg-opacity-25 transition-colors mb-3">
        {icon}
      </span>
      <h3 className="text-lg font-semibold">{title}</h3>
    </div>
  </Link>
);

// Modal Component
interface DetailModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  title: string;
  data: DetailViewData | null;
  columns: { Header: string; accessor: string; Cell?: (cell: any) => React.ReactNode }[];
  isLoading: boolean;
}

const DetailModal: React.FC<DetailModalProps> = ({ isOpen, setIsOpen, title, data, columns, isLoading }) => {
  function closeModal() {
    setIsOpen(false);
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={closeModal}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100"
          leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-40" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100"
              leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-xl font-semibold leading-6 text-gray-900 flex justify-between items-center">
                  {title}
                  <button onClick={closeModal} className="p-1 rounded-full hover:bg-gray-200 transition-colors">
                    <XMarkIcon className="h-6 w-6 text-gray-500" />
                  </button>
                </Dialog.Title>
                <div className="mt-4 max-h-[60vh] overflow-y-auto">
                  {isLoading && <p className="text-center text-gray-500 py-4">Loading details...</p>}
                  {!isLoading && (!data || data.length === 0) && <p className="text-center text-gray-500 py-4">No details to display.</p>}
                  {!isLoading && data && data.length > 0 && (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          {columns.map((col) => (
                            <th key={col.accessor} scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {col.Header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {data.map((row: any, rowIndex) => (
                          <tr key={row.id || rowIndex} className="hover:bg-gray-50">
                            {columns.map((col) => (
                              <td key={col.accessor} className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                                {col.Cell ? col.Cell(row) : row[col.accessor] ?? 'N/A'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="mt-6 text-right">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent bg-indigo-100 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 transition-colors"
                    onClick={closeModal}
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default function DashboardPage() {
  const supabase = createClientComponentClient<Database>();
  const { user, schoolId, isAdmin, isLoading: authLoading, isSchoolInfoLoading } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats>({
    studentCount: null, totalAssignedFees: null, totalCollectedFees: null, totalOutstandingFees: null,
  });
  const [isFetchingPageStats, setIsFetchingPageStats] = useState(true);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailModalTitle, setDetailModalTitle] = useState('');
  const [detailModalData, setDetailModalData] = useState<DetailViewData | null>(null);
  const [detailModalColumns, setDetailModalColumns] = useState<any[]>([]);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);

  const fetchDashboardAggregates = useCallback(async () => {
    if (!schoolId || !user) {
      setIsFetchingPageStats(false);
      setStats({ studentCount: 0, totalAssignedFees: 0, totalCollectedFees: 0, totalOutstandingFees: 0 });
      return;
    }
    setIsFetchingPageStats(true);
    try {
      const { count: studentCount, error: studentErr } = await supabase
        .from('students').select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId).eq('status', 'active').eq('is_passed_out', false);
      if (studentErr) console.error("Error fetching student count:", studentErr.message);

      const { data: studentsData, error: studentsErr } = await supabase
        .from('students').select('total_fees').eq('school_id', schoolId);
      if (studentsErr) console.error("Error fetching students for fees:", studentsErr.message);
      const totalAssigned = studentsData?.reduce((sum, s) => sum + (s.total_fees || 0), 0) || 0;

      const { data: paymentsData, error: paymentsErr } = await supabase
        .from('payments').select('amount_paid').eq('school_id', schoolId);
      if (paymentsErr) console.error("Error fetching payments:", paymentsErr.message);
      const totalCollected = paymentsData?.reduce((sum, p) => sum + (p.amount_paid || 0), 0) || 0;

      setStats({
        studentCount: studentCount ?? 0,
        totalAssignedFees: totalAssigned,
        totalCollectedFees: totalCollected,
        totalOutstandingFees: totalAssigned - totalCollected,
      });

    } catch (error: any) {
      toast.error("Failed to load dashboard statistics.");
      console.error("Error fetching dashboard stats:", error.message);
    } finally {
      setIsFetchingPageStats(false);
    }
  }, [supabase, schoolId, user]);

  useEffect(() => {
    if (user && schoolId && !authLoading && !isSchoolInfoLoading) {
      fetchDashboardAggregates();
    } else if (user && !schoolId && !authLoading && !isSchoolInfoLoading) {
      toast.error("School information not configured for dashboard stats.");
      setIsFetchingPageStats(false);
    } else {
      setIsFetchingPageStats(authLoading || isSchoolInfoLoading);
    }
  }, [user, schoolId, authLoading, isSchoolInfoLoading, fetchDashboardAggregates]);

  const handleShowDetail = async (type: DetailViewType) => {
    if (!schoolId) return;
    setIsFetchingDetails(true);
    setDetailModalData(null);
    setIsDetailModalOpen(true);
    let title = '';
    let columns: any[] = [];
    let fetchedData: DetailViewData = [];

    try {
      if (type === 'assigned_fees') {
        title = 'Total Assigned Fees Breakdown';
        columns = [
          { Header: 'Student Name', accessor: 'name' }, { Header: 'Roll No', accessor: 'roll_no' },
          { Header: 'Class', accessor: 'class_name' },
          { Header: 'Assigned Fees (₹)', accessor: 'total_fees', Cell: (row: StudentFeeDetail) => `₹${row.total_fees?.toLocaleString('en-IN') || '0'}` },
        ];
        const { data, error } = await supabase.from('students').select('id, name, roll_no, total_fees, classes(name)')
                                  .eq('school_id', schoolId).order('name');
        if (error) throw error;
        fetchedData = data?.map(s => ({...s, class_name: s.classes?.name || 'N/A'} as StudentFeeDetail)) || [];

      } else if (type === 'collected_fees') {
        title = 'Collected Fees Details';
        columns = [
          { Header: 'Student Name', accessor: 'student_name' }, { Header: 'Roll No', accessor: 'student_roll_no' },
          { Header: 'Amount Paid (₹)', accessor: 'amount_paid', Cell: (row: PaymentDetail) => `₹${row.amount_paid.toLocaleString('en-IN')}` },
          { Header: 'Date', accessor: 'date', Cell: (row: PaymentDetail) => new Date(row.date).toLocaleDateString() },
          { Header: 'Receipt #', accessor: 'receipt_number' },
          { Header: 'Mode', accessor: 'mode_of_payment', Cell: (row: PaymentDetail) => row.mode_of_payment.replace('_',' ') },
        ];
        const { data, error } = await supabase.from('payments').select('id, amount_paid, date, receipt_number, mode_of_payment, students(name, roll_no)')
                                  .eq('school_id', schoolId).order('date', { ascending: false });
        if (error) throw error;
        fetchedData = data?.map(p => ({...p, student_name: p.students?.name, student_roll_no: p.students?.roll_no} as PaymentDetail)) || [];
      
      } else if (type === 'outstanding_fees') {
        title = 'Students with Outstanding Fees';
        columns = [
          { Header: 'Student Name', accessor: 'name' }, { Header: 'Roll No', accessor: 'roll_no' },
          { Header: 'Class', accessor: 'class_name' },
          { Header: 'Total Fees (₹)', accessor: 'total_fees', Cell: (row: StudentFeeDetail) => `₹${row.total_fees?.toLocaleString('en-IN') || '0'}` },
          { Header: 'Paid (₹)', accessor: 'paid', Cell: (row: StudentFeeDetail) => `₹${row.paid.toLocaleString('en-IN')}` },
          { Header: 'Outstanding (₹)', accessor: 'outstanding', Cell: (row: StudentFeeDetail) => `₹${row.outstanding.toLocaleString('en-IN')}` },
          { Header: 'Status', accessor: 'status', Cell: (row: StudentFeeDetail) => (
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              row.status === "Paid" ? "bg-green-100 text-green-700"
              : row.status === "Partial" ? "bg-yellow-100 text-yellow-700"
              : "bg-red-100 text-red-700"
            }`}>{row.status}</span>
          )},
        ];
        const { data: studentsData, error } = await supabase.from('students')
          .select('id, name, roll_no, total_fees, status, classes(name), payments(amount_paid)')
          .eq('school_id', schoolId).order('name');
        if (error) throw error;
        
        fetchedData = studentsData?.map(s => {
          const totalPaid = s.payments?.reduce((sum, p) => sum + p.amount_paid, 0) || 0;
          const outstandingAmount = (s.total_fees || 0) - totalPaid;
          let studentStatus = "Unpaid";
          if ((s.total_fees || 0) <= 0.009 ) studentStatus = "No Dues";
          else if (totalPaid >= (s.total_fees || 0)) studentStatus = "Paid";
          else if (totalPaid > 0) studentStatus = "Partial";
          return { ...s, class_name: s.classes?.name || 'N/A', paid: totalPaid, outstanding: outstandingAmount, status: studentStatus };
        }).filter(s => s.outstanding > 0.009) as StudentFeeDetail[] || [];
      }
      setDetailModalTitle(title);
      setDetailModalColumns(columns);
      setDetailModalData(fetchedData);
    } catch (error: any) {
      toast.error(`Failed to load details: ${error.message}`);
      setDetailModalData([]);
    } finally {
      setIsFetchingDetails(false);
    }
  };

  if (authLoading || (user && isSchoolInfoLoading && !schoolId && !isAdmin)) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6 bg-slate-50">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-indigo-600 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600 mt-4 text-lg font-medium">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) { return <div className="p-6 text-center">Redirecting to login...</div>; }
  
  // Corrected line causing the error
  if (!schoolId && !isSchoolInfoLoading && !isAdmin ) { 
     return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
        <div className="bg-white p-8 rounded-xl shadow-2xl text-center max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-3">School Information Missing</h2>
          <p className="text-gray-600 mb-6">
            Your account needs to be linked to a school to access dashboard features. Please contact support or try logging in again.
          </p>
          <Link href="/login" className="inline-block px-6 py-2.5 bg-indigo-600 text-white font-medium text-sm rounded-lg shadow-md hover:bg-indigo-700 transition-colors">
            Re-Login
          </Link>
        </div>
      </div>
    );
  }
  
  const displayName = user.user_metadata?.full_name || user.email || (isAdmin ? 'Administrator' : 'User');

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-gray-100 to-sky-100 selection:bg-purple-100 selection:text-purple-700">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <header className="mb-8 md:mb-10">
            <div className="max-w-4xl">
              <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl md:text-5xl leading-tight">
                Welcome back, <span className="block text-purple-600 xl:inline">{displayName}!</span>
              </h1>
              <p className="mt-3 text-md text-gray-600 sm:text-lg max-w-2xl">
                Your school's financial and student overview. Click on stats for details.
              </p>
            </div>
          </header>

          <section className="mb-10 md:mb-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <StatCard title="Total Students" value={stats.studentCount} 
                        icon={<UsersIcon className="h-7 w-7" />} 
                        action={() => router.push('/dashboard/master-ledger')} 
                        isLoading={isFetchingPageStats} colorClass="text-purple-600 bg-purple-100" />
              <StatCard title="Total Assigned Fees" value={stats.totalAssignedFees} 
                        icon={<BanknotesIcon className="h-7 w-7" />} 
                        action={() => handleShowDetail('assigned_fees')}
                        isLoading={isFetchingPageStats} colorClass="text-indigo-600 bg-indigo-100" />
              <StatCard title="Total Collected Fees" value={stats.totalCollectedFees} 
                        icon={<ReceiptPercentIcon className="h-7 w-7" />}
                        action={() => handleShowDetail('collected_fees')}
                        isLoading={isFetchingPageStats} colorClass="text-green-600 bg-green-100" />
              <StatCard title="Total Outstanding Fees" value={stats.totalOutstandingFees} 
                        icon={<ExclamationTriangleIcon className="h-7 w-7" />}
                        action={() => handleShowDetail('outstanding_fees')}
                        isLoading={isFetchingPageStats} colorClass="text-red-600 bg-red-100" />
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-700 mb-5">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <ActionCard title="Record Payment" href="/dashboard/record-payment" 
                          icon={<PencilSquareIcon className="h-7 w-7"/>} 
                          colorTheme="bg-gradient-to-br from-teal-500 to-cyan-600"/>
              <ActionCard title="Manage Fees & Classes" href="/dashboard/fee-types" 
                          icon={<Cog8ToothIcon className="h-7 w-7"/>} 
                          colorTheme="bg-gradient-to-br from-sky-500 to-blue-600"/>
              <ActionCard title="Master Ledger" href="/dashboard/master-ledger" 
                          icon={<ClipboardDocumentListIcon className="h-7 w-7"/>} 
                          colorTheme="bg-gradient-to-br from-violet-500 to-fuchsia-600"/>
              <ActionCard title="Student Registration" href="/dashboard/student-registration" 
                          icon={<UserPlusIcon className="h-7 w-7"/>} 
                          colorTheme="bg-gradient-to-br from-pink-500 to-rose-600"/>
            </div>
          </section>

          <footer className="mt-10 pt-6 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">
              School Fee Management System &copy; {new Date().getFullYear()}
            </p>
          </footer>
        </div>
      </div>
      <DetailModal 
        isOpen={isDetailModalOpen} 
        setIsOpen={setIsDetailModalOpen} 
        title={detailModalTitle} 
        data={detailModalData}
        columns={detailModalColumns}
        isLoading={isFetchingDetails}
      />
    </>
  );
}