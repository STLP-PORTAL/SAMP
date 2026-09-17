/* ============================================================
   SAFETY ASSET MANAGEMENT PORTAL (SAMP)
   Talwandi Sabo Thermal Plant
   safety_app.js
   ============================================================ */

/* ============================================================
   SUPABASE CONFIGURATION & SAFE INITIALIZATION
   ============================================================ */

const SUPABASE_URL = "https://lhvpwisblaitiwueghjj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_RTcbc241tBzLzPT7LS423g_0FtqdRaD";

let supabaseClient = null;

function initSupabase() {
  if (supabaseClient) return supabaseClient;

  const clientLib = window.supabase || (typeof supabase !== 'undefined' ? supabase : null);

  if (clientLib && typeof clientLib.createClient === 'function') {
    supabaseClient = clientLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  return supabaseClient;
}

// Attempt immediate initialization
initSupabase();


/* ============================================================
   REGISTER DATALABELS PLUGIN IF AVAILABLE
   ============================================================ */

if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
  Chart.register(ChartDataLabels);
}


/* ============================================================
   USER STATE & DELETE PENDING STATE
   ============================================================ */

let userState = {
  isLoggedIn: false,
  isAdmin: false
};

let selectedHoistIds = new Set();
let currentSortColumn = null;
let currentSortOrder = 'asc';


/* ============================================================
   EXCEL MASTER DATA COLUMNS SEQUENCE (23 FIELDS)
   ============================================================ */

const HOIST_MASTER_FIELDS = [
  "Sr. No.",
  "Plant Section",
  "Location",
  "Equipment Name",
  "Equipment Location",
  "Hoist Type",
  "Nomenclature",
  "Make",
  "MFG",
  "Details",
  "Certificate",
  "Test date",
  "Due Date",
  "Capacity",
  "Healthiness Status",
  "Power Supply Status",
  "Running Status",
  "Feeder",
  "Pendant",
  "Remarks",
  "Expiry Reminder",
  "Expired",
  "TPI"
];


/* ============================================================
   DATABASE IN-MEMORY CACHE
   ============================================================ */

let dbData = {

  hoists: [],

  vessels: [],

  vehicles: [
    {
      vehicle_number: 'PB-11-AB-1234',
      vehicle_type: 'Hydra Crane',
      department: 'CHP',
      contractor: 'L&T Infra',
      driver: 'Ramesh Kumar',
      fitness_validity: '30-12-2026',
      status: 'Fit'
    }
  ],

  tools: [
    {
      equipment_id: 'TT-SLING-01',
      equipment_name: 'Wire Rope Sling',
      capacity: '10 Ton',
      location: 'Boiler 2',
      department: 'Mechanical',
      inspection_status: 'Fit',
      next_due_date: '20-10-2026'
    }
  ]

};


/* ============================================================
   SUPABASE DATA MAPPING HELPERS
   ============================================================ */

function mapRowFromSupabase(item) {
  return {
    id: String(item.id || ''),
    "Sr. No.": String(item.sr_no || item["Sr. No."] || ''),
    "Plant Section": item.plant_section || item["Plant Section"] || '',
    "Location": item.location || item["Location"] || '',
    "Equipment Name": item.equipment_name || item["Equipment Name"] || '',
    "Equipment Location": item.equipment_location || item["Equipment Location"] || '',
    "Hoist Type": item.hoist_type || item["Hoist Type"] || '',
    "Nomenclature": item.nomenclature || item["Nomenclature"] || '',
    "Make": item.make || item["Make"] || '',
    "MFG": item.mfg || item["MFG"] || '',
    "Details": item.details || item["Details"] || '',
    "Certificate": item.certificate || item["Certificate"] || '',
    "Test date": item.test_date || item["Test date"] || '',
    "Due Date": item.due_date || item["Due Date"] || '',
    "Capacity": item.capacity || item["Capacity"] || '',
    "Healthiness Status": item.healthiness_status || item["Healthiness Status"] || 'OK',
    "Power Supply Status": item.power_supply_status || item["Power Supply Status"] || '',
    "Running Status": item.running_status || item["Running Status"] || 'Running',
    "Feeder": item.feeder || item["Feeder"] || '',
    "Pendant": item.pendant || item["Pendant"] || '',
    "Remarks": item.remarks || item["Remarks"] || '',
    "Expiry Reminder": item.expiry_reminder || item["Expiry Reminder"] || '',
    "Expired": item.expired || item["Expired"] || '',
    "TPI": item.tpi || item["TPI"] || ''
  };
}

function mapRowToSupabase(hoist) {
  const nomClean = String(hoist["Nomenclature"] || '').trim().toUpperCase();
  return {
    sr_no: String(hoist["Sr. No."] || ''),
    plant_section: String(hoist["Plant Section"] || ''),
    location: String(hoist["Location"] || ''),
    equipment_name: String(hoist["Equipment Name"] || ''),
    equipment_location: String(hoist["Equipment Location"] || ''),
    hoist_type: String(hoist["Hoist Type"] || ''),
    nomenclature: nomClean,
    make: String(hoist["Make"] || ''),
    mfg: String(hoist["MFG"] || ''),
    details: String(hoist["Details"] || ''),
    certificate: String(hoist["Certificate"] || ''),
    test_date: String(hoist["Test date"] || ''),
    due_date: String(hoist["Due Date"] || ''),
    capacity: String(hoist["Capacity"] || ''),
    healthiness_status: String(hoist["Healthiness Status"] || 'OK'),
    power_supply_status: String(hoist["Power Supply Status"] || ''),
    running_status: String(hoist["Running Status"] || 'Running'),
    feeder: String(hoist["Feeder"] || ''),
    pendant: String(hoist["Pendant"] || ''),
    remarks: String(hoist["Remarks"] || ''),
    expiry_reminder: String(hoist["Expiry Reminder"] || ''),
    expired: String(hoist["Expired"] || ''),
    tpi: String(hoist["TPI"] || '')
  };
}


/* ============================================================
   FETCH HOISTS FROM SUPABASE
   ============================================================ */

async function fetchHoistsFromSupabase() {

  const client = initSupabase();

  if (!client) {
    console.warn("Supabase client is not available.");
    return;
  }

  try {

    const { data, error } = await client
      .from('hoist_records')
      .select('*');

    if (error) {
      console.error("Supabase fetch error:", error);
      return;
    }

    if (data) {
      dbData.hoists = data.map(mapRowFromSupabase);

      populateFilterDropdowns();

      const hoistScreen = document.getElementById('hoist-module-screen');
      if (hoistScreen && !hoistScreen.classList.contains('hidden-screen')) {
        renderHoistModule();
      }
    }

  } catch (err) {
    console.error("Failed to fetch from Supabase:", err);
  }

}


/* ============================================================
   CHARTS & FILTER STATE
   ============================================================ */

let chartInstances = {};

let currentFilters = {
  globalSearch: '',
  section: '',
  tpiStatus: '',
  type: '',
  healthiness: '',
  running: '',
  agency: ''
};


/* ============================================================
   THEME MANAGEMENT ENGINE
   ============================================================ */

function setPortalTheme(themeName, save = true) {

  if (!['dark', 'light', 'blue'].includes(themeName)) {
    themeName = 'dark';
  }

  document.body.setAttribute('data-theme', themeName);

  if (save) {
    try {
      localStorage.setItem('stlp_theme', themeName);
    } catch (e) {
      // LocalStorage fallback
    }
  }

  const dropdown = document.getElementById('theme-dropdown');
  if (dropdown) {
    dropdown.classList.add('hidden-screen');
  }

  const hoistScreen = document.getElementById('hoist-module-screen');
  if (hoistScreen && !hoistScreen.classList.contains('hidden-screen')) {
    const filteredHoists = getFilteredHoists();
    renderHoistCharts(filteredHoists);
  }

  const vesselScreen = document.getElementById('vessel-module-screen');
  if (vesselScreen && !vesselScreen.classList.contains('hidden-screen')) {
    renderVesselCharts(getFilteredVessels());
  }

}

function toggleThemeMenu() {
  const dropdown = document.getElementById('theme-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('hidden-screen');
  }
}

function initPortalTheme() {
  let savedTheme = 'dark';
  try {
    savedTheme = localStorage.getItem('stlp_theme') || 'dark';
  } catch (e) {
    savedTheme = 'dark';
  }
  setPortalTheme(savedTheme, false);
}


/* ============================================================
   LOGIN SCREEN LAYOUT ENGINE (Aurora Glass / Neumorphic Soft)
   Independent of the dark/light/blue color theme above — this
   only re-skins the login/auth screen.
   ============================================================ */

function setLoginLayout(layoutName, save = true) {

  if (!['aurora', 'neumorph'].includes(layoutName)) {
    layoutName = 'aurora';
  }

  document.body.setAttribute('data-login-layout', layoutName);

  if (save) {
    try {
      localStorage.setItem('stlp_login_layout', layoutName);
    } catch (e) {
      // LocalStorage fallback
    }
  }

  const optAurora = document.getElementById('layout-opt-aurora');
  const optNeumorph = document.getElementById('layout-opt-neumorph');
  if (optAurora) optAurora.style.background = (layoutName === 'aurora') ? 'var(--safety-blue)' : 'transparent';
  if (optNeumorph) optNeumorph.style.background = (layoutName === 'neumorph') ? 'var(--safety-blue)' : 'transparent';

  const dropdown = document.getElementById('layout-dropdown');
  if (dropdown) {
    dropdown.classList.add('hidden-screen');
  }

}

function toggleLayoutMenu() {
  const dropdown = document.getElementById('layout-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('hidden-screen');
  }
}

function initPortalLoginLayout() {
  let savedLayout = 'aurora';
  try {
    savedLayout = localStorage.getItem('stlp_login_layout') || 'aurora';
  } catch (e) {
    savedLayout = 'aurora';
  }
  setLoginLayout(savedLayout, false);
}


/* ============================================================
   GLOBAL BUTTON MICRO-INTERACTIONS (ripple effect)
   Uses event delegation on document so it also works on buttons
   rendered dynamically inside tables (edit/delete row actions etc).
   Hover-lift and press-scale are handled purely in CSS.
   ============================================================ */

function attachRippleEffect() {
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.stlp-btn, .stlp-btn-sm');
    if (!btn || btn.disabled) return;

    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.4;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    const ripple = document.createElement('span');
    ripple.className = 'ripple-el';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';

    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  });
}


/* ============================================================
   SCREEN MANAGEMENT
   ============================================================ */

function showScreen(id) {

  const screens = [
    'stlp-auth-screen',
    'safety-dashboard-screen',
    'vehicle-module-screen',
    'tools-module-screen',
    'hoist-module-screen',
    'vessel-module-screen'
  ];

  screens.forEach(function(screenId) {
    const element = document.getElementById(screenId);
    if (element) {
      element.classList.add('hidden-screen');
    }
  });

  const activeScreen = document.getElementById(id);
  if (activeScreen) {
    activeScreen.classList.remove('hidden-screen');
  }

  updateHeader();

}


/* ============================================================
   HEADER / USER STATUS
   ============================================================ */

function updateHeader() {

  const statusElement = document.getElementById('header-user-status');

  if (!statusElement) return;

  if (userState.isAdmin) {
    statusElement.innerHTML =
      '<span class="stlp-user-badge badge-valid">' +
      '👤 Admin Mode (Full Access)' +
      '</span>';
  } else {
    statusElement.innerHTML =
      '<span class="stlp-user-badge">' +
      '👀 Guest Mode (Read Only)' +
      '</span>';
  }

}


/* ============================================================
   ADMIN LOGIN (CORRECTED SCREEN TRANSITION)
   ============================================================ */

function handleAdminLogin(e) {

  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }

  const usernameElement = document.getElementById('login-username');
  const passwordElement = document.getElementById('login-password');

  if (!usernameElement || !passwordElement) {
    alert('Login fields not found.');
    return;
  }

  const username = usernameElement.value.trim();
  const password = passwordElement.value;

  const ADMIN_USERNAME = 'admin';
  const ADMIN_PASSWORD = 'admin123';

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    userState.isLoggedIn = true;
    userState.isAdmin = true;

    showScreen('safety-dashboard-screen');
  } else {
    userState.isLoggedIn = false;
    userState.isAdmin = false;

    alert('❌ Invalid Admin Username or Password');
  }

}


