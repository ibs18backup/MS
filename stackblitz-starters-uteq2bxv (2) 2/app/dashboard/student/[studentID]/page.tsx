// sfms/app/dashboard/student/[studentID]/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation'; // useParams to get studentID
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toast } from 'sonner';
import { Database } from '@/lib/database.types';
import { useAuth } from '@/components/AuthContext';
import Link from 'next/link';

// Type definitions
type StudentRow = Database['public']['Tables']['students']['Row'];
type ClassRow = Database['public']['Tables']['classes']['Row'];
type PaymentRow = Database['public']['Tables']['payments']['Row'];
type FeeTypeRow = Database['public']['Tables']['fee_types']['Row'];
type StudentFeeTypeRow =
  Database['public']['Tables']['student_fee_types']['Row'];

type AssignedFeeDetail = FeeTypeRow & {
  assigned_amount: number; // From student_fee_types (could be default_amount from fee_types)
  discount: number;
  discount_description: string | null;
  net_payable_amount: number; // Calculated
};

type StudentDetails = StudentRow & {
  classes?: Pick<ClassRow, 'name'> | null; // For class name
  payments?: PaymentRow[];
  student_fee_types?: (Pick<
    StudentFeeTypeRow,
    | 'assigned_amount'
    | 'discount'
    | 'discount_description'
    | 'net_payable_amount'
  > & {
    fee_type: FeeTypeRow | null;
  })[];
  // Calculated/Derived
  totalPaid?: number;
  balance?: number;
  assignedFeeDetails?: AssignedFeeDetail[];
  class_name?: string;
};

