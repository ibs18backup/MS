// ibs18backup/abc/abc-main/sfms/app/dashboard/student/[studentID]/page.tsx
'use client';

import { supabase } from '@/lib/supabase';
import { notFound, useRouter } from 'next/navigation';
import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';

interface PageProps {
  params: { studentID: string };
}

type ClassType = { id: string; name: string };
type FeeType = {
  id: string;
  name: string;
  default_amount: number;
  description?: string | null;
};
type StudentFeeTypeLink = {
  fee_type_id: string;
  fee_type: FeeType;
  discount?: number | null;
  discount_description?: string | null;
};
type PaymentRecord = {
  id: string;
  amount_paid: number;
  date: string; // ISO string
  mode_of_payment: string;
  receipt_number?: string | null;
  description?: string | null;
};
type LedgerEntry = {
  id: string;
  date: string; // ISO string from converted bigint
  type: string;
  description: string;
  debit?: number | null;
  credit?: number | null;
  balance: number;
  receipt_number?: string | null;
};

type StudentData = {
  id: string;
  name: string;
  roll_no: string;
  academic_year: string;
  db_status?: string | null; // Status from DB if you have one
  class_id: string;
  class?: { name: string } | null;
  total_fees: number; // Total fees assigned from the students table
  student_fee_types: StudentFeeTypeLink[];
  payments: PaymentRecord[];
  ledger_entries: LedgerEntry[];
  // Dynamically calculated fields for display
  calculated_total_paid?: number;
  calculated_balance?: number;
  display_status?: string;
};

type FeeAdjustment = {
  discount: number;
  description: string;
};

// Helper function to determine payment status
const getPaymentStatus = (
  totalAssignedFees: number,
  totalActuallyPaid: number
): string => {
  if (totalAssignedFees <= 0 && totalActuallyPaid <= 0)
    return 'No Fees Assigned';
  if (totalActuallyPaid >= totalAssignedFees) return 'Fees Paid';
  if (totalActuallyPaid > 0 && totalActuallyPaid < totalAssignedFees)
    return 'Fees Partially Paid';
  if (totalActuallyPaid <= 0 && totalAssignedFees > 0) return 'Fees Unpaid';
  return 'Status Unknown'; // Fallback
};