/* ============================================================
   GUEST ACCESS (CORRECTED SCREEN TRANSITION)
   ============================================================ */

function handleGuestAccess() {

  userState.isLoggedIn = true;
  userState.isAdmin = false;

  showScreen('safety-dashboard-screen');

}


/* ============================================================
   LOGOUT
   ============================================================ */

function handleLogout() {

  userState.isLoggedIn = false;
  userState.isAdmin = false;

  selectedHoistIds.clear();
  if (typeof selectedVesselIds !== 'undefined') selectedVesselIds.clear();
  showScreen('stlp-auth-screen');

  const username = document.getElementById('login-username');
  const password = document.getElementById('login-password');

  if (username) username.value = '';
  if (password) password.value = '';

}


/* ============================================================
   DYNAMIC TPI DATE & STATUS LOGIC
   ============================================================ */

function parseCustomDate(dateStr) {
  if (!dateStr || dateStr === '-' || dateStr === 'N/A') return null;

  const str = String(dateStr).trim();

  const ddmmyyyyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
    const year = parseInt(ddmmyyyyMatch[3], 10);
    return new Date(year, month, day);
  }

  const yyyymmddMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (yyyymmddMatch) {
    const year = parseInt(yyyymmddMatch[1], 10);
    const month = parseInt(yyyymmddMatch[2], 10) - 1;
    const day = parseInt(yyyymmddMatch[3], 10);
    return new Date(year, month, day);
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function getDaysLeft(dueDateStr) {
  const expiry = parseCustomDate(dueDateStr);
  if (!expiry) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);

  const difference = expiry.getTime() - today.getTime();
  return Math.ceil(difference / (1000 * 60 * 60 * 24));
}

function getHoistStatus(days) {
  if (days === null) {
    return { statusKey: 'unknown', className: '', label: 'N/A' };
  }
  if (days <= 0) {
    return { statusKey: 'expired', className: 'badge-expired', label: '🔴 Expired' };
  }
  if (days <= 30) {
    return { statusKey: 'due', className: 'badge-due-30', label: '🟡 Due Soon' };
  }
  return { statusKey: 'valid', className: 'badge-valid', label: '🟢 Valid' };
}


/* ============================================================
   FILTER ENGINE & DROPDOWN INITIALIZATION
   ============================================================ */

function populateFilterDropdowns() {

  const sectionSelect = document.getElementById('filter-plant-section');
  const typeSelect = document.getElementById('filter-hoist-type');
  const healthSelect = document.getElementById('filter-healthiness');

  if (!sectionSelect || !typeSelect || !healthSelect) return;

  const sections = new Set();
  const types = new Set();
  const healthConditions = new Set();

  dbData.hoists.forEach(function(h) {
    if (h["Plant Section"]) sections.add(h["Plant Section"]);
    if (h["Hoist Type"]) types.add(h["Hoist Type"]);
    if (h["Healthiness Status"]) healthConditions.add(h["Healthiness Status"]);
  });

  sectionSelect.innerHTML = '<option value="">All Sections</option>' +
    Array.from(sections).sort().map(s => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join('');

  typeSelect.innerHTML = '<option value="">All Types</option>' +
    Array.from(types).sort().map(t => `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`).join('');

  healthSelect.innerHTML = '<option value="">All Conditions</option>' +
    Array.from(healthConditions).sort().map(hc => `<option value="${escapeHTML(hc)}">${escapeHTML(hc)}</option>`).join('');

}

function sortHoists(hoists) {
  if (!currentSortColumn) return hoists;

  return [...hoists].sort((a, b) => {
    let valA = a[currentSortColumn] || '';
    let valB = b[currentSortColumn] || '';

    if (currentSortColumn === 'Sr. No.') {
      const numA = parseFloat(valA) || 0;
      const numB = parseFloat(valB) || 0;
      return currentSortOrder === 'asc' ? numA - numB : numB - numA;
    }

    valA = String(valA).toLowerCase();
    valB = String(valB).toLowerCase();

    if (valA < valB) return currentSortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return currentSortOrder === 'asc' ? 1 : -1;
    return 0;
  });
}

function getFilteredHoists() {

  const filtered = dbData.hoists.filter(function(hoist) {

    const days = getDaysLeft(hoist["Due Date"]);
    const statusObj = getHoistStatus(days);

    if (currentFilters.globalSearch) {
      const searchStr = currentFilters.globalSearch.toLowerCase();
      const searchableText = [
        hoist["Sr. No."],
        hoist["Plant Section"],
        hoist["Location"],
        hoist["Equipment Name"],
        hoist["Equipment Location"],
        hoist["Hoist Type"],
        hoist["Nomenclature"],
        hoist["Make"],
        hoist["Certificate"],
        hoist["Remarks"]
      ].join(' ').toLowerCase();

      if (!searchableText.includes(searchStr)) return false;
    }

    if (currentFilters.section && hoist["Plant Section"] !== currentFilters.section) return false;
    if (currentFilters.tpiStatus && statusObj.statusKey !== currentFilters.tpiStatus) return false;
    if (currentFilters.type && hoist["Hoist Type"] !== currentFilters.type) return false;
    if (currentFilters.healthiness && hoist["Healthiness Status"] !== currentFilters.healthiness) return false;

    if (currentFilters.running) {
      const runStatus = (hoist["Running Status"] || '').toLowerCase();
      if (currentFilters.running === 'Running' && !runStatus.includes('running')) return false;
      if (currentFilters.running === 'Obsolute' && runStatus.includes('running')) return false;
    }

    if (currentFilters.agency) {
      const tpiVal = (hoist["TPI"] || '').toUpperCase();
      if (currentFilters.agency === 'TPI DONE' && !tpiVal.includes('TPI DONE')) return false;
      if (currentFilters.agency === 'PENDING' && tpiVal.includes('TPI DONE')) return false;
    }

    return true;

  });

  return sortHoists(filtered);

}

function handleTableSort(columnKey) {
  if (currentSortColumn === columnKey) {
    currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortColumn = columnKey;
    currentSortOrder = 'asc';
  }
  renderHoistModule();
}

function applyHoistFilters() {

  currentFilters.globalSearch = document.getElementById('filter-global-search')?.value.trim() || '';
  currentFilters.section = document.getElementById('filter-plant-section')?.value || '';
  currentFilters.tpiStatus = document.getElementById('filter-tpi-status')?.value || '';
  currentFilters.type = document.getElementById('filter-hoist-type')?.value || '';
  currentFilters.healthiness = document.getElementById('filter-healthiness')?.value || '';
  currentFilters.running = document.getElementById('filter-running')?.value || '';
  currentFilters.agency = document.getElementById('filter-tpi-agency')?.value || '';

  updateFilterIndicator();
  renderHoistModule();

}

function filterByStatCard(statusKey) {
  const tpiStatusSelect = document.getElementById('filter-tpi-status');
  if (!tpiStatusSelect) return;

  if (statusKey === 'all') {
    tpiStatusSelect.value = '';
  } else {
    tpiStatusSelect.value = statusKey;
  }
  applyHoistFilters();
}

function resetHoistFilters() {

  currentFilters = { globalSearch: '', section: '', tpiStatus: '', type: '', healthiness: '', running: '', agency: '' };

  const elSearch = document.getElementById('filter-global-search');
  const elSection = document.getElementById('filter-plant-section');
  const elTpi = document.getElementById('filter-tpi-status');
  const elType = document.getElementById('filter-hoist-type');
  const elHealth = document.getElementById('filter-healthiness');
  const elRun = document.getElementById('filter-running');
  const elAgency = document.getElementById('filter-tpi-agency');

  if (elSearch) elSearch.value = '';
  if (elSection) elSection.value = '';
  if (elTpi) elTpi.value = '';
  if (elType) elType.value = '';
  if (elHealth) elHealth.value = '';
  if (elRun) elRun.value = '';
  if (elAgency) elAgency.value = '';

  updateFilterIndicator();
  renderHoistModule();

}

function updateFilterIndicator() {
  const indicator = document.getElementById('filter-active-indicator');
  if (!indicator) return;

  const activeTerms = [];
  if (currentFilters.globalSearch) activeTerms.push(`Search: "${currentFilters.globalSearch}"`);
  if (currentFilters.section) activeTerms.push(`Section: ${currentFilters.section}`);
  if (currentFilters.tpiStatus) activeTerms.push(`Status: ${currentFilters.tpiStatus.toUpperCase()}`);
  if (currentFilters.type) activeTerms.push(`Type: ${currentFilters.type}`);
  if (currentFilters.healthiness) activeTerms.push(`Health: ${currentFilters.healthiness}`);
  if (currentFilters.running) activeTerms.push(`Running: ${currentFilters.running}`);
  if (currentFilters.agency) activeTerms.push(`TPI: ${currentFilters.agency}`);

  if (activeTerms.length === 0) {
    indicator.innerHTML = 'Showing all asset records.';
  } else {
    indicator.innerHTML = '⚡ <strong>Active Filters:</strong> ' + activeTerms.join(' | ');
  }
}


/* ============================================================
   DATA VISUALIZATION & CHARTS RENDER ENGINE
   ============================================================ */

function getChartTextColor() {
  const currentTheme = document.body.getAttribute('data-theme') || 'dark';
  return currentTheme === 'light' ? '#334155' : '#94a3b8';
}

function getChartGridColor() {
  const currentTheme = document.body.getAttribute('data-theme') || 'dark';
  return currentTheme === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.05)';
}

function renderHoistCharts(filteredHoists) {

  if (typeof Chart === 'undefined') return;

  const textColor = getChartTextColor();
  const gridColor = getChartGridColor();

  const datalabelsConfig = {
    color: '#ffffff',
    font: { weight: 'bold', size: 11 },
    formatter: function(val) {
      return val > 0 ? val : '';
    }
  };

  let validCount = 0, dueCount = 0, expiredCount = 0;
  filteredHoists.forEach(h => {
    const days = getDaysLeft(h["Due Date"]);
    const st = getHoistStatus(days);
    if (st.statusKey === 'valid') validCount++;
    else if (st.statusKey === 'due') dueCount++;
    else if (st.statusKey === 'expired') expiredCount++;
  });

  renderChart('chart-status-donut', {
    type: 'doughnut',
    data: {
      labels: ['Valid 🟢', 'Due Soon 🟡', 'Expired 🔴'],
      datasets: [{
        data: [validCount, dueCount, expiredCount],
        backgroundColor: ['#22c55e', '#eab308', '#ef4444'],
        borderWidth: 2,
        borderColor: 'transparent'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: textColor, font: { size: 11, weight: 'bold' } } },
        datalabels: datalabelsConfig
      }
    }
  });

  const sectionCounts = {};
  filteredHoists.forEach(h => {
    const sec = h["Plant Section"] || 'Unassigned';
    sectionCounts[sec] = (sectionCounts[sec] || 0) + 1;
  });

  renderChart('chart-section-bar', {
    type: 'bar',
    data: {
      labels: Object.keys(sectionCounts),
      datasets: [{
        label: 'Hoist Count',
        data: Object.values(sectionCounts),
        backgroundColor: '#2563eb',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: 'end',
          align: 'top',
          color: textColor,
          font: { weight: 'bold', size: 11 },
          formatter: function(val) { return val > 0 ? val : ''; }
        }
      },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: { ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor } }
      }
    }
  });

  const healthCounts = {};
  filteredHoists.forEach(h => {
    const hc = h["Healthiness Status"] || 'Unknown';
    healthCounts[hc] = (healthCounts[hc] || 0) + 1;
  });

  renderChart('chart-health-pie', {
    type: 'pie',
    data: {
      labels: Object.keys(healthCounts),
      datasets: [{
        data: Object.values(healthCounts),
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6'],
        borderWidth: 2,
        borderColor: 'transparent'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: textColor, font: { size: 11, weight: 'bold' } } },
        datalabels: datalabelsConfig
      }
    }
  });

  const typeCounts = {};
  filteredHoists.forEach(h => {
    const tp = h["Hoist Type"] || 'Other';
    typeCounts[tp] = (typeCounts[tp] || 0) + 1;
  });

  renderChart('chart-type-bar', {
    type: 'bar',
    data: {
      labels: Object.keys(typeCounts),
      datasets: [{
        label: 'Equipment Type',
        data: Object.values(typeCounts),
        backgroundColor: '#f97316',
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: 'end',
          align: 'end',
          color: textColor,
          font: { weight: 'bold', size: 11 },
          formatter: function(val) { return val > 0 ? val : ''; }
        }
      },
      scales: {
        x: { ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor } },
        y: { ticks: { color: textColor }, grid: { color: gridColor } }
      }
    }
  });

}

function renderChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }
  chartInstances[canvasId] = new Chart(canvas, config);
}


/* ============================================================
   HOIST & TPI MODULE RENDER & ID-BASED BULK SELECTION ENGINE
   ============================================================ */

function toggleSelectAllHoists(masterCheckbox) {
  if (!userState.isAdmin) return;

  const filteredHoists = getFilteredHoists();
  if (masterCheckbox.checked) {
    filteredHoists.forEach(h => {
      const recId = String(h.id || '').trim();
      if (recId) selectedHoistIds.add(recId);
    });
  } else {
    filteredHoists.forEach(h => {
      const recId = String(h.id || '').trim();
      if (recId) selectedHoistIds.delete(recId);
    });
  }
  renderHoistModule();
}

function toggleSingleHoistSelect(recId) {
  if (!userState.isAdmin) return;

  const cleanId = String(recId || '').trim();
  if (!cleanId) return;

  if (selectedHoistIds.has(cleanId)) {
    selectedHoistIds.delete(cleanId);
  } else {
    selectedHoistIds.add(cleanId);
  }
  renderHoistModule();
}

async function deleteSelectedHoists() {
  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }

  const selectedList = Array.from(selectedHoistIds);
  if (selectedList.length === 0) {
    alert('⚠️ Please select at least one record to delete.');
    return;
  }

  if (!confirm(`⚠️ Are you sure you want to permanently delete ${selectedList.length} selected equipment record(s)?`)) {
    return;
  }

  const client = initSupabase();
  if (!client) {
    alert('❌ Supabase client not available.');
    return;
  }

  try {
    // Delete in batches of 100 using Primary Key database ID
    const BATCH_SIZE = 100;
    for (let i = 0; i < selectedList.length; i += BATCH_SIZE) {
      const batch = selectedList.slice(i, i + BATCH_SIZE);
      const { error } = await client
        .from('hoist_records')
        .delete()
        .in('id', batch);

      if (error) {
        alert('❌ Supabase Delete Error: ' + error.message);
        return;
      }
    }

    selectedHoistIds.clear();
    await fetchHoistsFromSupabase();
    alert(`✅ Successfully deleted ${selectedList.length} selected equipment record(s).`);

  } catch (err) {
    alert('❌ Exception during bulk deletion: ' + err.message);
  }
}

function renderHoistModule() {

  showScreen('hoist-module-screen');

  const tbody = document.getElementById('hoist-table-body');
  if (!tbody) return;

  const filteredHoists = getFilteredHoists();

  let valid = 0;
  let due = 0;
  let expired = 0;

  // Selection calculation on currently visible filtered items
  const visibleWithId = filteredHoists.filter(h => h.id);
  const selectedVisibleCount = visibleWithId.filter(h => selectedHoistIds.has(String(h.id))).length;

  const topSelectAllContainer = document.getElementById('top-select-all-container');
  if (topSelectAllContainer) {
    topSelectAllContainer.style.display = userState.isAdmin ? 'inline-flex' : 'none';
  }

  const masterCheckEl = document.getElementById('select-all-hoists-checkbox');
  if (masterCheckEl) {
    if (!userState.isAdmin || visibleWithId.length === 0) {
      masterCheckEl.checked = false;
      masterCheckEl.indeterminate = false;
      masterCheckEl.disabled = !userState.isAdmin;
    } else {
      masterCheckEl.disabled = false;
      if (selectedVisibleCount === visibleWithId.length) {
        masterCheckEl.checked = true;
        masterCheckEl.indeterminate = false;
      } else if (selectedVisibleCount > 0) {
        masterCheckEl.checked = false;
        masterCheckEl.indeterminate = true;
      } else {
        masterCheckEl.checked = false;
        masterCheckEl.indeterminate = false;
      }
    }
  }

  // Active / Inactive Bulk Delete Button Control
  const bulkDeleteBtn = document.getElementById('btn-bulk-delete');
  if (bulkDeleteBtn) {
    if (userState.isAdmin) {
      bulkDeleteBtn.style.display = 'inline-block';
      const count = selectedHoistIds.size;
      bulkDeleteBtn.innerText = `🗑️ Delete Selected (${count})`;
      bulkDeleteBtn.disabled = (count === 0);
    } else {
      bulkDeleteBtn.style.display = 'none';
    }
  }

  tbody.innerHTML = filteredHoists.map(function(hoist) {

    const days = getDaysLeft(hoist["Due Date"]);
    const status = getHoistStatus(days);

    if (days !== null) {
      if (days <= 0) {
        expired++;
        hoist["Expired"] = "Expired";
        hoist["Expiry Reminder"] = "EXPIRED";
      } else if (days <= 30) {
        due++;
        hoist["Expired"] = "No";
        hoist["Expiry Reminder"] = "Expiry Reminder";
      } else {
        valid++;
        hoist["Expired"] = "No";
        hoist["Expiry Reminder"] = "VALID";
      }
    }

    let actionHTML = '';

    if (userState.isAdmin) {
      actionHTML = '<button type="button" class="stlp-btn-sm" onclick="editHoist(\'' + hoist.id + '\')">Edit</button>';
    } else {
      actionHTML = '<span style="color:#94a3b8; font-size:0.75rem;">View Only</span>';
    }

    const recId = String(hoist.id || '').trim();
    const isChecked = selectedHoistIds.has(recId) ? 'checked' : '';
    const safeIdForJs = recId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const checkboxHTML = userState.isAdmin ? `<input type="checkbox" ${isChecked} onchange="toggleSingleHoistSelect('${safeIdForJs}')" />` : '-';

    return `
      <tr>
        <td style="text-align:center;">${checkboxHTML}</td>
        <td><strong>${escapeHTML(hoist["Sr. No."])}</strong></td>
        <td>${escapeHTML(hoist["Plant Section"])}</td>
        <td>${escapeHTML(hoist["Location"])}</td>
        <td><strong>${escapeHTML(hoist["Equipment Name"])}</strong></td>
        <td>${escapeHTML(hoist["Equipment Location"])}</td>
        <td>${escapeHTML(hoist["Hoist Type"])}</td>
        <td><code class="tag-nom">${escapeHTML(hoist["Nomenclature"])}</code></td>
        <td>${escapeHTML(hoist["Make"])}</td>
        <td>${escapeHTML(hoist["MFG"])}</td>
        <td>${escapeHTML(hoist["Details"])}</td>
        <td>${escapeHTML(hoist["Certificate"])}</td>
        <td>${escapeHTML(hoist["Test date"])}</td>
        <td>
          ${escapeHTML(hoist["Due Date"])}
          <br>
          <span class="badge-status ${status.className}">
            ${status.label}
            ${days !== null ? `(${days}d)` : ''}
          </span>
        </td>
        <td>${escapeHTML(hoist["Capacity"])}</td>
        <td>${escapeHTML(hoist["Healthiness Status"])}</td>
        <td>${escapeHTML(hoist["Power Supply Status"])}</td>
        <td>${escapeHTML(hoist["Running Status"])}</td>
        <td>${escapeHTML(hoist["Feeder"])}</td>
        <td>${escapeHTML(hoist["Pendant"])}</td>
        <td>${escapeHTML(hoist["Remarks"])}</td>
        <td>${escapeHTML(hoist["Expiry Reminder"])}</td>
        <td>${escapeHTML(hoist["Expired"])}</td>
        <td>${escapeHTML(hoist["TPI"])}</td>
        <td>${actionHTML}</td>
      </tr>
    `;
  }).join('');

  const totalElement = document.getElementById('stat-hoist-total');
  const validElement = document.getElementById('stat-hoist-valid');
  const dueElement = document.getElementById('stat-hoist-due');
  const expiredElement = document.getElementById('stat-hoist-expired');

  if (totalElement) totalElement.innerText = filteredHoists.length;
  if (validElement) validElement.innerText = valid;
  if (dueElement) dueElement.innerText = due;
  if (expiredElement) expiredElement.innerText = expired;

  renderHoistCharts(filteredHoists);

}


/* ============================================================
   ADD & EDIT HOIST MODAL FUNCTIONS
   ============================================================ */

function openAddHoistModal() {
  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }
  const form = document.getElementById('hoist-form');
  if (form) form.reset();

  const editIdInput = document.getElementById('m-editing-id');
  if (editIdInput) editIdInput.value = '';

  const modalTitle = document.getElementById('modal-title-text');
  if (modalTitle) modalTitle.innerText = 'Add New Hoist Record';

  const modal = document.getElementById('hoist-modal');
  if (modal) modal.classList.remove('hidden-screen');
}

function editHoist(id) {
  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }

  const hoist = dbData.hoists.find(item => String(item.id) === String(id));
  if (!hoist) {
    alert('❌ Hoist record not found.');
    return;
  }

  const editIdInput = document.getElementById('m-editing-id');
  if (editIdInput) editIdInput.value = hoist.id;

  const setValue = (inputId, val) => {
    const el = document.getElementById(inputId);
    if (el) el.value = val !== undefined && val !== null ? String(val) : '';
  };

  setValue('m-section', hoist["Plant Section"]);
  setValue('m-loc', hoist["Location"]);
  setValue('m-name', hoist["Equipment Name"]);
  setValue('m-eq-loc', hoist["Equipment Location"]);
  setValue('m-type', hoist["Hoist Type"]);
  setValue('m-nom', hoist["Nomenclature"]);
  setValue('m-make', hoist["Make"]);
  setValue('m-mfg', hoist["MFG"]);
  setValue('m-details', hoist["Details"]);
  setValue('m-cert', hoist["Certificate"]);

  const convertToInputDate = (str) => {
    const d = parseCustomDate(str);
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  setValue('m-test-date', convertToInputDate(hoist["Test date"]));
  setValue('m-due-date', convertToInputDate(hoist["Due Date"]));
  setValue('m-cap', hoist["Capacity"]);
  setValue('m-health', hoist["Healthiness Status"] || 'OK');
  setValue('m-power', hoist["Power Supply Status"]);
  setValue('m-running', hoist["Running Status"] || 'Running');
  setValue('m-feeder', hoist["Feeder"]);
  setValue('m-pendant', hoist["Pendant"]);
  setValue('m-remarks', hoist["Remarks"]);
  setValue('m-tpi', hoist["TPI"]);

  const modalTitle = document.getElementById('modal-title-text');
  if (modalTitle) modalTitle.innerText = 'Edit Hoist Record (' + (hoist["Nomenclature"] || hoist["Equipment Name"]) + ')';

  const modal = document.getElementById('hoist-modal');
  if (modal) modal.classList.remove('hidden-screen');
}

function closeHoistModal() {
  const modal = document.getElementById('hoist-modal');
  if (modal) modal.classList.add('hidden-screen');
}

/* ============================================================
   MODULE UNDER DEVELOPMENT MODAL
   ============================================================ */

function showModuleUnderDevelopment(moduleName) {
  const textEl = document.getElementById('under-dev-module-text');
  if (textEl) textEl.textContent = moduleName + ' module is currently under development and will be available soon.';

  const modal = document.getElementById('under-dev-modal');
  if (modal) modal.classList.remove('hidden-screen');
}

function closeUnderDevModal() {
  const modal = document.getElementById('under-dev-modal');
  if (modal) modal.classList.add('hidden-screen');
}


/* ============================================================
   SAVE HOIST RECORD (WRITE DIRECTLY TO SUPABASE)
   ============================================================ */