export default function StudentDetailPage() {
  const supabase = createClientComponentClient<Database>();
  const params = useParams();
  const router = useRouter();
  const {
    user,
    schoolId,
    isLoading: authLoading,
    isSchoolInfoLoading,
  } = useAuth();

  const studentID =
    typeof params.studentID === 'string' ? params.studentID : null;

  const [student, setStudent] = useState<StudentDetails | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(true);

  const fetchStudentDetails = useCallback(async () => {
    if (!studentID || !schoolId || !user) {
      setIsLoadingPage(false);
      if (user && schoolId) toast.error('Invalid student ID.');
      return;
    }

    console.log(
      'StudentDetailPage/fetchStudentDetails: Fetching for studentID:',
      studentID,
      'schoolId:',
      schoolId
    );
    setIsLoadingPage(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select(
          `
          *, 
          classes (name),
          payments (*),
          student_fee_types (
            assigned_amount, 
            discount, 
            discount_description, 
            net_payable_amount, 
            fee_type: fee_types (*)
          )
        `
        )
        .eq('id', studentID)
        .eq('school_id', schoolId) // CRITICAL: Ensure student belongs to the admin's school
        .single();

      if (error) {
        throw error;
      }

      if (data) {
        const totalPaid =
          data.payments?.reduce((sum, p) => sum + p.amount_paid, 0) || 0;

        const assignedFeeDetails: AssignedFeeDetail[] =
          (data.student_fee_types
            ?.map((sft) => {
              const feeType = sft.fee_type as FeeTypeRow; // Type assertion
              const assignedAmount =
                sft.assigned_amount || feeType?.default_amount || 0;
              const discount = sft.discount || 0;
              return {
                ...(feeType || {}), // Spread fee_type details, handle if null
                id: feeType?.id || 'unknown-fee-' + Math.random(), // Provide a fallback id
                name: feeType?.name || 'Unknown Fee Type',
                default_amount: feeType?.default_amount || 0,
                scheduled_date: feeType?.scheduled_date || null,
                assigned_amount: assignedAmount,
                discount: discount,
                discount_description: sft.discount_description,
                net_payable_amount:
                  sft.net_payable_amount ?? assignedAmount - discount,
              };
            })
            .filter(Boolean) as AssignedFeeDetail[]) || []; // Filter out any nulls if fee_type was missing

        const totalAssigned = data.total_fees || 0; // Use total_fees from student record

        setStudent({
          ...data,
          class_name: data.classes?.name || 'N/A',
          totalPaid: totalPaid,
          balance: totalAssigned - totalPaid,
          assignedFeeDetails: assignedFeeDetails,
        });
      } else {
        toast.error('Student not found or access denied.');
        setStudent(null);
      }
    } catch (err: any) {
      console.error('Failed to load student details:', err);
      toast.error(`Failed to load student details: ${err.message}`);
      setStudent(null);
    } finally {
      setIsLoadingPage(false);
    }
  }, [supabase, studentID, schoolId, user]);

  useEffect(() => {
    if (user && schoolId && studentID && !authLoading && !isSchoolInfoLoading) {
      fetchStudentDetails();
    } else if (!authLoading && !isSchoolInfoLoading && (!user || !schoolId)) {
      // If auth is loaded but no user/schoolId, don't attempt fetch, show appropriate message
      setIsLoadingPage(false);
    }
  }, [
    user,
    schoolId,
    studentID,
    authLoading,
    isSchoolInfoLoading,
    fetchStudentDetails,
  ]);

  // --- UI Render ---
  if (authLoading || (isSchoolInfoLoading && !schoolId)) {
    return (
      <div className="p-6 text-center">Loading student profile module...</div>
    );
  }
  if (!user) {
    // This should be caught by DashboardLayout, but as a safeguard
    router.push('/login'); // Or show a "Please log in" message
    return <div className="p-6 text-center">Redirecting to login...</div>;
  }
  if (!schoolId && !isSchoolInfoLoading) {
    return (
      <div className="p-6 text-center text-red-500">
        School information unavailable. Cannot display student details.
      </div>
    );
  }
  if (isLoadingPage) {
    return <div className="p-6 text-center">Loading student details...</div>;
  }
  if (!student) {
    return (
      <div className="p-6 text-center text-red-500">
        Student not found or you do not have permission to view this student's
        details. Ensure the student ID is correct and the student belongs to
        your school.
        <br />
        <Link
          href="/dashboard/master-ledger"
          className="text-indigo-600 hover:underline mt-4 inline-block"
        >
          Back to Master Ledger
        </Link>
      </div>
    );
  }

  // Calculations for display
  const totalAssignedFees = student.total_fees || 0; // From student record
  const totalPaid = student.totalPaid || 0;
  const currentBalance = totalAssignedFees - totalPaid;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            Back
          </button>
        </div>

        {/* Student Profile Card */}
        <div className="bg-white shadow-xl rounded-xl overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 sm:p-8">
            <h1 className="text-3xl font-bold text-white">{student.name}</h1>
            <p className="text-indigo-200 mt-1">Roll No: {student.roll_no}</p>
            <p className="text-indigo-200">Class: {student.class_name}</p>
            <p className="text-indigo-200">
              Academic Year: {student.academic_year}
            </p>
          </div>
          <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-gray-200">
            <div>
              <h3 className="text-sm font-medium text-gray-500">
                Total Assigned Fees
              </h3>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                ₹{totalAssignedFees.toFixed(2)}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Total Paid</h3>
              <p className="mt-1 text-2xl font-semibold text-green-600">
                ₹{totalPaid.toFixed(2)}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">
                Current Balance
              </h3>
              <p
                className={`mt-1 text-2xl font-semibold ${
                  currentBalance > 0
                    ? 'text-red-600'
                    : currentBalance < 0
                    ? 'text-yellow-500'
                    : 'text-gray-900'
                }`}
              >
                ₹{currentBalance.toFixed(2)}
                {currentBalance < 0 && (
                  <span className="text-xs ml-1">(Advance)</span>
                )}
              </p>
            </div>
          </div>
          <div className="px-6 sm:px-8 pb-6 text-right">
            <Link
              href={`/dashboard/record-payment?studentId=${student.id}`}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Record New Payment for {student.name.split(' ')[0]}
            </Link>
          </div>
        </div>

        {/* Assigned Fee Details */}
        {student.assignedFeeDetails &&
          student.assignedFeeDetails.length > 0 && (
            <div className="bg-white shadow-xl rounded-xl p-6 sm:p-8 mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Assigned Fee Structure
              </h2>
              <div className="space-y-3">
                {student.assignedFeeDetails.map((fee) => (
                  <div
                    key={fee.id || fee.name}
                    className="p-3 border rounded-md bg-slate-50 flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium text-gray-700">{fee.name}</p>
                      <p className="text-xs text-gray-500">
                        Default: ₹{fee.default_amount.toFixed(2)}
                        {fee.discount > 0 &&
                          `, Discount: ₹${fee.discount.toFixed(2)}`}
                      </p>
                      {fee.discount > 0 && fee.discount_description && (
                        <p className="text-xs text-gray-500 italic">
                          Note: {fee.discount_description}
                        </p>
                      )}
                    </div>
                    <p className="text-lg font-semibold text-indigo-600">
                      ₹{fee.net_payable_amount.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Payment History */}
        <div className="bg-white shadow-xl rounded-xl p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Payment History
          </h2>
          {student.payments && student.payments.length > 0 ? (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Date
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Amount Paid (₹)
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Mode
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Receipt #
                    </th>
                    <th
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {student.payments
                    .sort(
                      (a, b) =>
                        new Date(b.date).getTime() - new Date(a.date).getTime()
                    )
                    .map((payment) => (
                      <tr key={payment.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                          {new Date(payment.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 text-right">
                          {payment.amount_paid.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 capitalize">
                          {payment.mode_of_payment.replace('_', ' ')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                          {payment.receipt_number}
                        </td>
                        <td
                          className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate"
                          title={payment.description || undefined}
                        >
                          {payment.description || '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 italic">
              No payment history found for this student.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
