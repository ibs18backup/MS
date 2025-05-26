'use client';

import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/lib/database.types';

type Class = Database['public']['Tables']['classes']['Row'];
type FeeTypeClass = Database['public']['Tables']['fee_type_classes']['Row'];
type FeeType = Database['public']['Tables']['fee_types']['Row'] & {
  classes?: Class[];
  applicable_from?: string;
};

export default function FeeTypeManagement() {
  const supabase = createClientComponentClient<Database>();

  const [classes, setClasses] = useState<Class[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [loading, setLoading] = useState(false);
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
  const [editSelectedClassIds, setEditSelectedClassIds] = useState<string[]>([]);

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

  const fetchClasses = useCallback(async () => {
    const { data, error } = await supabase.from('classes').select();
    if (error) {
      toast.error('Failed to load classes');
    } else {
      setClasses(data);
    }
  }, [supabase]);

  const fetchFeeTypes = useCallback(async () => {
    const { data: feeTypeData, error: feeTypeError } = await supabase
      .from('fee_types')
      .select(`
        *,
        classes:fee_type_classes(class:classes(*))
      `);
    
    if (feeTypeError || !feeTypeData) {
      toast.error('Failed to load fee types');
      return;
    }

    const enrichedFeeTypes = feeTypeData.map(ft => ({
      ...ft,
      classes: ft.classes?.map((c: any) => c.class)
    }));

    setFeeTypes(enrichedFeeTypes);
  }, [supabase]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    fetchFeeTypes();
  }, [fetchFeeTypes]);

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
    setFunc: (ids: string[]) => void
  ) => {
    setFunc(classes.map(c => c.id));
  };

  const handleUnselectAllClasses = (
    setFunc: (ids: string[]) => void
  ) => {
    setFunc([]);
  };

  const handleCheckboxToggle = (
    id: string,
    currentIds: string[],
    setFunc: (ids: string[]) => void
  ) => {
    setFunc(
      currentIds.includes(id)
        ? currentIds.filter((cid) => cid !== id)
        : [...currentIds, id]
    );
  };

  const validateForm = (form: typeof editForm | typeof form): boolean => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return false;
    }
    if (form.default_amount && isNaN(parseFloat(form.default_amount))) {
      toast.error('Default amount must be a number');
      return false;
    }
    return true;
  };

  const handleAddClass = async () => {
    if (!newClassName.trim()) {
      toast.error('Class name is required');
      return;
    }

    const { data, error } = await supabase
      .from('classes')
      .insert({ name: newClassName.trim() })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create class');
      return;
    }

    toast.success('Class created successfully');
    setNewClassName('');
    fetchClasses();
  };

  const submitFeeType = async () => {
    if (!validateForm(form)) return;
    setLoading(true);

    const { data: newFeeType, error } = await supabase
      .from('fee_types')
      .insert({
        name: form.name.trim(),
        description: form.description || null,
        default_amount: form.default_amount
          ? parseFloat(form.default_amount)
          : null,
        applicable_from: form.applicable_from || null,
      })
      .select()
      .single();

    if (error || !newFeeType) {
      toast.error('Failed to create fee type');
      setLoading(false);
      return;
    }

    if (selectedClassIds.length > 0) {
      const linkInsert = selectedClassIds.map((class_id) => ({
        fee_type_id: newFeeType.id,
        class_id,
      }));
      const { error: linkError } = await supabase
        .from('fee_type_classes')
        .insert(linkInsert);
      if (linkError) {
        toast.error('Failed to link classes');
      }
    }

    toast.success('Fee type created');
    fetchFeeTypes();
    resetCreateForm();
    setLoading(false);
  };

  const openEdit = (feeType: FeeType) => {
    setEditing(feeType);
    setEditForm({
      name: feeType.name,
      description: feeType.description ?? '',
      default_amount: feeType.default_amount?.toString() ?? '',
      applicable_from: feeType.applicable_from ?? '',
    });
    setEditSelectedClassIds(feeType.classes?.map((c) => c.id) || []);
    setShowEditModal(true);
  };

  const updateFeeType = async () => {
    if (!editing || !validateForm(editForm)) return;
    setLoading(true);

    const { error: updateError } = await supabase
      .from('fee_types')
      .update({
        name: editForm.name.trim(),
        description: editForm.description || null,
        default_amount: editForm.default_amount
          ? parseFloat(editForm.default_amount)
          : null,
        applicable_from: editForm.applicable_from || null,
      })
      .eq('id', editing.id);

    if (updateError) {
      toast.error('Failed to update fee type');
      setLoading(false);
      return;
    }

    const { error: deleteLinksError } = await supabase
      .from('fee_type_classes')
      .delete()
      .eq('fee_type_id', editing.id);

    if (deleteLinksError) {
      toast.error('Failed to update class links');
      setLoading(false);
      return;
    }

    if (editSelectedClassIds.length > 0) {
      const newLinks = editSelectedClassIds.map((class_id) => ({
        fee_type_id: editing.id,
        class_id,
      }));
      const { error: insertError } = await supabase
        .from('fee_type_classes')
        .insert(newLinks);

      if (insertError) {
        toast.error('Failed to update class links');
        setLoading(false);
        return;
      }
    }

    toast.success('Fee type updated');
    fetchFeeTypes();
    resetEditForm();
    setLoading(false);
  };

  const deleteFeeType = async (feeType: FeeType) => {
    const confirmation = prompt(
      `To confirm deletion, please type the exact fee type name:\n"${feeType.name}"`
    );
    if (confirmation !== feeType.name) {
      if (confirmation !== null) {
        alert('Name did not match. Deletion aborted.');
      }
      return;
    }
    setLoading(true);

    await supabase
      .from('fee_type_classes')
      .delete()
      .eq('fee_type_id', feeType.id);
    const { error } = await supabase
      .from('fee_types')
      .delete()
      .eq('id', feeType.id);

    if (error) {
      toast.error('Failed to delete fee type');
    } else {
      toast.success('Fee type deleted');
      fetchFeeTypes();
    }
    setLoading(false);
  };

  const isCurrentlyApplicable = (feeType: FeeType) => {
    if (!feeType.applicable_from) return true;
    const now = new Date();
    const from = new Date(feeType.applicable_from);
    return now >= from;
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <button 
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Create New Fee Type
        </button>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newClassName}
            onChange={(e) => setNewClassName(e.target.value)}
            placeholder="New Class Name"
            className="border rounded px-3 py-2"
          />
          <button
            onClick={handleAddClass}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Add Class
          </button>
        </div>
      </div>

      <table className="w-full border-collapse border">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2 text-left">Name</th>
            <th className="border p-2 text-left">Description</th>
            <th className="border p-2 text-right">Default Amount</th>
            <th className="border p-2 text-left">Applicable From</th>
            <th className="border p-2 text-left">Classes</th>
            <th className="border p-2 text-left">Status</th>
            <th className="border p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {feeTypes.map((fee) => (
            <tr key={fee.id} className="hover:bg-gray-50">
              <td className="border p-2">{fee.name}</td>
              <td className="border p-2">{fee.description}</td>
              <td className="border p-2 text-right">
                {fee.default_amount ? `₹${fee.default_amount}` : '-'}
              </td>
              <td className="border p-2">
                {fee.applicable_from 
                  ? new Date(fee.applicable_from).toLocaleDateString()
                  : 'Always'
                }
              </td>
              <td className="border p-2">{fee.classes?.map((c) => c.name).join(', ') ?? '-'}</td>
              <td className="border p-2">
                <span className={`px-2 py-1 rounded-full text-sm ${
                  isCurrentlyApplicable(fee) 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {isCurrentlyApplicable(fee) ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="border p-2">
                <button 
                  onClick={() => openEdit(fee)}
                  className="text-blue-600 hover:underline mr-2"
                >
                  Edit
                </button>
                <button 
                  onClick={() => deleteFeeType(fee)} 
                  disabled={loading}
                  className="text-red-600 hover:underline"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-2xl">
            <h2 className="text-xl font-bold mb-4">Create Fee Type</h2>
            <div className="space-y-4">
              <label className="block">
                <span className="text-gray-700">Name:</span>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  disabled={loading}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </label>
              
              <label className="block">
                <span className="text-gray-700">Description:</span>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleFormChange}
                  disabled={loading}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </label>
              
              <label className="block">
                <span className="text-gray-700">Default Amount:</span>
                <input
                  name="default_amount"
                  value={form.default_amount}
                  onChange={handleFormChange}
                  disabled={loading}
                  type="number"
                  step="0.01"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </label>

              <label className="block">
                <span className="text-gray-700">Applicable From:</span>
                <input
                  type="date"
                  name="applicable_from"
                  value={form.applicable_from}
                  onChange={handleFormChange}
                  disabled={loading}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </label>

              <fieldset className="border rounded p-4">
                <legend className="font-bold px-2">Classes</legend>
                <div className="mb-2 space-x-2">
                  <button
                    type="button"
                    onClick={() => handleSelectAllClasses(setSelectedClassIds)}
                    className="text-blue-600 hover:underline"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnselectAllClasses(setSelectedClassIds)}
                    className="text-blue-600 hover:underline"
                  >
                    Unselect All
                  </button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {classes.map((cls) => (
                    <label key={cls.id} className="flex items-center">
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
                        disabled={loading}
                        className="mr-2"
                      />
                      {cls.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={submitFeeType}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Create
              </button>
              <button
                onClick={resetCreateForm}
                disabled={loading}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-full max-w-2xl">
            <h2 className="text-xl font-bold mb-4">Edit Fee Type</h2>
            <div className="space-y-4">
              <label className="block">
                <span className="text-gray-700">Name:</span>
                <input
                  name="name"
                  value={editForm.name}
                  onChange={handleEditFormChange}
                  disabled={loading}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </label>
              
              <label className="block">
                <span className="text-gray-700">Description:</span>
                <textarea
                  name="description"
                  value={editForm.description}
                  onChange={handleEditFormChange}
                  disabled={loading}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </label>
              
              <label className="block">
                <span className="text-gray-700">Default Amount:</span>
                <input
                  name="default_amount"
                  value={editForm.default_amount}
                  onChange={handleEditFormChange}
                  disabled={loading}
                  type="number"
                  step="0.01"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </label>

              <label className="block">
                <span className="text-gray-700">Applicable From:</span>
                <input
                  type="date"
                  name="applicable_from"
                  value={editForm.applicable_from}
                  onChange={handleEditFormChange}
                  disabled={loading}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                />
              </label>

              <fieldset className="border rounded p-4">
                <legend className="font-bold px-2">Classes</legend>
                <div className="mb-2 space-x-2">
                  <button
                    type="button"
                    onClick={() => handleSelectAllClasses(setEditSelectedClassIds)}
                    className="text-blue-600 hover:underline"
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnselectAllClasses(setEditSelectedClassIds)}
                    className="text-blue-600 hover:underline"
                  >
                    Unselect All
                  </button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {classes.map((cls) => (
                    <label key={cls.id} className="flex items-center">
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
                        disabled={loading}
                        className="mr-2"
                      />
                      {cls.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={updateFeeType}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={resetEditForm}
                disabled={loading}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}