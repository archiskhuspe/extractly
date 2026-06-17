import React, { useState } from 'react';
import UrlInput from '../components/UrlInput';
import SummaryBox from '../components/SummaryBox';
import KeyPointsTable from '../components/KeyPointsTable';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';

// shadcn/ui Card component (manual, JS version)
function Card({ className = '', children }) {
  return (
    <div className={`bg-white rounded-xl shadow-lg border border-gray-100 ${className}`}>{children}</div>
  );
}

// Document icon (like Summary)
function DocIcon() {
  return (
    <span className="inline-block mr-2 align-middle text-blue-500">
      <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3" fill="#2563eb" opacity="0.1"/><rect x="7" y="9" width="10" height="2" rx="1" fill="#2563eb"/><rect x="7" y="13" width="6" height="2" rx="1" fill="#2563eb"/></svg>
    </span>
  );
}

function HeaderCard() {
  return (
    <Card className="max-w-xl mx-auto mt-10 mb-8 p-8 flex flex-col items-center text-center">
      <div className="flex items-center mb-2">
        <DocIcon />
        <h1 className="text-3xl font-extrabold tracking-tight text-blue-800 whitespace-nowrap">Extractly: AI-powered Content Extractor</h1>
      </div>
      <p className="text-gray-600 text-base max-w-xl">Extract summaries and key points from any public article URL.</p>
    </Card>
  );
}

function UrlInputCard({ onSubmit, loading }) {
  return (
    <Card className="max-w-xl mx-auto mb-8 p-6">
      <UrlInput onSubmit={onSubmit} loading={loading} />
    </Card>
  );
}

// Export as PDF button
function ExportPDFButton({ summary, keyPoints, label = 'Download Summary as PDF' }) {
  const handleExport = async () => {
    const jsPDF = (await import('jspdf')).jsPDF;
    const doc = new jsPDF();
    let y = 15;
    doc.setFontSize(18);
    doc.text('Extractly: AI-powered Content Extractor', 10, y);
    y += 10;
    doc.setFontSize(14);
    doc.text('Summary:', 10, y);
    y += 8;
    doc.setFontSize(11);
    summary.split(/\n\n|\n/).forEach(p => {
      doc.text(doc.splitTextToSize(p, 180), 10, y);
      y += 8 + Math.ceil(p.length / 90) * 5;
    });
    y += 4;
    doc.setFontSize(14);
    doc.text('Key Points:', 10, y);
    y += 8;
    doc.setFontSize(11);
    keyPoints.forEach((pt, i) => {
      doc.text(`${i + 1}. ${pt}`, 12, y);
      y += 7 + Math.ceil(pt.length / 90) * 4;
      if (y > 270) { doc.addPage(); y = 15; }
    });
    doc.save('extracted-summary.pdf');
  };
  return (
    <button
      className="mb-4 ml-auto flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
      onClick={handleExport}
      title={label}
    >
      {label}
    </button>
  );
}

