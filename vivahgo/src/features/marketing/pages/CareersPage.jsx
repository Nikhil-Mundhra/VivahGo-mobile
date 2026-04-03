import { useEffect, useMemo, useRef, useState } from 'react';
import '../../../vendor.css';
import '../../../styles.css';
import '../../../marketing-home.css';
import FeedbackModal from '../../../components/FeedbackModal';
import LegalFooter from '../../../components/LegalFooter';
import MarketingSiteHeader from '../../../components/MarketingSiteHeader.jsx';
import { readAuthSession } from '../../../authStorage';
import { fetchCareers, submitCareerApplication } from '../api.js';
import { DEFAULT_SITE_URL, usePageSeo } from '../../../seo.js';

const MAX_RESUME_SIZE_BYTES = 2 * 1024 * 1024;

function formatBytes(value) {
  if (!value) {
    return '0 MB';
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Could not read resume PDF.'));
    reader.readAsDataURL(file);
  });
}

export default function CareersPage() {
  const [careers, setCareers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [resumeLabel, setResumeLabel] = useState('');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [session, setSession] = useState(null);
  const formRef = useRef(null);
  const [form, setForm] = useState({
    jobId: '',
    fullName: '',
    email: '',
    phone: '',
    location: '',
    linkedInUrl: '',
    portfolioUrl: '',
    coverLetter: '',
    resumeFile: null,
  });
  const careersStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'VivahGo Careers',
    url: `${DEFAULT_SITE_URL}/careers`,
    description: 'Explore open roles at VivahGo.',
  };

  usePageSeo({
    title: 'VivahGo Careers | Join the Team',
    description: 'Explore open roles at VivahGo and help us build better wedding planning tools for couples, families, and planners.',
    path: '/careers',
    structuredData: careersStructuredData,
  });

  useEffect(() => {
    setSession(readAuthSession());
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');

    fetchCareers()
      .then((data) => {
        if (cancelled) {
          return;
        }
        const nextCareers = Array.isArray(data?.careers) ? data.careers : [];
        setCareers(nextCareers);
        setForm((current) => ({
          ...current,
          jobId: current.jobId || nextCareers[0]?.id || '',
        }));
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error.message || 'Could not load careers.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCareer = useMemo(
    () => careers.find((career) => career.id === form.jobId) || careers[0] || null,
    [careers, form.jobId]
  );

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function focusForm(jobId) {
    updateForm('jobId', jobId);
    window.setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  function handleResumeChange(event) {
    const file = event.target.files?.[0] || null;
    setSubmitError('');
    setSubmitSuccess('');

    if (!file) {
      updateForm('resumeFile', null);
      setResumeLabel('');
      return;
    }

    const looksLikePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!looksLikePdf) {
      updateForm('resumeFile', null);
      setResumeLabel('');
      setSubmitError('Please upload your resume as a PDF.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_RESUME_SIZE_BYTES) {
      updateForm('resumeFile', null);
      setResumeLabel('');
      setSubmitError('Resume PDF must be 2 MB or smaller.');
      event.target.value = '';
      return;
    }

    updateForm('resumeFile', file);
    setResumeLabel(`${file.name} (${formatBytes(file.size)})`);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError('');
    setSubmitSuccess('');

    if (!form.resumeFile) {
      setSubmitError('Please attach your resume PDF.');
      return;
    }

    try {
      setSubmitting(true);
      const resumeBase64 = await readFileAsBase64(form.resumeFile);
      await submitCareerApplication({
        jobId: form.jobId,
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        location: form.location,
        linkedInUrl: form.linkedInUrl,
        portfolioUrl: form.portfolioUrl,
        coverLetter: form.coverLetter,
        resumeFilename: form.resumeFile.name,
        resumeMimeType: 'application/pdf',
        resumeBase64,
      });

      setSubmitSuccess(`Application received for ${selectedCareer?.title || 'this role'}.`);
      setForm((current) => ({
        ...current,
        fullName: '',
        email: '',
        phone: '',
        location: '',
        linkedInUrl: '',
        portfolioUrl: '',
        coverLetter: '',
        resumeFile: null,
      }));
      setResumeLabel('');
      const fileInput = document.getElementById('resume-upload');
      if (fileInput) {
        fileInput.value = '';
      }
    } catch (error) {
      setSubmitError(error.message || 'Could not submit your application.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8f3ee_0%,#fffdf8_42%,#fff_100%)] text-stone-900">
      <MarketingSiteHeader
        activePage="careers"
        session={session}
        onContactUs={() => setShowFeedbackModal(true)}
        primaryCtaLabel="Plan Now"
        mobileCtaLabel="Plan Now"
      />

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-rose-500">Join VivahGo</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight text-stone-900 sm:text-5xl">
              Build calmer wedding planning tools with a small team that ships.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-stone-600 sm:text-lg">
              We are building software for Indian weddings that cuts through chat chaos, keeps families aligned, and helps vendors operate better.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-stone-500">Open roles</p>
                <p className="mt-2 text-3xl font-bold text-stone-900">{careers.length}</p>
              </div>
              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-stone-500">Resume format</p>
                <p className="mt-2 text-2xl font-bold text-stone-900">PDF</p>
              </div>
              <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-stone-500">Resume size limit</p>
                <p className="mt-2 text-2xl font-bold text-stone-900">{formatBytes(MAX_RESUME_SIZE_BYTES)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-xl shadow-stone-200/40">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-stone-500">What we value</p>
            <div className="mt-5 space-y-4">
              {[
                ['Ownership', 'People here work across product, operations, and customer reality, not narrow handoffs.'],
                ['Taste with practicality', 'We care about polish, but only when it helps users move faster with less confusion.'],
                ['Speed with care', 'We ship quickly, keep feedback loops tight, and try to leave systems cleaner than we found them.'],
              ].map(([title, body]) => (
                <div key={title} className="rounded-2xl bg-stone-50 p-4">
                  <h2 className="font-semibold text-stone-900">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">Open Positions</p>
              <h2 className="mt-2 text-3xl font-bold text-stone-900">Potential careers at VivahGo</h2>
            </div>
          </div>

          {loading && <div className="mt-8 rounded-3xl border border-stone-200 bg-white px-6 py-8 text-sm text-stone-500">Loading roles...</div>}
          {loadError && <div className="mt-8 rounded-3xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">{loadError}</div>}

          {!loading && !loadError && (
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {careers.map((career) => {
                const isSelected = career.id === selectedCareer?.id;

                return (
                  <article
                    key={career.id}
                    className={`rounded-[2rem] border p-6 shadow-sm transition ${isSelected ? 'border-rose-300 bg-rose-50/60 shadow-rose-100' : 'border-stone-200 bg-white hover:border-stone-300'}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">{career.team}</span>
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">{career.type}</span>
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-stone-900">{career.title}</h3>
                    <p className="mt-2 text-sm text-stone-500">{career.location}</p>
                    <p className="mt-4 text-sm leading-6 text-stone-700">{career.summary}</p>
                    <div className="mt-5 space-y-2 text-sm text-stone-600">
                      {career.highlights?.map((highlight) => (
                        <p key={highlight}>- {highlight}</p>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="mt-6 inline-flex rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-700"
                      onClick={() => focusForm(career.id)}
                    >
                      Apply for this role
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section ref={formRef} className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-xl shadow-stone-200/30 sm:p-8">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-rose-500">Application Form</p>
                <h2 className="mt-3 text-3xl font-bold text-stone-900">Send us your profile</h2>
                <p className="mt-4 text-sm leading-6 text-stone-600">
                  Choose a role, share a few details, and upload your resume PDF. We review resumes from the admin console.
                </p>
                {selectedCareer && (
                  <div className="mt-6 rounded-3xl bg-stone-50 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Selected role</p>
                    <h3 className="mt-2 text-xl font-semibold text-stone-900">{selectedCareer.title}</h3>
                    <p className="mt-1 text-sm text-stone-500">{selectedCareer.team} | {selectedCareer.location}</p>
                  </div>
                )}
              </div>

              <form className="grid gap-4" onSubmit={handleSubmit}>
                <label className="grid gap-2 text-sm text-stone-700">
                  Role
                  <select
                    value={form.jobId}
                    onChange={(event) => updateForm('jobId', event.target.value)}
                    className="rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-rose-400"
                    required
                  >
                    {careers.map((career) => (
                      <option key={career.id} value={career.id}>{career.title}</option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm text-stone-700">
                    Full name
                    <input
                      type="text"
                      value={form.fullName}
                      onChange={(event) => updateForm('fullName', event.target.value)}
                      className="rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-rose-400"
                      required
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-stone-700">
                    Email
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => updateForm('email', event.target.value)}
                      className="rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-rose-400"
                      required
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm text-stone-700">
                    Phone
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(event) => updateForm('phone', event.target.value)}
                      className="rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-rose-400"
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-stone-700">
                    Location
                    <input
                      type="text"
                      value={form.location}
                      onChange={(event) => updateForm('location', event.target.value)}
                      className="rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-rose-400"
                    />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm text-stone-700">
                    LinkedIn URL
                    <input
                      type="url"
                      value={form.linkedInUrl}
                      onChange={(event) => updateForm('linkedInUrl', event.target.value)}
                      className="rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-rose-400"
                      placeholder="https://linkedin.com/in/..."
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-stone-700">
                    Portfolio URL
                    <input
                      type="url"
                      value={form.portfolioUrl}
                      onChange={(event) => updateForm('portfolioUrl', event.target.value)}
                      className="rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-rose-400"
                      placeholder="https://..."
                    />
                  </label>
                </div>

                <label className="grid gap-2 text-sm text-stone-700">
                  Why are you a fit for this role?
                  <textarea
                    value={form.coverLetter}
                    onChange={(event) => updateForm('coverLetter', event.target.value)}
                    className="min-h-36 rounded-2xl border border-stone-300 px-4 py-3 outline-none focus:border-rose-400"
                    placeholder="A short note is enough."
                  />
                </label>

                <label className="grid gap-2 text-sm text-stone-700">
                  Resume PDF
                  <input
                    id="resume-upload"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handleResumeChange}
                    className="rounded-2xl border border-dashed border-stone-300 px-4 py-3"
                    required
                  />
                  <span className="text-xs text-stone-500">{resumeLabel || `PDF only, max ${formatBytes(MAX_RESUME_SIZE_BYTES)}`}</span>
                </label>

                {submitError && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>}
                {submitSuccess && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{submitSuccess}</div>}

                <button
                  type="submit"
                  className="inline-flex justify-center rounded-full bg-rose-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={submitting || loading || careers.length === 0}
                >
                  {submitting ? 'Submitting...' : 'Submit application'}
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>

      <LegalFooter
        onOpenFeedback={() => setShowFeedbackModal(true)}
      />
      {showFeedbackModal && <FeedbackModal onClose={() => setShowFeedbackModal(false)} />}
    </div>
  );
}
