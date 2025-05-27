// sfms/app/dashboard/fee-types/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/lib/database.types';
import { useAuth } from '@/components/AuthContext';

type Class = Database['public']['Tables']['classes']['Row'];
type FeeType = Database['public']['Tables']['fee_types']['Row'] & {
  classes?: Partial<Class>[];
};

export default function FeeTypeManagement() {
  const supabase = createClientComponentClient<Database>();
  const {
    user,
    schoolId,
    isAdmin,
    isLoading: authLoading,
    isSchoolInfoLoading,
  } = useAuth();

  const [classes, setClasses] = useState<Class[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [pageSpecificLoading, setPageSpecificLoading] = useState(false);
  const [newClassName, setNewClassName] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    default_amount: '',
    applicable_from: '',
  });
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editing, setEditing] = useState<FeeType | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    default_amount: '',
    applicable_from: '',
  });
  const [editSelectedClassIds, setEditSelectedClassIds] = useState<string[]>(
    []
  );

  const resetCreateForm = () => {
    setForm({
      name: '',
      description: '',
      default_amount: '',
      applicable_from: '',
    });
    setSelectedClassIds([]);
    setShowCreateModal(false);
  };

  const resetEditForm = () => {
    setEditForm({
      name: '',
      description: '',
      default_amount: '',
      applicable_from: '',
    });
    setEditSelectedClassIds([]);
    setEditing(null);
    setShowEditModal(false);
  };

  // --- Data Fetching: Must use schoolId to filter ---
  const fetchClasses = useCallback(async () => {
    if (!schoolId) {
      setClasses([]);
      console.log(
        'FeeTypesPage/fetchClasses: No schoolId available from AuthContext.'
      );
      return;
    }
    console.log('FeeTypesPage/fetchClasses: Fetching for schoolId:', schoolId);
    setPageSpecificLoading(true);
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('school_id', schoolId) // CRITICAL: Filter by schoolId
      .order('name', { ascending: true });
    setPageSpecificLoading(false);
    if (error) {
      toast.error('Failed to load classes');
      console.error('Error fetching classes:', error);
    } else {
      setClasses(data || []);
      console.log('FeeTypesPage/fetchClasses: Loaded classes:', data);
    }
  }, [supabase, schoolId]);

  const fetchFeeTypes = useCallback(async () => {
    if (!schoolId) {
      setFeeTypes([]);
      console.log(
        'FeeTypesPage/fetchFeeTypes: No schoolId available from AuthContext.'
      );
      return;
    }
    console.log('FeeTypesPage/fetchFeeTypes: Fetching for schoolId:', schoolId);
    setPageSpecificLoading(true);
    // Query for fee_types associated with the schoolId
    // And join classes that are also associated with that schoolId
    const { data: feeTypeData, error: feeTypeError } = await supabase
      .from('fee_types')
      .select(
        `
        id, name, description, default_amount, school_id, applicable_from, created_at, updated_at,
        fee_type_classes ( class: classes (id, name, school_id) ) 
      `
      )
      .eq('school_id', schoolId) // CRITICAL: Filter fee_types by schoolId
      // If fee_type_classes also has school_id, you might need to filter there too
      // or rely on the join to classes which is filtered by school_id.
      // For simplicity, we assume classes within fee_type_classes are correctly linked,
      // and the primary filter on fee_types.school_id is most important.
      .order('name', { ascending: true });
    setPageSpecificLoading(false);

    if (feeTypeError || !feeTypeData) {
      toast.error(
        `Failed to load fee types: ${feeTypeError?.message || 'Unknown error'}`
      );
      console.error('Error fetching fee types:', feeTypeError);
      setFeeTypes([]);
      return;
    }

    const enrichedFeeTypes: FeeType[] = feeTypeData.map((ft) => ({
      ...ft,
      // Ensure that the classes listed also belong to the current school if RLS isn't doing it.
      // The .eq('school_id', schoolId) on the main query helps, but for joined data:
      classes:
        ft.fee_type_classes
          ?.map((link: any) => link.class)
          .filter((cls) => cls && cls.school_id === schoolId) || [],
    }));
    setFeeTypes(enrichedFeeTypes);
    console.log(
      'FeeTypesPage/fetchFeeTypes: Loaded fee types:',
      enrichedFeeTypes
    );
  }, [supabase, schoolId]);

  useEffect(() => {
    console.log(
      'FeeTypesPage useEffect: user:',
      !!user,
      'schoolId:',
      schoolId,
      'authLoading:',
      authLoading,
      'isSchoolInfoLoading:',
      isSchoolInfoLoading
    );
    if (user && schoolId && !authLoading && !isSchoolInfoLoading) {
      console.log(
        'FeeTypesPage useEffect: User and schoolId available, fetching data.'
      );
      fetchClasses();
      fetchFeeTypes();
    } else if (user && !schoolId && !authLoading && !isSchoolInfoLoading) {
      console.warn(
        'FeeTypesPage useEffect: User logged in, but no schoolId available after loading. RLS might be blocking school_administrators read or data is missing.'
      );
      toast.error(
        'School information could not be loaded. Please ensure your admin account is correctly linked to a school.'
      );
      setClasses([]);
      setFeeTypes([]);
    } else {
      // Clear data if conditions not met
      setClasses([]);
      setFeeTypes([]);
    }
  }, [
    user,
    schoolId,
    authLoading,
    isSchoolInfoLoading,
    fetchClasses,
    fetchFeeTypes,
  ]);

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectAllClasses = (
    setFunc: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setFunc(classes.map((c) => c.id));
  };

  const handleUnselectAllClasses = (
    setFunc: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setFunc([]);
  };

  const handleCheckboxToggle = (
    id: string,
    currentIds: string[],
    setFunc: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setFunc(
      currentIds.includes(id)
        ? currentIds.filter((cid) => cid !== id)
        : [...currentIds, id]
    );
  };

  const validateForm = (
    formToValidate: typeof form | typeof editForm
  ): boolean => {
    if (!formToValidate.name.trim()) {
      toast.error('Name is required');
      return false;
    }
    if (
      formToValidate.default_amount &&
      (isNaN(parseFloat(formToValidate.default_amount)) ||
        parseFloat(formToValidate.default_amount) < 0)
    ) {
      toast.error(
        'Default amount must be a valid non-negative number or empty.'
      );
      return false;
    }
    return true;
  };

  // --- CRUD Operations: Must use schoolId ---
  const handleAddClass = async () => {
    console.log('FeeTypesPage/handleAddClass: Function called.');
    console.log(
      'FeeTypesPage/handleAddClass: Current newClassName state:',
      newClassName
    );
    console.log(
      'FeeTypesPage/handleAddClass: Current schoolId from useAuth():',
      schoolId
    );

    if (!newClassName.trim()) {
      toast.error('Class name is required');
      console.log(
        'FeeTypesPage/handleAddClass: Aborted - newClassName is empty or whitespace.'
      );
      return;
    }
    if (!schoolId) {
      // This check is now even more critical
      toast.error(
        'School information unavailable. Cannot create class. Please re-login or contact support.'
      );
      console.log(
        'FeeTypesPage/handleAddClass: Aborted - schoolId is missing.'
      );
      return;
    }

    const classToInsert = {
      name: newClassName.trim(),
      school_id: schoolId, // CRITICAL: Ensure schoolId is part of the payload
    };
    console.log(
      'FeeTypesPage/handleAddClass: Proceeding with insert. Payload:',
      classToInsert
    );

    setPageSpecificLoading(true);
    const { data: insertedClass, error } = await supabase
      .from('classes')
      .insert(classToInsert) // RLS is disabled, so this should work if schoolId is correct
      .select()
      .single();
    setPageSpecificLoading(false);

    if (error) {
      toast.error(`Failed to create class: ${error.message}`);
      console.error(
        'FeeTypesPage/handleAddClass: Supabase error during insert:',
        error
      );
      return;
    }

    toast.success('Class created successfully!');
    console.log(
      'FeeTypesPage/handleAddClass: Class creation successful. Inserted data:',
      insertedClass
    );
    setNewClassName('');
    fetchClasses();
  };

  const submitFeeType = async () => {
    if (!validateForm(form)) return;
    if (!schoolId) {
      toast.error('School information unavailable. Cannot create fee type.');
      return;
    }
    setPageSpecificLoading(true);

    const feeTypePayload: Database['public']['Tables']['fee_types']['Insert'] =
      {
        name: form.name.trim(),
        description: form.description.trim() || null,
        default_amount: form.default_amount
          ? parseFloat(form.default_amount)
          : 0,
        school_id: schoolId, // CRITICAL
        applicable_from: form.applicable_from || null,
      };
    const { data: newFeeType, error } = await supabase
      .from('fee_types')
      .insert(feeTypePayload)
      .select()
      .single();

    if (error || !newFeeType) {
      setPageSpecificLoading(false);
      toast.error(
        `Failed to create fee type: ${error?.message || 'Unknown error'}`
      );
      console.error('Error creating fee type:', error);
      return;
    }
    if (selectedClassIds.length > 0) {
      // Ensure fee_type_classes also has school_id if you want to filter by it directly
      // Or rely on the fact that both fee_type and class will be linked to the same school.
      const linkInsert = selectedClassIds.map((class_id) => ({
        fee_type_id: newFeeType.id,
        class_id,
        school_id: schoolId, // CRITICAL if this table also needs school scoping
      }));
      const { error: linkError } = await supabase
        .from('fee_type_classes')
        .insert(linkInsert);
      if (linkError)
        toast.error(`Failed to link classes: ${linkError.message}`);
    }
    setPageSpecificLoading(false);
    toast.success('Fee type created');
    fetchFeeTypes();
    resetCreateForm();
  };

  const openEdit = (feeType: FeeType) => {
    // Ensure we only allow editing if the feeType's school_id matches the current admin's schoolId
    if (feeType.school_id !== schoolId) {
      toast.error('You can only edit fee types belonging to your school.');
      return;
    }
    setEditing(feeType);
    setEditForm({
      name: feeType.name,
      description: feeType.description ?? '',
      default_amount: feeType.default_amount?.toString() ?? '0',
      applicable_from: feeType.applicable_from
        ? new Date(feeType.applicable_from).toISOString().split('T')[0]
        : '',
    });
    setEditSelectedClassIds(
      (feeType.classes
        ?.map((c) => c?.id)
        .filter((id) => typeof id === 'string') as string[]) || []
    );
    setShowEditModal(true);
  };

  const updateFeeType = async () => {
    if (!editing || !validateForm(editForm) || !schoolId) {
      if (!schoolId) toast.error('School information unavailable for update.');
      return;
    }
    // Double check that the item being edited belongs to the current school
    if (editing.school_id !== schoolId) {
      toast.error('Authorization error: Cannot update this fee type.');
      resetEditForm();
      return;
    }
    setPageSpecificLoading(true);
    const feeTypeUpdatePayload: Partial<
      Database['public']['Tables']['fee_types']['Update']
    > = {
      name: editForm.name.trim(),
      description: editForm.description.trim() || null,
      default_amount: editForm.default_amount
        ? parseFloat(editForm.default_amount)
        : 0,
      applicable_from: editForm.applicable_from || null,
    };
    // CRITICAL: .eq('school_id', schoolId) in the update ensures you only update your own school's records.
    const { error: updateError } = await supabase
      .from('fee_types')
      .update(feeTypeUpdatePayload)
      .eq('id', editing.id)
      .eq('school_id', schoolId);

    if (updateError) {
      setPageSpecificLoading(false);
      toast.error(`Failed to update fee type: ${updateError.message}`);
      console.error(updateError);
      return;
    }

    // For fee_type_classes, ensure operations are scoped by schoolId too
    const { error: deleteLinksError } = await supabase
      .from('fee_type_classes')
      .delete()
      .eq('fee_type_id', editing.id)
      .eq('school_id', schoolId);
    if (deleteLinksError) {
      setPageSpecificLoading(false);
      toast.error(
        `Failed to update class links (delete): ${deleteLinksError.message}`
      );
      console.error(deleteLinksError);
      return;
    }

    if (editSelectedClassIds.length > 0) {
      const newLinks = editSelectedClassIds.map((class_id) => ({
        fee_type_id: editing.id,
        class_id,
        school_id: schoolId, // CRITICAL
      }));
      const { error: insertError } = await supabase
        .from('fee_type_classes')
        .insert(newLinks);
      if (insertError) {
        setPageSpecificLoading(false);
        toast.error(
          `Failed to update class links (insert): ${insertError.message}`
        );
        console.error(insertError);
        return;
      }
    }
    setPageSpecificLoading(false);
    toast.success('Fee type updated');
    fetchFeeTypes();
    resetEditForm();
  };

  const deleteFeeType = async (feeType: FeeType) => {
    if (!schoolId) {
      toast.error('School information unavailable for delete.');
      return;
    }
    // Double check that the item being deleted belongs to the current school
    if (feeType.school_id !== schoolId) {
      toast.error('Authorization error: Cannot delete this fee type.');
      return;
    }
    const confirmation = prompt(
      `To confirm deletion, please type the exact fee type name:\n"${feeType.name}"`
    );
    if (confirmation !== feeType.name) {
      if (confirmation !== null)
        toast.error('Name did not match. Deletion aborted.');
      return;
    }

    setPageSpecificLoading(true);
    // CRITICAL: .eq('school_id', schoolId) ensures you only delete from your own school.
    await supabase
      .from('fee_type_classes')
      .delete()
      .eq('fee_type_id', feeType.id)
      .eq('school_id', schoolId);
    const { error } = await supabase
      .from('fee_types')
      .delete()
      .eq('id', feeType.id)
      .eq('school_id', schoolId);
    setPageSpecificLoading(false);

    if (error) {
      toast.error(`Failed to delete fee type: ${error.message}`);
      console.error(error);
    } else {
      toast.success('Fee type deleted');
      fetchFeeTypes();
    }
  };

  const isCurrentlyApplicable = (feeType: FeeType): boolean => {
    if (!feeType.applicable_from) return true;
    try {
      const fromDate = new Date(feeType.applicable_from);
      if (isNaN(fromDate.getTime())) return false;
      const now = new Date();
      const nowDateOnly = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      const parts = feeType.applicable_from.split('-');
      const fromDateAdjusted = new Date(
        parseInt(parts[0]),
        parseInt(parts[1]) - 1,
        parseInt(parts[2])
      );
      return nowDateOnly >= fromDateAdjusted;
    } catch (e) {
      console.error('Error parsing applicable_from date:', e);
      return false;
    }
  };

  // Render logic based on loading states
  if (authLoading) {
    return <div className="p-6 text-center">Loading user session...</div>;
  }
  if (!user) {
    return (
      <div className="p-6 text-center">
        Please log in. (Redirect should occur)
      </div>
    );
  }
  // isSchoolInfoLoading should be false, and schoolId should be available
  // If schoolId is still null after school info loading is done, AuthContext should have logged it.
  // The useEffect for data fetching will show a toast if schoolId remains null.

  // UI Rendering
  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={pageSpecificLoading || !schoolId || isSchoolInfoLoading} // Disable if schoolId not ready
          className="bg-indigo-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 disabled:bg-gray-400"
        >
          Create New Fee Type
        </button>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            placeholder="New Class Name"
            disabled={pageSpecificLoading || !schoolId || isSchoolInfoLoading} // Disable if schoolId not ready
            className="border border-gray-300 rounded-md px-3 py-2 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm flex-grow sm:flex-grow-0 disabled:bg-gray-100"
          />
          <button
            onClick={handleAddClass}
            disabled={
              pageSpecificLoading ||
              !schoolId ||
              !newClassName.trim() ||
              isSchoolInfoLoading
            } // Disable if schoolId not ready
            className="bg-green-600 text-white px-4 py-2 rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:bg-gray-400"
          >
            Add Class
          </button>
        </div>
      </div>

      {(authLoading || isSchoolInfoLoading) && (
        <div className="text-center py-4 text-gray-500">
          Loading initial data...
        </div>
      )}

      {!authLoading && !isSchoolInfoLoading && !schoolId && user && (
        <div className="p-6 text-center text-red-500 bg-red-50 rounded-md shadow">
          School information could not be loaded. Your account might not be
          linked to a school, or there was an issue fetching it. Please try
          re-logging or contact support. Some features will be disabled.
        </div>
      )}

      {pageSpecificLoading &&
        (classes.length === 0 || feeTypes.length === 0) &&
        !authLoading &&
        !isSchoolInfoLoading &&
        schoolId && (
          <div className="text-center py-4 text-gray-500">
            Loading school data...
          </div>
        )}

      {schoolId &&
        !authLoading &&
        !isSchoolInfoLoading && ( // Only render table if schoolId is available and primary loading is done
          <div className="overflow-x-auto shadow-lg rounded-lg">
            <table className="w-full border-collapse border border-gray-200 min-w-[800px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border-b border-gray-200 p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="border-b border-gray-200 p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="border-b border-gray-200 p-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount (₹)
                  </th>
                  <th className="border-b border-gray-200 p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Applicable From
                  </th>
                  <th className="border-b border-gray-200 p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Classes
                  </th>
                  <th className="border-b border-gray-200 p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="border-b border-gray-200 p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {!pageSpecificLoading && feeTypes.length > 0
                  ? feeTypes.map((fee) => (
                      <tr
                        key={fee.id}
                        className="hover:bg-gray-50 transition-colors duration-150"
                      >
                        <td className="p-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {fee.name}
                        </td>
                        <td
                          className="p-3 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate"
                          title={fee.description || undefined}
                        >
                          {fee.description || '-'}
                        </td>
                        <td className="p-3 whitespace-nowrap text-sm text-gray-700 text-right">
                          {fee.default_amount != null
                            ? `${parseFloat(String(fee.default_amount)).toFixed(
                                2
                              )}`
                            : '-'}
                        </td>
                        <td className="p-3 whitespace-nowrap text-sm text-gray-700">
                          {fee.applicable_from
                            ? new Date(
                                fee.applicable_from.replace(/-/g, '/')
                              ).toLocaleDateString()
                            : 'Always'}
                        </td>
                        <td
                          className="p-3 whitespace-nowrap text-sm text-gray-700 max-w-xs truncate"
                          title={
                            fee.classes?.map((c) => c?.name).join(', ') ||
                            undefined
                          }
                        >
                          {fee.classes && fee.classes.length > 0
                            ? fee.classes.map((c) => c?.name).join(', ')
                            : '-'}
                        </td>
                        <td className="p-3 whitespace-nowrap text-sm">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                              isCurrentlyApplicable(fee)
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {isCurrentlyApplicable(fee) ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => openEdit(fee)}
                            disabled={pageSpecificLoading}
                            className="text-indigo-600 hover:text-indigo-800 disabled:text-gray-400"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteFeeType(fee)}
                            disabled={pageSpecificLoading}
                            className="text-red-600 hover:text-red-800 disabled:text-gray-400"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  : !pageSpecificLoading &&
                    schoolId && ( // Only show "No fee types found" if not loading and schoolId is present
                      <tr>
                        <td
                          colSpan={7}
                          className="text-center py-10 text-gray-500"
                        >
                          No fee types found for this school. Create one to get
                          started.
                        </td>
                      </tr>
                    )}
              </tbody>
            </table>
          </div>
        )}

      {/* Modals (Create and Edit) - Ensure they are also disabled appropriately based on pageSpecificLoading and !schoolId */}
      {/* Create Modal */}
      {showCreateModal &&
        schoolId && ( // Only show modal if schoolId is available
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              {/* ... (modal content as before, ensure form inputs and buttons use 'pageSpecificLoading' for disabled state) ... */}
              <h2 className="text-xl font-semibold mb-5 text-gray-800">
                Create New Fee Type
              </h2>
              {/* ... (rest of the modal form with inputs disabled by pageSpecificLoading) ... */}
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    Name <span className="text-red-500">*</span>
                  </span>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleFormChange}
                    disabled={pageSpecificLoading}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    Description
                  </span>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleFormChange}
                    disabled={pageSpecificLoading}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    Default Amount (₹)
                  </span>
                  <input
                    name="default_amount"
                    value={form.default_amount}
                    onChange={handleFormChange}
                    disabled={pageSpecificLoading}
                    type="number"
                    step="0.01"
                    placeholder="e.g., 500.00"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    Applicable From (Optional)
                  </span>
                  <input
                    type="date"
                    name="applicable_from"
                    value={form.applicable_from}
                    onChange={handleFormChange}
                    disabled={pageSpecificLoading}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </label>
                <fieldset className="border rounded-md p-4">
                  <legend className="text-sm font-semibold px-2 text-gray-700">
                    Assign to Classes
                  </legend>
                  <div className="my-2 space-x-3">
                    <button
                      type="button"
                      onClick={() =>
                        handleSelectAllClasses(setSelectedClassIds)
                      }
                      disabled={pageSpecificLoading || classes.length === 0}
                      className="text-xs text-indigo-600 hover:text-indigo-800 disabled:text-gray-400"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleUnselectAllClasses(setSelectedClassIds)
                      }
                      disabled={pageSpecificLoading}
                      className="text-xs text-indigo-600 hover:text-indigo-800 disabled:text-gray-400"
                    >
                      Unselect All
                    </button>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto border p-2 rounded-md bg-gray-50">
                    {classes.length > 0 ? (
                      classes.map((cls) => (
                        <label
                          key={cls.id}
                          className="flex items-center p-1 hover:bg-indigo-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedClassIds.includes(cls.id)}
                            onChange={() =>
                              handleCheckboxToggle(
                                cls.id,
                                selectedClassIds,
                                setSelectedClassIds
                              )
                            }
                            disabled={pageSpecificLoading}
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-2"
                          />
                          <span className="text-xs text-gray-800">
                            {cls.name}
                          </span>
                        </label>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500 italic">
                        No classes available for this school. Add classes first.
                      </p>
                    )}
                  </div>
                </fieldset>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={resetCreateForm}
                  disabled={pageSpecificLoading}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitFeeType}
                  disabled={pageSpecificLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
                >
                  {pageSpecificLoading ? 'Creating...' : 'Create Fee Type'}
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Edit Modal */}
      {showEditModal &&
        editing &&
        schoolId &&
        editing.school_id === schoolId && ( // Only show modal if schoolId matches
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              {/* ... (modal content as before, ensure form inputs and buttons use 'pageSpecificLoading' for disabled state) ... */}
              <h2 className="text-xl font-semibold mb-5 text-gray-800">
                Edit Fee Type: {editing.name}
              </h2>
              {/* ... (rest of the modal form with inputs disabled by pageSpecificLoading) ... */}
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    Name <span className="text-red-500">*</span>
                  </span>
                  <input
                    name="name"
                    value={editForm.name}
                    onChange={handleEditFormChange}
                    disabled={pageSpecificLoading}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    Description
                  </span>
                  <textarea
                    name="description"
                    value={editForm.description}
                    onChange={handleEditFormChange}
                    disabled={pageSpecificLoading}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    Default Amount (₹)
                  </span>
                  <input
                    name="default_amount"
                    value={editForm.default_amount}
                    onChange={handleEditFormChange}
                    disabled={pageSpecificLoading}
                    type="number"
                    step="0.01"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    Applicable From (Optional)
                  </span>
                  <input
                    type="date"
                    name="applicable_from"
                    value={editForm.applicable_from}
                    onChange={handleEditFormChange}
                    disabled={pageSpecificLoading}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </label>
                <fieldset className="border rounded-md p-4">
                  <legend className="text-sm font-semibold px-2 text-gray-700">
                    Assign to Classes
                  </legend>
                  <div className="my-2 space-x-3">
                    <button
                      type="button"
                      onClick={() =>
                        handleSelectAllClasses(setEditSelectedClassIds)
                      }
                      disabled={pageSpecificLoading || classes.length === 0}
                      className="text-xs text-indigo-600 hover:text-indigo-800 disabled:text-gray-400"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleUnselectAllClasses(setEditSelectedClassIds)
                      }
                      disabled={pageSpecificLoading}
                      className="text-xs text-indigo-600 hover:text-indigo-800 disabled:text-gray-400"
                    >
                      Unselect All
                    </button>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto border p-2 rounded-md bg-gray-50">
                    {classes.length > 0 ? (
                      classes.map((cls) => (
                        <label
                          key={cls.id}
                          className="flex items-center p-1 hover:bg-indigo-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={editSelectedClassIds.includes(cls.id)}
                            onChange={() =>
                              handleCheckboxToggle(
                                cls.id,
                                editSelectedClassIds,
                                setEditSelectedClassIds
                              )
                            }
                            disabled={pageSpecificLoading}
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-2"
                          />
                          <span className="text-xs text-gray-800">
                            {cls.name}
                          </span>
                        </label>
                      ))
                    ) : (
                      <p className="text-xs text-gray-500 italic">
                        No classes available for this school.
                      </p>
                    )}
                  </div>
                </fieldset>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={resetEditForm}
                  disabled={pageSpecificLoading}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={updateFeeType}
                  disabled={pageSpecificLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300"
                >
                  {pageSpecificLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
