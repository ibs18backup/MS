// sfms/app/dashboard/master-ledger/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toast } from 'sonner';
import { Database } from '@/lib/database.types';
import { useAuth } from '@/components/AuthContext';

// Types from your original code, potentially adjusted for Database types
type Payment = Pick<
  Database['public']['Tables']['payments']['Row'],
  'date' | 'amount_paid' | 'mode_of_payment' | 'receipt_number'
>;

type FeeTypeRow = Database['public']['Tables']['fee_types']['Row'];
type StudentFeeTypeRow =
  Database['public']['Tables']['student_fee_types']['Row'];

type FeeTypeDetail = {
  id: string;
  name: string;
  default_amount: number;
  scheduled_date: string | null;
  discount: number;
  // Net amount can be calculated, not stored directly here unless needed
};

type StudentRow = Database['public']['Tables']['students']['Row'];
type ClassRow = Database['public']['Tables']['classes']['Row'];

type StudentWithDetails = StudentRow & {
  classes?: Pick<ClassRow, 'name'> | null; // For class_name from join
  payments?: Payment[];
  student_fee_types?: (Pick<
    StudentFeeTypeRow,
    'discount' | 'discount_description'
  > & {
    fee_type: FeeTypeRow | null; // Renamed from fee_types to fee_type to match typical singular join
  })[];
  // Derived/Calculated fields
  class_name?: string;
  totalPaid?: number;
  all_fee_details?: FeeTypeDetail[];
  due_fees_total?: number;
  status_based_on_total?: 'paid' | 'partially_paid' | 'unpaid' | 'no_fees_due'; // Status based on calculation
};

type ClassOption = Pick<ClassRow, 'id' | 'name'>;
type FeeView = 'total' | 'due';

