import React, { useState } from 'react';
import { Upload, File, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export default function AddSchedule() {
  const [providerAvailability, setProviderAvailability] = useState<File | null>(null);
  const [providerContract, setProviderContract] = useState<File | null>(null);
  const [providerCredentialing, setProviderCredentialing] = useState<File | null>(null);
  const [facilityVolume, setFacilityVolume] = useState<File | null>(null);
  const [facilityCoverage, setFacilityCoverage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | null; text: string }>({ type: null, text: '' });

  const fileInputs = [
    { label: 'Provider Availability', file: providerAvailability, setter: setProviderAvailability, key: 'providerAvailability' },
    { label: 'Provider Contract', file: providerContract, setter: setProviderContract, key: 'providerContract' },
    { label: 'Provider Credentialing', file: providerCredentialing, setter: setProviderCredentialing, key: 'providerCredentialing' },
    { label: 'Facility Volume', file: facilityVolume, setter: setFacilityVolume, key: 'facilityVolume' },
    { label: 'Facility Coverage', file: facilityCoverage, setter: setFacilityCoverage, key: 'facilityCoverage' }
  ];

  // ---------- Helpers ----------
  function parseFilenameFromContentDisposition(cd: string | null): string | null {
    if (!cd) return null;
    // try filename*= (RFC5987) first
    const star = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(cd);
    if (star?.[2]) return decodeURIComponent(star[2].trim());
    // fallback to filename=
    const plain = /filename\s*=\s*"?([^"]+)"?/i.exec(cd);
    return plain?.[1] ?? null;
  }

  function isExcelContentType(ct: string | null): boolean {
    if (!ct) return false;
    const xlsx = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    return ct.includes(xlsx) || ct.includes('application/octet-stream');
  }

  const handleSubmit = async () => {
    setLoading(true);
    setMessage({ type: null, text: '' });

    const formData = new FormData();
    if (providerAvailability) formData.append('providerAvailability', providerAvailability);
    if (providerContract) formData.append('providerContract', providerContract);
    if (providerCredentialing) formData.append('providerCredentialing', providerCredentialing);
    if (facilityVolume) formData.append('facilityVolume', facilityVolume);
    if (facilityCoverage) formData.append('facilityCoverage', facilityCoverage);

    // 15-minute timeout using AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15 * 60 * 1000);

    try {
      const res = await fetch('http://localhost:4000/api/schedule/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });

      // Try to detect Excel response
      const ct = res.headers.get('content-type');
      const cd = res.headers.get('content-disposition');
      const looksLikeExcel = isExcelContentType(ct) || (cd && /filename=.*\.xlsx/i.test(cd));

      if (!res.ok) {
        // try to surface error JSON/text
        let errText = 'Upload failed. Please try again.';
        try {
          const txt = await res.text();
          try {
            const j = JSON.parse(txt);
            errText = j?.error || JSON.stringify(j) || errText;
          } catch {
            errText = txt || errText;
          }
        } catch {}
        setMessage({ type: 'error', text: errText });
        return;
      }

      if (looksLikeExcel) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        // choose filename from header or fallback
        const filename = parseFilenameFromContentDisposition(cd) || 'rank2.xlsx';

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        setMessage({ type: 'success', text: `Schedule generated. Downloaded ${filename}` });

        // Clear files after successful upload
        setProviderAvailability(null);
        setProviderContract(null);
        setProviderCredentialing(null);
        setFacilityVolume(null);
        setFacilityCoverage(null);
        return;
      }

      // If not Excel, assume JSON success payload
      const j = await res.json().catch(() => ({}));
      const successMsg = j?.counts
        ? `Upload successful! Records processed: ${JSON.stringify(j.counts)}`
        : 'Upload successful!';
      setMessage({ type: 'success', text: successMsg });

    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setMessage({ type: 'error', text: 'Request aborted after 15 minutes without a response.' });
      } else {
        setMessage({ type: 'error', text: 'An error occurred during upload. Please check your connection and try again.' });
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleClearAll = () => {
    setProviderAvailability(null);
    setProviderContract(null);
    setProviderCredentialing(null);
    setFacilityVolume(null);
    setFacilityCoverage(null);
    setMessage({ type: null, text: '' });
  };

  const hasFiles = providerAvailability || providerContract || providerCredentialing || facilityVolume || facilityCoverage;

  return (
    <div className="w-full max-w-5xl mx-auto p-6 pt-10">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900">Upload Schedule Files</h2>
          <p className="text-sm text-gray-500 mt-1">Upload .xlsx files for provider and facility data</p>
        </div>

        <div className="p-6">
          {message.type && (
            <div
              className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
                message.type === 'success'
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <p className={`text-sm ${message.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                {message.text}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {fileInputs.map((input) => (
              <div key={input.key} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">{input.label}</label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={e => input.setter(e.target.files ? e.target.files[0] : null)}
                    className="hidden"
                    id={input.key}
                    disabled={loading}
                  />
                  <label
                    htmlFor={input.key}
                    className={`flex items-center justify-between w-full px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                      input.file ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
                    } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      {input.file ? (
                        <File className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      ) : (
                        <Upload className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      )}
                      <span className={`text-sm truncate ${input.file ? 'text-blue-700 font-medium' : 'text-gray-500'}`}>
                        {input.file ? input.file.name : 'Choose file...'}
                      </span>
                    </div>
                    {input.file && <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />}
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleClearAll}
              disabled={loading || !hasFiles}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Clear All
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !hasFiles}
              className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload Files
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
