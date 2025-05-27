// sfms/app/dashboard/record-payment/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toast } from 'sonner';
import { Database } from '@/lib/database.types';
import { useAuth } from '@/components/AuthContext';

type ClassType = Pick<
  Database['public']['Tables']['classes']['Row'],
  'id' | 'name'
>;
type StudentListItem = Pick<
  Database['public']['Tables']['students']['Row'],
  'id' | 'name' | 'roll_no' | 'class_id' | 'school_id'
> & {
  classes?: { name?: string | null } | null;
};
type PaymentType = Database['public']['Tables']['payments']['Row'];
type PaymentInsert = Database['public']['Tables']['payments']['Insert'];

export default function RecordPaymentPage() {
  const supabase = createClientComponentClient<Database>();
  // Correctly destructure isLoading as authLoading
  const {
    user,
    schoolId,
    isLoading: authLoading,
    isSchoolInfoLoading,
  } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('');
  const [allStudentsInSchool, setAllStudentsInSchool] = useState<
    StudentListItem[]
  >([]);
  const [filteredStudentList, setFilteredStudentList] = useState<
    StudentListItem[]
  >([]);
  const [selectedStudent, setSelectedStudent] =
    useState<StudentListItem | null>(null);

  const [amountPaid, setAmountPaid] = useState('');
  const [modeOfPayment, setModeOfPayment] = useState('cash');
  const [description, setDescription] = useState('');
  const [manualReceiptNumber, setManualReceiptNumber] = useState('');

  const [classes, setClasses] = useState<ClassType[]>([]);
  const [studentPaymentsHistory, setStudentPaymentsHistory] = useState<
    PaymentType[]
  >([]);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isFetchingPageData, setIsFetchingPageData] = useState(true); // Renamed for clarity

  const fetchClassesAndInitialStudents = useCallback(async () => {
    if (!schoolId || !user) {
      setClasses([]);
      setAllStudentsInSchool([]);
      setIsFetchingPageData(false);
      return;
    }

    setIsFetchingPageData(true);
    try {
      const [classesRes, studentsRes] = await Promise.all([
        supabase
          .from('classes')
          .select('id, name')
          .eq('school_id', schoolId)
          .order('name'),
        supabase
          .from('students')
          .select('id, name, roll_no, class_id, school_id, classes(name)')
          .eq('school_id', schoolId)
          .order('name'),
      ]);

      if (classesRes.error) {
        toast.error('Failed to load classes');
      } else {
        setClasses(classesRes.data || []);
      }

      if (studentsRes.error) {
        toast.error('Failed to load students');
      } else {
        setAllStudentsInSchool(studentsRes.data || []);
      }
    } catch (error) {
      toast.error('An error occurred while loading initial data.');
    } finally {
      setIsFetchingPageData(false);
    }
  }, [supabase, schoolId, user]);

  const fetchStudentsByClass = useCallback(async () => {
    if (!schoolId || !user) {
      setAllStudentsInSchool([]);
      setIsFetchingPageData(false);
      return;
    }
    if (!selectedClassFilter) {
      fetchClassesAndInitialStudents();
      return;
    }

    setIsFetchingPageData(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, name, roll_no, class_id, school_id, classes(name)')
        .eq('school_id', schoolId)
        .eq('class_id', selectedClassFilter)
        .order('name');

      if (error) {
        toast.error(`Failed to load students for class: ${error.message}`);
        setAllStudentsInSchool([]);
      } else {
        setAllStudentsInSchool(data || []);
      }
    } catch (error) {
      toast.error('An error occurred while fetching students for class.');
    } finally {
      setIsFetchingPageData(false);
    }
  }, [
    supabase,
    schoolId,
    user,
    selectedClassFilter,
    fetchClassesAndInitialStudents,
  ]);

  const fetchStudentPaymentHistory = useCallback(async () => {
    if (!selectedStudent || !selectedStudent.id || !schoolId) {
      setStudentPaymentsHistory([]);
      return;
    }
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('student_id', selectedStudent.id)
      .eq('school_id', schoolId)
      .order('date', { ascending: false });

    if (error) {
      toast.error('Failed to fetch payment history');
    } else {
      setStudentPaymentsHistory(data || []);
    }
  }, [supabase, schoolId, selectedStudent]);

  useEffect(() => {
    if (user && schoolId && !authLoading && !isSchoolInfoLoading) {
      fetchClassesAndInitialStudents();
    } else {
      // Ensure page loading reflects auth loading state
      setIsFetchingPageData(authLoading || isSchoolInfoLoading);
    }
    // Correct dependency array:
  }, [
    user,
    schoolId,
    authLoading,
    isSchoolInfoLoading,
    fetchClassesAndInitialStudents,
  ]);

  useEffect(() => {
    if (schoolId && user && !authLoading && !isSchoolInfoLoading) {
      // Ensure auth is resolved and user/schoolId available
      fetchStudentsByClass();
    }
  }, [
    selectedClassFilter,
    schoolId,
    user,
    authLoading,
    isSchoolInfoLoading,
    fetchStudentsByClass,
  ]);

  useEffect(() => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    if (!lowerSearchTerm) {
      setFilteredStudentList(allStudentsInSchool);
    } else {
      const filtered = allStudentsInSchool.filter(
        (s) =>
          s.name.toLowerCase().includes(lowerSearchTerm) ||
          (s.roll_no && s.roll_no.toLowerCase().includes(lowerSearchTerm))
      );
      setFilteredStudentList(filtered);
    }
  }, [searchTerm, allStudentsInSchool]);

  useEffect(() => {
    if (selectedStudent && schoolId) {
      fetchStudentPaymentHistory();
    } else {
      setStudentPaymentsHistory([]);
    }
    // Refresh history also when a payment is NOT being submitted anymore (i.e., it just finished)
  }, [
    selectedStudent,
    schoolId,
    fetchStudentPaymentHistory,
    isSubmittingPayment,
  ]);

  const handleStudentSelection = (student: StudentListItem) => {
    if (student.school_id !== schoolId) {
      toast.error('Error: This student does not belong to your school.');
      setSelectedStudent(null);
      return;
    }
    setSelectedStudent(student);
    setAmountPaid('');
    setModeOfPayment('cash');
    setDescription('');
    setManualReceiptNumber('');
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedStudent.id || !schoolId) {
      toast.error(
        !selectedStudent
          ? 'Please select a student.'
          : 'School information is missing.'
      );
      return;
    }
    if (!amountPaid || isNaN(Number(amountPaid)) || Number(amountPaid) <= 0) {
      toast.error('Enter a valid payment amount.');
      return;
    }

    const generatedReceiptNumber = manualReceiptNumber.trim()
      ? manualReceiptNumber.trim()
      : `R-${Date.now()}`;
    setIsSubmittingPayment(true);
    const toastId = toast.loading('Recording payment...');

    const paymentData: PaymentInsert = {
      student_id: selectedStudent.id,
      school_id: schoolId,
      amount_paid: parseFloat(amountPaid),
      date: new Date().toISOString(),
      mode_of_payment: modeOfPayment,
      description: description.trim() || null,
      receipt_number: generatedReceiptNumber,
    };

    try {
      const { error } = await supabase.from('payments').insert(paymentData);
      if (error) {
        toast.error(`Failed to record payment: ${error.message}`, {
          id: toastId,
        });
      } else {
        toast.success(
          `Payment recorded. Receipt #: ${generatedReceiptNumber}`,
          { id: toastId }
        );
        setAmountPaid('');
        setModeOfPayment('cash');
        setDescription('');
        setManualReceiptNumber('');
      }
    } catch (err: any) {
      toast.error(
        err.message || 'An unexpected error occurred during payment.',
        { id: toastId }
      );
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  if (authLoading || (isSchoolInfoLoading && !schoolId)) {
    return <div className="p-6 text-center">Loading payment module...</div>;
  }
  if (!user) {
    return <div className="p-6 text-center">Please log in.</div>;
  }
  if (!schoolId && !isSchoolInfoLoading) {
    return (
      <div className="p-6 text-center text-red-500">
        School information unavailable. Payment recording disabled.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 bg-slate-50 min-h-screen">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center text-indigo-700">
        Record Student Payment
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4 p-4 bg-white rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
            Find Student
          </h3>
          <input
            type="text"
            placeholder="Search Name or Roll No."
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm transition-shadow"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={isFetchingPageData && allStudentsInSchool.length === 0}
          />
          <select
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm transition-shadow"
            value={selectedClassFilter}
            onChange={(e) => {
              setSelectedClassFilter(e.target.value);
              setSelectedStudent(null);
            }}
            disabled={isFetchingPageData && classes.length === 0}
          >
            <option value="">All Classes</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>

          {isFetchingPageData && filteredStudentList.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-3">
              Loading students...
            </p>
          )}
          <div className="border border-gray-200 rounded-lg max-h-80 min-h-[100px] overflow-y-auto bg-slate-50 shadow-inner">
            {!isFetchingPageData && filteredStudentList.length > 0
              ? filteredStudentList.map((student) => (
                  <div
                    key={student.id}
                    className={`p-3.5 cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-indigo-50 transition-colors duration-150 ease-in-out ${
                      selectedStudent?.id === student.id
                        ? 'bg-indigo-200 font-semibold text-indigo-800'
                        : 'hover:bg-slate-100'
                    }`}
                    onClick={() => handleStudentSelection(student)}
                  >
                    <div className="font-medium text-gray-800">
                      {student.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      Roll: {student.roll_no} | Class:{' '}
                      {student.classes?.name || 'N/A'}
                    </div>
                  </div>
                ))
              : !isFetchingPageData && (
                  <div className="p-5 text-gray-500 text-center italic">
                    No students found for current filter.
                  </div>
                )}
          </div>
        </div>

        <div className="md:col-span-2 bg-white p-6 sm:p-8 rounded-xl shadow-lg">
          {!selectedStudent && (
            <div className="text-center text-gray-400 py-20 h-full flex flex-col items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-16 w-16 text-gray-300 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <p className="text-lg">Select a student to record a payment.</p>
            </div>
          )}

          {selectedStudent && (
            <>
              <h2 className="text-xl font-semibold mb-1 text-indigo-700">
                New Payment for:{' '}
                <span className="font-bold">{selectedStudent.name}</span>
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Roll: {selectedStudent.roll_no} | Class:{' '}
                {selectedStudent.classes?.name || 'N/A'}
              </p>

              <form onSubmit={handleSubmitPayment} className="space-y-5">
                <div>
                  <label
                    htmlFor="amountPaid"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="amountPaid"
                    type="number"
                    min="0.01"
                    step="any"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    required
                    className="mt-1 w-full p-2.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                    placeholder="Enter amount"
                    disabled={isSubmittingPayment}
                  />
                </div>
                <div>
                  <label
                    htmlFor="modeOfPayment"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Mode of Payment
                  </label>
                  <select
                    id="modeOfPayment"
                    value={modeOfPayment}
                    onChange={(e) => setModeOfPayment(e.target.value)}
                    className="mt-1 w-full p-2.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white transition-shadow"
                    disabled={isSubmittingPayment}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="dd">Demand Draft</option>
                    <option value="online_portal">Online Portal</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="manualReceiptNumber"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Receipt Number (Optional)
                  </label>
                  <input
                    id="manualReceiptNumber"
                    type="text"
                    value={manualReceiptNumber}
                    onChange={(e) => setManualReceiptNumber(e.target.value)}
                    placeholder="Auto-generated if blank"
                    className="mt-1 w-full p-2.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                    disabled={isSubmittingPayment}
                  />
                </div>
                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Description/Notes (Optional)
                  </label>
                  <input
                    id="description"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g., Term 1 fees, Fine payment"
                    className="mt-1 w-full p-2.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
                    disabled={isSubmittingPayment}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingPayment || !selectedStudent}
                  className={`w-full py-2.5 px-4 rounded-lg text-white font-semibold transition-colors duration-150 ease-in-out ${
                    isSubmittingPayment || !selectedStudent
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                  }`}
                >
                  {isSubmittingPayment
                    ? 'Processing Payment...'
                    : 'Record Payment'}
                </button>
              </form>

              {studentPaymentsHistory.length > 0 && (
                <div className="mt-10">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 border-t border-gray-200 pt-6">
                    Payment History
                  </h3>
                  <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                    <table className="min-w-full bg-white text-sm">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-medium uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-4 py-2.5 text-left font-medium uppercase tracking-wider">
                            Amount (₹)
                          </th>
                          <th className="px-4 py-2.5 text-left font-medium uppercase tracking-wider">
                            Mode
                          </th>
                          <th className="px-4 py-2.5 text-left font-medium uppercase tracking-wider">
                            Receipt #
                          </th>
                          <th className="px-4 py-2.5 text-left font-medium uppercase tracking-wider">
                            Description
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {studentPaymentsHistory.map((p) => (
                          <tr
                            key={p.id}
                            className="hover:bg-slate-50 transition-colors"
                          >
                            <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                              {new Date(p.date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-700 text-right">
                              {p.amount_paid.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-700 capitalize">
                              {p.mode_of_payment.replace('_', ' ')}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                              {p.receipt_number}
                            </td>
                            <td
                              className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate"
                              title={p.description || undefined}
                            >
                              {p.description || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {selectedStudent &&
                studentPaymentsHistory.length === 0 &&
                !isSubmittingPayment && ( // Check isSubmittingPayment here
                  <p className="mt-8 text-center text-sm text-gray-500 italic">
                    No payment history found for {selectedStudent.name}.
                  </p>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
