// sfms/app/dashboard/student-registration/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation'; // Though not used in your provided code, good to have if needed
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import toast from 'react-hot-toast'; // We'll use toast for consistency with other pages
import { Database } from '@/lib/database.types';
import { useAuth } from '@/components/AuthContext';
import Link from 'next/link'; // From your provided code

// Types from your provided code, adapted slightly for clarity
type ClassType = Database['public']['Tables']['classes']['Row'];
type FeeType = Database['public']['Tables']['fee_types']['Row']; // default_amount is numeric
type StudentFeeTypeLink = {
  discount?: number;
  discount_description?: string | null; // Adjusted for schema (student_fee_types.discount_description)
  fee_types: FeeType; // Nested fee type
};
type StudentType = Omit<
  Database['public']['Tables']['students']['Row'],
  'class_id'
> & {
  class_id: string; // Ensure it's string for state
  classes?: { name: string } | null; // For class_name, matching Supabase join
  student_fee_types?: StudentFeeTypeLink[]; // For linked fee types
  // Derived/Display fields (not directly from 'students' table but joined/calculated)
  class_name?: string;
  assigned_fee_details?: (FeeType & {
    discount?: number;
    description?: string | null;
  })[];
};

export default function StudentRegistrationPage() {
  const supabase = createClientComponentClient<Database>();
  const router = useRouter();
  const {
    user,
    schoolId,
    isLoading: authLoading,
    isSchoolInfoLoading,
  } = useAuth();

  // States from your provided code
  const [name, setName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [classes, setClasses] = useState<ClassType[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  // feeTypes state (all fee types for the school)
  const [allSchoolFeeTypes, setAllSchoolFeeTypes] = useState<FeeType[]>([]);
  // filteredFeeTypes state (fee types applicable to selected class)
  const [filteredFeeTypesForClass, setFilteredFeeTypesForClass] = useState<
    FeeType[]
  >([]);
  const [selectedFeeTypeIds, setSelectedFeeTypeIds] = useState<string[]>([]);
  const [feeAdjustments, setFeeAdjustments] = useState<{
    [feeTypeId: string]: { discount: number; description: string };
  }>({});
  const [students, setStudents] = useState<StudentType[]>([]);
  const [academicYear, setAcademicYear] = useState(
    new Date().getFullYear().toString()
  ); // Defaulted like in my previous version

  // Loading and messaging states
  const [pageLoading, setPageLoading] = useState(true); // For initial data (classes, all fee types, students)
  const [isSubmitting, setIsSubmitting] = useState(false); // For form submission

  // Edit mode states
  const [editStudentId, setEditStudentId] = useState<string | null>(null);

  // Delete modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStudent, setDeleteStudent] = useState<StudentType | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState('');

  // --- Data Fetching Callbacks (modified to use schoolId) ---
  const fetchClassesForSchool = useCallback(async () => {
    if (!schoolId) {
      setClasses([]);
      return;
    }
    // console.log("StudentReg/fetchClasses: schoolId:", schoolId);
    const { data, error } = await supabase
      .from('classes')
      .select('id, name')
      .eq('school_id', schoolId)
      .order('name');
    if (error) toast.error('Failed to load classes');
    else setClasses(data || []);
  }, [supabase, schoolId]);

  const fetchAllSchoolFeeTypes = useCallback(async () => {
    if (!schoolId) {
      setAllSchoolFeeTypes([]);
      return;
    }
    // console.log("StudentReg/fetchAllSchoolFeeTypes: schoolId:", schoolId);
    const { data, error } = await supabase
      .from('fee_types')
      .select('id, name, default_amount')
      .eq('school_id', schoolId)
      .order('name');
    if (error) toast.error('Failed to load all fee types for school');
    else setAllSchoolFeeTypes(data || []);
  }, [supabase, schoolId]);

  const fetchStudentsForSchool = useCallback(async () => {
    if (!schoolId) {
      setStudents([]);
      return;
    }
    // console.log("StudentReg/fetchStudents: schoolId:", schoolId);
    setPageLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select(
        `
        id, name, roll_no, class_id, total_fees, academic_year, status, is_passed_out,
        classes (name), 
        student_fee_types ( discount, discount_description, fee_types (id, name, default_amount) )
      `
      )
      .eq('school_id', schoolId) // CRITICAL: Filter students by schoolId
      .order('name', { ascending: true });

    setPageLoading(false);
    if (error) {
      toast.error('Failed to load students: ' + error.message);
      console.error('Error fetching students:', error);
      setStudents([]);
      return;
    }
    const studentsData: StudentType[] = (data || []).map((student: any) => ({
      ...student,
      class_name: student.classes?.name || 'N/A',
      assigned_fee_details:
        student.student_fee_types?.map((sft: any) => ({
          ...sft.fee_types,
          discount: sft.discount,
          description: sft.discount_description,
        })) || [],
    }));
    setStudents(studentsData);
  }, [supabase, schoolId]);

  // --- useEffect for Initial Data Loading ---
  useEffect(() => {
    if (user && schoolId && !authLoading && !isSchoolInfoLoading) {
      setPageLoading(true);
      Promise.all([
        fetchClassesForSchool(),
        fetchAllSchoolFeeTypes(),
        fetchStudentsForSchool(),
      ]).finally(() => setPageLoading(false));
    } else if (user && !schoolId && !authLoading && !isSchoolInfoLoading) {
      toast.error('School information not loaded. Cannot fetch student data.');
      setPageLoading(false);
    } else {
      setPageLoading(true); // Show loading if auth/school info is pending
    }
  }, [
    user,
    schoolId,
    authLoading,
    isSchoolInfoLoading,
    fetchClassesForSchool,
    fetchAllSchoolFeeTypes,
    fetchStudentsForSchool,
  ]);

  // --- useEffect for Filtering Fee Types when Class Changes ---
  useEffect(() => {
    if (!selectedClassId || !schoolId) {
      setFilteredFeeTypesForClass([]);
      setSelectedFeeTypeIds([]); // Also reset selected fee types
      setFeeAdjustments({}); // And their adjustments
      return;
    }
    async function fetchFilteredFeeTypes() {
      // console.log("StudentReg/fetchFilteredFeeTypes: classId:", selectedClassId, "schoolId:", schoolId);
      const { data, error } = await supabase
        .from('fee_type_classes')
        .select('fee_types (id, name, default_amount)')
        .eq('class_id', selectedClassId)
        .eq('school_id', schoolId); // CRITICAL: Ensure fee_type_classes are also filtered by schoolId

      if (error) {
        toast.error('Failed to load fee types for the selected class');
        setFilteredFeeTypesForClass([]);
      } else {
        const feeTypesForClass =
          data?.map((item: any) => item.fee_types).filter(Boolean) || [];
        setFilteredFeeTypesForClass(feeTypesForClass);
      }
      // Reset selections when class changes, unless in edit mode for the same class
      if (
        !editStudentId ||
        (editStudentId &&
          students.find((s) => s.id === editStudentId)?.class_id !==
            selectedClassId)
      ) {
        setSelectedFeeTypeIds([]);
        setFeeAdjustments({});
      }
    }
    fetchFilteredFeeTypes();
  }, [selectedClassId, schoolId, supabase, editStudentId, students]);

  // --- Event Handlers from your code ---
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
      [id]: { discount: prev[id]?.discount || 0, description: val },
    }));
  }

  // --- Edit and Delete Logic (adapted for schoolId and toast) ---
  function startEditStudent(student: StudentType) {
    if (student.school_id !== schoolId) {
      toast.error('You can only edit students from your own school.');
      return;
    }
    setEditStudentId(student.id);
    setName(student.name);
    setRollNo(student.roll_no);
    setSelectedClassId(student.class_id); // This will trigger useEffect for filteredFeeTypes
    setAcademicYear(student.academic_year);

    const feeIds = student.assigned_fee_details?.map((ft) => ft.id) || [];
    setSelectedFeeTypeIds(feeIds);
    const adjustments: {
      [key: string]: { discount: number; description: string };
    } = {};
    student.assigned_fee_details?.forEach((ft) => {
      adjustments[ft.id] = {
        discount: ft.discount || 0,
        description: ft.description || '',
      };
    });
    setFeeAdjustments(adjustments);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top for form
  }

  function cancelEdit() {
    setEditStudentId(null);
    setName('');
    setRollNo('');
    setSelectedClassId('');
    setAcademicYear(new Date().getFullYear().toString());
    setSelectedFeeTypeIds([]);
    setFeeAdjustments({});
    toast.dismiss(); // Clear any active toasts
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    toast.dismiss(); // Clear previous toasts

    if (!schoolId) {
      toast.error('School information is missing. Cannot proceed.');
      return;
    }
    if (!name.trim()) {
      toast.error('Student name is required');
      return;
    }
    if (!rollNo.trim()) {
      toast.error('Roll number is required');
      return;
    }
    if (!selectedClassId) {
      toast.error('Please select a class');
      return;
    }
    if (!academicYear) {
      toast.error('Please select academic year');
      return;
    }
    // Your original code required selecting fee types. Keep or adjust as needed.
    // if (selectedFeeTypeIds.length === 0) { toast.error('You must assign at least one fee type'); return; }

    setIsSubmitting(true);
    const toastId = toast.loading(
      editStudentId ? 'Updating student...' : 'Registering student...'
    );

    // Calculate total_fees based on selected and adjusted fee types
    // This uses filteredFeeTypesForClass which should be populated based on selectedClassId
    const totalFees = filteredFeeTypesForClass
      .filter((ft) => selectedFeeTypeIds.includes(ft.id))
      .reduce((sum, ft) => {
        const disc = feeAdjustments[ft.id]?.discount || 0;
        return sum + ft.default_amount - disc;
      }, 0);

    const studentCoreData = {
      name: name.trim(),
      roll_no: rollNo.trim(),
      class_id: selectedClassId,
      academic_year: academicYear.trim(),
      total_fees: totalFees, // Calculated total_fees
      school_id: schoolId, // CRITICAL: always include schoolId
      // status and is_passed_out will use database defaults if not provided
    };

    try {
      let studentIdForFeeLinks: string;

      if (editStudentId) {
        // Update existing student
        const { data: updatedStudent, error: updateError } = await supabase
          .from('students')
          .update(studentCoreData)
          .eq('id', editStudentId)
          .eq('school_id', schoolId) // CRITICAL: Ensure update is scoped
          .select()
          .single();

        if (updateError) throw updateError;
        if (!updatedStudent)
          throw new Error('Failed to retrieve updated student data.');
        studentIdForFeeLinks = updatedStudent.id;

        // Delete old fee type links
        const { error: deleteLinksError } = await supabase
          .from('student_fee_types')
          .delete()
          .eq('student_id', editStudentId)
          .eq('school_id', schoolId); // CRITICAL: Scope delete
        if (deleteLinksError) throw deleteLinksError;
      } else {
        // Insert new student
        const { data: newStudent, error: studentError } = await supabase
          .from('students')
          .insert(studentCoreData)
          .select()
          .single();
        if (studentError) throw studentError;
        if (!newStudent)
          throw new Error('Failed to retrieve new student data.');
        studentIdForFeeLinks = newStudent.id;
      }

      // Insert new fee type links (for both create and update)
      if (selectedFeeTypeIds.length > 0) {
        const feeLinks = selectedFeeTypeIds.map((fee_type_id) => ({
          student_id: studentIdForFeeLinks,
          fee_type_id,
          school_id: schoolId, // CRITICAL
          assigned_amount:
            filteredFeeTypesForClass.find((ft) => ft.id === fee_type_id)
              ?.default_amount || 0,
          discount: feeAdjustments[fee_type_id]?.discount || 0,
          discount_description:
            feeAdjustments[fee_type_id]?.description || null,
          // net_payable_amount can be calculated here or by a trigger/view
        }));
        const { error: feeLinkError } = await supabase
          .from('student_fee_types')
          .insert(feeLinks);
        if (feeLinkError) throw feeLinkError;
      }

      toast.success(
        editStudentId
          ? 'Student updated successfully!'
          : 'Student registered successfully!',
        { id: toastId }
      );
      if (editStudentId) cancelEdit();
      else {
        setName('');
        setRollNo('');
        setSelectedClassId(classes.length > 0 ? classes[0]?.id || '' : '');
        setSelectedFeeTypeIds([]);
        setFeeAdjustments({});
        setAcademicYear(new Date().getFullYear().toString());
      }
      fetchStudentsForSchool(); // Refresh student list
    } catch (error: any) {
      toast.error(`Operation failed: ${error.message}`, { id: toastId });
      console.error(
        'Error in handleSubmit (student registration/update):',
        error
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function openDeleteModal(student: StudentType) {
    if (student.school_id !== schoolId) {
      toast.error('You can only delete students from your own school.');
      return;
    }
    setDeleteStudent(student);
    setConfirmDeleteName('');
    setDeleteModalOpen(true);
  }

  function closeDeleteModal() {
    setDeleteModalOpen(false);
    setDeleteStudent(null);
    setConfirmDeleteName('');
  }

  async function confirmDelete() {
    if (!deleteStudent || !schoolId) return;
    if (confirmDeleteName !== deleteStudent.name) {
      toast.error('Student name does not match.');
      return;
    }
    setIsSubmitting(true);
    const toastId = toast.loading('Deleting student...');
    try {
      // Delete from join table first, scoped by schoolId
      await supabase
        .from('student_fee_types')
        .delete()
        .eq('student_id', deleteStudent.id)
        .eq('school_id', schoolId);
      // Then delete student, scoped by schoolId
      await supabase
        .from('students')
        .delete()
        .eq('id', deleteStudent.id)
        .eq('school_id', schoolId);

      toast.success('Student deleted successfully!', { id: toastId });
      closeDeleteModal();
      fetchStudentsForSchool();
    } catch (error: any) {
      toast.error(`Failed to delete student: ${error.message}`, {
        id: toastId,
      });
      console.error('Error deleting student:', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  // --- Render Logic ---
  if (authLoading || (pageLoading && students.length === 0)) {
    // Show main loader if auth is loading OR page data is initially loading
    return (
      <div className="p-6 text-center">
        Loading student registration module...
      </div>
    );
  }
  if (!user) {
    return <div className="p-6 text-center">Please log in.</div>;
  }
  if (!schoolId && !isSchoolInfoLoading) {
    // School info done loading, but no schoolId
    return (
      <div className="p-6 text-center text-red-500">
        School information unavailable. Student management disabled.
      </div>
    );
  }
  if (isSchoolInfoLoading && !schoolId) {
    // Still waiting for school info specifically
    return (
      <div className="p-6 text-center">
        Loading school information for registration...
      </div>
    );
  }

  return (
    <main className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-gray-800 text-center">
        {editStudentId ? 'Edit Student Details' : 'Student Registration'}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 mb-10 bg-white p-6 rounded-lg shadow-xl"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              Student Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full p-2.5 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label
              htmlFor="rollNo"
              className="block text-sm font-medium text-gray-700"
            >
              Roll Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="rollNo"
              placeholder="Roll No."
              value={rollNo}
              onChange={(e) => setRollNo(e.target.value)}
              required
              className="mt-1 w-full p-2.5 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label
              htmlFor="selectedClassId"
              className="block text-sm font-medium text-gray-700"
            >
              Class <span className="text-red-500">*</span>
            </label>
            <select
              id="selectedClassId"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              required
              disabled={!!editStudentId || classes.length === 0}
              className="mt-1 w-full p-2.5 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white disabled:bg-gray-50"
            >
              <option value="">Select Class</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
            {classes.length === 0 && !pageLoading && (
              <p className="text-xs text-red-500 mt-1">
                No classes found. Add classes in 'Fee Types & Classes'.
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="academicYear"
              className="block text-sm font-medium text-gray-700"
            >
              Academic Year <span className="text-red-500">*</span>
            </label>
            <select
              id="academicYear"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              required
              className="mt-1 w-full p-2.5 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              <option value="">Select Year</option>
              {/* You can generate these dynamically or expand the list */}
              <option
                value={`${
                  new Date().getFullYear() - 1
                }-${new Date().getFullYear()}`}
              >{`${
                new Date().getFullYear() - 1
              }-${new Date().getFullYear()}`}</option>
              <option
                value={`${new Date().getFullYear()}-${
                  new Date().getFullYear() + 1
                }`}
              >{`${new Date().getFullYear()}-${
                new Date().getFullYear() + 1
              }`}</option>
              <option
                value={`${new Date().getFullYear() + 1}-${
                  new Date().getFullYear() + 2
                }`}
              >{`${new Date().getFullYear() + 1}-${
                new Date().getFullYear() + 2
              }`}</option>
            </select>
          </div>
        </div>

        {selectedClassId && filteredFeeTypesForClass.length > 0 && (
          <div className="space-y-3 border rounded-md p-4 bg-gray-50">
            <p className="font-medium text-gray-700">
              Assign Fee Types for{' '}
              {classes.find((c) => c.id === selectedClassId)?.name}:
            </p>
            <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
              {filteredFeeTypesForClass.map((ft) => (
                <div
                  key={ft.id}
                  className="p-3 border rounded-md bg-white shadow-sm"
                >
                  <label className="flex items-center justify-between space-x-2 cursor-pointer">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedFeeTypeIds.includes(ft.id)}
                        onChange={() => toggleFeeTypeSelection(ft.id)}
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <span className="ml-2 text-sm text-gray-800">
                        {ft.name}
                      </span>
                    </div>
                    <span className="text-sm text-gray-600">
                      ₹{ft.default_amount?.toFixed(2)}
                    </span>
                  </label>
                  {selectedFeeTypeIds.includes(ft.id) && (
                    <div className="mt-2 pl-6 space-y-2">
                      <input
                        type="number"
                        min={0}
                        max={ft.default_amount}
                        placeholder="Discount (₹)"
                        value={feeAdjustments[ft.id]?.discount || ''}
                        onChange={(e) =>
                          handleDiscountChange(ft.id, e.target.value)
                        }
                        className="w-full sm:w-1/2 p-2 border border-gray-300 rounded-md text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <input
                        type="text"
                        placeholder="Discount Description (Optional)"
                        value={feeAdjustments[ft.id]?.description || ''}
                        onChange={(e) =>
                          handleDescChange(ft.id, e.target.value)
                        }
                        className="w-full p-2 border border-gray-300 rounded-md text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {selectedClassId &&
          filteredFeeTypesForClass.length === 0 &&
          !pageLoading && (
            <p className="text-sm text-gray-500">
              No specific fee types found for this class. General school fee
              types might apply or add them via 'Fee Types & Classes'.
            </p>
          )}

        <div className="flex items-center justify-end space-x-3 pt-3">
          {editStudentId && (
            <button
              type="button"
              onClick={cancelEdit}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel Edit
            </button>
          )}
          <button
            type="submit"
            disabled={
              isSubmitting ||
              pageLoading ||
              !schoolId ||
              (classes.length === 0 && !selectedClassId)
            }
            className="px-6 py-2.5 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
          >
            {isSubmitting
              ? editStudentId
                ? 'Updating...'
                : 'Registering...'
              : editStudentId
              ? 'Update Student'
              : 'Register Student'}
          </button>
        </div>
      </form>

      <hr className="my-10" />

      <h2 className="text-2xl font-semibold mb-5 text-gray-800 text-center">
        Registered Students
      </h2>
      {pageLoading && students.length === 0 ? (
        <p className="text-center text-gray-500">Loading students...</p>
      ) : !pageLoading && students.length === 0 && schoolId ? (
        <p className="text-center text-gray-500">
          No students registered yet for this school.
        </p>
      ) : (
        <div className="overflow-x-auto bg-white shadow-lg rounded-lg">
          <table className="w-full min-w-[700px] border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Roll No
                </th>
                <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Class
                </th>
                <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Academic Year
                </th>
                <th className="p-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Fees (₹)
                </th>
                <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {students.map((st) => (
                <tr key={st.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-3 whitespace-nowrap text-sm font-medium text-indigo-600 hover:underline">
                    <Link href={`/dashboard/student/${st.id}`}>{st.name}</Link>
                  </td>
                  <td className="p-3 whitespace-nowrap text-sm text-gray-700">
                    {st.roll_no}
                  </td>
                  <td className="p-3 whitespace-nowrap text-sm text-gray-700">
                    {st.class_name}
                  </td>
                  <td className="p-3 whitespace-nowrap text-sm text-gray-700">
                    {st.academic_year}
                  </td>
                  <td className="p-3 whitespace-nowrap text-sm text-gray-700 text-right">
                    {st.total_fees?.toFixed(2)}
                  </td>
                  <td className="p-3 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => startEditStudent(st)}
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => openDeleteModal(st)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModalOpen && deleteStudent && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50"
          onClick={closeDeleteModal}
        >
          <div
            className="bg-white rounded-lg p-6 shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4 text-gray-800">
              Confirm Deletion
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              To confirm, please type the student's full name:{' '}
              <strong className="text-gray-900">{deleteStudent.name}</strong>
            </p>
            <input
              type="text"
              value={confirmDeleteName}
              onChange={(e) => setConfirmDeleteName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md mb-4 shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Type full student name"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={closeDeleteModal}
                disabled={isSubmitting}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={
                  isSubmitting || confirmDeleteName !== deleteStudent.name
                }
                className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-300"
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
