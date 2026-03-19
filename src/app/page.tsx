"use client";

import { useState, useEffect } from "react";
import { UserButton } from "@clerk/nextjs";
import { 
  TrendingUp, FileText, Target, Sliders, Zap, 
  Activity, Mail, HelpCircle, Copy, Download,
  Printer, Layers, Edit2, UploadCloud, Save, Check
} from "lucide-react";
import { marked } from "marked";

declare global {
  interface Window {
    html2pdf: any;
  }
}

type Tab = "resume" | "ats" | "cover" | "prep";

export default function Home() {
  // Inputs
  const [baseResume, setBaseResume] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [tone, setTone] = useState("Professional & Direct");
  const [level, setLevel] = useState("Mid-Level Professional");

  // Output State
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: "", type: "" });
  const [activeTab, setActiveTab] = useState<Tab>("resume");
  const [isEditing, setIsEditing] = useState(false);
  const [pdfLayout, setPdfLayout] = useState("classic");

  // User/Paywall State
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Output Data
  const [tailoredResume, setTailoredResume] = useState("");
  const [editorValue, setEditorValue] = useState("");
  const [atsScore, setAtsScore] = useState(0);
  const [missingKeywords, setMissingKeywords] = useState<string[]>([]);
  const [matchedKeywords, setMatchedKeywords] = useState<string[]>([]);
  const [coverLetter, setCoverLetter] = useState("");
  const [interviewQuestions, setInterviewQuestions] = useState("");
  
  const [hasOutput, setHasOutput] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load Auto-Saved Drafts on Mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedResume = localStorage.getItem("rezryt_draft_resume");
      if (savedResume) setBaseResume(savedResume);
      
      const savedJd = localStorage.getItem("rezryt_draft_jd");
      if (savedJd) setJobDescription(savedJd);
      
      const savedTone = localStorage.getItem("rezryt_draft_tone");
      if (savedTone) setTone(savedTone);
      
      const savedLevel = localStorage.getItem("rezryt_draft_level");
      if (savedLevel) setLevel(savedLevel);

      // Detect redirect back from Stripe checkout
      const params = new URLSearchParams(window.location.search);
      if (params.get("success") === "true") {
        const sessionId = params.get("session_id");
        window.history.replaceState({}, "", "/");
        const verifyPurchase = async () => {
          try {
            showStatus("Verifying your purchase...", "success");
            const res = await fetch("/api/verify-purchase", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId }),
            });
            const data = await res.json();
            if (res.ok) {
              setUserCredits(9999);
              setShowPaywall(false);
              showStatus("🎉 Unlimited Access Activated! Welcome to Elevate Pro!", "success");
            } else {
              fetchCredits();
            }
          } catch {
            fetchCredits();
          }
        };
        verifyPurchase();
      } else {
        fetchCredits();
      }
    }

    // Load HTML2PDF dynamically
    const loadScripts = async () => {
      if (typeof window !== "undefined") {
        if (!window.html2pdf) {
          const script1 = document.createElement("script");
          script1.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
          document.body.appendChild(script1);
        }
      }
    };
    loadScripts();
  }, []);

  // Save drafts when inputs change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("rezryt_draft_resume", baseResume);
      localStorage.setItem("rezryt_draft_jd", jobDescription);
      localStorage.setItem("rezryt_draft_tone", tone);
      localStorage.setItem("rezryt_draft_level", level);
    }
  }, [baseResume, jobDescription, tone, level]);

  const showStatus = (text: string, type: "success" | "error") => {
    setStatusMsg({ text, type });
    if (type === "success") {
      setTimeout(() => setStatusMsg({ text: "", type: "" }), 5000);
    }
  };

  const handleGenerate = async () => {
    if (isGenerating) return;
    if (!baseResume || !jobDescription) {
      showStatus("Please paste both your Base Resume and the Target Job.", "error");
      return;
    }

    setIsGenerating(true);
    showStatus("AI is analyzing and tailoring your profile...", "success");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseResume, jobDescription, tone, level })
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === "PAYWALL") {
           setShowPaywall(true);
           showStatus("Insufficient Credits.", "error");
        } else {
           throw new Error(data.error || "Generation Failed");
        }
        return;
      }

      setTailoredResume(data.tailoredResume || "No resume data");
      setEditorValue(data.tailoredResume || "");
      setAtsScore(data.atsScore || 0);
      setMissingKeywords(data.missingKeywords || []);
      setMatchedKeywords(data.matchedKeywords || []);
      setCoverLetter(data.coverLetter || "No cover letter data");
      setInterviewQuestions(data.interviewQuestions || "No prep data");
      
      setHasOutput(true);
      setActiveTab("resume");
      showStatus("Resume Elevated Successfully!", "success");

    } catch (error: any) {
      console.error(error);
      showStatus(error.message || "Failed to contact AI API.", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const fetchCredits = async () => {
    try {
      const res = await fetch("/api/user");
      const data = await res.json();
      if (res.ok) setUserCredits(data.credits);
    } catch (err) {
      console.error("Failed to fetch credits:", err);
    }
  };

  const handleBuyUnlimited = async () => {
    setIsCheckingOut(true);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create checkout session");
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleCopy = async () => {
    if (!tailoredResume) return;
    await navigator.clipboard.writeText(tailoredResume);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!tailoredResume) return;
    const blob = new Blob([tailoredResume], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Elevate_Tailored_Resume.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePdfExport = () => {
    if (!tailoredResume || typeof window === "undefined" || !window.html2pdf) return;
    showStatus("Generating PDF...", "success");

    if (isEditing) handleEditToggle();

    const element = document.getElementById("markdownOutput");
    if (!element) return;

    const layoutClass = "layout-" + pdfLayout;
    element.classList.add("pdf-export-mode");
    element.classList.add(layoutClass);
    const originalWidth = element.style.width;
    element.style.width = "800px";

    const opt = {
      margin:       [0.5, 0.5, 0.5, 0.5],
      filename:     'Elevate_Resume.pdf',
      image:        { type: 'jpeg', quality: 1.0 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['css', 'legacy'] }
    };

    window.html2pdf().set(opt).from(element).save().then(() => {
      element.classList.remove("pdf-export-mode");
      element.classList.remove(layoutClass);
      element.style.width = originalWidth;
      showStatus("PDF Exported Successfully!", "success");
    }).catch((err: any) => {
      console.error(err);
      element.classList.remove("pdf-export-mode");
      element.classList.remove(layoutClass);
      element.style.width = originalWidth;
      showStatus("Failed to generate PDF", "error");
    });
  };

  const handleEditToggle = () => {
    if (!hasOutput) return;
    
    if (isEditing) {
      // Saving edits
      setTailoredResume(editorValue);
      showStatus("Resume Changes Saved!", "success");
    }
    
    setIsEditing(!isEditing);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const processFile = async (file: File) => {
    if (file.type === "application/pdf") {
      showStatus("Reading your PDF...", "success");
      
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/parse-pdf", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to parse PDF.");
        }

        setBaseResume(data.text);
        showStatus("PDF parsed successfully!", "success");
      } catch (err: any) {
        console.error("PDF Parsing Error:", err);
        showStatus(err.message || "Failed to parse PDF. Please try pasting text manually.", "error");
      }
    } else {
      showStatus("Please upload a PDF file.", "error");
    }
  };

  return (
    <>
      <div className="background-orbs">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      <header className="glass-header">
        <div className="container header-content">
          <div className="brand">
            <div className="logo-icon"><TrendingUp size={24} /></div>
            <h1>Elevate <span className="gradient-text">ATS</span></h1>
          </div>
          
          <div className="api-key-container" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {userCredits !== null && (
              <div className="credits-badge" style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                {userCredits > 1000 ? 'Unlimited' : `${userCredits} Credits`}
              </div>
            )}
            <UserButton />
          </div>
        </div>
      </header>

      <main className="container layout-grid">
        {/* LEFT PANEL */}
        <section className="panel input-panel glass-panel delay-1">
          <div className="input-group">
            <div className="section-header">
               <FileText size={20} />
               <h2>Your Base Resume</h2>
            </div>
            <p className="subtitle">Paste your master resume content here.</p>
            
            <div 
              id="resumeDropzone" 
              className="dropzone"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <input type="file" onChange={handleFileUpload} accept=".pdf" className="hidden-input" id="resumeFileInput" />
              <div className="dropzone-content">
                <UploadCloud size={32} />
                <p>Drag & Drop your Resume (PDF) or <label htmlFor="resumeFileInput" style={{cursor: "pointer", color: "var(--primary-accent)"}}>Browse File</label></p>
              </div>
              <textarea 
                value={baseResume}
                onChange={(e) => setBaseResume(e.target.value)}
                placeholder="...or paste your text here"
              />
            </div>
          </div>

          <div className="input-group">
            <div className="section-header">
               <Target size={20} />
               <h2>Target Job Description</h2>
            </div>
            <p className="subtitle">Paste the job posting you want to tailor for.</p>
            <textarea 
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the job title, requirements, and responsibilities..."
            />
          </div>
          
          {/* Advanced Tuning */}
          <div className="advanced-tuning glass-panel-inner">
            <div className="section-header" style={{marginBottom: "1rem"}}>
              <Sliders size={20} />
              <h3>Advanced Tuning</h3>
            </div>
            
            <div className="tuning-grid">
              <div className="tuning-control">
                <label>Resume Tone</label>
                <select className="custom-select" value={tone} onChange={(e) => setTone(e.target.value)}>
                  <option value="Professional & Direct">Professional & Direct</option>
                  <option value="Confident & Action-Oriented">Confident & Action-Oriented</option>
                  <option value="Data-Driven & Analytical">Data-Driven & Analytical</option>
                  <option value="Creative & Visionary">Creative & Visionary</option>
                </select>
              </div>
              
              <div className="tuning-control">
                <label>Experience Level</label>
                <select className="custom-select" value={level} onChange={(e) => setLevel(e.target.value)}>
                  <option value="Entry Level / Junior">Entry Level / Junior</option>
                  <option value="Mid-Level Professional">Mid-Level Professional</option>
                  <option value="Senior / Lead Focus">Senior / Lead Focus</option>
                  <option value="Executive / Director">Executive / Director</option>
                </select>
              </div>
            </div>
          </div>

          <button 
            onClick={handleGenerate}
            disabled={isGenerating}
            className={`btn-primary ${isGenerating ? '' : 'animate-pulse-glow'}`} 
            style={{marginTop: "1.5rem"}}
          >
            <span className="btn-text">{isGenerating ? "Analyzing..." : "Elevate Resume"}</span>
            {!isGenerating && <Zap size={18} className="btn-icon" />}
            {isGenerating && <span className="loader"></span>}
          </button>
          
          {statusMsg.text && (
            <div className={`status-msg ${statusMsg.type}`}>{statusMsg.text}</div>
          )}
        </section>

        {/* RIGHT PANEL */}
        <section className="panel output-panel glass-panel delay-2">
          <div className="output-header">
            <div className="tabs-container">
              {[
                { id: "resume", icon: <FileText size={16}/>, label: "Resume" },
                { id: "ats", icon: <Activity size={16}/>, label: "ATS Score" },
                { id: "cover", icon: <Mail size={16}/>, label: "Cover Letter" },
                { id: "prep", icon: <HelpCircle size={16}/>, label: "Interview Prep" }
              ].map(t => (
                <button 
                  key={t.id}
                  onClick={() => setActiveTab(t.id as Tab)}
                  className={`tab-btn ${activeTab === t.id ? "active" : ""}`}
                >
                  {t.icon}<span>{t.label}</span>
                </button>
              ))}
            </div>
            
            <div className="actions">
              <button onClick={handleCopy} disabled={!hasOutput} className="icon-btn tooltip" data-tooltip="Copy Text">
                {copied ? <Check size={20} color="var(--success)" /> : <Copy size={20} />}
              </button>
              <button onClick={handleDownload} disabled={!hasOutput} className="icon-btn tooltip" data-tooltip="Download MD">
                <Download size={20} />
              </button>
              <select 
                value={pdfLayout}
                onChange={(e) => setPdfLayout(e.target.value)}
                disabled={!hasOutput}
                className="custom-select tooltip" 
                data-tooltip="PDF Layout" 
                style={{padding: "0.25rem 2rem 0.25rem 0.5rem", width: "auto", fontSize: "0.8rem", height: "35px", borderRadius: "4px"}}
              >
                <option value="classic">Classic ATS</option>
                <option value="modern">Modern Executive</option>
                <option value="minimalist">Minimalist</option>
              </select>
              <button 
                onClick={handlePdfExport}
                disabled={!hasOutput}
                className="btn-secondary" 
                style={{display: "flex", alignItems: "center", gap: "0.5rem", height: "35px", borderRadius: "4px"}}
              >
                <Printer size={16} /> Export PDF
              </button>
            </div>
          </div>
          
          <div className={`output-content ${!hasOutput ? "empty-state" : ""}`}>
            {!hasOutput && (
              <div className="empty-placeholder">
                <Layers size={48} style={{marginBottom: "1rem", opacity: 0.5}} />
                <h3>Dashboard Empty</h3>
                <p>Fill in your details and hit Elevate to generate your comprehensive job application package.</p>
              </div>
            )}
            
            {hasOutput && (
              <>
                {/* Resume Tab */}
                <div className={`tab-view ${activeTab === "resume" ? "active" : "hidden"}`}>
                   <div className="tab-toolbar" style={{display: "flex", justifyContent: "flex-end", marginBottom: "1rem"}}>
                     <button 
                       onClick={handleEditToggle}
                       className="btn-secondary" 
                       style={{
                         display: "flex", alignItems: "center", gap: "0.5rem",
                         background: isEditing ? "var(--brand-gradient)" : "",
                         color: isEditing ? "#0b0f19" : ""
                       }}
                     >
                       {isEditing ? <Save size={14} /> : <Edit2 size={14} />}
                       <span className="edit-btn-text">{isEditing ? "Save Changes" : "Edit Content"}</span>
                     </button>
                   </div>
                   
                   {!isEditing ? (
                     <div 
                       id="markdownOutput" 
                       className="markdown-body"
                       dangerouslySetInnerHTML={{ __html: marked(tailoredResume) as string }}
                     />
                   ) : (
                     <textarea 
                       value={editorValue}
                       onChange={(e) => setEditorValue(e.target.value)}
                       style={{height: "60vh", width: "100%", background: "inherit", color: "inherit", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "1rem"}}
                     />
                   )}
                </div>

                {/* ATS Tab */}
                <div className={`tab-view ${activeTab === "ats" ? "active" : "hidden"}`}>
                   <div className="ats-dashboard">
                     <div className="score-card glass-panel-inner">
                       <h3>Match Score</h3>
                       <div 
                         className="circular-progress" 
                         style={{background: `conic-gradient(${atsScore >= 80 ? 'var(--success)' : atsScore >= 60 ? 'var(--primary-accent)' : '#f56565'} ${atsScore * 3.6}deg, rgba(255,255,255,0.05) 0deg)`}}
                       >
                         <div className="inner-circle">{atsScore}%</div>
                       </div>
                       <p className="score-label">
                         {atsScore >= 80 ? "🏆 Excellent Match!" : atsScore >= 60 ? "✅ Good Match" : "⚠️ Needs Improvement"}
                       </p>
                     </div>
                     
                     {matchedKeywords.length > 0 && (
                       <div className="keywords-card glass-panel-inner">
                         <h3 style={{color: 'var(--success)'}}>✅ Keywords Added ({matchedKeywords.length})</h3>
                         <p className="subtitle">These high-value keywords from the JD were integrated into your resume.</p>
                         <div className="keyword-tags">
                           {matchedKeywords.map((kw, i) => (
                             <span key={i} className="keyword-tag" style={{background: "rgba(72,187,120,0.12)", color: "#68d391", border: "1px solid rgba(72,187,120,0.25)"}}>{kw}</span>
                           ))}
                         </div>
                       </div>
                     )}

                     <div className="keywords-card glass-panel-inner">
                       <h3 style={{color: missingKeywords.length === 0 ? 'var(--success)' : 'inherit'}}>❌ Missing Keywords</h3>
                       <p className="subtitle">These keywords couldn't be naturally included — prepare to address them in interviews.</p>
                       <div className="keyword-tags">
                          {missingKeywords.length > 0 ? missingKeywords.map((kw, i) => (
                            <span key={i} className="keyword-tag">{kw}</span>
                          )) : (
                            <span className="keyword-tag" style={{background: "rgba(72,187,120,0.1)", color: "var(--success)", border: "1px solid rgba(72, 187, 120, 0.2)"}}>
                              🎉 All major keywords were integrated!
                            </span>
                          )}
                       </div>
                     </div>
                   </div>
                </div>

                {/* Cover Letter Tab */}
                <div className={`tab-view ${activeTab === "cover" ? "active" : "hidden"}`}>
                   <div className="markdown-body" dangerouslySetInnerHTML={{ __html: marked(coverLetter) as string }} />
                </div>

                {/* Prep Tab */}
                <div className={`tab-view ${activeTab === "prep" ? "active" : "hidden"}`}>
                   <div className="markdown-body" dangerouslySetInnerHTML={{ __html: marked(interviewQuestions) as string }} />
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      {/* PAYWALL MODAL */}
      {showPaywall && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.3s ease' }}>
          <div className="glass-panel" style={{ maxWidth: '450px', width: '90%', padding: '2.5rem', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="logo-icon" style={{ margin: '0 auto 1.5rem', width: '60px', height: '60px', fontSize: '1.5rem' }}>
              <Zap size={30} fill="var(--primary-accent)" />
            </div>
            <h2 style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>Elevate Your Career</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>
              You've used your free generation. Upgrade to **Unlimited Access** to continue tailoring resumes, generating cover letters, and getting interview ready.
            </p>
            
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>$9.99</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.6 }}>One-time payment for lifetime unlimited access</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button 
                onClick={handleBuyUnlimited}
                disabled={isCheckingOut}
                className="btn-primary" 
                style={{ width: '100%', height: '50px' }}
              >
                {isCheckingOut ? "Connecting to Stripe..." : "Unlock Unlimited Access"}
              </button>
              <button 
                onClick={() => setShowPaywall(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.9rem', cursor: 'pointer' }}
              >
                Maybe Later
              </button>
            </div>

            <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', opacity: 0.4 }}>
              Secure payment via Stripe. No hidden fees.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