export default function StudentDashboardPage({ params }: PageProps) {
  const router = useRouter();
  const { studentID } = params;

  const [student, setStudent] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoadingError, setInitialLoadingError] = useState<string | null>(
    null
  );

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<Partial<StudentData>>({});
  const [allClasses, setAllClasses] = useState<ClassType[]>([]);
  const [allFeeTypes, setAllFeeTypes] = useState<FeeType[]>([]);
  const [filteredFeeTypesForEdit, setFilteredFeeTypesForEdit] = useState<
    FeeType[]
  >([]);
  const [editSelectedFeeTypeIds, setEditSelectedFeeTypeIds] = useState<
    string[]
  >([]);
  const [editFeeAdjustments, setEditFeeAdjustments] = useState<{
    [feeTypeId: string]: FeeAdjustment;
  }>({});
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmDeleteName, setConfirmDeleteName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchStudentData = useCallback(async () => {
    setLoading(true);
    setInitialLoadingError(null);
    const { data, error } = await supabase
      .from('students')
      .select(
        `
        id,
        name,
        roll_no,
        academic_year,
        status, 
        class_id,
        class:class_id (name),
        total_fees,
        student_fee_types (
          fee_type_id,
          discount,
          discount_description,
          fee_type:fee_types!inner(id, name, default_amount, description)
        ),
        payments (
          id, amount_paid, date, mode_of_payment, receipt_number, description
        ),
        ledger_entries (
          id, date, type, description, debit, credit, balance, receipt_number
        )
      `
      )
      .eq('id', studentID)
      .single();

    if (error || !data) {
      setInitialLoadingError(
        `Failed to fetch student details. ${error?.message || ''}`
      );
      console.error('Fetch student error:', error);
      setStudent(null);
    } else {
      const payments = data.payments || [];
      const calculatedTotalPaid = payments.reduce(
        (sum: number, p: PaymentRecord) => sum + (p.amount_paid || 0),
        0
      );
      const totalAssignedFees = data.total_fees || 0;
      const calculatedBalance = totalAssignedFees - calculatedTotalPaid;
      const displayStatus = getPaymentStatus(
        totalAssignedFees,
        calculatedTotalPaid
      );

      const formattedData: StudentData = {
        ...data,
        db_status: data.status, // Keep original status if needed
        class: data.class_id ? (data.class as { name: string }) : null,
        student_fee_types: (data.student_fee_types || []).map((sft: any) => ({
          ...sft,
          fee_type: sft.fee_type as FeeType,
        })),
        payments: payments.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        ), // Sort payments, newest first
        ledger_entries: (data.ledger_entries || [])
          .map((entry) => ({
            ...entry,
            date: entry.date
              ? new Date(Number(entry.date)).toISOString()
              : new Date(0).toISOString(), // Assuming bigint is ms timestamp
          }))
          .sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          ), // Sort ledger, oldest first
        calculated_total_paid: calculatedTotalPaid,
        calculated_balance: calculatedBalance,
        display_status: displayStatus,
      };
      setStudent(formattedData);
    }
    setLoading(false);
  }, [studentID]);

  const fetchAuxiliaryDataForEdit = useCallback(async () => {
    const { data: classesData, error: classesError } = await supabase
      .from('classes')
      .select('id, name');
    if (classesError) toast.error('Failed to load classes for editing.');
    else setAllClasses(classesData || []);

    const { data: feeTypesData, error: feeTypesError } = await supabase
      .from('fee_types')
      .select('id, name, default_amount, description');
    if (feeTypesError) toast.error('Failed to load all fee types for editing.');
    else setAllFeeTypes(feeTypesData || []);
  }, [supabase]);

  useEffect(() => {
    fetchStudentData();
    fetchAuxiliaryDataForEdit();
  }, [fetchStudentData, fetchAuxiliaryDataForEdit]);

  useEffect(() => {
    if (
      !editForm.class_id ||
      allClasses.length === 0 ||
      allFeeTypes.length === 0
    ) {
      setFilteredFeeTypesForEdit([]);
      return;
    }
    async function fetchFilteredFeeTypesForEditModal() {
      const { data, error } = await supabase
        .from('fee_type_classes')
        .select(
          'fee_type:fee_types!inner(id, name, default_amount, description)'
        ) // Adjusted to match structure
        .eq('class_id', editForm.class_id!);

      if (error) {
        toast.error(
          'Failed to load fee types for selected class in edit mode.'
        );
        setFilteredFeeTypesForEdit([]);
        return;
      }
      const feeTypesForClass =
        data?.map((item: any) => item.fee_type as FeeType) || [];
      setFilteredFeeTypesForEdit(feeTypesForClass);
    }

    if (editForm.class_id) {
      fetchFilteredFeeTypesForEditModal();
    } else {
      setFilteredFeeTypesForEdit([]);
    }
  }, [editForm.class_id, supabase, allClasses, allFeeTypes]);

  const handleOpenEditModal = () => {
    if (!student) return;
    setEditForm({
      id: student.id,
      name: student.name,
      roll_no: student.roll_no,
      class_id: student.class_id,
      academic_year: student.academic_year,
    });
    const currentFeeTypeIds = student.student_fee_types.map(
      (sft) => sft.fee_type_id
    );
    setEditSelectedFeeTypeIds(currentFeeTypeIds);
    const adjustments: { [key: string]: FeeAdjustment } = {};
    student.student_fee_types.forEach((sft) => {
      adjustments[sft.fee_type_id] = {
        discount: sft.discount || 0,
        description: sft.discount_description || '',
      };
    });
    setEditFeeAdjustments(adjustments);
    setShowEditModal(true);
  };

  const handleEditFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
    if (name === 'class_id') {
      setEditSelectedFeeTypeIds([]);
      setEditFeeAdjustments({});
    }
  };

  const toggleEditFeeTypeSelection = (id: string) => {
    setEditSelectedFeeTypeIds((prev) =>
      prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
    );
  };

  const handleEditDiscountChange = (id: string, val: string) => {
    setEditFeeAdjustments((prev) => ({
      ...prev,
      [id]: {
        discount: parseFloat(val) || 0,
        description: prev[id]?.description || '',
      },
    }));
  };

  const handleEditDescChange = (id: string, val: string) => {
    setEditFeeAdjustments((prev) => ({
      ...prev,
      [id]: {
        discount: prev[id]?.discount || 0,
        description: val,
      },
    }));
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !editForm.name?.trim() ||
      !editForm.roll_no?.trim() ||
      !editForm.class_id ||
      !editForm.academic_year?.trim()
    ) {
      toast.error('Please fill all required fields.');
      return;
    }
    if (
      editSelectedFeeTypeIds.length === 0 &&
      filteredFeeTypesForEdit.length > 0
    ) {
      // Check if fee types were available for class
      toast.error(
        'At least one fee type must be assigned if fee types are available for the class.'
      );
      return;
    }

    setIsSubmittingEdit(true);
    let toastId = toast.loading('Updating student...');

    try {
      const applicableFeeTypes = filteredFeeTypesForEdit.filter((ft) =>
        editSelectedFeeTypeIds.includes(ft.id)
      );
      const total_fees = applicableFeeTypes.reduce((sum, ft) => {
        const adjustment = editFeeAdjustments[ft.id];
        const discount = adjustment?.discount || 0;
        return sum + (ft.default_amount || 0) - discount;
      }, 0);

      const { error: studentUpdateError } = await supabase
        .from('students')
        .update({
          name: editForm.name,
          roll_no: editForm.roll_no,
          class_id: editForm.class_id,
          academic_year: editForm.academic_year,
          total_fees: total_fees,
        })
        .eq('id', studentID);

      if (studentUpdateError) throw studentUpdateError;

      const { error: deleteLinksError } = await supabase
        .from('student_fee_types')
        .delete()
        .eq('student_id', studentID);

      if (deleteLinksError) throw deleteLinksError;

      if (editSelectedFeeTypeIds.length > 0) {
        const newFeeLinks = editSelectedFeeTypeIds.map((fee_type_id) => ({
          student_id: studentID,
          fee_type_id: fee_type_id,
          discount: editFeeAdjustments[fee_type_id]?.discount || 0,
          discount_description:
            editFeeAdjustments[fee_type_id]?.description || null,
        }));
        const { error: insertLinksError } = await supabase
          .from('student_fee_types')
          .insert(newFeeLinks);
        if (insertLinksError) throw insertLinksError;
      }

      // Potentially re-calculate and update student status in 'students' table via a Supabase function or here
      // For now, we rely on display_status which is client-side calculated.

      toast.success('Student updated successfully!', { id: toastId });
      setShowEditModal(false);
      fetchStudentData();
    } catch (error: any) {
      console.error('Update error:', error);
      toast.error(`Update failed: ${error.message}`, { id: toastId });
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!student || confirmDeleteName !== student.name) {
      toast.error('Confirmation name does not match.');
      return;
    }
    setIsDeleting(true);
    let toastId = toast.loading('Deleting student...');

    try {
      await supabase
        .from('ledger_entries')
        .delete()
        .eq('student_id', studentID);
      await supabase.from('payments').delete().eq('student_id', studentID);
      await supabase
        .from('student_fee_types')
        .delete()
        .eq('student_id', studentID);
      const { error: studentDeleteError } = await supabase
        .from('students')
        .delete()
        .eq('id', studentID);
      if (studentDeleteError) throw studentDeleteError;

      toast.success('Student deleted successfully! Redirecting...', {
        id: toastId,
        duration: 4000,
      });
      setShowDeleteModal(false);
      router.push('/dashboard/student-registration');
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(`Deletion failed: ${error.message}`, { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading && !student && !initialLoadingError) {
    return (
      <main className="p-6 max-w-6xl mx-auto text-center">
        Loading student data...
      </main>
    );
  }

  if (initialLoadingError) {
    return (
      <main className="p-6 max-w-6xl mx-auto text-center">
        <p className="text-red-500 text-xl mb-4">{initialLoadingError}</p>
        <button
          onClick={() => router.push('/dashboard/student-registration')}
          className="text-blue-600 underline hover:text-blue-800"
        >
          Return to Student List
        </button>
      </main>
    );
  }

  if (!student) {
    return (
      <main className="p-6 max-w-6xl mx-auto text-center">
        <p className="text-xl mb-4">Student not found.</p>
        <button
          onClick={() => router.push('/dashboard/student-registration')}
          className="text-blue-600 underline hover:text-blue-800"
        >
          Return to Student List
        </button>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-gray-800">Student Dashboard</h1>
        <div className="flex space-x-2 flex-shrink-0">
          <button
            onClick={handleOpenEditModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded shadow-md transition duration-150 ease-in-out"
          >
            Edit Profile
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded shadow-md transition duration-150 ease-in-out"
          >
            Delete Student
          </button>
        </div>
      </div>

      <section className="mb-8 p-4 sm:p-6 bg-white shadow-lg rounded-lg">
        <h2 className="text-xl font-semibold mb-3 text-gray-700 border-b pb-2">
          Profile
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-gray-700">
          <p>
            <strong>Name:</strong> {student.name}
          </p>
          <p>
            <strong>Roll No:</strong> {student.roll_no}
          </p>
          <p>
            <strong>Class:</strong> {student.class?.name || 'N/A'}
          </p>
          <p>
            <strong>Academic Year:</strong> {student.academic_year}
          </p>
          <p>
            <strong>Total Assigned Fees:</strong> ₹
            {student.total_fees?.toFixed(2)}
          </p>
          <p>
            <strong>Total Paid:</strong> ₹
            {student.calculated_total_paid?.toFixed(2) ?? '0.00'}
          </p>
          <p>
            <strong>Balance Due:</strong>{' '}
            <span
              className={`font-bold ${
                (student.calculated_balance || 0) > 0
                  ? 'text-red-600'
                  : 'text-green-600'
              }`}
            >
              ₹{student.calculated_balance?.toFixed(2) ?? '0.00'}
            </span>
          </p>
          <p>
            <strong>Status:</strong>
            <span
              className={`ml-2 px-2.5 py-1 rounded-full text-xs font-semibold ${
                student.display_status === 'Fees Paid'
                  ? 'bg-green-100 text-green-800'
                  : student.display_status === 'Fees Partially Paid'
                  ? 'bg-yellow-100 text-yellow-800'
                  : student.display_status === 'No Fees Assigned'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-red-100 text-red-800' // Fees Unpaid or other
              }`}
            >
              {student.display_status || 'N/A'}
            </span>
          </p>
        </div>
      </section>

      <section className="mb-8 p-4 sm:p-6 bg-white shadow-lg rounded-lg">
        <h2 className="text-xl font-semibold mb-3 text-gray-700 border-b pb-2">
          Assigned Fee Types
        </h2>
        {student.student_fee_types.length > 0 ? (
          <ul className="list-disc pl-5 space-y-2 text-gray-700">
            {student.student_fee_types.map((item) => (
              <li key={item.fee_type_id}>
                <span className="font-medium">{item.fee_type.name}</span>: ₹
                {(item.fee_type.default_amount - (item.discount || 0)).toFixed(
                  2
                )}
                {item.discount ? (
                  <span className="text-sm text-green-700 ml-1">
                    (Original: ₹{item.fee_type.default_amount.toFixed(2)},
                    Discount: ₹{item.discount.toFixed(2)})
                  </span>
                ) : (
                  ''
                )}
                {item.fee_type.description ? (
                  <span className="text-xs text-gray-500 block ml-4">
                    - {item.fee_type.description}
                  </span>
                ) : (
                  ''
                )}
                {item.discount_description ? (
                  <span className="text-xs text-gray-500 block ml-4">
                    - Discount Note: {item.discount_description}
                  </span>
                ) : (
                  ''
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 italic">
            No specific fee types assigned. General class fees may apply.
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <section className="p-4 sm:p-6 bg-white shadow-lg rounded-lg">
          <h2 className="text-xl font-semibold mb-3 text-gray-700 border-b pb-2">
            Payments
          </h2>
          {student.payments.length > 0 ? (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full table-auto border-collapse text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="border px-3 py-2 text-left font-medium text-gray-600">
                      Date
                    </th>
                    <th className="border px-3 py-2 text-right font-medium text-gray-600">
                      Amount (₹)
                    </th>
                    <th className="border px-3 py-2 text-left font-medium text-gray-600">
                      Mode
                    </th>
                    <th className="border px-3 py-2 text-left font-medium text-gray-600">
                      Receipt #
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {student.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 border-b">
                      <td className="px-3 py-2">
                        {new Date(p.date).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {p.amount_paid.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 capitalize">
                        {p.mode_of_payment.replace(/_/g, ' ')}
                      </td>
                      <td className="px-3 py-2">{p.receipt_number || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 italic">No payments recorded.</p>
          )}
        </section>

        <section className="p-4 sm:p-6 bg-white shadow-lg rounded-lg">
          <h2 className="text-xl font-semibold mb-3 text-gray-700 border-b pb-2">
            Ledger Entries
          </h2>
          {student.ledger_entries.length > 0 ? (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full table-auto border-collapse text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="border px-3 py-2 text-left font-medium text-gray-600">
                      Date
                    </th>
                    <th className="border px-3 py-2 text-left font-medium text-gray-600">
                      Description
                    </th>
                    <th className="border px-3 py-2 text-right font-medium text-gray-600">
                      Debit (₹)
                    </th>
                    <th className="border px-3 py-2 text-right font-medium text-gray-600">
                      Credit (₹)
                    </th>
                    <th className="border px-3 py-2 text-right font-medium text-gray-600">
                      Balance (₹)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {student.ledger_entries.map((l) => (
                    <tr key={l.id} className="hover:bg-gray-50 border-b">
                      <td className="px-3 py-2">
                        {new Date(l.date).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2">
                        {l.description} ({l.type})
                      </td>
                      <td className="px-3 py-2 text-right text-red-600">
                        {l.debit ? l.debit.toFixed(2) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right text-green-600">
                        {l.credit ? l.credit.toFixed(2) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {l.balance.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 italic">No ledger entries found.</p>
          )}
        </section>
      </div>

      {/* Edit Student Modal */}
      {showEditModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100] p-4"
          onClick={() => setShowEditModal(false)}
        >
          <div
            className="bg-white p-5 sm:p-7 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-6 text-gray-800">
              Edit Student: {student?.name}
            </h2>
            <form onSubmit={handleUpdateStudent} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={editForm.name || ''}
                  onChange={handleEditFormChange}
                  className="mt-1 block w-full p-2.5 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Roll Number
                </label>
                <input
                  type="text"
                  name="roll_no"
                  value={editForm.roll_no || ''}
                  onChange={handleEditFormChange}
                  className="mt-1 block w-full p-2.5 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Class
                </label>
                <select
                  name="class_id"
                  value={editForm.class_id || ''}
                  onChange={handleEditFormChange}
                  className="mt-1 block w-full p-2.5 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  required
                >
                  <option value="">Select Class</option>
                  {allClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Academic Year
                </label>
                <select
                  name="academic_year"
                  value={editForm.academic_year || ''}
                  onChange={handleEditFormChange}
                  className="mt-1 block w-full p-2.5 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  required
                >
                  <option value="">Select Academic Year</option>
                  <option value="2023-2024">2023-2024</option>
                  <option value="2024-2025">2024-2025</option>
                  <option value="2025-2026">2025-2026</option>
                </select>
              </div>

              {editForm.class_id && (
                <div className="space-y-3 border rounded-md p-4 max-h-60 overflow-y-auto bg-gray-50">
                  <h3 className="text-md font-semibold text-gray-700 mb-2">
                    Assign Fee Types for{' '}
                    {allClasses.find((c) => c.id === editForm.class_id)?.name ||
                      'Selected Class'}
                  </h3>
                  {filteredFeeTypesForEdit.length > 0 ? (
                    filteredFeeTypesForEdit.map((ft) => (
                      <div
                        key={ft.id}
                        className="p-3 border rounded-md bg-white shadow-sm"
                      >
                        <label className="flex items-center space-x-3 mb-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                            checked={editSelectedFeeTypeIds.includes(ft.id)}
                            onChange={() => toggleEditFeeTypeSelection(ft.id)}
                          />
                          <span className="text-sm font-medium text-gray-800">
                            {ft.name} (Default: ₹{ft.default_amount.toFixed(2)})
                          </span>
                        </label>
                        {editSelectedFeeTypeIds.includes(ft.id) && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 pl-3">
                            <input
                              type="number"
                              placeholder="Discount (₹)"
                              min="0"
                              max={ft.default_amount}
                              value={editFeeAdjustments[ft.id]?.discount || ''}
                              onChange={(e) =>
                                handleEditDiscountChange(ft.id, e.target.value)
                              }
                              className="p-2 border border-gray-300 rounded-md w-full text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            />
                            <input
                              type="text"
                              placeholder="Discount Description"
                              value={
                                editFeeAdjustments[ft.id]?.description || ''
                              }
                              onChange={(e) =>
                                handleEditDescChange(ft.id, e.target.value)
                              }
                              className="p-2 border border-gray-300 rounded-md w-full text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            />
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 italic">
                      No specific fee types configured for this class.
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-5 border-t mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={isSubmittingEdit}
                  className="px-5 py-2.5 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out"
                >
                  {' '}
                  Cancel{' '}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2.5 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 transition duration-150 ease-in-out"
                >
                  {' '}
                  {isSubmittingEdit ? 'Saving...' : 'Save Changes'}{' '}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && student && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[100] p-4"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-3 text-red-600">
              Confirm Deletion
            </h2>
            <p className="mb-4 text-gray-700 text-sm">
              You are about to delete the student:{' '}
              <strong>{student.name}</strong> (Roll No: {student.roll_no}). This
              action is irreversible and will remove all associated fee records,
              payments, and ledger entries.
            </p>
            <label
              className="block mb-1 text-sm font-medium text-gray-700"
              htmlFor="confirmDeleteStudentName"
            >
              To confirm, please type the student's full name:{' '}
              <span className="font-semibold">{student.name}</span>
            </label>
            <input
              id="confirmDeleteStudentName"
              type="text"
              value={confirmDeleteName}
              onChange={(e) => setConfirmDeleteName(e.target.value)}
              placeholder="Type full name here"
              className="w-full p-2.5 border border-gray-300 rounded-md mb-5 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-md border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out"
              >
                {' '}
                Cancel{' '}
              </button>
              <button
                type="button"
                onClick={handleDeleteStudent}
                disabled={isDeleting || confirmDeleteName !== student.name}
                className="px-5 py-2.5 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition duration-150 ease-in-out"
              >
                {' '}
                {isDeleting ? 'Deleting...' : 'Confirm & Delete'}{' '}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