async function saveHoistRecord(e) {

  e.preventDefault();

  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }

  const client = initSupabase();
  if (!client) {
    alert('❌ Supabase client is not available.');
    return;
  }

  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };

  const editingId = getVal('m-editing-id');
  const plantSection = getVal('m-section');
  const location = getVal('m-loc');
  const eqName = getVal('m-name');
  const nom = getVal('m-nom');
  const rawDueDate = getVal('m-due-date');
  const rawTestDate = getVal('m-test-date');

  if (!plantSection || !location || !eqName || !nom || !rawDueDate) {
    alert('❌ Please fill in all required fields (Plant Section, Location, Equipment Name, Nomenclature, Due Date).');
    return;
  }

  const formatToDDMMYYYY = (dateStr) => {
    const d = parseCustomDate(dateStr);
    if (!d) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const dueDate = formatToDDMMYYYY(rawDueDate);
  const testDate = formatToDDMMYYYY(rawTestDate);

  const days = getDaysLeft(dueDate);
  let expiryReminder = "VALID";
  let expired = "No";

  if (days !== null) {
    if (days <= 0) {
      expiryReminder = "EXPIRED";
      expired = "Expired";
    } else if (days <= 30) {
      expiryReminder = "DUE SOON";
      expired = "No";
    }
  }

  const hoistObj = {
    "Sr. No.": editingId ? (dbData.hoists.find(h => String(h.id) === String(editingId))?.["Sr. No."] || '1') : String(dbData.hoists.length + 1),
    "Plant Section": plantSection,
    "Location": location,
    "Equipment Name": eqName,
    "Equipment Location": getVal('m-eq-loc'),
    "Hoist Type": getVal('m-type'),
    "Nomenclature": nom,
    "Make": getVal('m-make'),
    "MFG": getVal('m-mfg'),
    "Details": getVal('m-details'),
    "Certificate": getVal('m-cert'),
    "Test date": testDate,
    "Due Date": dueDate,
    "Capacity": getVal('m-cap'),
    "Healthiness Status": getVal('m-health'),
    "Power Supply Status": getVal('m-power'),
    "Running Status": getVal('m-running'),
    "Feeder": getVal('m-feeder'),
    "Pendant": getVal('m-pendant'),
    "Remarks": getVal('m-remarks'),
    "Expiry Reminder": expiryReminder,
    "Expired": expired,
    "TPI": getVal('m-tpi')
  };

  const supabaseRow = mapRowToSupabase(hoistObj);

  try {

    if (editingId) {
      const targetRecord = dbData.hoists.find(h => String(h.id) === String(editingId));
      const targetNom = targetRecord ? String(targetRecord["Nomenclature"]).trim().toUpperCase() : supabaseRow.nomenclature;

      const { error } = await client
        .from('hoist_records')
        .update(supabaseRow)
        .eq('nomenclature', targetNom);

      if (error) {
        alert('❌ Supabase Update Error: ' + error.message);
        return;
      }
    } else {
      const { error } = await client
        .from('hoist_records')
        .upsert([supabaseRow], { onConflict: 'nomenclature' });

      if (error) {
        alert('❌ Supabase Insert Error: ' + error.message);
        return;
      }
    }

    closeHoistModal();
    await fetchHoistsFromSupabase();
    alert('✅ Hoist record saved permanently to Supabase.');

  } catch (err) {
    alert('❌ Exception during save: ' + err.message);
  }

}


/* ============================================================
   EXCEL EXPORT ENGINE
   ============================================================ */

function exportHoistExcel() {

  if (typeof XLSX === 'undefined') {
    alert('❌ SheetJS library is loading. Please try again in a moment.');
    return;
  }

  const recordsToExport = getFilteredHoists();

  if (!recordsToExport || recordsToExport.length === 0) {
    alert('❌ No hoist records available to export.');
    return;
  }

  const exportData = recordsToExport.map(function(h) {
    const rowObj = {};
    HOIST_MASTER_FIELDS.forEach(function(field) {
      rowObj[field] = h[field] !== undefined && h[field] !== null ? String(h[field]) : '';
    });
    return rowObj;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData, { header: HOIST_MASTER_FIELDS });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "HOIST_RECORDS");

  const todayObj = new Date();
  const day = String(todayObj.getDate()).padStart(2, '0');
  const month = String(todayObj.getMonth() + 1).padStart(2, '0');
  const year = todayObj.getFullYear();
  const todayStr = `${day}-${month}-${year}`;

  const fileName = 'Hoist_TPI_Records_' + todayStr + '.xlsx';

  XLSX.writeFile(workbook, fileName);

}


/* ============================================================
   PROFESSIONAL EXCEL IMPORT ENGINE (ALL ROWS IMPORTED - NO SKIPS)
   ============================================================ */

function triggerHoistExcelImport() {
  if (!userState.isAdmin) {
    alert('❌ Admin access required to import records.');
    return;
  }

  const fileInput = document.getElementById('hoist-excel-file');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
}

function normalizeImportHeader(rawHeader) {
  if (!rawHeader) return '';
  const clean = String(rawHeader).trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  if (clean.includes('srno') || clean.includes('sno') || clean === 'sr' || clean.includes('serial')) return 'Sr. No.';
  if (clean.includes('plantsection') || clean === 'section' || clean.includes('dept')) return 'Plant Section';
  if (clean === 'location' || clean.includes('plantlocation') || clean.includes('area')) return 'Location';
  if (clean.includes('equipmentlocation') || clean.includes('eqlocation') || clean.includes('locat')) return 'Equipment Location';
  if (clean.includes('equipmentname') || clean.includes('eqname') || clean === 'name' || clean.includes('equipment')) return 'Equipment Name';
  if (clean.includes('hoisttype') || clean.includes('eqtype') || clean === 'type') return 'Hoist Type';
  if (clean.includes('nomenclature') || clean.includes('tag') || clean.includes('hoistid') || clean.includes('nomen')) return 'Nomenclature';
  if (clean === 'make' || clean.includes('manufacturer') || clean.includes('brand')) return 'Make';
  if (clean === 'mfg' || clean.includes('mfgdate') || clean.includes('manufacture') || clean.includes('year')) return 'MFG';
  if (clean.includes('detail') || clean.includes('spec') || clean.includes('description')) return 'Details';
  if (clean.includes('cert') || clean.includes('certificate') || clean.includes('certno')) return 'Certificate';
  if (clean.includes('testdate') || clean.includes('lasttest') || clean.includes('tested')) return 'Test date';
  if (clean.includes('duedate') || clean.includes('expirydate') || clean.includes('nexttest') || clean.includes('tpiexpir')) return 'Due Date';
  if (clean.includes('capacity') || clean.includes('swl') || clean.includes('ton')) return 'Capacity';
  if (clean.includes('health') || clean.includes('condition')) return 'Healthiness Status';
  if (clean.includes('power') || clean.includes('supply')) return 'Power Supply Status';
  if (clean.includes('running') || clean.includes('runstatus') || clean.includes('operat')) return 'Running Status';
  if (clean.includes('feeder')) return 'Feeder';
  if (clean.includes('pendant') || clean.includes('control')) return 'Pendant';
  if (clean.includes('remark') || clean.includes('note')) return 'Remarks';
  if (clean.includes('expiryreminder') || clean.includes('reminder')) return 'Expiry Reminder';
  if (clean.includes('expired')) return 'Expired';
  if (clean.includes('tpi') || clean.includes('agency') || clean.includes('thirdparty')) return 'TPI';

  return String(rawHeader).trim();
}

function formatExcelDate(dateVal) {
  if (dateVal === null || dateVal === undefined || dateVal === '') return '';

  if (typeof dateVal === 'number') {
    try {
      const parsed = XLSX.SSF.parse_date_code(dateVal);
      if (parsed) {
        const d = String(parsed.d).padStart(2, '0');
        const m = String(parsed.m).padStart(2, '0');
        const y = parsed.y;
        return `${d}-${m}-${y}`;
      }
    } catch (err) {}
  }

  if (dateVal instanceof Date) {
    if (!isNaN(dateVal.getTime())) {
      const d = String(dateVal.getDate()).padStart(2, '0');
      const m = String(dateVal.getMonth() + 1).padStart(2, '0');
      const y = dateVal.getFullYear();
      return `${d}-${m}-${y}`;
    }
  }

  const strVal = String(dateVal).trim();
  if (!strVal || strVal === '-' || strVal.toLowerCase() === 'n/a') return '';

  const ddmmyyyyMatch = strVal.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyyMatch) {
    const day = String(ddmmyyyyMatch[1]).padStart(2, '0');
    const month = String(ddmmyyyyMatch[2]).padStart(2, '0');
    const year = ddmmyyyyMatch[3];
    return `${day}-${month}-${year}`;
  }

  const yyyymmddMatch = strVal.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (yyyymmddMatch) {
    const year = yyyymmddMatch[1];
    const month = String(yyyymmddMatch[2]).padStart(2, '0');
    const day = String(yyyymmddMatch[3]).padStart(2, '0');
    return `${day}-${month}-${year}`;
  }

  const dateObj = new Date(strVal);
  if (!isNaN(dateObj.getTime())) {
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    return `${day}-${month}-${year}`;
  }

  return strVal;
}

function handleHoistExcelImport(e) {

  if (!userState.isAdmin) {
    alert('❌ Admin access required to import records.');
    return;
  }

  if (typeof XLSX === 'undefined') {
    alert('❌ SheetJS library is loading. Please try again.');
    return;
  }

  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = async function(evt) {

    try {

      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellNF: false, cellText: false });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        alert('❌ Selected Excel file contains no worksheets.');
        return;
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: true });

      if (!rawRows || rawRows.length === 0) {
        alert('❌ No data rows found in Excel sheet.');
        return;
      }

      const client = initSupabase();
      if (!client) {
        alert('❌ Supabase client is not available.');
        return;
      }

      const existingNomSet = new Set(dbData.hoists.map(h => String(h["Nomenclature"]).trim().toUpperCase()));

      let autoGeneratedCount = 0;
      let newRecordsCount = 0;
      let updatedRecordsCount = 0;

      const recordsToUpsert = [];
      const processedInFile = new Set();

      rawRows.forEach(function(row, index) {
        const mappedRecord = {};
        Object.keys(row).forEach(function(rawKey) {
          const normKey = normalizeImportHeader(rawKey);
          mappedRecord[normKey] = row[rawKey];
        });

        let rawNom = String(mappedRecord["Nomenclature"] || '').trim();

        if (!rawNom) {
          rawNom = 'TSPL/HOIST-AUTO-' + (index + 1) + '-' + Date.now().toString().slice(-4);
          autoGeneratedCount++;
        }

        let nomKey = rawNom.toUpperCase();

        if (processedInFile.has(nomKey)) {
          rawNom = rawNom + '-DUP-' + (index + 1);
          nomKey = rawNom.toUpperCase();
        }
        processedInFile.add(nomKey);

        if (existingNomSet.has(nomKey)) {
          updatedRecordsCount++;
        } else {
          newRecordsCount++;
        }

        const dueDate = formatExcelDate(mappedRecord["Due Date"]);
        const testDate = formatExcelDate(mappedRecord["Test date"]);
        const days = getDaysLeft(dueDate);
        let expiryReminder = "VALID";
        let expired = "No";

        if (days !== null) {
          if (days <= 0) {
            expiryReminder = "EXPIRED";
            expired = "Expired";
          } else if (days <= 30) {
            expiryReminder = "DUE SOON";
            expired = "No";
          }
        }

        const hoistObj = {
          "Sr. No.": String(mappedRecord["Sr. No."] || '').trim() || String(index + 1),
          "Plant Section": String(mappedRecord["Plant Section"] || '').trim() || 'CHP',
          "Location": String(mappedRecord["Location"] || '').trim() || 'Main Plant',
          "Equipment Name": String(mappedRecord["Equipment Name"] || '').trim() || 'Hoist Crane',
          "Equipment Location": String(mappedRecord["Equipment Location"] || '').trim(),
          "Hoist Type": String(mappedRecord["Hoist Type"] || '').trim() || 'Mono Rail',
          "Nomenclature": rawNom,
          "Make": String(mappedRecord["Make"] || '').trim(),
          "MFG": String(mappedRecord["MFG"] || '').trim(),
          "Details": String(mappedRecord["Details"] || '').trim(),
          "Certificate": String(mappedRecord["Certificate"] || '').trim(),
          "Test date": testDate,
          "Due Date": dueDate,
          "Capacity": String(mappedRecord["Capacity"] || '').trim(),
          "Healthiness Status": String(mappedRecord["Healthiness Status"] || '').trim() || 'OK',
          "Power Supply Status": String(mappedRecord["Power Supply Status"] || '').trim(),
          "Running Status": String(mappedRecord["Running Status"] || '').trim() || 'Running',
          "Feeder": String(mappedRecord["Feeder"] || '').trim(),
          "Pendant": String(mappedRecord["Pendant"] || '').trim(),
          "Remarks": String(mappedRecord["Remarks"] || '').trim(),
          "Expiry Reminder": expiryReminder,
          "Expired": expired,
          "TPI": String(mappedRecord["TPI"] || '').trim()
        };

        recordsToUpsert.push(mapRowToSupabase(hoistObj));
      });

      const BATCH_SIZE = 100;
      for (let i = 0; i < recordsToUpsert.length; i += BATCH_SIZE) {
        const batch = recordsToUpsert.slice(i, i + BATCH_SIZE);

        const { error } = await client
          .from('hoist_records')
          .upsert(batch, { onConflict: 'nomenclature' });

        if (error) {
          alert(`❌ Import stopped at Batch ${Math.floor(i / BATCH_SIZE) + 1} due to Error:\n${error.message}`);
          return;
        }
      }

      await fetchHoistsFromSupabase();

      const summaryMsg =
        `📊 Excel Import Complete Summary\n` +
        `===================================\n` +
        `🟢 New Records: ${newRecordsCount}\n` +
        `🔵 Updated Records: ${updatedRecordsCount}\n` +
        `🏷️ Auto-Generated Nomenclatures: ${autoGeneratedCount}\n` +
        `🟡 Skipped Rows: 0\n` +
        `-----------------------------------\n` +
        `📋 Total Records Processed: ${rawRows.length}\n` +
        `📦 Total Hoist Assets in Portal: ${dbData.hoists.length}`;

      alert(summaryMsg);

    } catch (err) {
      console.error("Import error:", err);
      alert('❌ Failed to process Excel file. Please ensure it is a valid .xlsx file.');
    }

  };

  reader.readAsArrayBuffer(file);

}


