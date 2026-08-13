"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { saveSession, clearSession } from "@/lib/clientSession";
import { scheduleSync } from "@/lib/backgroundSync";
import { quizUrl, resultsUrl, STANDINGS_PATH } from "@/lib/quizUrls";
import { requestEmbedStorageAccess } from "@/lib/embed";
import { showToast } from "@/lib/toast";

const PHONE_MIN_DIGITS = 10;
const PHONE_MAX_DIGITS = 12;

function digitsOnly(value: string, max = PHONE_MAX_DIGITS) {
  return value.replace(/\D/g, "").slice(0, max);
}

/** Soft Next navigations often fail inside Framer iframes — use a full load. */
function go(path: string) {
  window.location.assign(path);
}

async function withTimeout(promise: Promise<unknown>, ms: number) {
  await Promise.race([
    promise.catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, ms)),
  ]);
}

export default function LandingPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [workExperience, setWorkExperience] = useState("");
  const [domain, setDomain] = useState("");

  const [showResume, setShowResume] = useState(false);
  const [resumeEmail, setResumeEmail] = useState("");
  const [resumeError, setResumeError] = useState("");
  const [resumeSubmitting, setResumeSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError("");

    // Don't let Storage Access API hang the button in embeds.
    await withTimeout(requestEmbedStorageAccess(), 400);

    const fullName = `${firstName} ${lastName}`.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const phoneDigits = digitsOnly(phone);
    if (
      phoneDigits.length < PHONE_MIN_DIGITS ||
      phoneDigits.length > PHONE_MAX_DIGITS
    ) {
      const message = "Phone number must be 10 to 12 digits.";
      setError(message);
      showToast(message);
      return;
    }

    setSubmitting(true);

    try {
      const beginRes = await fetch("/api/begin", { method: "POST" });
      const beginData = await beginRes.json();
      if (!beginRes.ok) {
        const message =
          beginData.error ?? "Registration failed. Please try again.";
        setError(message);
        showToast(message);
        return;
      }

      const pid = String(beginData.pid);
      // Sheet write can take ~1–2s; we wait so resume-by-email works after reload.
      const regRes = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pid,
          name: fullName,
          email: normalizedEmail,
          phone: phoneDigits,
          workExperience,
          domain,
        }),
      });
      const regData = await regRes.json();
      if (!regRes.ok) {
        const message =
          regData.error ?? "Registration failed. Please try again.";
        setError(message);
        showToast(message);
        return;
      }

      const token = String(regData.token ?? beginData.token);
      const canonicalPid = String(regData.pid ?? pid);
      saveSession({
        pid: canonicalPid,
        token,
        name: fullName,
        email: normalizedEmail,
        phone: phoneDigits,
        workExperience,
        domain,
        registeredAt: Date.now(),
        registered: true,
        answers: {},
        syncedAnswerString: "",
        completed: Boolean(regData.existing && regData.status === "completed"),
        submitted: Boolean(regData.existing && regData.status === "completed"),
        score: null,
        completionTimeSeconds: null,
        completedAt: null,
      });

      scheduleSync();

      if (regData.existing && regData.status === "completed") {
        go(resultsUrl(normalizedEmail));
        return;
      }

      go(quizUrl(normalizedEmail));
    } catch {
      const message = "Network error. Please check your connection and try again.";
      setError(message);
      showToast(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResume(e: FormEvent) {
    e.preventDefault();
    setResumeError("");
    await withTimeout(requestEmbedStorageAccess(), 400);
    setResumeSubmitting(true);

    try {
      const res = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resumeEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message =
          data.error ?? "Couldn't find a registration for that email.";
        setResumeError(message);
        showToast(message);
        return;
      }
      clearSession();
      const normalizedEmail = resumeEmail.trim().toLowerCase();
      const page = data.status === "completed" ? "results" : "quiz";
      go(page === "results" ? resultsUrl(normalizedEmail) : quizUrl(normalizedEmail));
    } catch {
      const message = "Network error. Please check your connection and try again.";
      setResumeError(message);
      showToast(message);
    } finally {
      setResumeSubmitting(false);
    }
  }

  return (
    <div className="binary-bg min-h-dvh">
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col items-center justify-center px-5 py-12 sm:px-8">
        {/* Top text — centered above form */}
        <header className="mb-8 w-full text-center">
          <h1 className="register-headline">
            India&apos;s National AI Competition to identify the next-gen AI
            talent
          </h1>
        </header>

        {/* Form only */}
        <div className="register-form-panel w-full p-6 sm:p-8">
          {showResume ? (
            <form onSubmit={handleResume} className="space-y-4">
              <input
                id="resumeEmail"
                type="email"
                required
                value={resumeEmail}
                onChange={(e) => setResumeEmail(e.target.value)}
                className="register-input"
                placeholder="Email*"
              />

              {resumeError && (
                <p className="rounded-lg border border-red-500/30 bg-red-950/60 px-3 py-2 text-sm text-red-300">
                  {resumeError}
                </p>
              )}

              <button
                type="submit"
                disabled={resumeSubmitting}
                className="register-btn-primary"
              >
                {resumeSubmitting ? "Loading…" : "Continue"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <input
                  id="firstName"
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="register-input"
                  placeholder="First Name*"
                />
                <input
                  id="lastName"
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="register-input"
                  placeholder="Last Name*"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="register-input"
                  placeholder="Email*"
                />
                <input
                  id="phone"
                  type="text"
                  inputMode="numeric"
                  autoComplete="tel"
                  required
                  minLength={PHONE_MIN_DIGITS}
                  maxLength={PHONE_MAX_DIGITS}
                  pattern="[0-9]{10,12}"
                  title="Enter 10 to 12 digits"
                  value={phone}
                  onChange={(e) => setPhone(digitsOnly(e.target.value))}
                  onBeforeInput={(e) => {
                    const data = (e as unknown as InputEvent).data;
                    if (data && /\D/.test(data)) e.preventDefault();
                  }}
                  onKeyDown={(e) => {
                    if (e.ctrlKey || e.metaKey || e.altKey) return;
                    const allowed = [
                      "Backspace",
                      "Delete",
                      "Tab",
                      "Escape",
                      "Enter",
                      "ArrowLeft",
                      "ArrowRight",
                      "Home",
                      "End",
                    ];
                    if (allowed.includes(e.key)) return;
                    if (!/^\d$/.test(e.key)) e.preventDefault();
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const text = e.clipboardData.getData("text");
                    setPhone(digitsOnly(`${phone}${text}`));
                  }}
                  className="register-input"
                  placeholder="Phone Number*"
                />
              </div>

              <div>
                <label htmlFor="workExperience" className="register-label">
                  Work Experience (in years)
                </label>
                <div className="register-select-wrap">
                  <select
                    id="workExperience"
                    required
                    value={workExperience}
                    onChange={(e) => setWorkExperience(e.target.value)}
                    className="register-input register-select"
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    <option value="15+ Years">15+ Years</option>
                    <option value="10-15 Years">10-15 Years</option>
                    <option value="5-10 Years">5-10 Years</option>
                    <option value="2-5 Years">2-5 Years</option>
                    <option value="0-2 Years">0-2 Years</option>
                    <option value="Fresher">Fresher</option>
                    <option value="Still a student">Still a student</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="domain" className="register-label">
                  Which domain are you currently working in?
                </label>
                <div className="register-select-wrap">
                  <select
                    id="domain"
                    required
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="register-input register-select"
                  >
                    <option value="" disabled>
                      Select…
                    </option>
                    <option value="Software Development / Engineering">
                      Software Development / Engineering
                    </option>
                    <option value="Data Science & Analytics">
                      Data Science & Analytics
                    </option>
                    <option value="Artificial Intelligence (AI)">
                      Artificial Intelligence (AI)
                    </option>
                    <option value="Cybersecurity">Cybersecurity</option>
                    <option value="IT Infrastructure / Cloud / Networking">
                      IT Infrastructure / Cloud / Networking
                    </option>
                    <option value="Product / Project / Program Management">
                      Product / Project / Program Management
                    </option>
                  </select>
                </div>
              </div>

              {error && (
                <p className="rounded-lg border border-red-500/30 bg-red-950/60 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="register-btn-primary mt-1"
              >
                {submitting ? "Registering…" : "Register Now"}
              </button>
            </form>
          )}

          <p className="mt-5 text-center text-sm text-white/45">
            <button
              type="button"
              onClick={() => setShowResume((s) => !s)}
              className="text-white/70 hover:text-white hover:underline"
            >
              {showResume ? "New here? Register" : "Already registered? Continue"}
            </button>
            <span className="mx-2 text-white/25">·</span>
            <Link href={STANDINGS_PATH} className="text-white/70 hover:text-white hover:underline">
              Leaderboard
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
