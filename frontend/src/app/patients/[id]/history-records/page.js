'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Navbar from '@/components/common/Navbar';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, FileText, AlertCircle, CalendarDays, UserRound } from 'lucide-react';

export default function PatientHistoryRecordsPage() {
  const { id } = useParams();
  const { token, API_BASE_URL } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [patient, setPatient] = useState(null);
  const [doctorsById, setDoctorsById] = useState({});
  const [queueTokens, setQueueTokens] = useState([]);

  useEffect(() => {
    if (!id || !token) return;

    let active = true;

    const fetchHistoryData = async () => {
      setLoading(true);
      setError('');
      try {
        const [patientRes, doctorsRes, queueRes] = await Promise.all([
          fetch(`${API_BASE_URL}/patients/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/doctors`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE_URL}/queue`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!patientRes.ok) {
          throw new Error('Patient record could not be loaded.');
        }
        if (!doctorsRes.ok) {
          throw new Error('Doctor directory could not be loaded.');
        }
        if (!queueRes.ok) {
          throw new Error('Queue records could not be loaded.');
        }

        const [patientData, doctorsData, queueData] = await Promise.all([
          patientRes.json(),
          doctorsRes.json(),
          queueRes.json(),
        ]);

        if (!active) return;

        const doctorMap = (Array.isArray(doctorsData) ? doctorsData : []).reduce((acc, doc) => {
          acc[doc.id] = doc;
          return acc;
        }, {});

        setPatient(patientData);
        setDoctorsById(doctorMap);
        setQueueTokens(
          (Array.isArray(queueData) ? queueData : [])
            .filter((tokenItem) => tokenItem.patientId === id)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        );
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Unable to load patient history.');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchHistoryData();
    return () => {
      active = false;
    };
  }, [id, token, API_BASE_URL]);

  const sortedAppointments = useMemo(() => {
    if (!patient?.appointments) return [];
    return [...patient.appointments].sort(
      (a, b) => new Date(b.appointmentDate) - new Date(a.appointmentDate)
    );
  }, [patient]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-bold text-teal-600 dark:text-teal-400 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        {loading ? (
          <div className="glass p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-400">
            Loading patient diagnostic records...
          </div>
        ) : error ? (
          <div className="glass p-6 rounded-2xl border border-rose-500/25 bg-rose-500/10 text-rose-500 flex items-start gap-3 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <strong>Failed to load records:</strong> {error}
            </div>
          </div>
        ) : !patient ? (
          <div className="glass p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
            Patient not found.
          </div>
        ) : (
          <>
            <section className="glass p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md">
              <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <UserRound className="h-6 w-6 text-teal-600" />
                {patient.name}
              </h1>
              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-400">
                Contact: {patient.phoneNumber} | Gender: {patient.gender} | Age: {patient.age}
              </p>

              <div className="mt-5 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Clinical Background
                </h2>
                <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300 leading-6">
                  {patient.medicalHistory || 'No recorded medical history for this patient.'}
                </p>
              </div>
            </section>

            <section className="glass p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md">
              <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-teal-600" />
                Appointment History
              </h2>

              {sortedAppointments.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No appointments recorded yet.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm text-left">
                    <thead>
                      <tr className="text-slate-400 uppercase tracking-widest text-xxs font-bold">
                        <th className="py-2">Date</th>
                        <th className="py-2">Doctor</th>
                        <th className="py-2">Reason</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {sortedAppointments.map((app) => (
                        <tr key={app.id}>
                          <td className="py-3 font-semibold text-slate-700 dark:text-slate-300">
                            {new Date(app.appointmentDate).toLocaleString()}
                          </td>
                          <td className="py-3 text-slate-600 dark:text-slate-400">
                            {doctorsById[app.doctorId]?.name || 'Unknown doctor'}
                          </td>
                          <td className="py-3 text-slate-600 dark:text-slate-400">{app.reason || 'N/A'}</td>
                          <td className="py-3">
                            <span className="px-2 py-1 rounded text-xxs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {app.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="glass p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md">
              <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <FileText className="h-5 w-5 text-teal-600" />
                Queue History
              </h2>

              {queueTokens.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No queue records for this patient yet.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm text-left">
                    <thead>
                      <tr className="text-slate-400 uppercase tracking-widest text-xxs font-bold">
                        <th className="py-2">Date</th>
                        <th className="py-2">Token</th>
                        <th className="py-2">Doctor</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {queueTokens.map((tokenItem) => (
                        <tr key={tokenItem.id}>
                          <td className="py-3 font-semibold text-slate-700 dark:text-slate-300">
                            {new Date(tokenItem.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3 text-slate-600 dark:text-slate-400">#{tokenItem.tokenNumber}</td>
                          <td className="py-3 text-slate-600 dark:text-slate-400">
                            {tokenItem.doctor?.name || doctorsById[tokenItem.doctorId]?.name || 'Unknown doctor'}
                          </td>
                          <td className="py-3">
                            <span className="px-2 py-1 rounded text-xxs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              {tokenItem.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

