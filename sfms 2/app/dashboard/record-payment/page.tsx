'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

function isUUID(str: string) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export default function RecordPaymentPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null
  );

  const [amountPaid, setAmountPaid] = useState('');
  const [modeOfPayment, setModeOfPayment] = useState('cash');
  const [description, setDescription] = useState('');
  const [manualReceiptNumber, setManualReceiptNumber] = useState('');

  const [classes, setClasses] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');

  const [studentPayments, setStudentPayments] = useState<any[]>([]);

  // Load classes
  useEffect(() => {
    supabase
      .from('classes')
      .select('id,name')
      .then(({ data, error }) => {
        if (error) {
          toast.error('Failed to load classes');
          console.error('Error fetching classes:', error);
          return;
        }
        if (data) setClasses(data);
      });
  }, []);

  // Load students on class change
  useEffect(() => {
    let query = supabase.from('students').select('id, name, roll_no, class_id');
    if (selectedClass) query = query.eq('class_id', selectedClass);

    query.then(({ data, error }) => {
      if (error) {
        toast.error('Failed to load students');
        console.error('Error fetching students:', error);
        return;
      }
      if (data) setStudents(data);
    });
  }, [selectedClass]);

  // Filter search
  useEffect(() => {
    const filtered = students.filter(
      (s) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.roll_no.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredStudents(filtered);
  }, [searchTerm, students]);

  // Fetch payments for selected student
  useEffect(() => {
    if (!selectedStudentId) {
      setStudentPayments([]);
      return;
    }

    supabase
      .from('payments')
      .select('*')
      .eq('student_id', selectedStudentId)
      .order('date', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          toast.error('Failed to fetch payment history');
          console.error(error);
          return;
        }
        setStudentPayments(data || []);
      });
  }, [selectedStudentId, isSubmitting]);

  // Clear confirmation message on student change
  useEffect(() => {
    setConfirmationMessage('');
  }, [selectedStudentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStudentId) {
      toast.error('Please select a student.');
      return;
    }

    if (!amountPaid || isNaN(Number(amountPaid)) || Number(amountPaid) <= 0) {
      toast.error('Enter a valid amount.');
      return;
    }

    const generatedReceiptNumber = manualReceiptNumber.trim()
      ? manualReceiptNumber.trim()
      : `R-${Date.now()}`;

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.from('payments').insert([
        {
          student_id: selectedStudentId,
          amount_paid: parseFloat(amountPaid),
          date: new Date().toISOString(),
          mode_of_payment: modeOfPayment,
          description: description || null,
          receipt_number: generatedReceiptNumber,
        },
      ]);

      if (error) {
        toast.error('Failed to record payment: ' + error.message);
      } else {
        toast.success(`Payment recorded. Receipt #: ${generatedReceiptNumber}`);
        setConfirmationMessage(
          `✅ Payment of ₹${amountPaid} recorded with Receipt #${generatedReceiptNumber}`
        );
        // Reset form inputs only
        setAmountPaid('');
        setModeOfPayment('cash');
        setDescription('');
        setManualReceiptNumber('');
        setSearchTerm('');
      }
    } catch (err) {
      toast.error('Unexpected error occurred.');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-50 rounded-lg shadow-md">
      <h1 className="text-3xl font-bold mb-6 text-center text-indigo-700">
        Record Payment
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="md:col-span-1 space-y-4">
          <input
            type="text"
            placeholder="Search by name or roll no."
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
          >
            <option value="">All Classes</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>

          <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto bg-white shadow-inner">
            {filteredStudents.length ? (
              filteredStudents.map((student) => (
                <div
                  key={student.id}
                  className={`p-3 cursor-pointer hover:bg-indigo-100 ${
                    selectedStudentId === student.id
                      ? 'bg-indigo-200 font-semibold'
                      : ''
                  }`}
                  onClick={() => setSelectedStudentId(student.id)}
                >
                  <div>{student.name}</div>
                  <div className="text-sm text-gray-600">
                    Roll No: {student.roll_no}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-gray-500 text-center italic">
                No students found
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="md:col-span-2 bg-white p-8 rounded-lg shadow">
          {selectedStudentId ? (
            <>
              <h2 className="text-xl font-semibold mb-5 text-indigo-700">
                Payment for{' '}
                <span className="underline">
                  {students.find((s) => s.id === selectedStudentId)?.name}
                </span>
              </h2>

              {confirmationMessage && (
                <div className="mb-6 p-4 bg-green-100 border border-green-300 text-green-700 rounded">
                  {confirmationMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block mb-2 font-medium">Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    required
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter amount"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium">
                    Mode of Payment
                  </label>
                  <select
                    value={modeOfPayment}
                    onChange={(e) => setModeOfPayment(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isSubmitting}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="dd">Demand Draft</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-2 font-medium">
                    Receipt Number (Optional)
                  </label>
                  <input
                    type="text"
                    value={manualReceiptNumber}
                    onChange={(e) => setManualReceiptNumber(e.target.value)}
                    placeholder="Enter receipt number or leave blank"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block mb-2 font-medium">
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Notes or description"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={isSubmitting}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full py-3 rounded text-white font-semibold transition ${
                    isSubmitting
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {isSubmitting ? 'Recording...' : 'Record Payment'}
                </button>
              </form>

              {/* Payment History Table */}
              {studentPayments.length > 0 && (
                <div className="mt-10">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4">
                    Payment History
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-300 rounded shadow-sm text-sm">
                      <thead className="bg-gray-100 text-gray-600">
                        <tr>
                          <th className="px-4 py-2 text-left border-b">Date</th>
                          <th className="px-4 py-2 text-left border-b">
                            Amount
                          </th>
                          <th className="px-4 py-2 text-left border-b">Mode</th>
                          <th className="px-4 py-2 text-left border-b">
                            Receipt #
                          </th>
                          <th className="px-4 py-2 text-left border-b">
                            Description
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentPayments.map((p) => (
                          <tr key={p.id} className="border-t hover:bg-gray-50">
                            <td className="px-4 py-2">
                              {new Date(p.date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2">₹{p.amount_paid}</td>
                            <td className="px-4 py-2 capitalize">
                              {p.mode_of_payment}
                            </td>
                            <td className="px-4 py-2">{p.receipt_number}</td>
                            <td className="px-4 py-2 text-sm">
                              {p.description || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-gray-500 py-20 italic">
              Select a student to record payment
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