/* ============================================================
   VEHICLE MODULE
   ============================================================ */

function renderVehicleModule() {
  showScreen('vehicle-module-screen');

  const tbody = document.getElementById('vehicle-table-body');
  if (!tbody) return;

  tbody.innerHTML = dbData.vehicles.map(function(vehicle) {
    return `
      <tr>
        <td><strong>${escapeHTML(vehicle.vehicle_number)}</strong></td>
        <td>${escapeHTML(vehicle.vehicle_type)}</td>
        <td>${escapeHTML(vehicle.department)}</td>
        <td>${escapeHTML(vehicle.fitness_validity)}</td>
        <td><span class="badge-status badge-valid">${escapeHTML(vehicle.status)}</span></td>
      </tr>
    `;
  }).join('');
}


/* ============================================================
   TOOLS & TACKLES MODULE
   ============================================================ */

function renderToolsModule() {
  showScreen('tools-module-screen');

  const tbody = document.getElementById('tools-table-body');
  if (!tbody) return;

  tbody.innerHTML = dbData.tools.map(function(tool) {
    return `
      <tr>
        <td><strong>${escapeHTML(tool.equipment_id)}</strong></td>
        <td>${escapeHTML(tool.equipment_name)}</td>
        <td>${escapeHTML(tool.capacity)}</td>
        <td><span class="badge-status badge-valid">${escapeHTML(tool.inspection_status)}</span></td>
      </tr>
    `;
  }).join('');
}


/* ============================================================
   HTML ESCAPE
   ============================================================ */

