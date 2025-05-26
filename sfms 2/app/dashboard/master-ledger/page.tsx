'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase'; // Ensure this path is correct
import { toast } from 'sonner'; // Or your preferred toast library

// Types
type Payment = {
  date: string;
  amount_paid: number;
  mode_of_payment: string;
  receipt_number: string;
};

type FeeTypeDetail = {
  // For processing fee details
  id: string;
  name: string;
  default_amount: number;
  scheduled_date: string | null;
  discount: number;
};

type StudentWithPayments = {
  id: string;
  name: string;
  roll_no: string;
  class_name: string; // Changed from 'class' to avoid conflict
  class_id: string;
  total_assigned_fees: number; // Renamed from total_fees to be explicit
  due_fees_total: number; // Sum of fees currently due
  status_based_on_total: 'paid' | 'partially_paid' | 'unpaid'; // Original status from DB
  academic_year?: string;
  payments?: Payment[];
  totalPaid?: number;
  all_fee_details: FeeTypeDetail[]; // Store all assigned fee details
};

type ClassOption = {
  id: string;
  name: string;
};

type FeeView = 'total' | 'due'; // To toggle between total and due fees

export default function MasterLedger() {
  const router = useRouter();
  const [view, setView] = useState<'class' | 'school'>('school');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState<StudentWithPayments[]>([]);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [feeViewType, setFeeViewType] = useState<FeeView>('total'); // 'total' or 'due'

  const fetchClasses = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('classes').select('id, name');
      if (error) throw error;
      setClassOptions(data || []);
    } catch (err) {
      console.error('Failed to load classes:', err);
      toast.error('Failed to load classes');
    }
  }, [supabase]); // Added supabase dependency

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select(
          `
          id,
          name,
          roll_no,
          total_fees, 
          status,
          academic_year,
          class_id,
          classes(name),
          payments (
            date,
            amount_paid,
            mode_of_payment,
            receipt_number
          ),
          student_fee_types (
            discount,
            fee_type:fee_types (
              id,
              name,
              default_amount,
              scheduled_date 
            )
          )
        `
        )
        .order('name', { ascending: true });

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize today's date for accurate comparison

      const enrichedStudents: StudentWithPayments[] = (data || []).map(
        (s: any) => {
          const totalPaid =
            s.payments?.reduce(
              (sum: number, p: Payment) => sum + p.amount_paid,
              0
            ) || 0;

          let due_fees_this_moment = 0; // Initialize due fees for this student

          const allFeeDetailsCurrentStudent: FeeTypeDetail[] =
            s.student_fee_types?.map((sft: any) => {
              const fee = sft.fee_type;
              const discount = sft.discount || 0;
              const netFeeAmount = (fee?.default_amount || 0) - discount;

              // Revised logic for "due" fees:
              // Only include if fee_type exists, has a scheduled_date,
              // and that date is today or in the past.
              if (fee && fee.scheduled_date) {
                const scheduledDate = new Date(fee.scheduled_date);
                // Check if the parsed date is valid
                if (!isNaN(scheduledDate.getTime())) {
                  if (scheduledDate <= today) {
                    due_fees_this_moment += netFeeAmount;
                  }
                }
              }
              // Fees without a scheduled_date are NOT included in due_fees_this_moment.

              return {
                id: fee?.id || '',
                name: fee?.name || 'Unknown Fee',
                default_amount: fee?.default_amount || 0,
                scheduled_date: fee?.scheduled_date || null,
                discount: discount,
              };
            }) || [];

          return {
            id: s.id,
            name: s.name,
            roll_no: s.roll_no,
            class_name: s.classes?.name || 'Unknown',
            class_id: s.class_id,
            total_assigned_fees: s.total_fees || 0, // This remains the sum from student record
            due_fees_total: due_fees_this_moment, // This is the corrected due fees
            status_based_on_total: s.status || 'unpaid',
            academic_year: s.academic_year,
            payments: s.payments || [],
            totalPaid,
            all_fee_details: allFeeDetailsCurrentStudent,
          };
        }
      );

      const classFilteredStudents = selectedClassId
        ? enrichedStudents.filter((s) => s.class_id === selectedClassId)
        : enrichedStudents;

      setStudents(classFilteredStudents);
    } catch (err: any) {
      console.error('Failed to load students:', err);
      toast.error(`Failed to load students: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, supabase]); // Added supabase to dependency array

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const getDynamicStatus = useCallback(
    (
      student: StudentWithPayments
    ): 'paid' | 'partially_paid' | 'unpaid' | 'no_fees_due' => {
      const feesToConsider =
        feeViewType === 'total'
          ? student.total_assigned_fees
          : student.due_fees_total;
      const paid = student.totalPaid || 0;

      if (feesToConsider <= 0) {
        // Handles cases where total_fees or due_fees_total might be 0
        return paid > 0 ? 'paid' : 'no_fees_due';
      }
      if (paid >= feesToConsider) return 'paid';
      if (paid > 0 && paid < feesToConsider) return 'partially_paid';
      return 'unpaid';
    },
    [feeViewType]
  );

  const filteredStudents = students.filter((stu) => {
    const term = searchTerm.toLowerCase();
    return (
      stu.name.toLowerCase().includes(term) ||
      stu.roll_no.toLowerCase().includes(term) ||
      (stu.class_name && stu.class_name.toLowerCase().includes(term)) ||
      term === ''
    );
  });

  const handleExport = () => {
    if (!filteredStudents.length) {
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
      'Payment Mode',
      'Academic Year',
      'Last Receipt Number',
    ];
    const rows = filteredStudents.map((stu) => {
      const lastPayment =
        stu.payments && stu.payments.length > 0
          ? stu.payments.sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            )[0]
          : null;
      const feesForCalc =
        feeViewType === 'total' ? stu.total_assigned_fees : stu.due_fees_total;
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
    a.download = `ledger-${view}-${selectedClassId || 'all'}-${feeViewType}-${
      new Date().toISOString().split('T')[0]
    }.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('CSV exported successfully!');
  };

  return (
    <div className="p-6 space-y-6 bg-white rounded-lg shadow-lg max-w-full mx-auto">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="p-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500"
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
              className="p-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
            >
              <option value="">All Classes</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <input
            type="text"
            className="p-2 border rounded-lg shadow-sm w-full md:w-64 focus:ring-2 focus:ring-indigo-500"
            placeholder="🔍 Search student/class..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg shadow-sm">
            <button
              onClick={() => setFeeViewType('total')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                ${
                  feeViewType === 'total'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
            >
              Total Assigned Fees
            </button>
            <button
              onClick={() => setFeeViewType('due')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                ${
                  feeViewType === 'due'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
            >
              Currently Due Fees
            </button>
          </div>
          <button
            onClick={handleExport}
            disabled={loading || filteredStudents.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md"
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-600 py-10 text-lg">
          Loading student data…
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="text-center text-gray-600 py-10 text-lg">
          No records found.
        </div>
      ) : (
        <div className="overflow-x-auto shadow-md rounded-lg">
          <table className="w-full border-collapse min-w-[800px]">
            <thead className="bg-indigo-600 text-white sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Student / Class
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold">
                  {feeViewType === 'total'
                    ? 'Total Assigned Fees (₹)'
                    : 'Currently Due Fees (₹)'}
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold">
                  Paid (₹)
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold">
                  Balance (₹)
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Last Payment
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Receipt #
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {view === 'school'
                ? Array.from(new Set(filteredStudents.map((s) => s.class_name)))
                    .sort()
                    .map((className) => {
                      const group = filteredStudents.filter(
                        (s) => s.class_name === className
                      );
                      const totalFeesForClass = group.reduce(
                        (acc, s) =>
                          acc +
                          (feeViewType === 'total'
                            ? s.total_assigned_fees
                            : s.due_fees_total),
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
                          key={className}
                          className="hover:bg-indigo-50 cursor-pointer transition-colors duration-150"
                          onClick={() => {
                            setView('class');
                            const classOption = classOptions.find(
                              (c) => c.name === className
                            );
                            setSelectedClassId(
                              classOption ? classOption.id : ''
                            );
                            setSearchTerm('');
                          }}
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-semibold text-indigo-700">
                              {className}
                            </div>
                            <div className="text-xs text-gray-500">
                              {group.length} students
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap font-medium">
                            {totalFeesForClass.toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap text-green-600 font-medium">
                            {totalPaidForClass.toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap font-medium text-red-600">
                            {(
                              totalFeesForClass - totalPaidForClass
                            ).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            —
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            —
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs">
                            {studentsUnpaid > 0 && (
                              <span className="text-red-600 block">
                                {studentsUnpaid} Unpaid
                              </span>
                            )}
                            {studentsPartial > 0 && (
                              <span className="text-yellow-600 block">
                                {studentsPartial} Partial
                              </span>
                            )}
                            {studentsPaid > 0 && (
                              <span className="text-green-600 block">
                                {studentsPaid} Paid
                              </span>
                            )}
                            {studentsNoFeesDue > 0 && (
                              <span className="text-blue-600 block">
                                {studentsNoFeesDue} No Fees Due
                              </span>
                            )}
                            {group.length === 0 && (
                              <span className="text-gray-500">No Students</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                : filteredStudents.map((stu) => {
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
                        ? stu.total_assigned_fees
                        : stu.due_fees_total;
                    const balance = feesForCalc - (stu.totalPaid || 0);
                    const currentStatus = getDynamicStatus(stu);

                    let statusColor = '';
                    let statusText = '';

                    switch (currentStatus) {
                      case 'paid':
                        statusColor = 'bg-green-100 text-green-800';
                        statusText = 'Paid';
                        break;
                      case 'partially_paid':
                        statusColor = 'bg-yellow-100 text-yellow-800';
                        statusText = 'Partial';
                        break;
                      case 'unpaid':
                        statusColor = 'bg-red-100 text-red-800';
                        statusText = 'Unpaid';
                        break;
                      case 'no_fees_due':
                        statusColor = 'bg-blue-100 text-blue-800';
                        statusText = 'No Fees Due';
                        break;
                    }

                    return (
                      <tr
                        key={stu.id}
                        className="hover:bg-indigo-50 cursor-pointer transition-colors duration-150"
                        onClick={() =>
                          router.push(`/dashboard/student/${stu.id}`)
                        }
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium text-indigo-700">
                            {stu.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {stu.class_name} • Roll: {stu.roll_no}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {feesForCalc.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap text-green-600">
                          {(stu.totalPaid || 0).toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td
                          className={`px-4 py-3 text-right whitespace-nowrap font-semibold ${
                            balance < 0
                              ? 'text-green-600'
                              : balance > 0
                              ? 'text-red-600'
                              : 'text-gray-700'
                          }`}
                        >
                          {balance.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                          {lastPayment
                            ? new Date(lastPayment.date).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                          {lastPayment?.receipt_number || '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColor}`}
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