export default function MasterLedgerPage() {
  const supabase = createClientComponentClient<Database>();
  const router = useRouter();
  const {
    user,
    schoolId,
    isLoading: authLoading,
    isSchoolInfoLoading,
  } = useAuth();

  const [view, setView] = useState<'class' | 'school'>('school');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState<StudentWithDetails[]>([]);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [pageLoading, setPageLoading] = useState(true); // For initial data and subsequent fetches
  const [feeViewType, setFeeViewType] = useState<FeeView>('total');

  const fetchClassesForSchool = useCallback(async () => {
    if (!schoolId) {
      setClassOptions([]);
      return;
    }
    // console.log("MasterLedger/fetchClasses: schoolId:", schoolId);
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', schoolId) // CRITICAL: Filter by schoolId
        .order('name');
      if (error) throw error;
      setClassOptions(data || []);
    } catch (err: any) {
      console.error('Failed to load classes:', err);
      toast.error('Failed to load classes: ' + err.message);
    }
  }, [supabase, schoolId]);

  const fetchStudentsAndDetails = useCallback(async () => {
    if (!schoolId) {
      setStudents([]);
      setPageLoading(false);
      return;
    }
    // console.log("MasterLedger/fetchStudents: schoolId:", schoolId, "selectedClassId:", selectedClassId);
    setPageLoading(true);
    try {
      let query = supabase
        .from('students')
        .select(
          `
          id, name, roll_no, total_fees, status, academic_year, class_id, school_id,
          classes (name),
          payments (date, amount_paid, mode_of_payment, receipt_number),
          student_fee_types ( discount, discount_description, fee_type:fee_types (id, name, default_amount, scheduled_date) )
        `
        )
        .eq('school_id', schoolId); // CRITICAL: Filter students by schoolId

      if (view === 'class' && selectedClassId) {
        query = query.eq('class_id', selectedClassId);
      }
      query = query.order('name', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const enrichedStudents: StudentWithDetails[] = (data || []).map(
        (s: any): StudentWithDetails => {
          const totalPaid =
            s.payments?.reduce(
              (sum: number, p: Payment) => sum + p.amount_paid,
              0
            ) || 0;
          let due_fees_this_moment = 0;

          const allFeeDetailsCurrentStudent: FeeTypeDetail[] =
            s.student_fee_types?.map((sft: any) => {
              const fee: FeeTypeRow | null = sft.fee_type;
              const discount = sft.discount || 0;
              const netFeeAmount = (fee?.default_amount || 0) - discount;

              if (fee && fee.scheduled_date) {
                const scheduledDate = new Date(fee.scheduled_date);
                if (!isNaN(scheduledDate.getTime()) && scheduledDate <= today) {
                  due_fees_this_moment += netFeeAmount;
                }
              }
              return {
                id: fee?.id || '',
                name: fee?.name || 'Unknown Fee',
                default_amount: fee?.default_amount || 0,
                scheduled_date: fee?.scheduled_date || null,
                discount: discount,
              };
            }) || [];

          return {
            ...s, // Spread all properties from student row
            class_name: s.classes?.name || 'N/A',
            totalPaid,
            all_fee_details: allFeeDetailsCurrentStudent,
            due_fees_total: due_fees_this_moment,
            // status_based_on_total will be calculated dynamically by getDynamicStatus
          };
        }
      );
      setStudents(enrichedStudents);
    } catch (err: any) {
      console.error('Failed to load students for ledger:', err);
      toast.error(`Failed to load student data: ${err.message}`);
      setStudents([]); // Clear students on error
    } finally {
      setPageLoading(false);
    }
  }, [supabase, schoolId, selectedClassId, view]);

  useEffect(() => {
    if (user && schoolId && !authLoading && !isSchoolInfoLoading) {
      // console.log("MasterLedger useEffect: User and schoolId available, fetching initial data.");
      fetchClassesForSchool(); // Fetch classes for the dropdown
      fetchStudentsAndDetails(); // Fetch students based on current view/filter
    } else if (user && !schoolId && !authLoading && !isSchoolInfoLoading) {
      toast.error('School information not loaded. Cannot display ledger.');
      setPageLoading(false);
    } else {
      setPageLoading(authLoading || isSchoolInfoLoading);
    }
  }, [
    user,
    schoolId,
    authLoading,
    isSchoolInfoLoading,
    fetchClassesForSchool,
    fetchStudentsAndDetails,
  ]);

  // Re-fetch students when selectedClassId or view changes, if schoolId is present
  useEffect(() => {
    if (schoolId && !authLoading && !isSchoolInfoLoading) {
      fetchStudentsAndDetails();
    }
  }, [
    selectedClassId,
    view,
    schoolId,
    authLoading,
    isSchoolInfoLoading,
    fetchStudentsAndDetails,
  ]);

  const getDynamicStatus = useCallback(
    (
      student: StudentWithDetails
    ): 'paid' | 'partially_paid' | 'unpaid' | 'no_fees_due' => {
      const feesToConsider =
        feeViewType === 'total'
          ? student.total_fees || 0
          : student.due_fees_total || 0;
      const paid = student.totalPaid || 0;

      if (feesToConsider <= 0.009) {
        // Using a small epsilon for floating point comparison to 0
        return paid > 0 ? 'paid' : 'no_fees_due'; // If no fees assigned/due, consider paid if anything was paid, else no_fees_due
      }
      if (paid >= feesToConsider) return 'paid';
      if (paid > 0 && paid < feesToConsider) return 'partially_paid';
      return 'unpaid';
    },
    [feeViewType]
  );

  const filteredStudentsForDisplay = students.filter((stu) => {
    const term = searchTerm.toLowerCase();
    if (!term) return true; // No search term, show all (already school/class filtered)
    return (
      stu.name.toLowerCase().includes(term) ||
      (stu.roll_no && stu.roll_no.toLowerCase().includes(term)) ||
      (stu.class_name && stu.class_name.toLowerCase().includes(term))
    );
  });

  const handleExport = () => {
    if (!filteredStudentsForDisplay.length) {
      toast.error('No data to export.');
      return;
    }
    const header = [
      'Name',
      'Class',
      'Roll Number',
      feeViewType === 'total' ? 'Total Assigned Fees' : 'Currently Due Fees',
      'Total Paid',
      'Balance',
      'Status',
      'Last Payment Date',
      'Last Payment Amount',
      'Last Payment Mode',
      'Academic Year',
      'Last Receipt Number',
    ];
    const rows = filteredStudentsForDisplay.map((stu) => {
      const lastPayment =
        stu.payments && stu.payments.length > 0
          ? stu.payments.sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            )[0]
          : null;
      const feesForCalc =
        feeViewType === 'total' ? stu.total_fees || 0 : stu.due_fees_total || 0;
      const balance = feesForCalc - (stu.totalPaid || 0);
      const currentStatus = getDynamicStatus(stu);
      return [
        stu.name,
        stu.class_name,
        stu.roll_no,
        feesForCalc.toFixed(2),
        (stu.totalPaid || 0).toFixed(2),
        balance.toFixed(2),
        currentStatus === 'no_fees_due'
          ? 'No Fees Due'
          : currentStatus.charAt(0).toUpperCase() + currentStatus.slice(1),
        lastPayment ? new Date(lastPayment.date).toLocaleDateString() : '-',
        lastPayment ? lastPayment.amount_paid.toFixed(2) : '-',
        lastPayment ? lastPayment.mode_of_payment.replace('_', ' ') : '-',
        stu.academic_year || '-',
        lastPayment ? lastPayment.receipt_number : '-',
      ];
    });
    const csv = [header, ...rows]
      .map((r) =>
        r
          .map((c) => (typeof c === 'string' && c.includes(',') ? `"${c}"` : c))
          .join(',')
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `master-ledger-${view}-${
      selectedClassId || 'all'
    }-${feeViewType}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('CSV exported successfully!');
  };

  // --- Render Logic ---
  if (authLoading || (isSchoolInfoLoading && !schoolId)) {
    return (
      <div className="p-6 text-center">Loading Master Ledger module...</div>
    );
  }
  if (!user) {
    return <div className="p-6 text-center">Please log in.</div>;
  }
  if (!schoolId && !isSchoolInfoLoading) {
    return (
      <div className="p-6 text-center text-red-500">
        School information unavailable. Master Ledger disabled.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 flex-wrap">
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="p-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 transition-shadow"
              value={view}
              onChange={(e) => {
                setView(e.target.value as 'class' | 'school');
                if (e.target.value === 'school') {
                  setSelectedClassId('');
                }
              }}
            >
              <option value="school">School Overview</option>
              <option value="class">Class View</option>
            </select>
            {view === 'class' && (
              <select
                className="p-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 transition-shadow"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                disabled={classOptions.length === 0}
              >
                <option value="">All Classes in School</option>{' '}
                {/* Changed from "All Classes" to be more specific */}
                {classOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            <input
              type="text"
              className="p-2.5 border border-gray-300 rounded-lg shadow-sm w-full md:w-60 focus:ring-2 focus:ring-indigo-500 transition-shadow"
              placeholder="🔍 Search Student/Roll/Class..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg shadow-sm">
              <button
                onClick={() => setFeeViewType('total')}
                className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  feeViewType === 'total'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Total Assigned
              </button>
              <button
                onClick={() => setFeeViewType('due')}
                className={`px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  feeViewType === 'due'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Currently Due
              </button>
            </div>
            <button
              onClick={handleExport}
              disabled={pageLoading || filteredStudentsForDisplay.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:bg-gray-400 shadow-md transition-colors"
            >
              📥 Export CSV
            </button>
          </div>
        </div>
      </div>

      {pageLoading ? (
        <div className="text-center text-gray-600 py-10 text-lg">
          Loading student data…
        </div>
      ) : filteredStudentsForDisplay.length === 0 ? (
        <div className="text-center text-gray-600 py-10 text-lg bg-white p-6 rounded-xl shadow-lg">
          No records found for the current selection.
        </div>
      ) : (
        <div className="overflow-x-auto bg-white shadow-xl rounded-lg">
          <table className="w-full border-collapse min-w-[900px]">
            <thead className="bg-indigo-700 text-white sticky top-0 z-10">
              <tr>
                <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold uppercase tracking-wider">
                  Student / Class
                </th>
                <th className="px-3 sm:px-4 py-3 text-right text-xs sm:text-sm font-semibold uppercase tracking-wider">
                  {feeViewType === 'total'
                    ? 'Total Assigned (₹)'
                    : 'Currently Due (₹)'}
                </th>
                <th className="px-3 sm:px-4 py-3 text-right text-xs sm:text-sm font-semibold uppercase tracking-wider">
                  Paid (₹)
                </th>
                <th className="px-3 sm:px-4 py-3 text-right text-xs sm:text-sm font-semibold uppercase tracking-wider">
                  Balance (₹)
                </th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold uppercase tracking-wider">
                  Last Payment
                </th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold uppercase tracking-wider">
                  Receipt #
                </th>
                <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {view === 'school' && !selectedClassId // School Overview: Group by class
                ? Array.from(
                    new Set(filteredStudentsForDisplay.map((s) => s.class_name))
                  )
                    .sort((a, b) => (a || '').localeCompare(b || ''))
                    .map((className) => {
                      const group = filteredStudentsForDisplay.filter(
                        (s) => s.class_name === className
                      );
                      const totalFeesForClass = group.reduce(
                        (acc, s) =>
                          acc +
                          (feeViewType === 'total'
                            ? s.total_fees || 0
                            : s.due_fees_total || 0),
                        0
                      );
                      const totalPaidForClass = group.reduce(
                        (acc, s) => acc + (s.totalPaid || 0),
                        0
                      );
                      const studentsUnpaid = group.filter(
                        (s) => getDynamicStatus(s) === 'unpaid'
                      ).length;
                      const studentsPartial = group.filter(
                        (s) => getDynamicStatus(s) === 'partially_paid'
                      ).length;
                      const studentsPaid = group.filter(
                        (s) => getDynamicStatus(s) === 'paid'
                      ).length;
                      const studentsNoFeesDue = group.filter(
                        (s) => getDynamicStatus(s) === 'no_fees_due'
                      ).length;

                      return (
                        <tr
                          key={className || 'unclassified'}
                          className="hover:bg-indigo-50 transition-colors duration-150 group"
                          onClick={() => {
                            setView('class');
                            const classOpt = classOptions.find(
                              (c) => c.name === className
                            );
                            if (classOpt) setSelectedClassId(classOpt.id);
                            setSearchTerm('');
                          }}
                        >
                          <td className="px-3 sm:px-4 py-3 whitespace-nowrap cursor-pointer">
                            <div className="font-semibold text-indigo-700 group-hover:underline">
                              {className || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {group.length} student(s)
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-right whitespace-nowrap font-medium">
                            {totalFeesForClass.toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-3 sm:px-4 py-3 text-right whitespace-nowrap text-green-600 font-medium">
                            {totalPaidForClass.toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td
                            className={`px-3 sm:px-4 py-3 text-right whitespace-nowrap font-medium ${
                              totalFeesForClass - totalPaidForClass > 0
                                ? 'text-red-600'
                                : 'text-gray-700'
                            }`}
                          >
                            {(
                              totalFeesForClass - totalPaidForClass
                            ).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                            —
                          </td>
                          <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                            —
                          </td>
                          <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-xs">
                            {studentsUnpaid > 0 && (
                              <span className="text-red-500 block">
                                {studentsUnpaid} Unpaid
                              </span>
                            )}
                            {studentsPartial > 0 && (
                              <span className="text-yellow-500 block">
                                {studentsPartial} Partial
                              </span>
                            )}
                            {studentsPaid > 0 && (
                              <span className="text-green-500 block">
                                {studentsPaid} Paid
                              </span>
                            )}
                            {studentsNoFeesDue > 0 && (
                              <span className="text-blue-500 block">
                                {studentsNoFeesDue} No Dues
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                : // Class View or School View with a class selected
                  filteredStudentsForDisplay.map((stu) => {
                    const lastPayment =
                      stu.payments && stu.payments.length > 0
                        ? stu.payments.sort(
                            (a, b) =>
                              new Date(b.date).getTime() -
                              new Date(a.date).getTime()
                          )[0]
                        : null;
                    const feesForCalc =
                      feeViewType === 'total'
                        ? stu.total_fees || 0
                        : stu.due_fees_total || 0;
                    const balance = feesForCalc - (stu.totalPaid || 0);
                    const currentStatus = getDynamicStatus(stu);
                    let statusColor = '',
                      statusText = '';
                    switch (currentStatus) {
                      case 'paid':
                        statusColor = 'bg-green-100 text-green-700';
                        statusText = 'Paid';
                        break;
                      case 'partially_paid':
                        statusColor = 'bg-yellow-100 text-yellow-700';
                        statusText = 'Partial';
                        break;
                      case 'unpaid':
                        statusColor = 'bg-red-100 text-red-700';
                        statusText = 'Unpaid';
                        break;
                      case 'no_fees_due':
                        statusColor = 'bg-blue-100 text-blue-700';
                        statusText = 'No Dues';
                        break;
                    }
                    return (
                      <tr
                        key={stu.id}
                        className="hover:bg-indigo-50 transition-colors duration-150 group"
                        onClick={() =>
                          router.push(`/dashboard/student/${stu.id}`)
                        }
                      >
                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap cursor-pointer">
                          <div className="font-medium text-indigo-700 group-hover:underline">
                            {stu.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {stu.class_name || 'N/A'} • Roll:{' '}
                            {stu.roll_no || 'N/A'}
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-right whitespace-nowrap">
                          {feesForCalc.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-right whitespace-nowrap text-green-600">
                          {(stu.totalPaid || 0).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td
                          className={`px-3 sm:px-4 py-3 text-right whitespace-nowrap font-semibold ${
                            balance < -0.009
                              ? 'text-green-600'
                              : balance > 0.009
                              ? 'text-red-600'
                              : 'text-gray-700'
                          }`}
                        >
                          {balance.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                          {lastPayment
                            ? new Date(lastPayment.date).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                          {lastPayment?.receipt_number || '—'}
                        </td>
                        <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusColor}`}
                          >
                            {statusText}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