function escapeHTML(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


/* ============================================================
   INITIALIZATION
   ============================================================ */

document.addEventListener('DOMContentLoaded', async function() {

  userState = {
    isLoggedIn: false,
    isAdmin: false
  };

  initPortalTheme();
  initPortalLoginLayout();
  attachRippleEffect();
  showScreen('stlp-auth-screen');
  updateHeader();

  // Load Live Data from Supabase Cloud Database on Startup
  await fetchHoistsFromSupabase();
  await fetchVesselsFromSupabase();

  document.addEventListener('click', function(e) {
    if (!e.target.closest('.theme-switcher-wrapper')) {
      const themeDropdown = document.getElementById('theme-dropdown');
      if (themeDropdown) themeDropdown.classList.add('hidden-screen');
    }
    if (!e.target.closest('.layout-switcher-wrapper')) {
      const layoutDropdown = document.getElementById('layout-dropdown');
      if (layoutDropdown) layoutDropdown.classList.add('hidden-screen');
    }
  });

});

/* ============================================================
   ============================================================
   PRESSURE VESSEL MODULE
   Hydro Test + Ultrasonic Thickness Test Validity Monitoring
   Supabase Table: pressure_vessel_records
   Unique Key: vessel_serial_no
   ============================================================
   ============================================================ */


/* ============================================================
   PRESSURE VESSEL MASTER COLUMN SEQUENCE (25 FIELDS)
   ============================================================ */

const VESSEL_MASTER_FIELDS = [
  "SN",
  "Area",
  "Location",
  "Name of Vessel",
  "Vessel Serial Number",
  "Safe Working Pressure (Mfr)",
  "Test Certificate No",
  "Last Hydro Test Date",
  "Present Hydro Test Done",
  "Hydro Test Due Date",
  "Hydro Expiry Reminder",
  "Hydro Expired",
  "Last Thickness Test Date",
  "Thickness Test Due Date",
  "Thickness Expiry Reminder",
  "Thickness Expired",
  "Constructed Shell",
  "Constructed Dish",
  "Min Allowable Shell",
  "Min Allowable Dish",
  "Measured Shell",
  "Measured Dish",
  "Calculated SWP",
  "Condition",
  "TPI Observation"
];


/* ============================================================
   VESSEL STATE
   ============================================================ */

let selectedVesselIds = new Set();
let currentVesselSortColumn = null;
let currentVesselSortOrder = 'asc';

let currentVesselFilters = {
  globalSearch: '',
  area: '',
  location: '',
  hydroStatus: '',
  thicknessStatus: '',
  condition: ''
};


/* ============================================================
   SUPABASE MAPPING HELPERS
   ============================================================ */

function mapVesselFromSupabase(item) {
  return {
    id: String(item.id || ''),
    "SN": String(item.sn || ''),
    "Area": item.area || '',
    "Location": item.location || '',
    "Name of Vessel": item.vessel_name || '',
    "Vessel Serial Number": item.vessel_serial_no || '',
    "Safe Working Pressure (Mfr)": item.swp_manufacturer || '',
    "Test Certificate No": item.test_certificate_no || '',
    "Last Hydro Test Date": item.last_hydro_test || '',
    "Present Hydro Test Done": item.present_hydro_test || '',
    "Hydro Test Due Date": item.hydro_due_date || '',
    "Hydro Expiry Reminder": item.hydro_expiry_reminder || '',
    "Hydro Expired": item.hydro_expired || '',
    "Last Thickness Test Date": item.last_thickness_test || '',
    "Thickness Test Due Date": item.thickness_due_date || '',
    "Thickness Expiry Reminder": item.thickness_expiry_reminder || '',
    "Thickness Expired": item.thickness_expired || '',
    "Constructed Shell": item.constructed_shell || '',
    "Constructed Dish": item.constructed_dish || '',
    "Min Allowable Shell": item.min_allowable_shell || '',
    "Min Allowable Dish": item.min_allowable_dish || '',
    "Measured Shell": item.measured_shell || '',
    "Measured Dish": item.measured_dish || '',
    "Calculated SWP": item.calculated_swp || '',
    "Condition": item.condition_status || '',
    "TPI Observation": item.tpi_observation || ''
  };
}

function mapVesselToSupabase(vessel) {
  const serialClean = String(vessel["Vessel Serial Number"] || '').trim().toUpperCase();
  return {
    sn: String(vessel["SN"] || ''),
    area: String(vessel["Area"] || ''),
    location: String(vessel["Location"] || ''),
    vessel_name: String(vessel["Name of Vessel"] || ''),
    vessel_serial_no: serialClean,
    swp_manufacturer: String(vessel["Safe Working Pressure (Mfr)"] || ''),
    test_certificate_no: String(vessel["Test Certificate No"] || ''),
    last_hydro_test: String(vessel["Last Hydro Test Date"] || ''),
    present_hydro_test: String(vessel["Present Hydro Test Done"] || ''),
    hydro_due_date: String(vessel["Hydro Test Due Date"] || ''),
    hydro_expiry_reminder: String(vessel["Hydro Expiry Reminder"] || ''),
    hydro_expired: String(vessel["Hydro Expired"] || ''),
    last_thickness_test: String(vessel["Last Thickness Test Date"] || ''),
    thickness_due_date: String(vessel["Thickness Test Due Date"] || ''),
    thickness_expiry_reminder: String(vessel["Thickness Expiry Reminder"] || ''),
    thickness_expired: String(vessel["Thickness Expired"] || ''),
    constructed_shell: String(vessel["Constructed Shell"] || ''),
    constructed_dish: String(vessel["Constructed Dish"] || ''),
    min_allowable_shell: String(vessel["Min Allowable Shell"] || ''),
    min_allowable_dish: String(vessel["Min Allowable Dish"] || ''),
    measured_shell: String(vessel["Measured Shell"] || ''),
    measured_dish: String(vessel["Measured Dish"] || ''),
    calculated_swp: String(vessel["Calculated SWP"] || ''),
    condition_status: String(vessel["Condition"] || ''),
    tpi_observation: String(vessel["TPI Observation"] || '')
  };
}


/* ============================================================
   FETCH VESSELS FROM SUPABASE
   ============================================================ */

async function fetchVesselsFromSupabase() {

  const client = initSupabase();

  if (!client) {
    console.warn("Supabase client is not available.");
    return;
  }

  try {

    const { data, error } = await client
      .from('pressure_vessel_records')
      .select('*');

    if (error) {
      console.error("Supabase vessel fetch error:", error);
      return;
    }

    if (data) {
      dbData.vessels = data.map(mapVesselFromSupabase);

      populateVesselFilterDropdowns();

      const vesselScreen = document.getElementById('vessel-module-screen');
      if (vesselScreen && !vesselScreen.classList.contains('hidden-screen')) {
        renderVesselModule();
      }
    }

  } catch (err) {
    console.error("Failed to fetch vessels from Supabase:", err);
  }

}


/* ============================================================
   OVERALL VESSEL STATUS (WORST OF HYDRO & THICKNESS)
   ============================================================ */

function getVesselOverallStatus(vessel) {
  const hydroDays = getDaysLeft(vessel["Hydro Test Due Date"]);
  const thickDays = getDaysLeft(vessel["Thickness Test Due Date"]);

  const candidates = [hydroDays, thickDays].filter(d => d !== null);
  if (candidates.length === 0) {
    return { statusKey: 'unknown', className: '', label: 'N/A', days: null };
  }

  const worst = Math.min(...candidates);
  const st = getHoistStatus(worst);
  return { statusKey: st.statusKey, className: st.className, label: st.label, days: worst };
}


/* ============================================================
   FILTER ENGINE
   ============================================================ */

function populateVesselFilterDropdowns() {

  const areaSelect = document.getElementById('vfilter-area');
  const locSelect = document.getElementById('vfilter-location');
  const condSelect = document.getElementById('vfilter-condition');

  if (!areaSelect || !locSelect || !condSelect) return;

  const areas = new Set();
  const locations = new Set();
  const conditions = new Set();

  dbData.vessels.forEach(function(v) {
    if (v["Area"]) areas.add(String(v["Area"]).trim());
    if (v["Location"]) locations.add(String(v["Location"]).trim());
    if (v["Condition"]) conditions.add(String(v["Condition"]).trim());
  });

  areaSelect.innerHTML = '<option value="">All Areas</option>' +
    Array.from(areas).sort().map(a => `<option value="${escapeHTML(a)}">${escapeHTML(a)}</option>`).join('');

  locSelect.innerHTML = '<option value="">All Locations</option>' +
    Array.from(locations).sort().map(l => `<option value="${escapeHTML(l)}">${escapeHTML(l)}</option>`).join('');

  condSelect.innerHTML = '<option value="">All Conditions</option>' +
    Array.from(conditions).sort().map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');

}

function sortVessels(vessels) {
  if (!currentVesselSortColumn) return vessels;

  return [...vessels].sort((a, b) => {
    let valA = a[currentVesselSortColumn] || '';
    let valB = b[currentVesselSortColumn] || '';

    if (currentVesselSortColumn === 'SN') {
      const numA = parseFloat(valA) || 0;
      const numB = parseFloat(valB) || 0;
      return currentVesselSortOrder === 'asc' ? numA - numB : numB - numA;
    }

    if (currentVesselSortColumn === 'Hydro Test Due Date' || currentVesselSortColumn === 'Thickness Test Due Date') {
      const dA = parseCustomDate(valA);
      const dB = parseCustomDate(valB);
      const tA = dA ? dA.getTime() : 0;
      const tB = dB ? dB.getTime() : 0;
      return currentVesselSortOrder === 'asc' ? tA - tB : tB - tA;
    }

    valA = String(valA).toLowerCase();
    valB = String(valB).toLowerCase();

    if (valA < valB) return currentVesselSortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return currentVesselSortOrder === 'asc' ? 1 : -1;
    return 0;
  });
}

function getFilteredVessels() {

  const filtered = dbData.vessels.filter(function(vessel) {

    const hydroStatus = getHoistStatus(getDaysLeft(vessel["Hydro Test Due Date"]));
    const thickStatus = getHoistStatus(getDaysLeft(vessel["Thickness Test Due Date"]));

    if (currentVesselFilters.globalSearch) {
      const searchStr = currentVesselFilters.globalSearch.toLowerCase();
      const searchableText = [
        vessel["SN"],
        vessel["Area"],
        vessel["Location"],
        vessel["Name of Vessel"],
        vessel["Vessel Serial Number"],
        vessel["Test Certificate No"],
        vessel["Safe Working Pressure (Mfr)"],
        vessel["Condition"],
        vessel["TPI Observation"]
      ].join(' ').toLowerCase();

      if (!searchableText.includes(searchStr)) return false;
    }

    if (currentVesselFilters.area && String(vessel["Area"]).trim() !== currentVesselFilters.area) return false;
    if (currentVesselFilters.location && String(vessel["Location"]).trim() !== currentVesselFilters.location) return false;
    if (currentVesselFilters.condition && String(vessel["Condition"]).trim() !== currentVesselFilters.condition) return false;
    if (currentVesselFilters.hydroStatus && hydroStatus.statusKey !== currentVesselFilters.hydroStatus) return false;
    if (currentVesselFilters.thicknessStatus && thickStatus.statusKey !== currentVesselFilters.thicknessStatus) return false;

    return true;

  });

  return sortVessels(filtered);

}

function handleVesselTableSort(columnKey) {
  if (currentVesselSortColumn === columnKey) {
    currentVesselSortOrder = currentVesselSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    currentVesselSortColumn = columnKey;
    currentVesselSortOrder = 'asc';
  }
  renderVesselModule();
}

function applyVesselFilters() {

  currentVesselFilters.globalSearch = document.getElementById('vfilter-global-search')?.value.trim() || '';
  currentVesselFilters.area = document.getElementById('vfilter-area')?.value || '';
  currentVesselFilters.location = document.getElementById('vfilter-location')?.value || '';
  currentVesselFilters.hydroStatus = document.getElementById('vfilter-hydro-status')?.value || '';
  currentVesselFilters.thicknessStatus = document.getElementById('vfilter-thickness-status')?.value || '';
  currentVesselFilters.condition = document.getElementById('vfilter-condition')?.value || '';

  updateVesselFilterIndicator();
  renderVesselModule();

}

function resetVesselFilters() {

  currentVesselFilters = { globalSearch: '', area: '', location: '', hydroStatus: '', thicknessStatus: '', condition: '' };

  ['vfilter-global-search', 'vfilter-area', 'vfilter-location', 'vfilter-hydro-status', 'vfilter-thickness-status', 'vfilter-condition']
    .forEach(function(elId) {
      const el = document.getElementById(elId);
      if (el) el.value = '';
    });

  updateVesselFilterIndicator();
  renderVesselModule();

}

function updateVesselFilterIndicator() {
  const indicator = document.getElementById('vfilter-active-indicator');
  if (!indicator) return;

  const activeTerms = [];
  if (currentVesselFilters.globalSearch) activeTerms.push(`Search: "${currentVesselFilters.globalSearch}"`);
  if (currentVesselFilters.area) activeTerms.push(`Area: ${currentVesselFilters.area}`);
  if (currentVesselFilters.location) activeTerms.push(`Location: ${currentVesselFilters.location}`);
  if (currentVesselFilters.hydroStatus) activeTerms.push(`Hydro: ${currentVesselFilters.hydroStatus.toUpperCase()}`);
  if (currentVesselFilters.thicknessStatus) activeTerms.push(`Thickness: ${currentVesselFilters.thicknessStatus.toUpperCase()}`);
  if (currentVesselFilters.condition) activeTerms.push(`Condition: ${currentVesselFilters.condition}`);

  if (activeTerms.length === 0) {
    indicator.innerHTML = 'Showing all pressure vessel records.';
  } else {
    indicator.innerHTML = '⚡ <strong>Active Filters:</strong> ' + activeTerms.join(' | ');
  }
}


/* ============================================================
   VESSEL CHARTS RENDER ENGINE
   ============================================================ */

function renderVesselCharts(filteredVessels) {

  if (typeof Chart === 'undefined') return;

  const textColor = getChartTextColor();
  const gridColor = getChartGridColor();

  const datalabelsConfig = {
    color: '#ffffff',
    font: { weight: 'bold', size: 11 },
    formatter: function(val) { return val > 0 ? val : ''; }
  };

  // 1. HYDRO TEST STATUS DONUT
  let hValid = 0, hDue = 0, hExpired = 0;
  filteredVessels.forEach(v => {
    const st = getHoistStatus(getDaysLeft(v["Hydro Test Due Date"]));
    if (st.statusKey === 'valid') hValid++;
    else if (st.statusKey === 'due') hDue++;
    else if (st.statusKey === 'expired') hExpired++;
  });

  renderChart('chart-vessel-hydro-donut', {
    type: 'doughnut',
    data: {
      labels: ['Valid 🟢', 'Due Soon 🟡', 'Expired 🔴'],
      datasets: [{
        data: [hValid, hDue, hExpired],
        backgroundColor: ['#22c55e', '#eab308', '#ef4444'],
        borderWidth: 2,
        borderColor: 'transparent'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: 'Hydro Test Status', color: textColor, font: { size: 12, weight: 'bold' } },
        legend: { position: 'bottom', labels: { color: textColor, font: { size: 11, weight: 'bold' } } },
        datalabels: datalabelsConfig
      }
    }
  });

  // 2. VESSELS BY AREA
  const areaCounts = {};
  filteredVessels.forEach(v => {
    const a = String(v["Area"] || 'Unassigned').trim() || 'Unassigned';
    areaCounts[a] = (areaCounts[a] || 0) + 1;
  });

  renderChart('chart-vessel-area-bar', {
    type: 'bar',
    data: {
      labels: Object.keys(areaCounts),
      datasets: [{
        label: 'Vessel Count',
        data: Object.values(areaCounts),
        backgroundColor: '#2563eb',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: 'Vessels by Area', color: textColor, font: { size: 12, weight: 'bold' } },
        legend: { display: false },
        datalabels: {
          anchor: 'end',
          align: 'top',
          color: textColor,
          font: { weight: 'bold', size: 11 },
          formatter: function(val) { return val > 0 ? val : ''; }
        }
      },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: { ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor } }
      }
    }
  });

  // 3. CONDITION PIE
  const condCounts = {};
  filteredVessels.forEach(v => {
    const c = String(v["Condition"] || 'Unknown').trim() || 'Unknown';
    condCounts[c] = (condCounts[c] || 0) + 1;
  });

  renderChart('chart-vessel-condition-pie', {
    type: 'pie',
    data: {
      labels: Object.keys(condCounts),
      datasets: [{
        data: Object.values(condCounts),
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#6366f1', '#8b5cf6'],
        borderWidth: 2,
        borderColor: 'transparent'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: 'Vessel Condition', color: textColor, font: { size: 12, weight: 'bold' } },
        legend: { position: 'bottom', labels: { color: textColor, font: { size: 11, weight: 'bold' } } },
        datalabels: datalabelsConfig
      }
    }
  });

  // 4. THICKNESS TEST STATUS
  let tValid = 0, tDue = 0, tExpired = 0;
  filteredVessels.forEach(v => {
    const st = getHoistStatus(getDaysLeft(v["Thickness Test Due Date"]));
    if (st.statusKey === 'valid') tValid++;
    else if (st.statusKey === 'due') tDue++;
    else if (st.statusKey === 'expired') tExpired++;
  });

  renderChart('chart-vessel-thickness-bar', {
    type: 'bar',
    data: {
      labels: ['Valid 🟢', 'Due Soon 🟡', 'Expired 🔴'],
      datasets: [{
        label: 'Thickness Test',
        data: [tValid, tDue, tExpired],
        backgroundColor: ['#22c55e', '#eab308', '#ef4444'],
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: 'Thickness (UT) Test Status', color: textColor, font: { size: 12, weight: 'bold' } },
        legend: { display: false },
        datalabels: {
          anchor: 'end',
          align: 'end',
          color: textColor,
          font: { weight: 'bold', size: 11 },
          formatter: function(val) { return val > 0 ? val : ''; }
        }
      },
      scales: {
        x: { ticks: { color: textColor, stepSize: 1 }, grid: { color: gridColor } },
        y: { ticks: { color: textColor }, grid: { color: gridColor } }
      }
    }
  });

}


/* ============================================================
   BULK SELECTION ENGINE
   ============================================================ */

function toggleSelectAllVessels(masterCheckbox) {
  if (!userState.isAdmin) return;

  const filteredVessels = getFilteredVessels();
  if (masterCheckbox.checked) {
    filteredVessels.forEach(v => {
      const recId = String(v.id || '').trim();
      if (recId) selectedVesselIds.add(recId);
    });
  } else {
    filteredVessels.forEach(v => {
      const recId = String(v.id || '').trim();
      if (recId) selectedVesselIds.delete(recId);
    });
  }
  renderVesselModule();
}

function toggleSingleVesselSelect(recId) {
  if (!userState.isAdmin) return;

  const cleanId = String(recId || '').trim();
  if (!cleanId) return;

  if (selectedVesselIds.has(cleanId)) {
    selectedVesselIds.delete(cleanId);
  } else {
    selectedVesselIds.add(cleanId);
  }
  renderVesselModule();
}

async function deleteSelectedVessels() {
  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }

  const selectedList = Array.from(selectedVesselIds);
  if (selectedList.length === 0) {
    alert('⚠️ Please select at least one record to delete.');
    return;
  }

  if (!confirm(`⚠️ Are you sure you want to permanently delete ${selectedList.length} selected pressure vessel record(s)?`)) {
    return;
  }

  const client = initSupabase();
  if (!client) {
    alert('❌ Supabase client not available.');
    return;
  }

  try {
    const BATCH_SIZE = 100;
    for (let i = 0; i < selectedList.length; i += BATCH_SIZE) {
      const batch = selectedList.slice(i, i + BATCH_SIZE);
      const { error } = await client
        .from('pressure_vessel_records')
        .delete()
        .in('id', batch);

      if (error) {
        alert('❌ Supabase Delete Error: ' + error.message);
        return;
      }
    }

    selectedVesselIds.clear();
    await fetchVesselsFromSupabase();
    alert(`✅ Successfully deleted ${selectedList.length} selected pressure vessel record(s).`);

  } catch (err) {
    alert('❌ Exception during bulk deletion: ' + err.message);
  }
}


/* ============================================================
   VESSEL MODULE RENDER
   ============================================================ */

