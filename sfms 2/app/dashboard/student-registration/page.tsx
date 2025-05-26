'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

type ClassType = { id: string; name: string };
type FeeType = { id: string; name: string; default_amount: number };
type Student = {
  id: string;
  name: string;
  roll_no: string;
  class_id: string;
  class_name: string;
  total_fees: number;
  fee_types: (FeeType & { discount?: number; description?: string })[];
  academic_year: string;
};

export default function StudentRegistrationPage() {
  const [name, setName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [classes, setClasses] = useState<ClassType[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [filteredFeeTypes, setFilteredFeeTypes] = useState<FeeType[]>([]);
  const [selectedFeeTypeIds, setSelectedFeeTypeIds] = useState<string[]>([]);
  const [feeAdjustments, setFeeAdjustments] = useState<{
    [feeTypeId: string]: { discount: number; description: string };
  }>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [academicYear, setAcademicYear] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // For edit mode
  const [editStudentId, setEditStudentId] = useState<string | null>(null);

  // For delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStudent, setDeleteStudent] = useState<Student | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState('');

  useEffect(() => {
    fetchClasses();
    fetchFeeTypes();
    fetchStudents();
  }, []);

  async function fetchClasses() {
    const { data, error } = await supabase.from('classes').select('id, name');
    if (error) setErrorMsg('Failed to load classes');
    else setClasses(data || []);
  }

  async function fetchFeeTypes() {
    const { data, error } = await supabase
      .from('fee_types')
      .select('id, name, default_amount');
    if (error) setErrorMsg('Failed to load fee types');
    else setFeeTypes(data || []);
  }

  async function fetchStudents() {
    const { data, error } = await supabase.from('students').select(
      `
        id,
        name,
        roll_no,
        class_id,
        total_fees,
        academic_year,
        classes!inner(name),
        student_fee_types!inner(
          discount,
          discount_description,
          fee_types!inner(id, name, default_amount)
        )
      `
    );

    if (error) {
      setErrorMsg('Failed to load students');
      return;
    }

    const studentsData: Student[] = (data || []).map((student: any) => ({
      id: student.id,
      name: student.name,
      roll_no: student.roll_no,
      class_id: student.class_id,
      class_name: student.classes.name,
      total_fees: student.total_fees,
      academic_year: student.academic_year,
      fee_types: student.student_fee_types.map((sft: any) => ({
        ...sft.fee_types,
        discount: sft.discount,
        description: sft.discount_description,
      })),
    }));

    setStudents(studentsData);
  }

  useEffect(() => {
    if (!selectedClassId) {
      setFilteredFeeTypes([]);
      setSelectedFeeTypeIds([]);
      return;
    }

    async function fetchFilteredFeeTypes() {
      const { data, error } = await supabase
        .from('fee_type_classes')
        .select('fee_types(id, name, default_amount)')
        .eq('class_id', selectedClassId);

      if (error) {
        setErrorMsg('Failed to load fee types for class');
        setFilteredFeeTypes([]);
        return;
      }

      const feeTypesForClass = data?.map((item: any) => item.fee_types) || [];
      setFilteredFeeTypes(feeTypesForClass);
      setSelectedFeeTypeIds([]);
      setFeeAdjustments({});
    }

    fetchFilteredFeeTypes();
  }, [selectedClassId]);

  function toggleFeeTypeSelection(id: string) {
    setSelectedFeeTypeIds((prev) =>
      prev.includes(id) ? prev.filter((fid) => fid !== id) : [...prev, id]
    );
  }

  function handleDiscountChange(id: string, val: string) {
    setFeeAdjustments((prev) => ({
      ...prev,
      [id]: {
        discount: parseFloat(val) || 0,
        description: prev[id]?.description || '',
      },
    }));
  }

  function handleDescChange(id: string, val: string) {
    setFeeAdjustments((prev) => ({
      ...prev,
      [id]: {
        discount: prev[id]?.discount || 0,
        description: val,
      },
    }));
  }

  // Fill form with student data for editing
  function startEditStudent(student: Student) {
    setEditStudentId(student.id);
    setName(student.name);
    setRollNo(student.roll_no);
    setSelectedClassId(student.class_id);
    setAcademicYear(student.academic_year);

    // Set selected fee types and feeAdjustments for this student
    const feeIds = student.fee_types.map((ft) => ft.id);
    setSelectedFeeTypeIds(feeIds);
    const adjustments: {
      [key: string]: { discount: number; description: string };
    } = {};
    student.fee_types.forEach((ft) => {
      adjustments[ft.id] = {
        discount: ft.discount || 0,
        description: ft.description || '',
      };
    });
    setFeeAdjustments(adjustments);
  }

  function cancelEdit() {
    setEditStudentId(null);
    setName('');
    setRollNo('');
    setSelectedClassId('');
    setAcademicYear('');
    setSelectedFeeTypeIds([]);
    setFeeAdjustments({});
    setErrorMsg('');
    setSuccessMsg('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!name.trim()) return setErrorMsg('Student name is required');
    if (!rollNo.trim()) return setErrorMsg('Roll number is required');
    if (!selectedClassId) return setErrorMsg('Please select a class');
    if (!academicYear) return setErrorMsg('Please select academic year');
    if (selectedFeeTypeIds.length === 0)
      return setErrorMsg('You must assign at least one fee type');

    setLoading(true);

    const selectedFees = filteredFeeTypes.filter((ft) =>
      selectedFeeTypeIds.includes(ft.id)
    );
    const totalFees = selectedFees.reduce((sum, ft) => {
      const disc = feeAdjustments[ft.id]?.discount || 0;
      return sum + ft.default_amount - disc;
    }, 0);

    if (editStudentId) {
      // Update existing student
      const { error: updateError } = await supabase
        .from('students')
        .update({
          name,
          roll_no: rollNo,
          class_id: selectedClassId,
          total_fees: totalFees,
          academic_year: academicYear,
        })
        .eq('id', editStudentId);

      if (updateError) {
        setErrorMsg('Failed to update student: ' + updateError.message);
        setLoading(false);
        return;
      }

      // Delete old fee type links and insert new ones (simplest way)
      const { error: deleteLinksError } = await supabase
        .from('student_fee_types')
        .delete()
        .eq('student_id', editStudentId);

      if (deleteLinksError) {
        setErrorMsg('Failed to update fee types: ' + deleteLinksError.message);
        setLoading(false);
        return;
      }

      const feeLinks = selectedFeeTypeIds.map((fee_type_id) => ({
        student_id: editStudentId,
        fee_type_id,
        discount: feeAdjustments[fee_type_id]?.discount || 0,
        discount_description: feeAdjustments[fee_type_id]?.description || null,
      }));

      const { error: feeLinkError } = await supabase
        .from('student_fee_types')
        .insert(feeLinks);

      if (feeLinkError) {
        setErrorMsg('Failed to assign fee types: ' + feeLinkError.message);
        setLoading(false);
        return;
      }

      setSuccessMsg('Student updated successfully!');
      cancelEdit();
      fetchStudents();
      setLoading(false);
      return;
    }

    // Insert new student
    const { data: newStudent, error: studentError } = await supabase
      .from('students')
      .insert({
        name,
        roll_no: rollNo,
        class_id: selectedClassId,
        total_fees: totalFees,
        academic_year: academicYear,
      })
      .select()
      .single();

    if (studentError || !newStudent) {
      setErrorMsg('Failed to add student: ' + studentError?.message);
      setLoading(false);
      return;
    }

    const feeLinks = selectedFeeTypeIds.map((fee_type_id) => ({
      student_id: newStudent.id,
      fee_type_id,
      discount: feeAdjustments[fee_type_id]?.discount || 0,
      discount_description: feeAdjustments[fee_type_id]?.description || null,
    }));

    const { error: feeLinkError } = await supabase
      .from('student_fee_types')
      .insert(feeLinks);

    if (feeLinkError) {
      setErrorMsg('Failed to assign fee types: ' + feeLinkError.message);
      setLoading(false);
      return;
    }

    setSuccessMsg('Student registered successfully!');
    setName('');
    setRollNo('');
    setSelectedClassId('');
    setSelectedFeeTypeIds([]);
    setFeeAdjustments({});
    setAcademicYear('');
    fetchStudents();
    setLoading(false);
  }

  // Open delete modal and set student
  function openDeleteModal(student: Student) {
    setDeleteStudent(student);
    setConfirmDeleteName('');
    setDeleteModalOpen(true);
  }

  function closeDeleteModal() {
    setDeleteModalOpen(false);
    setDeleteStudent(null);
    setConfirmDeleteName('');
    setErrorMsg('');
  }

  // Confirm delete only if typed name matches exactly
  async function confirmDelete() {
    if (!deleteStudent) return;
    if (confirmDeleteName !== deleteStudent.name) {
      setErrorMsg('Student name does not match. Please type the exact name.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      // Delete student_fee_types links first
      const { error: delLinksErr } = await supabase
        .from('student_fee_types')
        .delete()
        .eq('student_id', deleteStudent.id);
      if (delLinksErr) throw delLinksErr;

      // Delete student record
      const { error: delStudentErr } = await supabase
        .from('students')
        .delete()
        .eq('id', deleteStudent.id);
      if (delStudentErr) throw delStudentErr;

      setSuccessMsg('Student deleted successfully!');
      closeDeleteModal();
      fetchStudents();
    } catch (error: any) {
      setErrorMsg('Failed to delete student: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-6 max-w-xl mx-auto relative">
      <h1 className="text-3xl font-bold mb-6">Student Registration</h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 mb-10 border p-6 rounded shadow"
      >
        <input
          type="text"
          placeholder="Student Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />
        <input
          type="text"
          placeholder="Roll Number"
          value={rollNo}
          onChange={(e) => setRollNo(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />

        <select
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="w-full p-2 border rounded"
          required
          disabled={!!editStudentId} // prevent changing class during edit to keep fee types consistent
        >
          <option value="">Select Class</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name}
            </option>
          ))}
        </select>

        <select
          value={academicYear}
          onChange={(e) => setAcademicYear(e.target.value)}
          className="w-full p-2 border rounded"
          required
        >
          <option value="">Select Academic Year</option>
          <option value="2023-2024">2023-2024</option>
          <option value="2024-2025">2024-2025</option>
          <option value="2025-2026">2025-2026</option>
        </select>

        {filteredFeeTypes.length > 0 && (
          <div className="space-y-2 border rounded p-3 max-h-64 overflow-y-auto">
            <p className="font-semibold">
              Assign Fee Types (Select & add discount):
            </p>
            {filteredFeeTypes.map((ft) => (
              <div
                key={ft.id}
                className="flex flex-col border-b pb-2 last:border-b-0"
              >
                <label className="inline-flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={selectedFeeTypeIds.includes(ft.id)}
                    onChange={() => toggleFeeTypeSelection(ft.id)}
                  />
                  <span>
                    {ft.name} - Default Amount: ₹{ft.default_amount.toFixed(2)}
                  </span>
                </label>
                {selectedFeeTypeIds.includes(ft.id) && (
                  <div className="flex space-x-2 mt-1">
                    <input
                      type="number"
                      min={0}
                      max={ft.default_amount}
                      placeholder="Discount"
                      value={feeAdjustments[ft.id]?.discount || ''}
                      onChange={(e) =>
                        handleDiscountChange(ft.id, e.target.value)
                      }
                      className="w-24 p-1 border rounded"
                    />
                    <input
                      type="text"
                      placeholder="Discount Description"
                      value={feeAdjustments[ft.id]?.description || ''}
                      onChange={(e) => handleDescChange(ft.id, e.target.value)}
                      className="flex-grow p-1 border rounded"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {errorMsg && (
          <p className="text-red-600 font-semibold mt-2">{errorMsg}</p>
        )}
        {successMsg && (
          <p className="text-green-600 font-semibold mt-2">{successMsg}</p>
        )}

        <div className="flex space-x-4 mt-4">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            {editStudentId ? 'Update Student' : 'Register Student'}
          </button>
          {editStudentId && (
            <button
              type="button"
              onClick={cancelEdit}
              disabled={loading}
              className="bg-gray-400 text-black px-4 py-2 rounded hover:bg-gray-500"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <h2 className="text-2xl font-semibold mb-4">Registered Students</h2>
      {students.length === 0 ? (
        <p>No students registered yet.</p>
      ) : (
        <table className="w-full border-collapse border border-gray-300 text-left">
          <thead>
            <tr>
              <th className="border border-gray-300 p-2">Name</th>
              <th className="border border-gray-300 p-2">Roll No</th>
              <th className="border border-gray-300 p-2">Class</th>
              <th className="border border-gray-300 p-2">Academic Year</th>
              <th className="border border-gray-300 p-2">Total Fees (₹)</th>
              <th className="border border-gray-300 p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((st) => (
              <tr key={st.id} className="hover:bg-gray-50">
                <td className="border border-gray-300 p-2 text-blue-600 hover:underline">
                  <Link href={`/dashboard/student/${st.id}`}>{st.name}</Link>
                </td>

                <td className="border border-gray-300 p-2">{st.roll_no}</td>
                <td className="border border-gray-300 p-2">{st.class_name}</td>
                <td className="border border-gray-300 p-2">
                  {st.academic_year}
                </td>
                <td className="border border-gray-300 p-2">
                  {st.total_fees.toFixed(2)}
                </td>
                <td className="border border-gray-300 p-2 space-x-2">
                  <button
                    onClick={() => startEditStudent(st)}
                    className="text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => openDeleteModal(st)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Delete Modal */}
      {deleteModalOpen && deleteStudent && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={closeDeleteModal}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold mb-4">Confirm Delete</h3>
            <p className="mb-4">
              To confirm deletion, please type the student's full name{' '}
              <strong>{deleteStudent.name}</strong>:
            </p>
            <input
              type="text"
              className="w-full p-2 border rounded mb-4"
              value={confirmDeleteName}
              onChange={(e) => setConfirmDeleteName(e.target.value)}
              placeholder="Type full student name"
            />
            {errorMsg && (
              <p className="text-red-600 font-semibold mb-2">{errorMsg}</p>
            )}
            <div className="flex justify-end space-x-3">
              <button
                onClick={closeDeleteModal}
                disabled={loading}
                className="px-4 py-2 rounded border border-gray-400 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={loading}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
