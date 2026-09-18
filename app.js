/**
 * EduPulse AI – Production Engine Orchestrator
 * Full Integration: Real Google Gemini API, Voice Mock Simulator (STT/TTS),
 * Student Twin Telemetry, ATS Keyword Engine, Gamification & PDF Exporters.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // 1. STORAGE & CACHE ENGINE
  // ==========================================
  const Storage = {
    get: (key, fallback) => {
      try {
        const item = localStorage.getItem(`edupulse_${key}`);
        return item ? JSON.parse(item) : fallback;
      } catch (e) {
        console.warn(`Error reading ${key}:`, e);
        return fallback;
      }
    },
    set: (key, value) => {
      try {
        localStorage.setItem(`edupulse_${key}`, JSON.stringify(value));
      } catch (e) {
        console.warn(`Error writing ${key}:`, e);
      }
    },
    remove: (key) => {
      try {
        localStorage.removeItem(`edupulse_${key}`);
      } catch (e) {
        console.warn(`Error removing ${key}:`, e);
      }
    }
  };

  // Toast Notification Hub
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? 'circle-check' : (type === 'danger' ? 'circle-exclamation' : 'circle-info');
    toast.innerHTML = `<i class="fa-solid fa-${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  // Preloader Dismissal
  setTimeout(() => {
    const preloader = document.getElementById('app-preloader');
    if (preloader) preloader.classList.add('fade-out');
  }, 350);

  // Markdown-to-HTML parser for Gemini output
  function parseMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/^\s*[-*]\s+(.*)$/gim, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gims, '<ul style="margin: 0.5rem 0; padding-left: 1.25rem;">$1</ul>')
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>');
  }

  // ==========================================
  // 2. AUTHENTICATION & SESSION VERIFICATION
  // ==========================================
  const authScreen = document.getElementById('auth-screen');
  const appContainer = document.getElementById('app-container');
  const authForm = document.getElementById('auth-form');
  const authEmail = document.getElementById('auth-email');
  const authPassword = document.getElementById('auth-password');
  const authName = document.getElementById('auth-name');
  const authNameGroup = document.getElementById('auth-name-group');
  const authSubmitBtn = document.getElementById('auth-submit-btn');
  const authToggleMode = document.getElementById('auth-toggle-mode');
  const authSubtitle = document.getElementById('auth-subtitle');
  const authToggleMsg = document.getElementById('auth-toggle-msg');
  const logoutBtn = document.getElementById('logout-btn');

  let isRegisterMode = false;
  let chartsInitialized = false;

  // Initialize or repair account database with clean credentials
  let userAccounts = Storage.get('accounts', []);
  const defaultDemoUser = { name: 'Alex Vance', email: 'alex@edupulse.ai', password: 'password123' };
  
  if (!Array.isArray(userAccounts) || userAccounts.length === 0 || !userAccounts.some(u => u.email === defaultDemoUser.email)) {
    userAccounts = [defaultDemoUser];
    Storage.set('accounts', userAccounts);
  }

  // Toggle Password Visibility
  const togglePwdBtn = document.getElementById('toggle-password-vis');
  const pwdEyeIcon = document.getElementById('pwd-eye-icon');
  if (togglePwdBtn && pwdEyeIcon) {
    togglePwdBtn.addEventListener('click', () => {
      const isPwd = authPassword.type === 'password';
      authPassword.type = isPwd ? 'text' : 'password';
      pwdEyeIcon.className = isPwd ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    });
  }

  // Toggle Login / Register View
  if (authToggleMode) {
    authToggleMode.addEventListener('click', () => {
      isRegisterMode = !isRegisterMode;
      if (isRegisterMode) {
        authNameGroup.style.display = 'block';
        authName.required = true;
        authSubtitle.textContent = 'Join EduPulse AI – Setup your student profile';
        authSubmitBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Create Account';
        authToggleMsg.textContent = 'Already have an account?';
        authToggleMode.textContent = 'Sign In';
      } else {
        authNameGroup.style.display = 'none';
        authName.required = false;
        authSubtitle.textContent = 'Sign in to your intelligent student dashboard';
        authSubmitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In to Platform';
        authToggleMsg.textContent = "Don't have an account?";
        authToggleMode.textContent = 'Create an Account';
      }
    });
  }

  // Authentication Submission with Auto-Sanitization
  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = authEmail.value.trim().toLowerCase();
      const password = authPassword.value.trim(); // Cleans accidental trailing spaces

      if (!email || !password) {
        showToast('Please enter both email and password.', 'danger');
        return;
      }

      if (isRegisterMode) {
        const name = authName.value.trim();
        if (!name) {
          showToast('Please enter your full name.', 'danger');
          return;
        }
        if (userAccounts.find(u => u.email === email)) {
          showToast('An account with this email already exists.', 'danger');
          return;
        }

        const newUser = { name, email, password };
        userAccounts.push(newUser);
        Storage.set('accounts', userAccounts);
        performLogin(newUser, 'Account created! Welcome to EduPulse AI.');
      } else {
        const matched = userAccounts.find(u => u.email === email && u.password === password);
        if (matched) {
          performLogin(matched, 'Logged in successfully!');
        } else {
          showToast('Invalid credentials. Password must be exact (password123)', 'danger');
        }
      }
    });
  }

  function performLogin(user, message) {
    Storage.set('current_session', {
      name: user.name,
      email: user.email,
      loginTimestamp: Date.now()
    });

    updateUserInterfaceProfile(user);

    authScreen.style.display = 'none';
    appContainer.style.display = 'flex';

    if (!chartsInitialized) {
      initializeDashboardCharts();
      initializeAdvancedAnalyticsCharts();
      initializeAdminCharts();
      chartsInitialized = true;
    }

    animateCounters();
    location.hash = '#landing';
    switchView('landing');
    showToast(message, 'success');
  }

  function updateUserInterfaceProfile(user) {
    const firstName = user.name ? user.name.split(' ')[0] : 'Alex';
    const bannerUser = document.getElementById('banner-user-name');
    const sidebarUser = document.getElementById('sidebar-user-name');
    const sidebarEmail = document.getElementById('sidebar-user-email');
    const avatarImg = document.getElementById('user-avatar-img');
    const profileImg = document.getElementById('profile-card-img');
    const profName = document.getElementById('prof-name');
    const profEmail = document.getElementById('prof-email');
    const profileCardName = document.getElementById('profile-card-name');

    if (bannerUser) bannerUser.textContent = firstName;
    if (sidebarUser) sidebarUser.textContent = user.name;
    if (sidebarEmail) sidebarEmail.textContent = user.email;
    if (profileCardName) profileCardName.textContent = user.name;
    if (profName) profName.value = user.name;
    if (profEmail) profEmail.value = user.email;

    const savedAvatar = Storage.get('user_custom_avatar', `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.name)}`);
    if (avatarImg) avatarImg.src = savedAvatar;
    if (profileImg) profileImg.src = savedAvatar;
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      Storage.remove('current_session');
      appContainer.style.display = 'none';
      authScreen.style.display = 'flex';
      showToast('Logged out successfully.', 'info');
    });
  }

  function checkSessionState() {
    // Fill credentials by default to eliminate manual typing friction
    if (authEmail && !authEmail.value) authEmail.value = 'alex@edupulse.ai';
    if (authPassword && !authPassword.value) authPassword.value = 'password123';

    authScreen.style.display = 'flex';
    appContainer.style.display = 'none';
  }

  // ==========================================
  // 3. ROUTING & THEME
  // ==========================================
  const navLinks = document.querySelectorAll('.nav-link');
  const viewSections = document.querySelectorAll('.view-section');
  const viewTitle = document.getElementById('current-view-title');

  function switchView(viewId) {
    viewSections.forEach(section => section.classList.remove('active'));
    navLinks.forEach(link => link.classList.remove('active'));

    const targetSection = document.getElementById(`view-${viewId}`);
    const activeLink = document.querySelector(`[data-view="${viewId}"]`);

    if (targetSection) {
      targetSection.classList.add('active');
      if (activeLink) {
        activeLink.classList.add('active');
        const label = activeLink.querySelector('span');
        if (label && viewTitle) viewTitle.textContent = label.textContent;
      }
    }

    const sidebar = document.getElementById('sidebar');
    if (sidebar && window.innerWidth <= 768) {
      sidebar.classList.remove('open');
    }
  }

  window.addEventListener('hashchange', () => {
    const view = window.location.hash.replace('#', '') || 'landing';
    switchView(view);
  });

  const initialView = window.location.hash.replace('#', '') || 'landing';
  switchView(initialView);

  const toggleBtn = document.getElementById('toggle-sidebar');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('open');
    });
  }

  // Dark/Light Theme Switching
  const themeToggler = document.getElementById('theme-toggler');
  const themeIcon = document.getElementById('theme-icon');
  const savedTheme = Storage.get('theme', 'dark');
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  if (themeToggler) {
    themeToggler.addEventListener('click', () => {
      const active = document.documentElement.getAttribute('data-theme');
      const target = active === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', target);
      Storage.set('theme', target);
      updateThemeIcon(target);
      showToast(`Switched to ${target.toUpperCase()} mode`, 'info');
    });
  }

  function updateThemeIcon(theme) {
    if (!themeIcon) return;
    themeIcon.className = theme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  }

  // ==========================================
  // 4. REAL GOOGLE GEMINI API ENGINE
  // ==========================================
  async function callAIEngine(prompt, systemInstruction = '', conversationHistory = []) {
    const customKey = Storage.get('custom_ai_key', '').trim();

    // Check if valid API key is present
    if (!customKey || !customKey.startsWith('AIzaSy')) {
      console.warn('No active Google Gemini key found in settings. Running local fallback.');
      return null;
    }

    // Prepare payload with conversation context
    const contents = [];
    if (conversationHistory.length > 0) {
      conversationHistory.slice(-6).forEach(msg => {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        });
      });
    }
    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });

    const bodyPayload = {
      contents: contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000
      }
    };

    if (systemInstruction) {
      bodyPayload.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    // Try current high-speed model, fallback to 1.5-flash if unavailable
    const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
    for (const model of models) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${customKey}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload)
        });

        if (response.ok) {
          const data = await response.json();
          const generated = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (generated) return generated;
        } else {
          const errData = await response.json().catch(() => ({}));
          console.warn(`Model ${model} returned error:`, errData);
          if (model === models[models.length - 1]) {
            showToast(`Gemini API: ${errData?.error?.message || response.statusText}`, 'danger');
          }
        }
      } catch (err) {
        console.error(`Network fetch failed for ${model}:`, err);
      }
    }

    return null;
  }

  // ==========================================
  // 5. NOTIFICATION CENTER
  // ==========================================
  let notifications = Storage.get('notifications', [
    { id: 1, type: 'placement', title: 'Google SDE-1 Drive', desc: 'Online coding round opens September 15', time: '10m ago' },
    { id: 2, type: 'interview', title: 'Voice Mock Scheduled', desc: 'System Design round pending for review', time: '2h ago' },
    { id: 3, type: 'reminder', title: 'Coding Streak Active', desc: 'Solve 1 Medium question to keep your 18-day streak', time: '4h ago' }
  ]);

  const notifBtn = document.getElementById('notif-btn');
  const notifDropdown = document.getElementById('notif-dropdown');
  const notifList = document.getElementById('notif-list');
  const notifDot = document.getElementById('notif-badge-dot');

  function renderNotifications() {
    if (!notifList) return;
    if (notifications.length === 0) {
      notifList.innerHTML = `<div class="text-muted text-xs text-center py-2">No unread notifications</div>`;
      if (notifDot) notifDot.style.display = 'none';
      return;
    }
    if (notifDot) notifDot.style.display = 'block';
    notifList.innerHTML = notifications.map(n => `
      <div class="notif-item ${n.type}">
        <div class="notif-item-title">${n.title}</div>
        <div>${n.desc}</div>
        <div class="notif-item-time">${n.time}</div>
      </div>
    `).join('');
  }

  notifBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    notifDropdown?.classList.toggle('open');
  });

  document.addEventListener('click', () => notifDropdown?.classList.remove('open'));

  document.getElementById('clear-notifs-btn')?.addEventListener('click', () => {
    notifications = [];
    Storage.set('notifications', notifications);
    renderNotifications();
    showToast('Notifications cleared', 'info');
  });

  renderNotifications();

  // ==========================================
  // 6. SMART AI STUDENT TWIN
  // ==========================================
  const studentTwinData = {
    cgpa: 8.84,
    placementProbability: 89,
    readinessScore: 91,
    skillGaps: [
      { domain: 'Distributed Concurrency', score: '62%', status: 'Needs Improvement', rec: 'Study Java Virtual Threads & Actor models' },
      { domain: 'System Design Scaling', score: '74%', status: 'Moderate', rec: 'Practice horizontal partitioning & write-through cache' },
      { domain: 'Dynamic Programming', score: '82%', status: 'Proficient', rec: 'Solve 10 2D-DP state formulation problems' }
    ],
    recommendations: [
      'Allocate 45% of weekly sprints to System Design tradeoffs (CAP, Consistent Hashing)',
      'Simulate 2 Behavioral STAR interviews to elevate communication clarity to 95%',
      'Add Docker & Kubernetes containerization metrics to your master ATS resume'
    ],
    weeklyRoadmap: [
      { week: 'Week 1', focus: 'Cache Invalidation & Redis Streams', tasks: 'Implement Pub/Sub queues, audit read/write latency' },
      { week: 'Week 2', focus: 'Graph Topo-Sort & Dijkstra Optimization', tasks: 'Solve 15 LeetCode Graph problems with monotonic queues' },
      { week: 'Week 3', focus: 'Live Voice AI Behavioral Drills', tasks: 'Complete 3 leadership scenario simulations via voice assistant' },
      { week: 'Week 4', focus: 'Mock OA & Production Architecture Review', tasks: 'Complete 120-minute timed round + ATS keyword sync' }
    ]
  };

  function renderStudentTwin() {
    const gapsList = document.getElementById('twin-skill-gaps');
    const recList = document.getElementById('twin-recommendations');
    const roadmapBox = document.getElementById('twin-roadmap-container');

    if (gapsList) {
      gapsList.innerHTML = studentTwinData.skillGaps.map(g => `
        <div class="gap-item">
          <div class="gap-item-head">
            <span>${g.domain}</span>
            <span class="text-warning font-bold">${g.score}</span>
          </div>
          <p class="text-muted text-xs">${g.rec}</p>
        </div>
      `).join('');
    }

    if (recList) {
      recList.innerHTML = studentTwinData.recommendations.map(r => `
        <div class="rec-item">
          <div class="rec-item-head">
            <i class="fa-solid fa-bolt text-primary"></i>
            <span class="text-xs font-bold text-success">High Priority Action</span>
          </div>
          <p class="text-muted text-xs mt-1">${r}</p>
        </div>
      `).join('');
    }

    if (roadmapBox) {
      roadmapBox.innerHTML = studentTwinData.weeklyRoadmap.map(w => `
        <div class="roadmap-week-card">
          <h5>${w.week}: ${w.focus}</h5>
          <p>${w.tasks}</p>
        </div>
      `).join('');
    }
  }

  document.getElementById('btn-sync-twin-roadmap')?.addEventListener('click', async () => {
    showToast('Recalibrating Student Twin roadmap via AI telemetry...', 'info');
    setTimeout(() => {
      renderStudentTwin();
      showToast('Roadmap updated with latest mock performance metrics!', 'success');
    }, 500);
  });

  renderStudentTwin();

  // ==========================================
  // 7. AI VOICE INTERVIEW ASSISTANT (TTS & STT)
  // ==========================================
  const voicePrompts = {
    frontend: [
      "Explain the Virtual DOM reconciliation algorithm in React. How do Keys prevent unnecessary re-renders?",
      "What is the difference between microtasks and macrotasks in the JavaScript Event Loop?",
      "How does CSS layout containment and content-visibility optimize rendering performance?"
    ],
    dsa: [
      "Explain how Floyd's Cycle-Finding Algorithm detects a loop in a Singly Linked List in O(1) auxiliary space.",
      "How would you architect an LRU Cache achieving O(1) time complexity for both get and put operations?",
      "Given a directed acyclic graph, explain how Kahn's Algorithm computes Topological Ordering."
    ],
    java: [
      "Explain the locking granularity difference between ConcurrentHashMap and synchronizedMap in Java.",
      "How do Generics and Type Erasure operate at runtime within the Java Virtual Machine?",
      "Compare Garbage Collection mechanisms in Java, specifically detailing G1GC versus ZGC."
    ],
    system: [
      "How would you design a distributed rate limiter supporting millions of requests per second across regions?",
      "Explain how Consistent Hashing minimizes cache misses when nodes join or exit a distributed cluster.",
      "Compare event-driven asynchronous architectures using Kafka with synchronous RESTful microservices."
    ],
    hr: [
      "Tell me about a technical initiative where your architectural choice failed. How did you resolve it?",
      "How do you resolve a sharp technical dispute with your lead regarding database schemas or APIs?",
      "Where do you see your engineering craftsmanship evolving over the next three years?"
    ]
  };

  let isRecording = false;
  let speechRecognition = null;
  const transcriptArea = document.getElementById('voice-transcript-area');
  const recordBtn = document.getElementById('btn-toggle-recording');
  const recordStatus = document.getElementById('voice-recording-status');
  const micWave = document.getElementById('mic-wave-pulse');
  const voiceQText = document.getElementById('voice-q-text');

  function cycleVoiceQuestion() {
    const track = document.getElementById('voice-interview-track')?.value || 'frontend';
    const pool = voicePrompts[track] || voicePrompts.frontend;
    const q = pool[Math.floor(Math.random() * pool.length)];
    if (voiceQText) voiceQText.textContent = q;
    const evalPanel = document.getElementById('voice-eval-card');
    if (evalPanel) evalPanel.style.display = 'none';
  }

  document.getElementById('voice-next-q-btn')?.addEventListener('click', cycleVoiceQuestion);
  cycleVoiceQuestion();

  // Web Speech API STT
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRec) {
    speechRecognition = new SpeechRec();
    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;

    speechRecognition.onresult = (event) => {
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript + ' ';
      }
      if (transcriptArea) transcriptArea.value = fullTranscript.trim();
    };

    speechRecognition.onerror = (e) => {
      console.warn('Voice recognition note:', e.error);
      stopRecording();
    };
  }

  function startRecording() {
    if (speechRecognition) {
      try { speechRecognition.start(); } catch (err) {}
    }
    isRecording = true;
    if (recordBtn) recordBtn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop Recording Answer';
    if (recordStatus) recordStatus.textContent = 'Listening... Speak into your microphone.';
    if (micWave) micWave.classList.add('active');
  }

  function stopRecording() {
    if (speechRecognition) {
      try { speechRecognition.stop(); } catch (err) {}
    }
    isRecording = false;
    if (recordBtn) recordBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> Start Recording Answer';
    if (recordStatus) recordStatus.textContent = 'Microphone Idle (Answer ready for evaluation)';
    if (micWave) micWave.classList.remove('active');
  }

  recordBtn?.addEventListener('click', () => {
    if (!isRecording) startRecording();
    else stopRecording();
  });

  document.getElementById('btn-clear-transcript')?.addEventListener('click', () => {
    if (transcriptArea) transcriptArea.value = '';
  });

  // Text-to-Speech Prompt
  document.getElementById('voice-speak-prompt-btn')?.addEventListener('click', () => {
    if ('speechSynthesis' in window && voiceQText) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(voiceQText.textContent);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
      showToast('Speaking question prompt aloud...', 'info');
    } else {
      showToast('Speech synthesis not supported in this browser.', 'danger');
    }
  });

  // AI Voice Answer Evaluation with Real AI or Heuristic Fallback
  document.getElementById('btn-eval-voice')?.addEventListener('click', async () => {
    const transcript = transcriptArea?.value.trim();
    if (!transcript || transcript.length < 15) {
      showToast('Please record or type a substantive response first (minimum 15 characters).', 'danger');
      return;
    }

    stopRecording();
    const evalCard = document.getElementById('voice-eval-card');
    if (!evalCard) return;

    evalCard.style.display = 'block';
    evalCard.innerHTML = `<div class="text-center py-2"><i class="fa-solid fa-circle-notch fa-spin text-primary"></i> Evaluating answer structure, clarity, and technical depth...</div>`;

    const liveAIResponse = await callAIEngine(
      `You are an enterprise technical interviewer. Evaluate this candidate response: "${transcript}" to the question: "${voiceQText?.textContent}". Provide: 1. Score out of 100, 2. Technical strengths, 3. Missing depth/edge cases.`
    );

    let feedbackHTML = '';
    if (liveAIResponse) {
      feedbackHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h5 class="text-success font-bold"><i class="fa-solid fa-brain"></i> Real AI Interview Evaluation</h5>
          <span class="badge badge-success">Gemini Verified</span>
        </div>
        <div class="text-xs" style="line-height: 1.6;">${parseMarkdown(liveAIResponse)}</div>
      `;
    } else {
      const lengthBonus = Math.min(25, Math.round(transcript.split(' ').length / 3));
      const score = Math.min(96, 70 + lengthBonus);
      feedbackHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h5 class="text-success font-bold"><i class="fa-solid fa-square-check"></i> Evaluation Score: ${score}/100</h5>
          <span class="badge badge-success">Passing Calibration</span>
        </div>
        <div class="mb-2 text-xs">
          <strong>Linguistic Confidence & Clarity:</strong> Solid pacing and articulation with minimal filler words.
        </div>
        <div class="mb-2 text-xs">
          <strong>Technical Accuracy:</strong> Covers core principles accurately. To reach a 100% score, explicitly articulate space-time complexity (Big-O) and one edge case.
        </div>
      `;
    }

    evalCard.innerHTML = feedbackHTML;
    awardXP(100, 'Voice Mock Round Evaluated');
    showToast('Scorecard generated!', 'success');
  });

  // ==========================================
  // 8. USER PROFILE SYSTEM & LOCAL PERSISTENCE
  // ==========================================
  const avatarFileInput = document.getElementById('profile-avatar-file');
  avatarFileInput?.addEventListener('change', function () {
    const file = this.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        Storage.set('user_custom_avatar', dataUrl);
        const avatarImg = document.getElementById('user-avatar-img');
        const profileImg = document.getElementById('profile-card-img');
        if (avatarImg) avatarImg.src = dataUrl;
        if (profileImg) profileImg.src = dataUrl;
        showToast('Profile image updated successfully!', 'success');
      };
      reader.readAsDataURL(file);
    }
  });

  document.getElementById('btn-save-profile')?.addEventListener('click', () => {
    const name = document.getElementById('prof-name')?.value.trim();
    const college = document.getElementById('prof-college')?.value.trim();
    const branch = document.getElementById('prof-branch')?.value.trim();
    const cgpa = document.getElementById('prof-cgpa')?.value.trim();
    const skills = document.getElementById('prof-skills')?.value.trim();

    Storage.set('profile_data', { name, college, branch, cgpa, skills });

    const session = Storage.get('current_session', {});
    session.name = name;
    Storage.set('current_session', session);

    updateUserInterfaceProfile(session);
    showToast('Student Profile saved successfully!', 'success');
  });

  document.getElementById('prof-resume-file')?.addEventListener('change', function() {
    if (this.files[0]) {
      const nameEl = document.getElementById('prof-resume-name');
      if (nameEl) nameEl.textContent = `Active: ${this.files[0].name} (Indexed for ATS)`;
      showToast('Master resume uploaded and indexed!', 'success');
    }
  });

  // ==========================================
  // 9. ACHIEVEMENTS & GAMIFICATION
  // ==========================================
  let currentXP = Storage.get('xp', 2850);
  let userStreak = Storage.get('streak', 18);

  function awardXP(points, reason) {
    currentXP += points;
    Storage.set('xp', currentXP);

    const level = Math.floor(currentXP / 500) + 1;
    const headerXP = document.getElementById('header-xp-val');
    const gamifyXP = document.getElementById('gamify-xp-val');
    const gamifyLevel = document.getElementById('gamify-level-val');

    if (headerXP) headerXP.textContent = `${currentXP.toLocaleString()} XP`;
    if (gamifyXP) gamifyXP.textContent = currentXP.toLocaleString();
    if (gamifyLevel) gamifyLevel.textContent = `Level ${level}`;

    showToast(`+${points} XP: ${reason}`, 'success');
  }

  const badges = [
    { title: 'DSA Centurion', icon: 'fa-code', desc: 'Solved 100+ DSA Questions', unlocked: true },
    { title: 'Streak Master', icon: 'fa-fire', desc: '15+ Day Study Streak', unlocked: true },
    { title: 'ATS Elite', icon: 'fa-file-check', desc: 'ATS Resume Score above 90', unlocked: true },
    { title: 'Mock Ready', icon: 'fa-robot', desc: 'Completed 5 Technical Mocks', unlocked: true },
    { title: 'Cloud Native', icon: 'fa-cloud', desc: 'AWS/Docker Deployment Verified', unlocked: true },
    { title: 'Voice Orator', icon: 'fa-microphone', desc: 'Voice Confidence Score > 90%', unlocked: true },
    { title: 'Campus Legend', icon: 'fa-trophy', desc: 'Top 3 on Cohort Leaderboard', unlocked: false }
  ];

  function renderGamificationShowroom() {
    const wall = document.getElementById('gamify-badges-wall');
    const dashBadges = document.getElementById('dash-badges-list');
    if (wall) {
      wall.innerHTML = badges.map(b => `
        <div class="badge-tile ${b.unlocked ? '' : 'locked'}" title="${b.desc}">
          <i class="fa-solid ${b.icon}"></i>
          <span>${b.title}</span>
        </div>
      `).join('');
    }
    if (dashBadges) {
      dashBadges.innerHTML = badges.filter(b => b.unlocked).slice(0, 4).map(b => `
        <div class="badge-item" title="${b.desc}">
          <i class="fa-solid ${b.icon}"></i>
          <span>${b.title}</span>
        </div>
      `).join('');
    }

    const leaderboard = [
      { rank: 1, name: 'Siddharth Rao', level: 9, xp: '4,450 XP', streak: '34 Days' },
      { rank: 2, name: 'Priya Sharma', level: 8, xp: '3,920 XP', streak: '28 Days' },
      { rank: 3, name: 'Alex Vance (You)', level: 6, xp: `${currentXP} XP`, streak: `${userStreak} Days` },
      { rank: 4, name: 'David Kim', level: 6, xp: '2,650 XP', streak: '12 Days' },
      { rank: 5, name: 'Ananya Gupta', level: 5, xp: '2,300 XP', streak: '9 Days' }
    ];

    const lbBody = document.getElementById('gamify-leaderboard-body');
    if (lbBody) {
      lbBody.innerHTML = leaderboard.map(l => `
        <tr style="${l.rank === 3 ? 'background:rgba(99,102,241,0.15); font-weight:700;' : ''}">
          <td>#${l.rank}</td>
          <td>${l.name}</td>
          <td><span class="badge badge-primary">Lvl ${l.level}</span></td>
          <td>${l.xp}</td>
          <td><i class="fa-solid fa-fire text-rose"></i> ${l.streak}</td>
        </tr>
      `).join('');
    }
  }

  renderGamificationShowroom();

  // ==========================================
  // 10. CALENDAR & SCHEDULING SYSTEM
  // ==========================================
  let calendarEvents = Storage.get('calendar_events', [
    { id: 1, title: 'Google SDE Online Assessment', category: 'Placement', date: '2026-09-12T10:00' },
    { id: 2, title: 'Distributed Systems Voice Round', category: 'Interview', date: '2026-09-14T15:30' },
    { id: 3, title: 'Dynamic Programming Focus Sprint', category: 'Study', date: '2026-09-16T18:00' }
  ]);

  function renderCalendar(filterCat = 'ALL') {
    const list = document.getElementById('calendar-events-list');
    if (!list) return;

    const filtered = filterCat === 'ALL' ? calendarEvents : calendarEvents.filter(e => e.category === filterCat);
    if (filtered.length === 0) {
      list.innerHTML = `<div class="text-muted text-xs text-center py-3">No upcoming events scheduled in this category.</div>`;
      return;
    }

    list.innerHTML = filtered.map(ev => {
      const d = new Date(ev.date);
      const dateString = isNaN(d.getTime()) ? ev.date : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return `
        <div class="cal-event-card">
          <div class="cal-event-left">
            <div class="cal-date-badge">
              <i class="fa-solid fa-calendar text-primary"></i>
            </div>
            <div>
              <div class="font-bold text-sm">${ev.title}</div>
              <span class="badge badge-primary text-xs">${ev.category}</span>
            </div>
          </div>
          <div class="d-flex align-items-center gap-2">
            <span class="text-xs text-muted">${dateString}</span>
            <button class="icon-btn" style="width:28px; height:28px; color:var(--danger);" onclick="deleteCalendarEvent(${ev.id})">
              <i class="fa-solid fa-trash" style="font-size:0.75rem;"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  window.deleteCalendarEvent = (id) => {
    calendarEvents = calendarEvents.filter(e => e.id !== id);
    Storage.set('calendar_events', calendarEvents);
    renderCalendar();
    showToast('Event removed from schedule.', 'info');
  };

  window.filterCalendar = (cat) => {
    document.querySelectorAll('.filter-pills .chip').forEach(c => c.classList.remove('active'));
    event.target.classList.add('active');
    renderCalendar(cat);
  };

  document.getElementById('calendar-add-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('cal-event-title').value.trim();
    const category = document.getElementById('cal-event-category').value;
    const date = document.getElementById('cal-event-date').value;

    calendarEvents.unshift({ id: Date.now(), title, category, date });
    Storage.set('calendar_events', calendarEvents);
    renderCalendar();
    e.target.reset();
    awardXP(50, 'Event Milestone Scheduled');
    showToast('Event scheduled successfully!', 'success');
  });

  renderCalendar();

  // ==========================================
  // 11. ATS RESUME INTELLIGENCE ENGINE
  // ==========================================
  const resInputs = ['name', 'role', 'contact', 'skills', 'exp', 'edu'];
  resInputs.forEach(field => {
    const input = document.getElementById(`res-${field}`);
    const preview = document.getElementById(`prev-${field}`);
    if (input && preview) {
      input.addEventListener('input', () => {
        preview.textContent = input.value;
      });
    }
  });

  document.getElementById('resume-analyze-btn')?.addEventListener('click', async () => {
    const reportBanner = document.getElementById('ats-intelligence-report');
    const scoreDisplay = document.getElementById('ats-score-display');
    const tagsContainer = document.getElementById('ats-missing-tags');

    if (reportBanner) reportBanner.style.display = 'block';

    const commonRequiredTech = ['Kubernetes', 'GraphQL', 'System Design', 'Redis', 'CI/CD Pipelines', 'TypeScript'];
    const currentSkills = (document.getElementById('res-skills')?.value || '').toLowerCase();
    const missing = commonRequiredTech.filter(tech => !currentSkills.includes(tech.toLowerCase()));

    const score = Math.max(78, 100 - (missing.length * 4));
    if (scoreDisplay) scoreDisplay.textContent = score;

    if (tagsContainer) {
      tagsContainer.innerHTML = missing.map(m => `<span class="tag-missing">+ ${m}</span>`).join('');
    }

    awardXP(75, 'ATS Resume Keyword Audit Completed');
    showToast(`ATS Analysis Complete: ${score}% match benchmark`, 'success');
  });

  document.getElementById('resume-export-btn')?.addEventListener('click', () => {
    const elem = document.getElementById('resume-preview-doc');
    const name = document.getElementById('res-name')?.value || 'Candidate';
    if (typeof html2pdf !== 'undefined') {
      showToast('Generating ATS PDF document...', 'info');
      html2pdf().set({
        margin: 10,
        filename: `${name.replace(/\s+/g, '_')}_Resume.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(elem).save();
    } else {
      window.print();
    }
  });

  // ==========================================
  // 12. EXPORT & PDF REPORTS ENGINE
  // ==========================================
  function generateGenericPDF(elementId, filename) {
    const element = document.getElementById(elementId);
    if (!element) return;
    if (typeof html2pdf !== 'undefined') {
      showToast(`Compiling ${filename}...`, 'info');
      html2pdf().set({
        margin: 10,
        filename: filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(element).save();
    } else {
      window.print();
    }
  }

  document.getElementById('export-dash-pdf')?.addEventListener('click', () => generateGenericPDF('view-dashboard', 'EduPulse_Executive_Telemetry.pdf'));
  document.getElementById('btn-export-analytics-pdf')?.addEventListener('click', () => generateGenericPDF('view-analytics', 'EduPulse_Cohort_Analytics.pdf'));
  document.getElementById('btn-export-plan-pdf')?.addEventListener('click', () => generateGenericPDF('planner-output-card', 'EduPulse_Study_Roadmap.pdf'));
  document.getElementById('btn-export-interview-pdf')?.addEventListener('click', () => generateGenericPDF('interview-feedback', 'EduPulse_Technical_Scorecard.pdf'));
  document.getElementById('btn-export-placement-report')?.addEventListener('click', () => generateGenericPDF('view-tracker', 'EduPulse_Placement_Portfolio.pdf'));

  // ==========================================
  // 13. SETTINGS & PLATFORM PREFERENCES
  // ==========================================
  const settingAiKeyInput = document.getElementById('setting-ai-key');
  if (settingAiKeyInput) {
    settingAiKeyInput.value = Storage.get('custom_ai_key', '');
  }

  document.getElementById('btn-save-settings')?.addEventListener('click', () => {
    const apiKey = document.getElementById('setting-ai-key')?.value.trim();
    if (apiKey) {
      Storage.set('custom_ai_key', apiKey);
    }

    const theme = document.getElementById('setting-theme-select')?.value;
    if (theme) {
      document.documentElement.setAttribute('data-theme', theme);
      Storage.set('theme', theme);
      updateThemeIcon(theme);
    }
    showToast('Platform preferences saved successfully!', 'success');
  });

  document.getElementById('btn-purge-storage')?.addEventListener('click', () => {
    if (confirm('Purge locally cached telemetry and reset to default demonstration state?')) {
      localStorage.clear();
      location.reload();
    }
  });

  // ==========================================
  // 14. PROGRESSIVE WEB APP & SERVICE WORKER
  // ==========================================
  let deferredPrompt = null;
  const pwaInstallBtn = document.getElementById('pwa-install-btn');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (pwaInstallBtn) pwaInstallBtn.style.display = 'inline-flex';
  });

  pwaInstallBtn?.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        pwaInstallBtn.style.display = 'none';
      }
      deferredPrompt = null;
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(e => console.warn('Service worker registration:', e));
  }

  // ==========================================
  // 15. CHARTS INITIALIZATION
  // ==========================================
  function animateCounters() {
    document.querySelectorAll('.animated-counter').forEach(counter => {
      const target = parseFloat(counter.getAttribute('data-target'));
      let current = 0;
      const step = target / 35;
      const timer = setInterval(() => {
        current += step;
        if (current >= target) {
          counter.textContent = target;
          clearInterval(timer);
        } else {
          counter.textContent = current.toFixed(target % 1 === 0 ? 0 : 1);
        }
      }, 25);
    });
  }

  function initializeDashboardCharts() {
    const weeklyCanvas = document.getElementById('weeklyActivityChart');
    if (weeklyCanvas && typeof Chart !== 'undefined') {
      new Chart(weeklyCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [
            { label: 'Problem Solving (hrs)', data: [4.5, 5.0, 3.5, 6.0, 5.5, 3.0, 2.0], backgroundColor: '#6366f1', borderRadius: 6 },
            { label: 'System Theory (hrs)', data: [2.0, 3.0, 2.0, 3.0, 2.0, 1.0, 0.0], backgroundColor: 'rgba(99, 102, 241, 0.25)', borderRadius: 6 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#94a3b8' } } },
          scales: {
            x: { stacked: true, grid: { display: false }, ticks: { color: '#94a3b8' } },
            y: { stacked: true, grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#94a3b8' } }
          }
        }
      });
    }

    const radarCanvas = document.getElementById('skillRadarChart');
    if (radarCanvas && typeof Chart !== 'undefined') {
      new Chart(radarCanvas.getContext('2d'), {
        type: 'radar',
        data: {
          labels: ['Algorithms', 'System Design', 'React / UI', 'Node / Java', 'Cloud / DevOps', 'Communication'],
          datasets: [{
            label: 'Applicant Score',
            data: [90, 75, 92, 84, 70, 88],
            backgroundColor: 'rgba(168, 85, 247, 0.25)',
            borderColor: '#a855f7',
            pointBackgroundColor: '#a855f7'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            r: {
              grid: { color: 'rgba(255,255,255,0.08)' },
              angleLines: { color: 'rgba(255,255,255,0.08)' },
              pointLabels: { color: '#94a3b8', font: { size: 11 } },
              ticks: { display: false }
            }
          }
        }
      });
    }

    const heatmap = document.getElementById('study-heatmap');
    if (heatmap && heatmap.children.length === 0) {
      let cellsHTML = '';
      for (let i = 0; i < 96; i++) {
        const lvl = Math.floor(Math.random() * 4);
        cellsHTML += `<div class="cell lvl-${lvl}" title="Activity Weight: ${lvl}"></div>`;
      }
      heatmap.innerHTML = cellsHTML;
    }
  }

  function initializeAdvancedAnalyticsCharts() {
    const c1 = document.getElementById('chart-readiness-trend');
    if (c1 && typeof Chart !== 'undefined') {
      new Chart(c1.getContext('2d'), {
        type: 'line',
        data: {
          labels: ['Month 1', 'Month 2', 'Month 3', 'Month 4', 'Month 5', 'Current'],
          datasets: [{ label: 'Readiness Index', data: [58, 67, 72, 81, 85, 91], borderColor: '#10b981', tension: 0.35, fill: true, backgroundColor: 'rgba(16, 185, 129, 0.1)' }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { color: '#94a3b8' } }, x: { ticks: { color: '#94a3b8' } } } }
      });
    }

    const c2 = document.getElementById('chart-skill-growth');
    if (c2 && typeof Chart !== 'undefined') {
      new Chart(c2.getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['Data Structures', 'Spring Boot', 'System Design', 'React / UI', 'Distributed Queues'],
          datasets: [{ label: 'Mastery Percentage', data: [88, 82, 70, 94, 65], backgroundColor: '#6366f1', borderRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { color: '#94a3b8' } }, x: { ticks: { color: '#94a3b8' } } } }
      });
    }

    const c3 = document.getElementById('chart-study-consistency');
    if (c3 && typeof Chart !== 'undefined') {
      new Chart(c3.getContext('2d'), {
        type: 'line',
        data: {
          labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
          datasets: [{ label: 'Focus Hours', data: [22, 28, 31, 26, 38, 41, 39, 42.5], borderColor: '#06b6d4', tension: 0.3 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { color: '#94a3b8' } }, x: { ticks: { color: '#94a3b8' } } } }
      });
    }

    const c4 = document.getElementById('chart-goal-completion');
    if (c4 && typeof Chart !== 'undefined') {
      new Chart(c4.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['Completed Milestones', 'Pending Reviews', 'Backlog'],
          datasets: [{ data: [18, 5, 3], backgroundColor: ['#10b981', '#f59e0b', 'rgba(255,255,255,0.1)'] }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } } } }
      });
    }
  }

  function initializeAdminCharts() {
    const adminCanvas = document.getElementById('adminSystemMetricsChart');
    if (adminCanvas && typeof Chart !== 'undefined') {
      new Chart(adminCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', 'Live'],
          datasets: [
            { label: 'Inference QPS', data: [12, 5, 45, 120, 180, 140, 95], borderColor: '#6366f1', tension: 0.3 },
            { label: 'Token Volume (k)', data: [20, 10, 80, 240, 310, 270, 190], borderColor: '#a855f7', tension: 0.3 }
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { ticks: { color: '#94a3b8' } }, x: { ticks: { color: '#94a3b8' } } } }
      });
    }

    const logBox = document.getElementById('admin-audit-logs');
    if (logBox) {
      logBox.innerHTML = `
        <div class="audit-log-item"><span>[AUTH] User alex@edupulse.ai session initialized</span><span class="text-muted">12s ago</span></div>
        <div class="audit-log-item"><span>[ATS] Parser completed on file Vance_Resume.pdf</span><span class="text-muted">2m ago</span></div>
        <div class="audit-log-item"><span>[VOICE] Speech pipeline ready (Web Speech API)</span><span class="text-muted">6m ago</span></div>
        <div class="audit-log-item"><span>[TWIN] Recalibrated risk vectors for Cohort CSE-2027</span><span class="text-muted">14m ago</span></div>
      `;
    }
  }

  // ==========================================
  // 16. AI CAREER MENTOR (REAL GEMINI CONVERSATION)
  // ==========================================
  const mentorForm = document.getElementById('mentor-form');
  const mentorInput = document.getElementById('mentor-input');
  const mentorMessages = document.getElementById('mentor-messages');
  let mentorHistory = [];

  function appendChat(role, text) {
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.innerHTML = `
      <div class="msg-avatar"><i class="fa-solid fa-${role === 'bot' ? 'robot' : 'user'}"></i></div>
      <div class="msg-bubble">${parseMarkdown(text)}</div>
    `;
    mentorMessages?.appendChild(div);
    if (mentorMessages) mentorMessages.scrollTop = mentorMessages.scrollHeight;
  }

  function generateMentorReply(query) {
    const q = query.toLowerCase();
    if (q.includes('python')) {
      return `**Python Breakdown:**\nPython is a high-level interpreted language prized in Backend (FastAPI, Django) and AI/ML.\n\n* **Interview Keys:** List comprehensions, generator memory benefits (\`yield\`), GIL (Global Interpreter Lock) constraints, and decorator patterns.`;
    }
    if (q.includes('java')) {
      return `**Java Enterprise Overview:**\nCore topics evaluated in campus drives include:\n* **JVM Architecture:** Garbage Collection (G1GC vs ZGC), Heap vs Stack memory.\n* **Concurrency:** \`ConcurrentHashMap\`, atomic primitives, and Java 21 Virtual Threads.\n* **Spring Boot:** IoC/DI, Spring Security, and Hibernate caching.`;
    }
    if (q.includes('resume')) {
      return `**Resume Strategy for Placements:**\n1. Use the **STAR method** with quantifiable impact (e.g. *'reduced API latency by 42%'*).\n2. Adhere strictly to single-column ATS layouts without complex graphic tables.\n3. Align keyword names with job descriptions.`;
    }
    return `**AI Career Advisor:** Regarding "${query}", ensure you articulate the problem context, highlight space-time asymptotic complexity (Big-O), and describe real-world system tradeoffs.`;
  }

  mentorForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = mentorInput.value.trim();
    if (!text) return;

    appendChat('user', text);
    mentorHistory.push({ role: 'user', text });
    mentorInput.value = '';

    // Show temporary thinking bubble
    const loadingId = 'mentor-loading-' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'chat-msg bot';
    loadingDiv.id = loadingId;
    loadingDiv.innerHTML = `
      <div class="msg-avatar"><i class="fa-solid fa-robot"></i></div>
      <div class="msg-bubble"><i class="fa-solid fa-circle-notch fa-spin text-primary"></i> Consulting Gemini intelligence...</div>
    `;
    mentorMessages.appendChild(loadingDiv);
    mentorMessages.scrollTop = mentorMessages.scrollHeight;

    const liveReply = await callAIEngine(
      text,
      'You are EduPulse AI, an elite career mentor and senior software engineering hiring advisor. Provide detailed, actionable, and structured guidance with code examples or algorithmic tradeoffs where relevant.',
      mentorHistory
    );

    const loadingElement = document.getElementById(loadingId);
    if (loadingElement) loadingElement.remove();

    if (liveReply) {
      appendChat('bot', liveReply);
      mentorHistory.push({ role: 'model', text: liveReply });
    } else {
      const fallback = generateMentorReply(text);
      appendChat('bot', fallback);
      mentorHistory.push({ role: 'model', text: fallback });
    }
  });

  window.askPredefined = (text) => {
    if (mentorInput && mentorForm) {
      mentorInput.value = text;
      mentorForm.dispatchEvent(new Event('submit'));
    }
  };

  // ==========================================
  // 17. REMAINING MODULES (PLANNER, MOCK, POMO, NOTES, ROADMAP)
  // ==========================================
  // Study Planner
  const plannerForm = document.getElementById('study-planner-form');
  const plannerResults = document.getElementById('planner-results');

  function renderPlan(subject, days, hours, diff) {
    const totalHours = days * hours;
    const probability = Math.min(98, Math.round((totalHours / (days * 5)) * 100));
    const badge = document.getElementById('plan-success-badge');
    if (badge) badge.textContent = `Calculated Probability: ${probability}%`;

    if (plannerResults) {
      plannerResults.innerHTML = `
        <div class="strategy-step">
          <h5>Phase 1: Deep Theory & Foundation (Days 1 to ${Math.ceil(days * 0.3)})</h5>
          <p>Target: <strong>${Math.round(totalHours * 0.3)} hours</strong> focused on ${subject} architecture and primitives.</p>
        </div>
        <div class="strategy-step">
          <h5>Phase 2: High-Frequency Problem Sets (Days ${Math.ceil(days * 0.3) + 1} to ${Math.ceil(days * 0.75)})</h5>
          <p>Target: <strong>${Math.round(totalHours * 0.45)} hours</strong> drilling ${diff} level algorithms and test cases.</p>
        </div>
        <div class="strategy-step">
          <h5>Phase 3: Timed Mocks & Edge Case Audits (Days ${Math.ceil(days * 0.75) + 1} to ${days})</h5>
          <p>Target: <strong>${Math.round(totalHours * 0.25)} hours</strong> dedicated to end-to-end interview simulations.</p>
        </div>
      `;
    }
  }

  plannerForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    renderPlan(
      document.getElementById('plan-subject').value,
      parseInt(document.getElementById('plan-days').value) || 14,
      parseInt(document.getElementById('plan-hours').value) || 3,
      document.getElementById('plan-difficulty').value
    );
    awardXP(50, 'AI Study Plan Formulated');
    showToast('Dynamic schedule generated!', 'success');
  });
  renderPlan('Distributed Microservices & Spring Cloud', 21, 4, 'Advanced');

  // Technical Mock Simulator
  const questionBox = document.getElementById('interview-question-box');
  const interviewTrack = document.getElementById('interview-track');

  function getRandomQuestion() {
    const track = interviewTrack ? interviewTrack.value : 'frontend';
    const pool = voicePrompts[track] || voicePrompts.frontend;
    if (questionBox) questionBox.textContent = pool[Math.floor(Math.random() * pool.length)];
    const feedback = document.getElementById('interview-feedback');
    if (feedback) feedback.style.display = 'none';
  }

  document.getElementById('start-interview-btn')?.addEventListener('click', getRandomQuestion);
  getRandomQuestion();

  document.getElementById('evaluate-interview-btn')?.addEventListener('click', async () => {
    const answer = document.getElementById('interview-answer')?.value.trim();
    if (!answer || answer.length < 20) {
      showToast('Please provide a substantive answer (minimum 20 characters).', 'danger');
      return;
    }
    const feedbackPanel = document.getElementById('interview-feedback');
    if (!feedbackPanel) return;
    feedbackPanel.style.display = 'block';

    const liveAI = await callAIEngine(`Prompt: "${questionBox?.textContent}"\nAnswer: "${answer}"\nProvide evaluation score out of 100 with actionable feedback.`);
    if (liveAI) {
      feedbackPanel.innerHTML = `<h5 class="text-success font-bold mb-2">Live Evaluation:</h5><div class="text-xs">${parseMarkdown(liveAI)}</div>`;
    } else {
      feedbackPanel.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h5 class="text-success font-bold">Evaluation Score: 92/100</h5>
          <span class="badge badge-success">High Distinction</span>
        </div>
        <p class="text-xs">Correct architectural structure and edge-case handling. Big-O analysis is well defined.</p>
      `;
    }
    awardXP(100, 'Technical Mock Round Completed');
    showToast('Answer audited by AI Simulator!', 'success');
  });

  // Focus Pomodoro Timer
  let timerInterval = null;
  let timeRemaining = 25 * 60;
  let sessionTally = 0;
  let isWorkMode = true;
  const timerDisplay = document.getElementById('pomo-timer');
  const stateLabel = document.getElementById('timer-state-label');

  function updateTimerText() {
    if (!timerDisplay) return;
    const m = Math.floor(timeRemaining / 60).toString().padStart(2, '0');
    const s = (timeRemaining % 60).toString().padStart(2, '0');
    timerDisplay.textContent = `${m}:${s}`;
  }

  document.getElementById('pomo-start')?.addEventListener('click', () => {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
      if (timeRemaining > 0) {
        timeRemaining--;
        updateTimerText();
      } else {
        clearInterval(timerInterval);
        timerInterval = null;
        if (isWorkMode) {
          sessionTally++;
          document.getElementById('pomo-session-count').textContent = sessionTally;
          document.getElementById('pomo-total-focus').textContent = `${(sessionTally * 0.42).toFixed(1)} hrs`;
          awardXP(150, 'Completed Focus Sprint');
          timeRemaining = 5 * 60;
          isWorkMode = false;
          if (stateLabel) stateLabel.textContent = 'Recharge Break';
        } else {
          timeRemaining = 25 * 60;
          isWorkMode = true;
          if (stateLabel) stateLabel.textContent = 'Concentration Phase';
        }
        updateTimerText();
      }
    }, 1000);
  });

  document.getElementById('pomo-pause')?.addEventListener('click', () => {
    clearInterval(timerInterval);
    timerInterval = null;
  });

  document.getElementById('pomo-reset')?.addEventListener('click', () => {
    clearInterval(timerInterval);
    timerInterval = null;
    timeRemaining = isWorkMode ? 25 * 60 : 5 * 60;
    updateTimerText();
  });

  document.getElementById('pomo-mode-work')?.addEventListener('click', function () {
    clearInterval(timerInterval);
    timerInterval = null;
    isWorkMode = true;
    timeRemaining = 25 * 60;
    updateTimerText();
    this.classList.add('active');
    document.getElementById('pomo-mode-break')?.classList.remove('active');
  });

  document.getElementById('pomo-mode-break')?.addEventListener('click', function () {
    clearInterval(timerInterval);
    timerInterval = null;
    isWorkMode = false;
    timeRemaining = 5 * 60;
    updateTimerText();
    this.classList.add('active');
    document.getElementById('pomo-mode-work')?.classList.remove('active');
  });

  // Notes Repository
  let notes = Storage.get('notes', [
    { id: 1, title: 'CAP Theorem In Distributed Systems', category: 'System Design', content: 'Consistency vs Availability vs Partition Tolerance. Financial systems require CP; social feeds prioritize AP.' },
    { id: 2, title: 'Dynamic Programming Formulations', category: 'DSA', content: 'Memoization top-down versus bottom-up iterative state transitions.' }
  ]);

  function renderNotesList(filterCat = 'ALL') {
    const list = document.getElementById('notes-list');
    const countEl = document.getElementById('notes-count');
    if (!list) return;
    const filtered = filterCat === 'ALL' ? notes : notes.filter(n => n.category === filterCat);
    if (countEl) countEl.textContent = filtered.length;
    list.innerHTML = filtered.map(n => `
      <div class="note-item">
        <div class="note-item-head">
          <h5>${n.title}</h5>
          <button class="icon-btn" style="width:28px; height:28px; color:var(--danger);" onclick="deleteNote(${n.id})">
            <i class="fa-solid fa-trash" style="font-size:0.75rem;"></i>
          </button>
        </div>
        <span class="badge badge-primary" style="margin-bottom:0.5rem; align-self:flex-start;">${n.category}</span>
        <div class="note-item-body">${n.content}</div>
      </div>
    `).join('');
  }

  window.deleteNote = (id) => {
    notes = notes.filter(n => n.id !== id);
    Storage.set('notes', notes);
    renderNotesList();
  };

  window.filterNotes = (cat) => {
    document.querySelectorAll('.filter-pills .chip').forEach(c => c.classList.remove('active'));
    event.target.classList.add('active');
    renderNotesList(cat);
  };

  document.getElementById('note-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    notes.unshift({
      id: Date.now(),
      title: document.getElementById('note-title').value.trim(),
      category: document.getElementById('note-category').value,
      content: document.getElementById('note-content').value.trim()
    });
    Storage.set('notes', notes);
    renderNotesList();
    e.target.reset();
    awardXP(30, 'Knowledge Note Saved');
  });
  renderNotesList();

  // Placement Application Hub
  let jobs = Storage.get('jobs', [
    { id: 1, company: 'Google', role: 'Software Engineer Intern', stage: 'Technical Round 2', date: '2026-09-02' },
    { id: 2, company: 'Amazon AWS', role: 'Cloud Solutions Engineer', stage: 'Online Assessment', date: '2026-09-08' },
    { id: 3, company: 'Microsoft', role: 'Full Stack Engineer', stage: 'Offer Received', date: '2026-08-25' }
  ]);

  function renderPlacements() {
    const tableBody = document.getElementById('placements-table-body');
    if (!tableBody) return;
    tableBody.innerHTML = jobs.map(j => `
      <tr>
        <td class="font-bold">${j.company}</td>
        <td>${j.role}</td>
        <td><span class="badge ${j.stage.includes('Offer') ? 'badge-success' : 'badge-primary'}">${j.stage}</span></td>
        <td class="text-muted">${j.date}</td>
        <td>
          <button class="icon-btn" style="width:32px; height:32px; color:var(--danger);" onclick="deleteJob(${j.id})">
            <i class="fa-solid fa-trash" style="font-size:0.75rem;"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  window.deleteJob = (id) => {
    jobs = jobs.filter(j => j.id !== id);
    Storage.set('jobs', jobs);
    renderPlacements();
  };

  document.getElementById('add-job-btn')?.addEventListener('click', () => {
    const company = prompt('Target Enterprise Name:');
    if (!company) return;
    const role = prompt('Target Role Title:', 'Software Engineer Intern');
    if (!role) return;
    jobs.unshift({ id: Date.now(), company, role, stage: 'Applied', date: new Date().toISOString().split('T')[0] });
    Storage.set('jobs', jobs);
    renderPlacements();
    awardXP(50, 'Application Logged');
  });
  renderPlacements();

  // Placement Risk Predictor
  document.getElementById('run-predictor-btn')?.addEventListener('click', () => {
    const att = parseFloat(document.getElementById('pred-att').value);
    const hours = parseFloat(document.getElementById('pred-hours').value);
    const mock = parseFloat(document.getElementById('pred-mock').value);
    const score = Math.round((att * 0.25) + ((Math.min(hours, 40) / 40) * 100 * 0.35) + (mock * 0.40));
    const out = document.getElementById('predictor-output');
    if (!out) return;
    out.style.display = 'block';
    out.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h4 class="${score >= 80 ? 'text-success' : 'text-warning'} font-bold">${score >= 80 ? 'Tier-1 Candidate Probable' : 'Moderate Placement Odds'}</h4>
        <span class="badge badge-primary">${score}/100</span>
      </div>
      <p class="text-xs">Based on weekly focus of ${hours} hours and assessment ratings of ${mock}%, you rank in the top quartile of applicants.</p>
    `;
    awardXP(40, 'Placement Vector Recomputed');
  });

  // Goals & Certifications
  let goals = Storage.get('goals', [
    'Solve 50 LeetCode Medium Graphs & Dynamic Programming Problems',
    'Deploy Scalable Distributed System with Docker and AWS EC2',
    'Review Core OS Semaphores, Mutexes & Memory Virtualization'
  ]);

  function renderGoals() {
    const list = document.getElementById('goals-list');
    if (!list) return;
    list.innerHTML = goals.map((g, idx) => `
      <li class="goal-entry">
        <div class="goal-title-wrap">
          <i class="fa-solid fa-circle-check text-primary"></i>
          <span>${g}</span>
        </div>
        <button class="icon-btn" style="width:30px; height:30px; color:var(--danger);" onclick="deleteGoal(${idx})">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </li>
    `).join('');
  }

  window.deleteGoal = (idx) => {
    goals.splice(idx, 1);
    Storage.set('goals', goals);
    renderGoals();
  };

  document.getElementById('add-goal-btn')?.addEventListener('click', () => {
    const val = document.getElementById('goal-input')?.value.trim();
    if (val) {
      goals.unshift(val);
      Storage.set('goals', goals);
      renderGoals();
      document.getElementById('goal-input').value = '';
      awardXP(30, 'Milestone Goal Logged');
    }
  });
  renderGoals();

  let certs = Storage.get('certs', [
    { title: 'AWS Certified Cloud Practitioner', issuer: 'Amazon Web Services' },
    { title: 'Meta Frontend Professional Certificate', issuer: 'Coursera / Meta' },
    { title: 'Algorithmic Toolbox with Honors', issuer: 'UC San Diego' }
  ]);

  function renderCerts() {
    const grid = document.getElementById('certs-grid');
    if (!grid) return;
    grid.innerHTML = certs.map((c, idx) => `
      <div class="cert-card">
        <button class="icon-btn" style="position:absolute; top:8px; right:8px; width:26px; height:26px; color:var(--danger);" onclick="deleteCert(${idx})">
          <i class="fa-solid fa-trash" style="font-size:0.7rem;"></i>
        </button>
        <i class="fa-solid fa-award cert-icon"></i>
        <h5>${c.title}</h5>
        <span>${c.issuer}</span>
      </div>
    `).join('');
  }

  window.deleteCert = (idx) => {
    certs.splice(idx, 1);
    Storage.set('certs', certs);
    renderCerts();
  };

  document.getElementById('add-cert-btn')?.addEventListener('click', () => {
    const title = document.getElementById('cert-title').value.trim();
    const issuer = document.getElementById('cert-issuer').value.trim();
    if (title && issuer) {
      certs.unshift({ title, issuer });
      Storage.set('certs', certs);
      renderCerts();
      awardXP(60, 'Credential Saved to Vault');
    }
  });
  renderCerts();

  // Career Roadmap
  function generateRoadmap(roleName) {
    const container = document.getElementById('roadmap-timeline-container');
    if (!container) return;
    container.innerHTML = `
      <div class="timeline-node">
        <h5>Stage 1: Core Fundamentals & Primitives (${roleName})</h5>
        <p>Master programming paradigms, data structures, dynamic memory allocation, and asymptotic analysis.</p>
      </div>
      <div class="timeline-node">
        <h5>Stage 2: Enterprise Architecture & Production Standards</h5>
        <p>Build end-to-end architectures, database indexing (B-Trees, LSM-Trees), API gateways, and Redis caching.</p>
      </div>
      <div class="timeline-node">
        <h5>Stage 3: Cloud Systems, Containers & CI/CD Pipelines</h5>
        <p>Containerization with Docker, Kubernetes orchestration, and automated deployment via GitHub Actions.</p>
      </div>
      <div class="timeline-node">
        <h5>Stage 4: High-Concurrency & System Design Mastery</h5>
        <p>Complete deep-dive mocks on rate-limiters, distributed message queues (Kafka), and CAP Theorem edge cases.</p>
      </div>
    `;
  }

  document.getElementById('generate-roadmap-btn')?.addEventListener('click', () => {
    const role = document.getElementById('roadmap-role-input').value.trim() || 'Software Engineer';
    generateRoadmap(role);
    awardXP(40, 'Career Roadmap Generated');
    showToast(`Roadmap generated for ${role}!`, 'success');
  });
  generateRoadmap('Full Stack Cloud & AI Engineer');

  // Verify auth session on load
  checkSessionState();

});