function renderVesselModule() {

  showScreen('vessel-module-screen');

  const tbody = document.getElementById('vessel-table-body');
  if (!tbody) return;

  const filteredVessels = getFilteredVessels();

  let valid = 0;
  let due = 0;
  let expired = 0;

  const visibleWithId = filteredVessels.filter(v => v.id);
  const selectedVisibleCount = visibleWithId.filter(v => selectedVesselIds.has(String(v.id))).length;

  const topSelectAllContainer = document.getElementById('vessel-top-select-all-container');
  if (topSelectAllContainer) {
    topSelectAllContainer.style.display = userState.isAdmin ? 'inline-flex' : 'none';
  }

  const masterCheckEl = document.getElementById('select-all-vessels-checkbox');
  if (masterCheckEl) {
    if (!userState.isAdmin || visibleWithId.length === 0) {
      masterCheckEl.checked = false;
      masterCheckEl.indeterminate = false;
      masterCheckEl.disabled = !userState.isAdmin;
    } else {
      masterCheckEl.disabled = false;
      if (selectedVisibleCount === visibleWithId.length) {
        masterCheckEl.checked = true;
        masterCheckEl.indeterminate = false;
      } else if (selectedVisibleCount > 0) {
        masterCheckEl.checked = false;
        masterCheckEl.indeterminate = true;
      } else {
        masterCheckEl.checked = false;
        masterCheckEl.indeterminate = false;
      }
    }
  }

  const bulkDeleteBtn = document.getElementById('btn-vessel-bulk-delete');
  if (bulkDeleteBtn) {
    if (userState.isAdmin) {
      bulkDeleteBtn.style.display = 'inline-block';
      const count = selectedVesselIds.size;
      bulkDeleteBtn.innerText = `🗑️ Delete Selected (${count})`;
      bulkDeleteBtn.disabled = (count === 0);
    } else {
      bulkDeleteBtn.style.display = 'none';
    }
  }

  tbody.innerHTML = filteredVessels.map(function(vessel) {

    const hydroDays = getDaysLeft(vessel["Hydro Test Due Date"]);
    const hydroStatus = getHoistStatus(hydroDays);

    const thickDays = getDaysLeft(vessel["Thickness Test Due Date"]);
    const thickStatus = getHoistStatus(thickDays);

    // Auto-calculated reminder / expired flags (mirrors the Excel formulas)
    vessel["Hydro Expiry Reminder"] = (hydroDays !== null && hydroDays < 35) ? "Expiry Reminder" : "";
    vessel["Hydro Expired"] = (hydroDays !== null && hydroDays <= 0) ? "Expired" : "";
    vessel["Thickness Expiry Reminder"] = (thickDays !== null && thickDays < 35) ? "Expiry Reminder" : "";
    vessel["Thickness Expired"] = (thickDays !== null && thickDays <= 0) ? "Expired" : "";

    const overall = getVesselOverallStatus(vessel);
    if (overall.statusKey === 'valid') valid++;
    else if (overall.statusKey === 'due') due++;
    else if (overall.statusKey === 'expired') expired++;

    let actionHTML = '';
    if (userState.isAdmin) {
      actionHTML = '<button type="button" class="stlp-btn-sm" onclick="editVessel(\'' + vessel.id + '\')">Edit</button>';
    } else {
      actionHTML = '<span style="color:#94a3b8; font-size:0.75rem;">View Only</span>';
    }

    const recId = String(vessel.id || '').trim();
    const isChecked = selectedVesselIds.has(recId) ? 'checked' : '';
    const safeIdForJs = recId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const checkboxHTML = userState.isAdmin ? `<input type="checkbox" ${isChecked} onchange="toggleSingleVesselSelect('${safeIdForJs}')" />` : '-';

    const reminderBadge = (txt) => txt
      ? `<span class="badge-status badge-due-30">${escapeHTML(txt)}</span>`
      : '';
    const expiredBadge = (txt) => txt
      ? `<span class="badge-status badge-expired">${escapeHTML(txt)}</span>`
      : '';

    return `
      <tr>
        <td style="text-align:center;">${checkboxHTML}</td>
        <td><strong>${escapeHTML(vessel["SN"])}</strong></td>
        <td>${escapeHTML(vessel["Area"])}</td>
        <td>${escapeHTML(vessel["Location"])}</td>
        <td><strong>${escapeHTML(vessel["Name of Vessel"])}</strong></td>
        <td><code class="tag-nom">${escapeHTML(vessel["Vessel Serial Number"])}</code></td>
        <td>${escapeHTML(vessel["Safe Working Pressure (Mfr)"])}</td>
        <td>${escapeHTML(vessel["Test Certificate No"])}</td>
        <td>${escapeHTML(vessel["Last Hydro Test Date"])}</td>
        <td>${escapeHTML(vessel["Present Hydro Test Done"])}</td>
        <td>
          ${escapeHTML(vessel["Hydro Test Due Date"])}
          <br>
          <span class="badge-status ${hydroStatus.className}">
            ${hydroStatus.label}
            ${hydroDays !== null ? `(${hydroDays}d)` : ''}
          </span>
        </td>
        <td>${reminderBadge(vessel["Hydro Expiry Reminder"])}</td>
        <td>${expiredBadge(vessel["Hydro Expired"])}</td>
        <td>${escapeHTML(vessel["Last Thickness Test Date"])}</td>
        <td>
          ${escapeHTML(vessel["Thickness Test Due Date"])}
          <br>
          <span class="badge-status ${thickStatus.className}">
            ${thickStatus.label}
            ${thickDays !== null ? `(${thickDays}d)` : ''}
          </span>
        </td>
        <td>${reminderBadge(vessel["Thickness Expiry Reminder"])}</td>
        <td>${expiredBadge(vessel["Thickness Expired"])}</td>
        <td>${escapeHTML(vessel["Constructed Shell"])}</td>
        <td>${escapeHTML(vessel["Constructed Dish"])}</td>
        <td>${escapeHTML(vessel["Min Allowable Shell"])}</td>
        <td>${escapeHTML(vessel["Min Allowable Dish"])}</td>
        <td>${escapeHTML(vessel["Measured Shell"])}</td>
        <td>${escapeHTML(vessel["Measured Dish"])}</td>
        <td>${escapeHTML(vessel["Calculated SWP"])}</td>
        <td>${escapeHTML(vessel["Condition"])}</td>
        <td>${escapeHTML(vessel["TPI Observation"])}</td>
        <td>${actionHTML}</td>
      </tr>
    `;
  }).join('');

  const totalElement = document.getElementById('stat-vessel-total');
  const validElement = document.getElementById('stat-vessel-valid');
  const dueElement = document.getElementById('stat-vessel-due');
  const expiredElement = document.getElementById('stat-vessel-expired');

  if (totalElement) totalElement.innerText = filteredVessels.length;
  if (validElement) validElement.innerText = valid;
  if (dueElement) dueElement.innerText = due;
  if (expiredElement) expiredElement.innerText = expired;

  renderVesselCharts(filteredVessels);

}


/* ============================================================
   ADD & EDIT VESSEL MODAL
   ============================================================ */

function openAddVesselModal() {
  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }
  const form = document.getElementById('vessel-form');
  if (form) form.reset();

  const editIdInput = document.getElementById('v-editing-id');
  if (editIdInput) editIdInput.value = '';

  const modalTitle = document.getElementById('vessel-modal-title-text');
  if (modalTitle) modalTitle.innerText = 'Add New Pressure Vessel Record';

  const modal = document.getElementById('vessel-modal');
  if (modal) modal.classList.remove('hidden-screen');
}

function editVessel(id) {
  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }

  const vessel = dbData.vessels.find(item => String(item.id) === String(id));
  if (!vessel) {
    alert('❌ Pressure vessel record not found.');
    return;
  }

  const editIdInput = document.getElementById('v-editing-id');
  if (editIdInput) editIdInput.value = vessel.id;

  const setValue = (inputId, val) => {
    const el = document.getElementById(inputId);
    if (el) el.value = val !== undefined && val !== null ? String(val) : '';
  };

  const convertToInputDate = (str) => {
    const d = parseCustomDate(str);
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  setValue('v-area', vessel["Area"]);
  setValue('v-loc', vessel["Location"]);
  setValue('v-name', vessel["Name of Vessel"]);
  setValue('v-serial', vessel["Vessel Serial Number"]);
  setValue('v-swp', vessel["Safe Working Pressure (Mfr)"]);
  setValue('v-cert', vessel["Test Certificate No"]);
  setValue('v-last-hydro', convertToInputDate(vessel["Last Hydro Test Date"]));
  setValue('v-present-hydro', convertToInputDate(vessel["Present Hydro Test Done"]));
  setValue('v-hydro-due', convertToInputDate(vessel["Hydro Test Due Date"]));
  setValue('v-last-thick', convertToInputDate(vessel["Last Thickness Test Date"]));
  setValue('v-thick-due', convertToInputDate(vessel["Thickness Test Due Date"]));
  setValue('v-con-shell', vessel["Constructed Shell"]);
  setValue('v-con-dish', vessel["Constructed Dish"]);
  setValue('v-min-shell', vessel["Min Allowable Shell"]);
  setValue('v-min-dish', vessel["Min Allowable Dish"]);
  setValue('v-mes-shell', vessel["Measured Shell"]);
  setValue('v-mes-dish', vessel["Measured Dish"]);
  setValue('v-calc-swp', vessel["Calculated SWP"]);
  setValue('v-condition', vessel["Condition"]);
  setValue('v-tpi-obs', vessel["TPI Observation"]);

  const modalTitle = document.getElementById('vessel-modal-title-text');
  if (modalTitle) modalTitle.innerText = 'Edit Pressure Vessel (' + (vessel["Vessel Serial Number"] || vessel["Name of Vessel"]) + ')';

  const modal = document.getElementById('vessel-modal');
  if (modal) modal.classList.remove('hidden-screen');
}

function closeVesselModal() {
  const modal = document.getElementById('vessel-modal');
  if (modal) modal.classList.add('hidden-screen');
}


/* ============================================================
   SAVE VESSEL RECORD (WRITE DIRECTLY TO SUPABASE)
   ============================================================ */

async function saveVesselRecord(e) {

  e.preventDefault();

  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }

  const client = initSupabase();
  if (!client) {
    alert('❌ Supabase client is not available.');
    return;
  }

  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };

  const editingId = getVal('v-editing-id');
  const area = getVal('v-area');
  const location = getVal('v-loc');
  const vesselName = getVal('v-name');
  const serialNo = getVal('v-serial');
  const rawHydroDue = getVal('v-hydro-due');
  const rawThickDue = getVal('v-thick-due');

  if (!area || !location || !vesselName || !serialNo || !rawHydroDue || !rawThickDue) {
    alert('❌ Please fill in all required fields (Area, Location, Name of Vessel, Serial Number, Hydro Due Date, Thickness Due Date).');
    return;
  }

  const formatToDDMMYYYY = (dateStr) => {
    if (!dateStr) return '';
    const d = parseCustomDate(dateStr);
    if (!d) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const hydroDue = formatToDDMMYYYY(rawHydroDue);
  const thickDue = formatToDDMMYYYY(rawThickDue);

  const hydroDays = getDaysLeft(hydroDue);
  const thickDays = getDaysLeft(thickDue);

  const vesselObj = {
    "SN": editingId
      ? (dbData.vessels.find(v => String(v.id) === String(editingId))?.["SN"] || '1')
      : String(dbData.vessels.length + 1),
    "Area": area,
    "Location": location,
    "Name of Vessel": vesselName,
    "Vessel Serial Number": serialNo,
    "Safe Working Pressure (Mfr)": getVal('v-swp'),
    "Test Certificate No": getVal('v-cert'),
    "Last Hydro Test Date": formatToDDMMYYYY(getVal('v-last-hydro')),
    "Present Hydro Test Done": formatToDDMMYYYY(getVal('v-present-hydro')),
    "Hydro Test Due Date": hydroDue,
    "Hydro Expiry Reminder": (hydroDays !== null && hydroDays < 35) ? "Expiry Reminder" : "",
    "Hydro Expired": (hydroDays !== null && hydroDays <= 0) ? "Expired" : "",
    "Last Thickness Test Date": formatToDDMMYYYY(getVal('v-last-thick')),
    "Thickness Test Due Date": thickDue,
    "Thickness Expiry Reminder": (thickDays !== null && thickDays < 35) ? "Expiry Reminder" : "",
    "Thickness Expired": (thickDays !== null && thickDays <= 0) ? "Expired" : "",
    "Constructed Shell": getVal('v-con-shell'),
    "Constructed Dish": getVal('v-con-dish'),
    "Min Allowable Shell": getVal('v-min-shell'),
    "Min Allowable Dish": getVal('v-min-dish'),
    "Measured Shell": getVal('v-mes-shell'),
    "Measured Dish": getVal('v-mes-dish'),
    "Calculated SWP": getVal('v-calc-swp'),
    "Condition": getVal('v-condition'),
    "TPI Observation": getVal('v-tpi-obs')
  };

  const supabaseRow = mapVesselToSupabase(vesselObj);

  try {

    if (editingId) {
      const targetRecord = dbData.vessels.find(v => String(v.id) === String(editingId));
      const targetSerial = targetRecord
        ? String(targetRecord["Vessel Serial Number"]).trim().toUpperCase()
        : supabaseRow.vessel_serial_no;

      const { error } = await client
        .from('pressure_vessel_records')
        .update(supabaseRow)
        .eq('vessel_serial_no', targetSerial);

      if (error) {
        alert('❌ Supabase Update Error: ' + error.message);
        return;
      }
    } else {
      const { error } = await client
        .from('pressure_vessel_records')
        .upsert([supabaseRow], { onConflict: 'vessel_serial_no' });

      if (error) {
        alert('❌ Supabase Insert Error: ' + error.message);
        return;
      }
    }

    closeVesselModal();
    await fetchVesselsFromSupabase();
    alert('✅ Pressure vessel record saved permanently to Supabase.');

  } catch (err) {
    alert('❌ Exception during save: ' + err.message);
  }

}