// Simple Toast component
function Toast({ message, type, onClose }) {
  if (!message) return null;
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded shadow-lg text-white text-sm transition-all duration-300 ${type === 'error' ? 'bg-red-500' : 'bg-blue-600'}`}
      role="alert">
      {message}
      <button className="ml-4 text-white/80 hover:text-white" onClick={onClose}>&times;</button>
    </div>
  );
}

// Highlight helper (copied from KeyPointsTable)
function highlightText(text, search) {
  if (!search) return text;
  const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} className="bg-yellow-200 text-black px-0.5 rounded">{part}</mark>
      : part
  );
}

// Main page: manages state and layout
export default function Home() {
  const [summary, setSummary] = useState('');
  const [keyPoints, setKeyPoints] = useState([]);
  const [currentKeyPoints, setCurrentKeyPoints] = useState([]); // for export
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'info' });
  const [allExtracted, setAllExtracted] = useState([]);
  const [fetchingAll, setFetchingAll] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(5);
  const [totalPages, setTotalPages] = useState(1);
  const [editId, setEditId] = useState(null);
  const [editUrl, setEditUrl] = useState('');
  const [editContent, setEditContent] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const handleSubmit = async (url) => {
    setLoading(true);
    setError('');
    setSummary('');
    setKeyPoints([]);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to extract content.');
        setToast({ message: data.error || 'Failed to extract content.', type: 'error' });
      } else {
        setSummary(data.summary);
        setKeyPoints(data.keyPoints);
        setCurrentKeyPoints(data.keyPoints);
        setToast({ message: 'Extraction complete!', type: 'info' });
      }
    } catch (err) {
      setError('Network error.');
      setToast({ message: 'Network error.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const fetchAllExtracted = async (pageOverride = page, searchOverride = search) => {
    setFetchingAll(true);
    setAllExtracted([]);
    try {
      const params = new URLSearchParams({ page: pageOverride, size, ...(searchOverride ? { search: searchOverride } : {}) });
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/extracted?${params}`);
      const data = await res.json();
      if (data && Array.isArray(data.content)) {
        setAllExtracted(data.content);
        setTotalPages(data.totalPages);
        setPage(data.page);
        setToast({ message: 'Fetched extracted content!', type: 'info' });
      } else {
        setToast({ message: 'Failed to fetch extracted content.', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Network error.', type: 'error' });
    } finally {
      setFetchingAll(false);
    }
  };

  React.useEffect(() => {
    fetchAllExtracted(0, '');
    // eslint-disable-next-line
  }, []);

  // Pagination/search handlers
  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchAllExtracted(newPage, search);
  };
  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(0);
    fetchAllExtracted(0, e.target.value);
  };

  // Edit handlers
  const startEdit = (item) => {
    setEditId(item.id);
    setEditUrl(item.url);
    setEditContent(item.summary || '');
  };
  const saveEdit = async (id) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/extracted/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: editUrl, summary: editContent })
      });
      if (res.ok) {
        setToast({ message: 'Updated!', type: 'info' });
        fetchAllExtracted(page, search);
      } else {
        setToast({ message: 'Failed to update.', type: 'error' });
      }
    } catch {
      setToast({ message: 'Network error.', type: 'error' });
    }
    setEditId(null);
    setEditUrl('');
    setEditContent('');
  };
  const cancelEdit = () => {
    setEditId(null);
    setEditUrl('');
    setEditContent('');
  };
  // Delete handler
  const deleteRow = async (id) => {
    setDeletingId(id);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/extracted/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setToast({ message: 'Deleted!', type: 'info' });
        fetchAllExtracted(page, search);
      } else {
        setToast({ message: 'Failed to delete.', type: 'error' });
      }
    } catch {
      setToast({ message: 'Network error.', type: 'error' });
    }
    setDeletingId(null);
  };

  // Auto-dismiss toast
  React.useEffect(() => {
    if (toast.message) {
      const t = setTimeout(() => setToast({ message: '', type: 'info' }), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Export all extracted content as PDF
  const handleExportAllPDF = async () => {
    const doc = new jsPDF();
    let y = 15;
    doc.setFontSize(18);
    doc.text('All Extracted Summaries', 10, y);
    y += 10;
    doc.setFontSize(12);
    allExtracted.forEach((item, idx) => {
      if (y > 270) { doc.addPage(); y = 15; }
      doc.setFont(undefined, 'bold');
      doc.text(`${idx + 1}. ${item.url}`, 10, y);
      y += 7;
      doc.setFont(undefined, 'normal');
      const summaryLines = doc.splitTextToSize(item.summary || '', 180);
      summaryLines.forEach(line => {
        if (y > 270) { doc.addPage(); y = 15; }
        doc.text(line, 12, y);
        y += 6;
      });
      y += 4;
    });
    doc.save('all-extracted-summaries.pdf');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-gray-100 flex flex-col">
      <header className="w-full bg-white shadow-sm border-b mb-6">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <DocIcon />
            <h1 className="text-3xl font-extrabold tracking-tight text-blue-800 whitespace-nowrap">Extractly: AI-powered Content Extractor</h1>
          </div>
          <div className="text-gray-500 text-sm mt-2 md:mt-0">by Archis Khuspe</div>
        </div>
      </header>
      <main className="flex-1 w-full">
        <section className="max-w-3xl mx-auto mb-10 p-6 bg-white rounded-xl shadow-lg border border-gray-100">
          <h2 className="text-xl font-bold text-blue-700 mb-4 whitespace-nowrap">Extract Content</h2>
          <UrlInputCard onSubmit={handleSubmit} loading={loading} />
        </section>
        {(summary || keyPoints.length > 0) && (
          <section className="max-w-3xl mx-auto mb-10 p-6 bg-white rounded-xl shadow-lg border border-gray-100">
            <div className="flex flex-row items-center justify-between gap-2 mb-4">
              <h2 className="text-xl font-bold text-blue-700 whitespace-nowrap m-0 p-0">Summary & Key Points</h2>
              <ExportPDFButton summary={summary} keyPoints={currentKeyPoints.length ? currentKeyPoints : keyPoints} label="Export as PDF" />
            </div>
            <Card>
              <SummaryBox summary={summary} loading={loading} />
            </Card>
            <Card>
              <KeyPointsTable keyPoints={keyPoints} setKeyPoints={setKeyPoints} loading={loading} onKeyPointsChange={setCurrentKeyPoints} />
            </Card>
          </section>
        )}
        <section className="max-w-6xl mx-auto mb-10 p-6 bg-white rounded-xl shadow-lg border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-2">
            <h2 className="text-xl font-bold text-blue-700 whitespace-nowrap">Extraction History</h2>
            <div className="flex gap-2 items-center">
              <Input type="text" placeholder="Search..." value={search} onChange={handleSearch} className="w-48 text-sm" />
              <Button onClick={() => fetchAllExtracted(0, search)} disabled={fetchingAll} className="bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition-colors text-sm font-medium px-4 py-2 whitespace-nowrap">{fetchingAll ? 'Fetching...' : 'View/Refresh History'}</Button>
              <Button onClick={handleExportAllPDF} className="bg-blue-600 text-white rounded shadow hover:bg-blue-700 transition-colors text-sm font-medium px-4 py-2 whitespace-nowrap">Export as PDF</Button>
            </div>
          </div>
          {allExtracted.length > 0 && (
            <div className="overflow-x-auto animate-fade-in">
              <table className="w-full text-sm border-separate border-spacing-y-2">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-2 py-1 w-10">#</th>
                    <th className="text-left px-2 py-1">URL</th>
                    <th className="text-left px-2 py-1 w-2/5">Content</th>
                    <th className="px-2 py-1 w-32">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allExtracted.map((item, idx) => (
                    <tr key={item.id} className={`transition-all duration-300 bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md ${deletingId === item.id ? 'opacity-0 translate-x-8 pointer-events-none' : 'opacity-100'}`}> 
                      <td className="px-2 py-2 align-top font-mono text-gray-400">{page * size + idx + 1}</td>
                      <td className="px-2 py-2 align-top">
                        {editId === item.id ? (
                          <Input value={editUrl} onChange={e => setEditUrl(e.target.value)} className="w-full" />
                        ) : (
                          <span className="block break-all">{search ? highlightText(item.url, search) : item.url}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 align-top">
                        {editId === item.id ? (
                          <textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="w-full min-h-[80px] rounded border border-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" />
                        ) : (
                          <span className="block whitespace-pre-line">{search ? highlightText(item.summary?.slice(0, 300) || '', search) : (item.summary?.slice(0, 300) || '')}{item.summary && item.summary.length > 300 ? '...' : ''}</span>
                        )}
                      </td>
                      <td className="px-2 py-2 align-top flex gap-1">
                        {editId === item.id ? (
                          <>
                            <Button className="text-green-600" variant="outline" onClick={() => saveEdit(item.id)}>Save</Button>
                            <Button className="text-gray-500" variant="outline" onClick={cancelEdit}>Cancel</Button>
                          </>
                        ) : (
                          <>
                            <Button className="text-blue-600" variant="outline" onClick={() => startEdit(item)}>Edit</Button>
                            <Button className="text-red-600" variant="outline" onClick={() => deleteRow(item.id)}>Delete</Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Pagination */}
              <div className="flex justify-center items-center gap-2 mt-4">
                <Button variant="outline" className="px-2 py-1" disabled={page === 0} onClick={() => handlePageChange(page - 1)}>&lt;</Button>
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    className={`w-8 h-8 rounded-md text-sm font-medium ${page === i ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-500'} transition-colors`}
                    onClick={() => handlePageChange(i)}
                    disabled={page === i}
                  >
                    {i + 1}
                  </button>
                ))}
                <Button variant="outline" className="px-2 py-1" disabled={page === totalPages - 1} onClick={() => handlePageChange(page + 1)}>&gt;</Button>
              </div>
            </div>
          )}
        </section>
      </main>
      <Toast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'info' })} />
      <footer className="py-6 text-center text-xs text-gray-400 border-t mt-8">
        <div className="text-gray-400 text-xs mt-1">
          Built with: React, Next.js, Spring Boot, Tailwind CSS, shadcn/ui, jsPDF
        </div>
      </footer>
    </div>
  );
} 