/* ============================================================
   VESSEL EXCEL EXPORT ENGINE
   ============================================================ */

function exportVesselExcel() {

  if (typeof XLSX === 'undefined') {
    alert('❌ SheetJS library is loading. Please try again in a moment.');
    return;
  }

  const recordsToExport = getFilteredVessels();

  if (!recordsToExport || recordsToExport.length === 0) {
    alert('❌ No pressure vessel records available to export.');
    return;
  }

  const exportData = recordsToExport.map(function(v) {
    const rowObj = {};
    VESSEL_MASTER_FIELDS.forEach(function(field) {
      rowObj[field] = v[field] !== undefined && v[field] !== null ? String(v[field]) : '';
    });
    return rowObj;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData, { header: VESSEL_MASTER_FIELDS });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "PRESSURE_VESSELS");

  const todayObj = new Date();
  const day = String(todayObj.getDate()).padStart(2, '0');
  const month = String(todayObj.getMonth() + 1).padStart(2, '0');
  const year = todayObj.getFullYear();
  const todayStr = `${day}-${month}-${year}`;

  XLSX.writeFile(workbook, 'Pressure_Vessel_Records_' + todayStr + '.xlsx');

}


/* ============================================================
   VESSEL EXCEL IMPORT ENGINE
   ============================================================ */

function triggerVesselExcelImport() {
  if (!userState.isAdmin) {
    alert('❌ Admin access required to import records.');
    return;
  }

  const fileInput = document.getElementById('vessel-excel-file');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
}

function normalizeVesselHeader(rawHeader) {
  if (!rawHeader) return '';
  const clean = String(rawHeader).trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  if (clean === 'sn' || clean === 'srno' || clean === 'sno' || clean === 'slno' || clean === 'sr') return 'SN';
  if (clean === 'area' || clean.includes('plantarea')) return 'Area';
  if (clean === 'location' || clean.includes('plantlocation')) return 'Location';
  if (clean.includes('nameofvessel') || clean.includes('natureofprocess') || clean.includes('vesselname')) return 'Name of Vessel';
  if (clean.includes('vesselserial') || clean.includes('serialnumber') || clean.includes('serialno')) return 'Vessel Serial Number';
  if (clean.includes('recommendedbymanufacturer') || clean.includes('safeworkingpressurerecommended')) return 'Safe Working Pressure (Mfr)';
  if (clean.includes('testcertificate') || clean.includes('certificateno') || clean.includes('certno')) return 'Test Certificate No';
  if (clean.includes('lasthydro')) return 'Last Hydro Test Date';
  if (clean.includes('presenthydro')) return 'Present Hydro Test Done';
  if (clean.includes('hydrotestdue') || clean.includes('hydroduedate')) return 'Hydro Test Due Date';
  if (clean.includes('lastthikness') || clean.includes('lastthickness')) return 'Last Thickness Test Date';
  if (clean.includes('thicknesstestdue') || clean.includes('thicknessduedate')) return 'Thickness Test Due Date';
  if (clean.includes('asconstructed') || clean.includes('vesselthicknessasconstructed')) return 'Constructed Shell';
  if (clean.includes('minimumallowable')) return 'Min Allowable Shell';
  if (clean.includes('asmeasured') || clean.includes('ultrasonitest') || clean.includes('ultrasonictest')) return 'Measured Shell';
  if (clean.includes('calculatedsafeworkingpressure') || clean.includes('calculatedswp')) return 'Calculated SWP';
  if (clean.includes('goodcondition') || clean === 'condition') return 'Condition';
  if (clean.includes('tpiobservation') || clean.includes('observation')) return 'TPI Observation';
  if (clean.includes('expiryreminder') || clean.includes('reminder')) return 'Expiry Reminder';
  if (clean.includes('expired')) return 'Expired';

  return String(rawHeader).trim();
}

function handleVesselExcelImport(e) {

  if (!userState.isAdmin) {
    alert('❌ Admin access required to import records.');
    return;
  }

  if (typeof XLSX === 'undefined') {
    alert('❌ SheetJS library is loading. Please try again.');
    return;
  }

  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = async function(evt) {

    try {

      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellNF: false, cellText: false });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        alert('❌ Selected Excel file contains no worksheets.');
        return;
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      // Read as raw arrays so the merged Shell/Dish header pairs can be split by position
      const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: true, blankrows: false });

      if (!matrix || matrix.length < 2) {
        alert('❌ No data rows found in Excel sheet.');
        return;
      }

      const headerRow = matrix[0].map(h => normalizeVesselHeader(h));
      const bodyRows = matrix.slice(1).filter(r => r.some(c => c !== "" && c !== null && c !== undefined));

      // Resolve the paired Shell / Dish columns (merged headers in the master file)
      const pairBase = {
        'Constructed Shell': ['Constructed Shell', 'Constructed Dish'],
        'Min Allowable Shell': ['Min Allowable Shell', 'Min Allowable Dish'],
        'Measured Shell': ['Measured Shell', 'Measured Dish']
      };

      const colMap = {};
      let reminderSeen = 0;
      let expiredSeen = 0;

      headerRow.forEach(function(name, idx) {
        if (!name) return;

        if (pairBase[name]) {
          const pair = pairBase[name];
          if (colMap[pair[0]] === undefined) colMap[pair[0]] = idx;
          else if (colMap[pair[1]] === undefined) colMap[pair[1]] = idx;
          return;
        }

        // The sheet has two "Expiry Reminder" and two "Expired" columns:
        // the first pair belongs to Hydro, the second to Thickness.
        if (name === 'Expiry Reminder') {
          colMap[reminderSeen === 0 ? 'Hydro Expiry Reminder' : 'Thickness Expiry Reminder'] = idx;
          reminderSeen++;
          return;
        }
        if (name === 'Expired') {
          colMap[expiredSeen === 0 ? 'Hydro Expired' : 'Thickness Expired'] = idx;
          expiredSeen++;
          return;
        }

        if (colMap[name] === undefined) colMap[name] = idx;
      });

      // Handle the unmerged second half of each pair (blank header cell right after)
      Object.keys(pairBase).forEach(function(shellKey) {
        const dishKey = pairBase[shellKey][1];
        if (colMap[shellKey] !== undefined && colMap[dishKey] === undefined) {
          colMap[dishKey] = colMap[shellKey] + 1;
        }
      });

      const cellAt = (row, key) => {
        const idx = colMap[key];
        if (idx === undefined) return '';
        const val = row[idx];
        return val === null || val === undefined ? '' : val;
      };

      const client = initSupabase();
      if (!client) {
        alert('❌ Supabase client is not available.');
        return;
      }

      const existingSerialSet = new Set(
        dbData.vessels.map(v => String(v["Vessel Serial Number"]).trim().toUpperCase())
      );

      let autoGeneratedCount = 0;
      let newRecordsCount = 0;
      let updatedRecordsCount = 0;

      const recordsToUpsert = [];
      const processedInFile = new Set();

      bodyRows.forEach(function(row, index) {

        let rawSerial = String(cellAt(row, 'Vessel Serial Number') || '').trim();

        if (!rawSerial) {
          rawSerial = 'TSPL/PV-AUTO-' + (index + 1) + '-' + Date.now().toString().slice(-4);
          autoGeneratedCount++;
        }

        let serialKey = rawSerial.toUpperCase();

        if (processedInFile.has(serialKey)) {
          rawSerial = rawSerial + '-DUP-' + (index + 1);
          serialKey = rawSerial.toUpperCase();
        }
        processedInFile.add(serialKey);

        if (existingSerialSet.has(serialKey)) {
          updatedRecordsCount++;
        } else {
          newRecordsCount++;
        }

        const hydroDue = formatExcelDate(cellAt(row, 'Hydro Test Due Date'));
        const thickDue = formatExcelDate(cellAt(row, 'Thickness Test Due Date'));

        const hydroDays = getDaysLeft(hydroDue);
        const thickDays = getDaysLeft(thickDue);

        const asText = (key) => String(cellAt(row, key) || '').trim();

        const vesselObj = {
          "SN": asText('SN') || String(index + 1),
          "Area": asText('Area') || 'BOP',
          "Location": asText('Location') || 'Main Plant',
          "Name of Vessel": asText('Name of Vessel') || 'Pressure Vessel',
          "Vessel Serial Number": rawSerial,
          "Safe Working Pressure (Mfr)": asText('Safe Working Pressure (Mfr)'),
          "Test Certificate No": asText('Test Certificate No'),
          "Last Hydro Test Date": formatExcelDate(cellAt(row, 'Last Hydro Test Date')),
          "Present Hydro Test Done": formatExcelDate(cellAt(row, 'Present Hydro Test Done')),
          "Hydro Test Due Date": hydroDue,
          "Hydro Expiry Reminder": (hydroDays !== null && hydroDays < 35) ? "Expiry Reminder" : "",
          "Hydro Expired": (hydroDays !== null && hydroDays <= 0) ? "Expired" : "",
          "Last Thickness Test Date": formatExcelDate(cellAt(row, 'Last Thickness Test Date')),
          "Thickness Test Due Date": thickDue,
          "Thickness Expiry Reminder": (thickDays !== null && thickDays < 35) ? "Expiry Reminder" : "",
          "Thickness Expired": (thickDays !== null && thickDays <= 0) ? "Expired" : "",
          "Constructed Shell": asText('Constructed Shell'),
          "Constructed Dish": asText('Constructed Dish'),
          "Min Allowable Shell": asText('Min Allowable Shell'),
          "Min Allowable Dish": asText('Min Allowable Dish'),
          "Measured Shell": asText('Measured Shell'),
          "Measured Dish": asText('Measured Dish'),
          "Calculated SWP": asText('Calculated SWP'),
          "Condition": asText('Condition') || 'Good Condition',
          "TPI Observation": asText('TPI Observation')
        };

        recordsToUpsert.push(mapVesselToSupabase(vesselObj));
      });

      const BATCH_SIZE = 100;
      for (let i = 0; i < recordsToUpsert.length; i += BATCH_SIZE) {
        const batch = recordsToUpsert.slice(i, i + BATCH_SIZE);

        const { error } = await client
          .from('pressure_vessel_records')
          .upsert(batch, { onConflict: 'vessel_serial_no' });

        if (error) {
          alert(`❌ Import stopped at Batch ${Math.floor(i / BATCH_SIZE) + 1} due to Error:\n${error.message}`);
          return;
        }
      }

      await fetchVesselsFromSupabase();

      const summaryMsg =
        `📊 Pressure Vessel Import Complete Summary\n` +
        `===================================\n` +
        `🟢 New Records: ${newRecordsCount}\n` +
        `🔵 Updated Records: ${updatedRecordsCount}\n` +
        `🏷️ Auto-Generated Serial Numbers: ${autoGeneratedCount}\n` +
        `🟡 Skipped Rows: 0\n` +
        `-----------------------------------\n` +
        `📋 Total Records Processed: ${bodyRows.length}\n` +
        `📦 Total Pressure Vessels in Portal: ${dbData.vessels.length}`;

      alert(summaryMsg);

    } catch (err) {
      console.error("Vessel import error:", err);
      alert('❌ Failed to process Excel file. Please ensure it is a valid .xlsx file.');
    }

  };

  reader.readAsArrayBuffer(file);

}
