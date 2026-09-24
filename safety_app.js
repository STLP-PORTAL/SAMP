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
let selectedInstrumentIds = new Set();
let currentSortColumn = null;
let currentSortOrder = 'asc';
let currentInstrumentSortColumn = null;
let currentInstrumentSortOrder = 'asc';


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

  instruments: [],

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
    'vessel-module-screen',
    'ppe-module-screen',
    'instruments-module-screen',
    'jfc-module-screen'
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

  // "Layout" (Aurora/Neumorph) re-skins the login card AND the Dashboard
  // (2nd) screen — show the header control on either of those only.
  const layoutWrapper = document.querySelector('.layout-switcher-wrapper');
  if (layoutWrapper) {
    if (id === 'stlp-auth-screen' || id === 'safety-dashboard-screen') {
      layoutWrapper.classList.remove('hidden-screen');
    } else {
      layoutWrapper.classList.add('hidden-screen');
    }
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
  await fetchPPEDataFromSupabase();
  await fetchInstrumentsFromSupabase();
  await fetchJfcFromSupabase();

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


/* ============================================================
   ============================================================
   PPE ISSUE MANAGEMENT + EMPLOYEE MASTER MODULE  (NEW — ADDITIVE)
   Independent of Hoist / Pressure Vessel data.
   Supabase Tables: ppe_employees (unique key: gate_pass_no)
                    ppe_records   (never updated — history only)
   ============================================================
   ============================================================ */

/* ------------------------------------------------------------
   PPE STATE (independent arrays — does NOT touch dbData.hoists /
   dbData.vessels / dbData.vehicles / dbData.tools)
   ------------------------------------------------------------ */

let ppeEmployeeData = [];
let ppeRecords = [];

const PPE_CONTRACTOR_NAME = "Power Mech Projects Limited";

const PPE_EMPLOYEE_MASTER_FIELDS = [
  "Gate Pass No.",
  "Employee Name",
  "Department",
  "Designation",
  "Joining Date",
  "Contractor"
];

const PPE_ITEM_LABELS = [
  { key: "Jacket Size",         item: "Safety Jacket" },
  { key: "Helmet Colour",       item: "Safety Helmet" },
  { key: "Goggle Type",         item: "Safety Goggle" },
  { key: "Shoe Size",           item: "Safety Shoe" },
  { key: "Electrical Shoe Size", item: "Electrical Safety Shoe" },
  { key: "Ear Plug",            item: "Ear Plug" },
  { key: "Nose Mask",           item: "Nose Mask" },
  { key: "Gloves Category",     item: "Hand Gloves" }
];

/* Checkbox/dropdown item registry used by the Add PPE Issue form (NEW, ADDITIVE) */
const PPE_ISSUE_ITEM_FIELDS = [
  { key: "jacket",   dataKey: "Jacket Size",           qtyDataKey: "Jacket Qty" },
  { key: "helmet",   dataKey: "Helmet Colour",         qtyDataKey: "Helmet Qty" },
  { key: "goggle",   dataKey: "Goggle Type",           qtyDataKey: "Goggle Qty" },
  { key: "shoe",     dataKey: "Shoe Size",             qtyDataKey: "Shoe Qty" },
  { key: "elecshoe", dataKey: "Electrical Shoe Size",  qtyDataKey: "Electrical Shoe Qty" },
  { key: "earplug",  dataKey: "Ear Plug",              qtyDataKey: "Ear Plug Qty" },
  { key: "nosemask", dataKey: "Nose Mask",             qtyDataKey: "Nose Mask Qty" },
  { key: "gloves",   dataKey: "Gloves Category",       qtyDataKey: "Gloves Qty" }
];


/* ------------------------------------------------------------
   SUPABASE MAPPING HELPERS — EMPLOYEE MASTER
   ------------------------------------------------------------ */

function mapPPEEmployeeFromSupabase(item) {
  return {
    id: String(item.id || ''),
    "Gate Pass No.": String(item.gate_pass_no || item["Gate Pass No."] || ''),
    "Employee Name": item.employee_name || item["Employee Name"] || '',
    "Department": item.department || item["Department"] || '',
    "Designation": item.designation || item["Designation"] || '',
    "Joining Date": item.joining_date || item["Joining Date"] || '',
    "Contractor": item.contractor || PPE_CONTRACTOR_NAME
  };
}

function mapPPEEmployeeToSupabase(emp) {
  return {
    gate_pass_no: String(emp["Gate Pass No."] || '').trim(),
    employee_name: String(emp["Employee Name"] || '').trim(),
    department: String(emp["Department"] || '').trim(),
    designation: String(emp["Designation"] || '').trim(),
    joining_date: String(emp["Joining Date"] || '').trim(),
    contractor: PPE_CONTRACTOR_NAME
  };
}


/* ------------------------------------------------------------
   SUPABASE MAPPING HELPERS — PPE ISSUE RECORDS
   ------------------------------------------------------------ */

function mapPPERecordFromSupabase(item) {
  return {
    id: String(item.id || ''),
    "Gate Pass No.": String(item.gate_pass_no || item["Gate Pass No."] || ''),
    "Employee Name": item.employee_name || item["Employee Name"] || '',
    "Issue Date": item.issue_date || item["Issue Date"] || '',
    "Jacket Size": item.jacket_size || item["Jacket Size"] || '',
    "Jacket Qty": item.jacket_qty || item["Jacket Qty"] || '',
    "Helmet Colour": item.helmet_colour || item["Helmet Colour"] || '',
    "Helmet Qty": item.helmet_qty || item["Helmet Qty"] || '',
    "Goggle Type": item.goggle_type || item["Goggle Type"] || '',
    "Goggle Qty": item.goggle_qty || item["Goggle Qty"] || '',
    "Shoe Size": item.shoe_size || item["Shoe Size"] || '',
    "Shoe Qty": item.shoe_qty || item["Shoe Qty"] || '',
    "Electrical Shoe Size": item.electrical_shoe_size || item["Electrical Shoe Size"] || '',
    "Electrical Shoe Qty": item.electrical_shoe_qty || item["Electrical Shoe Qty"] || '',
    "Ear Plug": item.ear_plug || item["Ear Plug"] || '',
    "Ear Plug Qty": item.earplug_qty || item["Ear Plug Qty"] || '',
    "Nose Mask": item.nose_mask || item["Nose Mask"] || '',
    "Nose Mask Qty": item.nosemask_qty || item["Nose Mask Qty"] || '',
    "Gloves Category": item.gloves_category || item["Gloves Category"] || '',
    "Gloves Qty": item.gloves_qty || item["Gloves Qty"] || '',
    "Remarks": item.remarks || item["Remarks"] || ''
  };
}

function mapPPERecordToSupabase(rec) {
  return {
    gate_pass_no: String(rec["Gate Pass No."] || '').trim(),
    employee_name: String(rec["Employee Name"] || '').trim(),
    issue_date: String(rec["Issue Date"] || '').trim(),
    jacket_size: String(rec["Jacket Size"] || '').trim(),
    jacket_qty: rec["Jacket Qty"] ? parseInt(rec["Jacket Qty"], 10) : null,
    helmet_colour: String(rec["Helmet Colour"] || '').trim(),
    helmet_qty: rec["Helmet Qty"] ? parseInt(rec["Helmet Qty"], 10) : null,
    goggle_type: String(rec["Goggle Type"] || '').trim(),
    goggle_qty: rec["Goggle Qty"] ? parseInt(rec["Goggle Qty"], 10) : null,
    shoe_size: String(rec["Shoe Size"] || '').trim(),
    shoe_qty: rec["Shoe Qty"] ? parseInt(rec["Shoe Qty"], 10) : null,
    electrical_shoe_size: String(rec["Electrical Shoe Size"] || '').trim(),
    electrical_shoe_qty: rec["Electrical Shoe Qty"] ? parseInt(rec["Electrical Shoe Qty"], 10) : null,
    ear_plug: String(rec["Ear Plug"] || '').trim(),
    earplug_qty: rec["Ear Plug Qty"] ? parseInt(rec["Ear Plug Qty"], 10) : null,
    nose_mask: String(rec["Nose Mask"] || '').trim(),
    nosemask_qty: rec["Nose Mask Qty"] ? parseInt(rec["Nose Mask Qty"], 10) : null,
    gloves_category: String(rec["Gloves Category"] || '').trim(),
    gloves_qty: rec["Gloves Qty"] ? parseInt(rec["Gloves Qty"], 10) : null,
    remarks: String(rec["Remarks"] || '').trim()
  };
}


/* ------------------------------------------------------------
   DATE HELPERS (local to PPE module — reuse global parseCustomDate)
   ------------------------------------------------------------ */

function ppeFormatToDMY(dateStr) {
  const d = parseCustomDate(dateStr);
  if (!d) return dateStr || '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function ppeConvertToInputDate(str) {
  const d = parseCustomDate(str);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}


/* ------------------------------------------------------------
   FETCH FROM SUPABASE
   ------------------------------------------------------------ */

async function fetchPPEEmployeesFromSupabase() {
  const client = initSupabase();
  if (!client) {
    console.warn("Supabase client is not available (PPE Employee Master).");
    return;
  }
  try {
    const { data, error } = await client.from('ppe_employees').select('*');
    if (error) {
      console.error("Supabase fetch error (ppe_employees):", error);
      return;
    }
    if (data) {
      ppeEmployeeData = data.map(mapPPEEmployeeFromSupabase);
    }
  } catch (err) {
    console.error("Failed to fetch ppe_employees from Supabase:", err);
  }
}

async function fetchPPERecordsFromSupabase() {
  const client = initSupabase();
  if (!client) {
    console.warn("Supabase client is not available (PPE Records).");
    return;
  }
  try {
    const { data, error } = await client.from('ppe_records').select('*');
    if (error) {
      console.error("Supabase fetch error (ppe_records):", error);
      return;
    }
    if (data) {
      ppeRecords = data.map(mapPPERecordFromSupabase);
    }
  } catch (err) {
    console.error("Failed to fetch ppe_records from Supabase:", err);
  }
}

async function fetchPPEDataFromSupabase() {
  await fetchPPEEmployeesFromSupabase();
  await fetchPPERecordsFromSupabase();

  const ppeScreen = document.getElementById('ppe-module-screen');
  if (ppeScreen && !ppeScreen.classList.contains('hidden-screen')) {
    renderPPEModule(true);
  }
}


/* ------------------------------------------------------------
   MODULE RENDER
   ------------------------------------------------------------ */

let ppeEmployeeSearchTerm = '';

function renderPPEModule(skipScreenSwitch) {
  if (!skipScreenSwitch) showScreen('ppe-module-screen');

  // Guest sees ONLY the "Employee PPE History" search/view.
  // Employee Master + PPE Issue Records panels are fully hidden (not just disabled) for Guest.
  // NOTE: must toggle the 'hidden-screen' class (not just inline style) because
  // 'hidden-screen' uses display:none !important, which would otherwise
  // override a plain inline style.display change.
  const adminPanels = document.getElementById('ppe-admin-panels');
  if (adminPanels) {
    if (userState.isAdmin) {
      adminPanels.classList.remove('hidden-screen');
    } else {
      adminPanels.classList.add('hidden-screen');
    }
  }

  const statsBar = document.getElementById('ppe-stats-bar');
  if (statsBar) {
    if (userState.isAdmin) {
      statsBar.classList.remove('hidden-screen');
    } else {
      statsBar.classList.add('hidden-screen');
    }
  }

  renderPPEEmployeeTable();
  renderPPEIssueTable();
  updatePPEStats();
}

function updatePPEStats() {
  const totalEmpEl = document.getElementById('stat-ppe-employees');
  const totalRecEl = document.getElementById('stat-ppe-records');
  if (totalEmpEl) totalEmpEl.innerText = ppeEmployeeData.length;
  if (totalRecEl) totalRecEl.innerText = ppeRecords.length;

  // NEW (additive, display-only): Today's Issues KPI for the redesigned PPE dashboard.
  const todayEl = document.getElementById('stat-ppe-today');
  if (todayEl) {
    const now = new Date();
    const todayCount = ppeRecords.filter(function(rec) {
      const d = parseCustomDate(rec["Issue Date"]);
      return d && d.getFullYear() === now.getFullYear() &&
             d.getMonth() === now.getMonth() &&
             d.getDate() === now.getDate();
    }).length;
    todayEl.innerText = todayCount;
  }

  renderPPERecentIssuesPreview();
  renderPPEItemsOverviewChart();
}

/* ------------------------------------------------------------
   NEW (additive, display-only): "Recent PPE Issues" preview
   table for the redesigned dashboard. Reads the SAME ppeRecords
   array used by renderPPEIssueTable() — no new data source,
   no change to existing data/functions. Falls back to a no-op
   if the new markup isn't present.
   ------------------------------------------------------------ */
function renderPPERecentIssuesPreview() {
  const tbody = document.getElementById('ppe-recent-issues-tbody');
  if (!tbody) return;

  const sorted = ppeRecords.slice().sort(function(a, b) {
    const da = parseCustomDate(a["Issue Date"]);
    const db = parseCustomDate(b["Issue Date"]);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return db.getTime() - da.getTime();
  }).slice(0, 5);

  if (sorted.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No PPE issue records yet.</td></tr>';
    return;
  }

  tbody.innerHTML = sorted.map(function(rec) {
    const badges = PPE_ITEM_LABELS
      .filter(function(def) { return String(rec[def.key] || '').trim() !== ''; })
      .map(function(def) { return '<span class="ppe-item-badge">' + escapeHTML(def.item) + '</span>'; })
      .join('');

    const delBtn = userState.isAdmin
      ? `<button type="button" class="stlp-btn-sm" style="background:var(--safety-red,#ef4444);" onclick="deletePPERecord('${rec.id}')">🗑️</button>`
      : '';

    return `
      <tr>
        <td>${escapeHTML(rec["Gate Pass No."])}</td>
        <td>${escapeHTML(rec["Employee Name"])}</td>
        <td>${escapeHTML(rec["Issue Date"])}</td>
        <td>${badges || '<span style="color:var(--text-muted);">—</span>'}</td>
        <td>${delBtn}</td>
      </tr>
    `;
  }).join('');
}

/* ------------------------------------------------------------
   NEW (additive, display-only): "PPE Items Overview" donut chart
   for the redesigned dashboard. Purely a visual summary computed
   from the existing ppeRecords array — writes nothing back,
   invents no data.
   ------------------------------------------------------------ */
function renderPPEItemsOverviewChart() {
  const container = document.getElementById('ppe-items-chart');
  if (!container) return;

  const palette = ['#2563eb', '#f97316', '#22c55e', '#eab308', '#7c3aed', '#ef4444', '#06b6d4', '#ec4899'];

  const counts = PPE_ITEM_LABELS.map(function(def) {
    return {
      label: def.item,
      count: ppeRecords.filter(function(rec) { return String(rec[def.key] || '').trim() !== ''; }).length
    };
  });

  const total = counts.reduce(function(sum, c) { return sum + c.count; }, 0);

  if (total === 0) {
    container.innerHTML = '<div class="ppe-chart-empty">No PPE issue data yet to summarize.</div>';
    return;
  }

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const segments = counts.filter(function(c) { return c.count > 0; }).map(function(c, i) {
    const fraction = c.count / total;
    const dash = fraction * circumference;
    const seg = `<circle cx="80" cy="80" r="${radius}" fill="none" stroke="${palette[i % palette.length]}" stroke-width="20" stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 80 80)"></circle>`;
    offset += dash;
    return seg;
  }).join('');

  const legend = counts.filter(function(c) { return c.count > 0; }).map(function(c, i) {
    return `<span><span class="ppe-legend-dot" style="background:${palette[i % palette.length]};"></span>${escapeHTML(c.label)} (${c.count})</span>`;
  }).join('');

  container.innerHTML = `
    <svg viewBox="0 0 160 160" width="160" height="160">
      <circle cx="80" cy="80" r="${radius}" fill="none" stroke="var(--border-color)" stroke-width="20"></circle>
      ${segments}
      <text x="80" y="76" text-anchor="middle" font-size="20" font-weight="700" fill="var(--text-main)">${total}</text>
      <text x="80" y="94" text-anchor="middle" font-size="10" fill="var(--text-muted)">Issued</text>
    </svg>
    <div class="ppe-chart-legend">${legend}</div>
  `;
}

/* ------------------------------------------------------------
   NEW (additive, UI-only): routes the PPE dashboard header
   search box into the existing search functionality — it does
   not add any new search/filter logic of its own.
   ------------------------------------------------------------ */
function handlePPEHeaderSearch(evt) {
  const input = document.getElementById('ppe-header-search');
  const term = input ? input.value : '';

  if (userState.isAdmin) {
    const empSearch = document.getElementById('ppe-employee-search');
    if (empSearch) {
      empSearch.value = term;
      applyPPEEmployeeSearch();
    }
  }

  if (evt && evt.key === 'Enter' && term.trim() !== '') {
    openPPEHistoryModal();
    const historySearch = document.getElementById('ppe-history-search');
    if (historySearch) {
      historySearch.value = term;
      searchPPEHistory();
    }
  }
}

/* NEW (additive, UI-only): smooth-scrolls to an existing PPE panel. */
function scrollToPPEPanel(panelId) {
  const el = document.getElementById(panelId);
  if (el && el.scrollIntoView) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function getFilteredPPEEmployees() {
  const term = ppeEmployeeSearchTerm.trim().toLowerCase();
  if (!term) return ppeEmployeeData;
  return ppeEmployeeData.filter(function(emp) {
    return String(emp["Gate Pass No."]).toLowerCase().includes(term) ||
           String(emp["Employee Name"]).toLowerCase().includes(term);
  });
}

function applyPPEEmployeeSearch() {
  const input = document.getElementById('ppe-employee-search');
  ppeEmployeeSearchTerm = input ? input.value : '';
  renderPPEEmployeeTable();
}

function renderPPEEmployeeTable() {
  const tbody = document.getElementById('ppe-employee-table-body');
  if (!tbody) return;

  const list = getFilteredPPEEmployees();

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">No employees found.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(function(emp) {
    const gatePass = escapeHTML(emp["Gate Pass No."]);
    const actions = userState.isAdmin
      ? `<button type="button" class="stlp-btn-sm" onclick="editPPEEmployee('${gatePass}')">✏️ Edit</button>
         <button type="button" class="stlp-btn-sm" style="background:var(--safety-red,#ef4444);" onclick="deletePPEEmployee('${gatePass}')">🗑️ Delete</button>`
      : '';

    return `
      <tr>
        <td><strong>${gatePass}</strong></td>
        <td>${escapeHTML(emp["Employee Name"])}</td>
        <td>${escapeHTML(emp["Department"])}</td>
        <td>${escapeHTML(emp["Designation"])}</td>
        <td>${escapeHTML(emp["Joining Date"])}</td>
        <td>${escapeHTML(emp["Contractor"] || PPE_CONTRACTOR_NAME)}</td>
        <td>
          <button type="button" class="stlp-btn-sm" onclick="viewEmployeePPEHistoryDirect('${gatePass}')">📜 PPE History</button>
          ${actions}
        </td>
      </tr>
    `;
  }).join('');
}

function renderPPEIssueTable() {
  const tbody = document.getElementById('ppe-records-table-body');
  if (!tbody) return;

  const sorted = ppeRecords.slice().sort(function(a, b) {
    const da = parseCustomDate(a["Issue Date"]);
    const db = parseCustomDate(b["Issue Date"]);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return db.getTime() - da.getTime();
  });

  if (sorted.length === 0) {
    tbody.innerHTML = '<tr><td colspan="12" style="text-align:center; color:var(--text-muted);">No PPE issue records yet.</td></tr>';
    return;
  }

  tbody.innerHTML = sorted.map(function(rec) {
    const editBtn = userState.isAdmin
      ? `<button type="button" class="stlp-btn-sm" onclick="editPPEIssueRecord('${rec.id}')">✏️</button>`
      : '';
    const delBtn = userState.isAdmin
      ? `<button type="button" class="stlp-btn-sm" style="background:var(--safety-red,#ef4444);" onclick="deletePPERecord('${rec.id}')">🗑️</button>`
      : '';
    const withQty = function(valueKey, qtyKey) {
      const val = rec[valueKey];
      const qty = rec[qtyKey];
      if (!val) return '';
      return escapeHTML(val) + (qty ? ' (x' + escapeHTML(qty) + ')' : '');
    };
    return `
      <tr>
        <td>${escapeHTML(rec["Gate Pass No."])}</td>
        <td>${escapeHTML(rec["Employee Name"])}</td>
        <td>${escapeHTML(rec["Issue Date"])}</td>
        <td>${withQty("Jacket Size", "Jacket Qty")}</td>
        <td>${withQty("Helmet Colour", "Helmet Qty")}</td>
        <td>${withQty("Goggle Type", "Goggle Qty")}</td>
        <td>${withQty("Shoe Size", "Shoe Qty")}</td>
        <td>${withQty("Electrical Shoe Size", "Electrical Shoe Qty")}</td>
        <td>${withQty("Ear Plug", "Ear Plug Qty")}</td>
        <td>${withQty("Nose Mask", "Nose Mask Qty")}</td>
        <td>${withQty("Gloves Category", "Gloves Qty")}</td>
        <td>${escapeHTML(rec["Remarks"])} ${editBtn} ${delBtn}</td>
      </tr>
    `;
  }).join('');
}


/* ------------------------------------------------------------
   EMPLOYEE MASTER — ADD / EDIT / DELETE
   ------------------------------------------------------------ */

function openAddPPEEmployeeModal() {
  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }
  const form = document.getElementById('ppe-employee-form');
  if (form) form.reset();

  const editInput = document.getElementById('pe-editing-gatepass');
  if (editInput) editInput.value = '';

  const gpInput = document.getElementById('pe-gatepass');
  if (gpInput) gpInput.disabled = false;

  const titleEl = document.getElementById('ppe-employee-modal-title');
  if (titleEl) titleEl.innerText = 'Add New Employee';

  const modal = document.getElementById('ppe-employee-modal');
  if (modal) modal.classList.remove('hidden-screen');
}

function editPPEEmployee(gatePassNo) {
  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }
  const emp = ppeEmployeeData.find(e => String(e["Gate Pass No."]) === String(gatePassNo));
  if (!emp) {
    alert('❌ Employee not found.');
    return;
  }

  const setValue = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val !== undefined && val !== null ? String(val) : '';
  };

  const editInput = document.getElementById('pe-editing-gatepass');
  if (editInput) editInput.value = emp["Gate Pass No."];

  setValue('pe-gatepass', emp["Gate Pass No."]);
  const gpInput = document.getElementById('pe-gatepass');
  if (gpInput) gpInput.disabled = true; // Gate Pass No. is the primary identifier — not editable once created

  setValue('pe-name', emp["Employee Name"]);
  setValue('pe-dept', emp["Department"]);
  setValue('pe-designation', emp["Designation"]);
  setValue('pe-joining', ppeConvertToInputDate(emp["Joining Date"]));

  const titleEl = document.getElementById('ppe-employee-modal-title');
  if (titleEl) titleEl.innerText = 'Edit Employee (' + emp["Gate Pass No."] + ')';

  const modal = document.getElementById('ppe-employee-modal');
  if (modal) modal.classList.remove('hidden-screen');
}

function closePPEEmployeeModal() {
  const modal = document.getElementById('ppe-employee-modal');
  if (modal) modal.classList.add('hidden-screen');
}

async function savePPEEmployeeRecord(e) {
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

  const editingGatePass = getVal('pe-editing-gatepass');
  const gatePassNo = editingGatePass || getVal('pe-gatepass');
  const employeeName = getVal('pe-name');
  const department = getVal('pe-dept');
  const designation = getVal('pe-designation');
  const rawJoining = getVal('pe-joining');

  if (!gatePassNo || !employeeName) {
    alert('❌ Please fill in Gate Pass Number and Employee Name.');
    return;
  }

  if (!editingGatePass) {
    const dupe = ppeEmployeeData.find(emp => String(emp["Gate Pass No."]).trim() === String(gatePassNo).trim());
    if (dupe) {
      alert('❌ This Gate Pass Number already exists. Use Edit instead of creating a duplicate.');
      return;
    }
  }

  const empObj = {
    "Gate Pass No.": gatePassNo,
    "Employee Name": employeeName,
    "Department": department,
    "Designation": designation,
    "Joining Date": ppeFormatToDMY(rawJoining),
    "Contractor": PPE_CONTRACTOR_NAME
  };

  const supabaseRow = mapPPEEmployeeToSupabase(empObj);

  try {
    const { error } = await client
      .from('ppe_employees')
      .upsert([supabaseRow], { onConflict: 'gate_pass_no' });

    if (error) {
      alert('❌ Supabase Error: ' + error.message);
      return;
    }

    closePPEEmployeeModal();
    await fetchPPEEmployeesFromSupabase();
    renderPPEModule(true);
    alert('✅ Employee record saved.');

  } catch (err) {
    alert('❌ Exception during save: ' + err.message);
  }
}

async function deletePPEEmployee(gatePassNo) {
  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }

  const linkedRecords = ppeRecords.filter(r => String(r["Gate Pass No."]) === String(gatePassNo));
  if (linkedRecords.length > 0) {
    const proceed = confirm(
      `⚠️ Gate Pass ${gatePassNo} has ${linkedRecords.length} PPE issue history record(s).\n` +
      `Deleting this employee will NOT delete their PPE history, but the employee master entry will be removed.\n\n` +
      `Are you sure you want to continue?`
    );
    if (!proceed) return;
  } else {
    if (!confirm(`⚠️ Delete employee with Gate Pass ${gatePassNo}?`)) return;
  }

  const client = initSupabase();
  if (!client) {
    alert('❌ Supabase client not available.');
    return;
  }

  try {
    const { error } = await client
      .from('ppe_employees')
      .delete()
      .eq('gate_pass_no', String(gatePassNo));

    if (error) {
      alert('❌ Supabase Delete Error: ' + error.message);
      return;
    }

    await fetchPPEEmployeesFromSupabase();
    renderPPEModule(true);
    alert('✅ Employee deleted. PPE history (if any) remains preserved.');

  } catch (err) {
    alert('❌ Exception during deletion: ' + err.message);
  }
}


/* ------------------------------------------------------------
   PPE ISSUE — ADD RECORD (WITH GATE PASS AUTO-FILL)
   ------------------------------------------------------------ */

function openAddPPEIssueModal() {
  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }
  const form = document.getElementById('ppe-issue-form');
  if (form) form.reset();

  const editIdInput = document.getElementById('pi-editing-id');
  if (editIdInput) editIdInput.value = '';

  const issueTitleEl = document.getElementById('ppe-issue-modal-title');
  if (issueTitleEl) issueTitleEl.innerText = 'Add PPE Issue Record';

  setPPEIssueEmployeeFieldsMode(false);

  // Reset every PPE item row: uncheck the tick, disable its dropdown, clear qty
  PPE_ISSUE_ITEM_FIELDS.forEach(function(fieldDef) {
    const chk = document.getElementById('pi-chk-' + fieldDef.key);
    const sel = document.getElementById('pi-' + fieldDef.key);
    const qtyEl = document.getElementById('pi-qty-' + fieldDef.key);
    if (chk) chk.checked = false;
    if (sel) { sel.disabled = true; sel.value = ''; }
    if (qtyEl) { qtyEl.disabled = true; qtyEl.value = ''; }
  });

  const noticeEl = document.getElementById('ppe-new-employee-notice');
  if (noticeEl) noticeEl.classList.add('hidden-screen');

  const modal = document.getElementById('ppe-issue-modal');
  if (modal) modal.classList.remove('hidden-screen');
}

/* Ticking a PPE item checkbox reveals (enables) its dropdown; unticking
   disables it again and clears any selected value (NEW, ADDITIVE). */
// Items that no longer show a dropdown — a tick alone means "Yes".
const PPE_NO_DROPDOWN_ITEMS = ['earplug', 'nosemask'];
// Items whose dropdown should pre-select a sensible default (instead of a
// blank "Select..." placeholder) as soon as the item is ticked.
const PPE_DEFAULT_DROPDOWN_VALUES = { helmet: 'Blue', goggle: 'Safety Goggles' };

function togglePPEItemDropdown(itemKey) {
  const chk = document.getElementById('pi-chk-' + itemKey);
  const sel = document.getElementById('pi-' + itemKey);
  const qtyEl = document.getElementById('pi-qty-' + itemKey);
  if (!chk || !sel) return;

  if (chk.checked) {
    if (PPE_NO_DROPDOWN_ITEMS.indexOf(itemKey) !== -1) {
      sel.value = 'Yes';
    } else {
      sel.disabled = false;
      if (!sel.value && PPE_DEFAULT_DROPDOWN_VALUES[itemKey]) {
        sel.value = PPE_DEFAULT_DROPDOWN_VALUES[itemKey];
      }
    }
    if (qtyEl) {
      qtyEl.disabled = false;
      if (!qtyEl.value) qtyEl.value = '1';
    }
  } else {
    sel.value = '';
    if (PPE_NO_DROPDOWN_ITEMS.indexOf(itemKey) === -1) sel.disabled = true;
    if (qtyEl) { qtyEl.disabled = true; qtyEl.value = ''; }
  }
}

/* Admin: open the Add PPE Issue modal pre-filled with an already-issued
   record's data, so it can be corrected in place (UPDATE instead of a
   brand-new history row). NEW, ADDITIVE — does not change Add-new flow. */
function editPPEIssueRecord(recordId) {
  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }

  const rec = ppeRecords.find(function(r) { return String(r.id) === String(recordId); });
  if (!rec) {
    alert('❌ PPE issue record not found.');
    return;
  }

  const form = document.getElementById('ppe-issue-form');
  if (form) form.reset();

  const setValue = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val !== undefined && val !== null ? String(val) : '';
  };

  const editIdInput = document.getElementById('pi-editing-id');
  if (editIdInput) editIdInput.value = rec.id;

  setValue('pi-gatepass', rec["Gate Pass No."]);
  setValue('pi-issue-date', ppeConvertToInputDate(rec["Issue Date"]));
  setValue('pi-remarks', rec["Remarks"]);

  // Reuse the existing lookup to populate the readonly employee fields.
  lookupEmployeeForPPE();

  PPE_ISSUE_ITEM_FIELDS.forEach(function(fieldDef) {
    const chk = document.getElementById('pi-chk-' + fieldDef.key);
    const sel = document.getElementById('pi-' + fieldDef.key);
    const qtyEl = document.getElementById('pi-qty-' + fieldDef.key);
    const val = rec[fieldDef.dataKey] || '';
    const qtyVal = rec[fieldDef.qtyDataKey] || '';
    if (chk) chk.checked = !!val;
    if (sel) {
      sel.value = val;
      if (PPE_NO_DROPDOWN_ITEMS.indexOf(fieldDef.key) === -1) sel.disabled = !val;
    }
    if (qtyEl) {
      qtyEl.value = qtyVal;
      qtyEl.disabled = !val;
    }
  });

  const issueTitleEl = document.getElementById('ppe-issue-modal-title');
  if (issueTitleEl) issueTitleEl.innerText = 'Edit PPE Issue Record (' + rec["Gate Pass No."] + ')';

  const modal = document.getElementById('ppe-issue-modal');
  if (modal) modal.classList.remove('hidden-screen');
}

function closePPEIssueModal() {
  const modal = document.getElementById('ppe-issue-modal');
  if (modal) modal.classList.add('hidden-screen');
}

/* ------------------------------------------------------------
   BULK PPE ISSUE (NEW, ADDITIVE)
   Reuses PPE_ISSUE_ITEM_FIELDS / PPE_NO_DROPDOWN_ITEMS /
   PPE_DEFAULT_DROPDOWN_VALUES. Element ids use a 'bi-' prefix
   instead of 'pi-' so nothing here can collide with the single
   Add/Edit PPE Issue modal.
   ------------------------------------------------------------ */

function openBulkIssueModal() {
  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }

  const deptSel = document.getElementById('bi-department');
  if (deptSel) {
    const depts = Array.from(new Set(ppeEmployeeData.map(e => String(e["Department"] || '').trim()).filter(Boolean))).sort();
    deptSel.innerHTML = depts.map(d => `<option value="${escapeHTML(d)}">${escapeHTML(d)}</option>`).join('');
  }

  document.getElementById('bi-issue-date').value = '';
  document.getElementById('bi-remarks').value = '';

  PPE_ISSUE_ITEM_FIELDS.forEach(function(fieldDef) {
    const chk = document.getElementById('bi-chk-' + fieldDef.key);
    const sel = document.getElementById('bi-' + fieldDef.key);
    const qtyEl = document.getElementById('bi-qty-' + fieldDef.key);
    if (chk) chk.checked = false;
    if (sel) { sel.disabled = true; sel.value = ''; }
    if (qtyEl) { qtyEl.disabled = true; qtyEl.value = ''; }
  });

  renderBulkIssueEmployeeList();

  const modal = document.getElementById('ppe-bulk-issue-modal');
  if (modal) modal.classList.remove('hidden-screen');
}

function closeBulkIssueModal() {
  const modal = document.getElementById('ppe-bulk-issue-modal');
  if (modal) modal.classList.add('hidden-screen');
}

function renderBulkIssueEmployeeList() {
  const listEl = document.getElementById('bi-employee-list');
  const deptSel = document.getElementById('bi-department');
  if (!listEl || !deptSel) return;

  const dept = deptSel.value;
  const emps = ppeEmployeeData.filter(e => String(e["Department"] || '').trim() === dept);

  if (emps.length === 0) {
    listEl.innerHTML = '<p style="color:var(--text-muted); margin:0;">No employees found in this department.</p>';
    updateBulkSubmitCount();
    return;
  }

  listEl.innerHTML =
    '<label style="display:flex; align-items:center; gap:8px; padding:4px 0; font-weight:600;">' +
      '<input type="checkbox" id="bi-select-all" checked onchange="toggleBulkAllEmployees(this)" /> Select All (' + emps.length + ')' +
    '</label>' +
    emps.map(function(e) {
      return '<label style="display:flex; align-items:center; gap:8px; padding:4px 0;">' +
        '<input type="checkbox" class="bi-emp-chk" checked onchange="updateBulkSubmitCount()" value="' + escapeHTML(e["Gate Pass No."]) + '" /> ' +
        escapeHTML(e["Gate Pass No."]) + ' — ' + escapeHTML(e["Employee Name"]) +
      '</label>';
    }).join('');

  updateBulkSubmitCount();
}

function toggleBulkAllEmployees(master) {
  document.querySelectorAll('.bi-emp-chk').forEach(function(c) { c.checked = master.checked; });
  updateBulkSubmitCount();
}

function updateBulkSubmitCount() {
  const btn = document.getElementById('bi-submit-btn');
  if (!btn) return;
  const n = document.querySelectorAll('.bi-emp-chk:checked').length;
  btn.textContent = 'Issue to Selected (' + n + ')';
}

function toggleBulkItemDropdown(itemKey) {
  const chk = document.getElementById('bi-chk-' + itemKey);
  const sel = document.getElementById('bi-' + itemKey);
  const qtyEl = document.getElementById('bi-qty-' + itemKey);
  if (!chk || !sel) return;

  if (chk.checked) {
    if (PPE_NO_DROPDOWN_ITEMS.indexOf(itemKey) !== -1) {
      sel.value = 'Yes';
    } else {
      sel.disabled = false;
      if (!sel.value && PPE_DEFAULT_DROPDOWN_VALUES[itemKey]) sel.value = PPE_DEFAULT_DROPDOWN_VALUES[itemKey];
    }
    if (qtyEl) { qtyEl.disabled = false; if (!qtyEl.value) qtyEl.value = '1'; }
  } else {
    sel.value = '';
    if (PPE_NO_DROPDOWN_ITEMS.indexOf(itemKey) === -1) sel.disabled = true;
    if (qtyEl) { qtyEl.disabled = true; qtyEl.value = ''; }
  }
}

async function submitBulkIssue() {
  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }

  const selectedGatePasses = Array.from(document.querySelectorAll('.bi-emp-chk:checked')).map(c => c.value);
  if (selectedGatePasses.length === 0) {
    alert('❌ Please select at least one employee.');
    return;
  }

  const rawIssueDate = document.getElementById('bi-issue-date').value;
  if (!rawIssueDate) {
    alert('❌ Please select a PPE Issue Date.');
    return;
  }
  const issueDateDMY = ppeFormatToDMY(rawIssueDate);
  const remarks = document.getElementById('bi-remarks').value.trim();

  const itemValues = {};
  let anyItemTicked = false;
  PPE_ISSUE_ITEM_FIELDS.forEach(function(fieldDef) {
    const chk = document.getElementById('bi-chk-' + fieldDef.key);
    const isTicked = !!(chk && chk.checked);
    if (isTicked) anyItemTicked = true;
    itemValues[fieldDef.dataKey] = isTicked ? getVal('bi-' + fieldDef.key) : '';
    itemValues[fieldDef.qtyDataKey] = isTicked ? getVal('bi-qty-' + fieldDef.key) : '';
  });

  if (!anyItemTicked) {
    alert('❌ Please tick and select at least one PPE item being issued.');
    return;
  }

  const client = initSupabase();
  if (!client) {
    alert('❌ Supabase client is not available.');
    return;
  }

  const employeeMap = new Map(ppeEmployeeData.map(emp => [String(emp["Gate Pass No."]).trim(), emp]));
  const recordsToInsert = selectedGatePasses.map(function(gatePassNo) {
    const emp = employeeMap.get(gatePassNo);
    const recObj = Object.assign({
      "Gate Pass No.": gatePassNo,
      "Employee Name": emp ? emp["Employee Name"] : '',
      "Issue Date": issueDateDMY,
      "Remarks": remarks
    }, itemValues);
    return mapPPERecordToSupabase(recObj);
  });

  const { error } = await client.from('ppe_records').insert(recordsToInsert);

  if (error) {
    alert('❌ Supabase Error (Bulk PPE Issue): ' + error.message);
    return;
  }

  closeBulkIssueModal();
  await fetchPPERecordsFromSupabase();
  renderPPEModule(true);
  alert('✅ PPE issued to ' + recordsToInsert.length + ' employee(s).');
}

function setPPEIssueEmployeeFieldsMode(isNewEmployee) {
  ['pi-name', 'pi-dept', 'pi-designation', 'pi-joining'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.readOnly = !isNewEmployee;
  });
}

function lookupEmployeeForPPE() {
  const gpInput = document.getElementById('pi-gatepass');
  if (!gpInput) return;

  const gatePassNo = gpInput.value.trim();
  const noticeEl = document.getElementById('ppe-new-employee-notice');

  const setValue = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val !== undefined && val !== null ? String(val) : '';
  };

  if (!gatePassNo) {
    setValue('pi-name', ''); setValue('pi-dept', ''); setValue('pi-designation', ''); setValue('pi-joining', '');
    setPPEIssueEmployeeFieldsMode(false);
    if (noticeEl) noticeEl.classList.add('hidden-screen');
    return;
  }

  const emp = ppeEmployeeData.find(e => String(e["Gate Pass No."]).trim() === gatePassNo);

  if (emp) {
    setValue('pi-name', emp["Employee Name"]);
    setValue('pi-dept', emp["Department"]);
    setValue('pi-designation', emp["Designation"]);
    setValue('pi-joining', ppeConvertToInputDate(emp["Joining Date"]));
    setPPEIssueEmployeeFieldsMode(false);
    if (noticeEl) noticeEl.classList.add('hidden-screen');
  } else {
    setValue('pi-name', ''); setValue('pi-dept', ''); setValue('pi-designation', ''); setValue('pi-joining', '');
    setPPEIssueEmployeeFieldsMode(true);
    if (noticeEl) noticeEl.classList.remove('hidden-screen');
  }
}

async function savePPEIssueRecord(e) {
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

  const gatePassNo = getVal('pi-gatepass');
  const rawIssueDate = getVal('pi-issue-date');

  if (!gatePassNo || !rawIssueDate) {
    alert('❌ Gate Pass Number and PPE Issue Date are required.');
    return;
  }

  let emp = ppeEmployeeData.find(e2 => String(e2["Gate Pass No."]).trim() === gatePassNo);
  const isNewEmployee = !emp;

  let employeeName = getVal('pi-name');
  let department = getVal('pi-dept');
  let designation = getVal('pi-designation');
  let rawJoining = getVal('pi-joining');

  if (isNewEmployee) {
    if (!employeeName || !department || !designation || !rawJoining) {
      alert('❌ New Employee — please fill in Employee Name, Department, Designation and Joining Date.');
      return;
    }
  } else {
    employeeName = emp["Employee Name"];
    department = emp["Department"];
    designation = emp["Designation"];
    rawJoining = ppeConvertToInputDate(emp["Joining Date"]);
  }

  try {
    // Step 1 — ensure Employee Master has this Gate Pass Number (create if new, never duplicate)
    if (isNewEmployee) {
      const empObj = {
        "Gate Pass No.": gatePassNo,
        "Employee Name": employeeName,
        "Department": department,
        "Designation": designation,
        "Joining Date": ppeFormatToDMY(rawJoining),
        "Contractor": PPE_CONTRACTOR_NAME
      };
      const { error: empError } = await client
        .from('ppe_employees')
        .upsert([mapPPEEmployeeToSupabase(empObj)], { onConflict: 'gate_pass_no' });

      if (empError) {
        alert('❌ Supabase Error (Employee Master): ' + empError.message);
        return;
      }
      await fetchPPEEmployeesFromSupabase();
    }

    // Step 2 — INSERT a brand-new PPE issue record (never overwrites history),
    // UNLESS an admin is editing an already-issued record (pi-editing-id set),
    // in which case that specific record is UPDATEd in place.
    // Only ticked items carry a value; unticked items are left blank (not mandatory).
    const editingId = getVal('pi-editing-id');

    const recObj = {
      "Gate Pass No.": gatePassNo,
      "Employee Name": employeeName,
      "Issue Date": ppeFormatToDMY(rawIssueDate),
      "Remarks": getVal('pi-remarks')
    };

    let anyItemTicked = false;
    PPE_ISSUE_ITEM_FIELDS.forEach(function(fieldDef) {
      const chk = document.getElementById('pi-chk-' + fieldDef.key);
      const isTicked = !!(chk && chk.checked);
      if (isTicked) anyItemTicked = true;
      recObj[fieldDef.dataKey] = isTicked ? getVal('pi-' + fieldDef.key) : '';
      recObj[fieldDef.qtyDataKey] = isTicked ? getVal('pi-qty-' + fieldDef.key) : '';
    });

    if (!anyItemTicked) {
      alert('❌ Please tick and select at least one PPE item being issued.');
      return;
    }

    const recError = editingId
      ? (await client.from('ppe_records').update(mapPPERecordToSupabase(recObj)).eq('id', editingId)).error
      : (await client.from('ppe_records').insert([mapPPERecordToSupabase(recObj)])).error;

    if (recError) {
      alert('❌ Supabase Error (PPE Record): ' + recError.message);
      return;
    }

    closePPEIssueModal();
    await fetchPPERecordsFromSupabase();
    renderPPEModule(true);
    alert(editingId
      ? '✅ PPE issue record updated.'
      : '✅ PPE issue record saved. Previous history for this employee remains untouched.');

  } catch (err) {
    alert('❌ Exception during save: ' + err.message);
  }
}

async function deletePPERecord(recordId) {
  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }
  if (!confirm('⚠️ Delete this PPE issue record permanently?')) return;

  const client = initSupabase();
  if (!client) {
    alert('❌ Supabase client not available.');
    return;
  }

  try {
    const { error } = await client
      .from('ppe_records')
      .delete()
      .eq('id', recordId);

    if (error) {
      alert('❌ Supabase Delete Error: ' + error.message);
      return;
    }

    await fetchPPERecordsFromSupabase();
    renderPPEModule(true);

    const historyModal = document.getElementById('ppe-history-modal');
    if (historyModal && !historyModal.classList.contains('hidden-screen')) {
      const activeGatePass = historyModal.getAttribute('data-active-gatepass');
      if (activeGatePass) showEmployeeHistoryDetail(activeGatePass);
    }

  } catch (err) {
    alert('❌ Exception during deletion: ' + err.message);
  }
}


/* ------------------------------------------------------------
   EMPLOYEE PPE HISTORY — SEARCH + DETAIL VIEW
   ------------------------------------------------------------ */

function openPPEHistoryModal() {
  const modal = document.getElementById('ppe-history-modal');
  if (modal) {
    modal.classList.remove('hidden-screen');
    modal.removeAttribute('data-active-gatepass');
  }
  const searchInput = document.getElementById('ppe-history-search');
  if (searchInput) searchInput.value = '';
  const resultsEl = document.getElementById('ppe-history-search-results');
  if (resultsEl) resultsEl.innerHTML = '';
  const detailEl = document.getElementById('ppe-history-detail');
  if (detailEl) detailEl.innerHTML = '<p style="color:var(--text-muted);">Search by Gate Pass Number or Employee Name above to view PPE issue history.</p>';
}

function closePPEHistoryModal() {
  const modal = document.getElementById('ppe-history-modal');
  if (modal) modal.classList.add('hidden-screen');
}

function viewEmployeePPEHistoryDirect(gatePassNo) {
  openPPEHistoryModal();
  showEmployeeHistoryDetail(gatePassNo);
}

function searchPPEHistory() {
  const input = document.getElementById('ppe-history-search');
  const term = input ? input.value.trim().toLowerCase() : '';
  const resultsEl = document.getElementById('ppe-history-search-results');
  if (!resultsEl) return;

  if (!term) {
    resultsEl.innerHTML = '';
    return;
  }

  const matches = ppeEmployeeData.filter(function(emp) {
    return String(emp["Gate Pass No."]).toLowerCase().includes(term) ||
           String(emp["Employee Name"]).toLowerCase().includes(term);
  }).slice(0, 25);

  if (matches.length === 0) {
    resultsEl.innerHTML = '<p style="color:var(--text-muted);">No matching employee found.</p>';
    return;
  }

  resultsEl.innerHTML = matches.map(function(emp) {
    const gp = escapeHTML(emp["Gate Pass No."]);
    return `<button type="button" class="stlp-btn-sm" style="margin:3px;" onclick="showEmployeeHistoryDetail('${gp}')">
      ${gp} — ${escapeHTML(emp["Employee Name"])}
    </button>`;
  }).join('');
}

function getLastIssuedForEmployee(gatePassNo) {
  const records = ppeRecords
    .filter(r => String(r["Gate Pass No."]).trim() === String(gatePassNo).trim())
    .slice()
    .sort(function(a, b) {
      const da = parseCustomDate(a["Issue Date"]);
      const db = parseCustomDate(b["Issue Date"]);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db.getTime() - da.getTime();
    });

  return PPE_ITEM_LABELS.map(function(itemDef) {
    const found = records.find(function(r) {
      const val = String(r[itemDef.key] || '').trim();
      if (itemDef.key === 'Ear Plug' || itemDef.key === 'Nose Mask') {
        return val.toLowerCase() === 'yes';
      }
      return val !== '';
    });

    if (!found) {
      return { item: itemDef.item, date: '', detail: 'Never Issued' };
    }
    return { item: itemDef.item, date: found["Issue Date"], detail: String(found[itemDef.key] || '') };
  });
}

function showEmployeeHistoryDetail(gatePassNo) {
  const emp = ppeEmployeeData.find(e => String(e["Gate Pass No."]).trim() === String(gatePassNo).trim());
  const detailEl = document.getElementById('ppe-history-detail');
  const modal = document.getElementById('ppe-history-modal');
  if (modal) modal.setAttribute('data-active-gatepass', gatePassNo);
  if (!detailEl) return;

  if (!emp) {
    detailEl.innerHTML = '<p style="color:var(--safety-red);">❌ Employee not found.</p>';
    return;
  }

  const history = ppeRecords
    .filter(r => String(r["Gate Pass No."]).trim() === String(gatePassNo).trim())
    .slice()
    .sort(function(a, b) {
      const da = parseCustomDate(a["Issue Date"]);
      const db = parseCustomDate(b["Issue Date"]);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db.getTime() - da.getTime();
    });

  const lastIssued = getLastIssuedForEmployee(gatePassNo);

  const lastIssuedRows = lastIssued.map(function(row) {
    return `
      <tr>
        <td>${escapeHTML(row.item)}</td>
        <td>${row.date ? escapeHTML(row.date) : '-'}</td>
        <td>${escapeHTML(row.detail)}</td>
      </tr>
    `;
  }).join('');

  const historyRows = history.length === 0
    ? '<tr><td colspan="9" style="text-align:center; color:var(--text-muted);">No PPE issue history for this employee.</td></tr>'
    : history.map(function(rec) {
        const delBtn = userState.isAdmin
          ? `<button type="button" class="stlp-btn-sm" style="background:var(--safety-red,#ef4444);" onclick="deletePPERecord('${rec.id}')">🗑️</button>`
          : '';
        return `
          <tr>
            <td>${escapeHTML(rec["Issue Date"])}</td>
            <td>${escapeHTML(rec["Jacket Size"])}</td>
            <td>${escapeHTML(rec["Helmet Colour"])}</td>
            <td>${escapeHTML(rec["Goggle Type"])}</td>
            <td>${escapeHTML(rec["Shoe Size"])}</td>
            <td>${escapeHTML(rec["Electrical Shoe Size"])}</td>
            <td>${escapeHTML(rec["Ear Plug"])}</td>
            <td>${escapeHTML(rec["Nose Mask"])}</td>
            <td>${escapeHTML(rec["Gloves Category"])} ${delBtn}</td>
          </tr>
        `;
      }).join('');

  const gp = escapeHTML(emp["Gate Pass No."]);

  detailEl.innerHTML = `
    <div style="background:var(--card-dark); padding:1rem; border-radius:8px; border:1px solid var(--border-dark); margin-bottom:1rem;">
      <strong>${escapeHTML(emp["Employee Name"])}</strong> &nbsp;|&nbsp; Gate Pass: <strong>${gp}</strong><br/>
      Department: ${escapeHTML(emp["Department"])} &nbsp;|&nbsp;
      Designation: ${escapeHTML(emp["Designation"])} &nbsp;|&nbsp;
      Joining: ${escapeHTML(emp["Joining Date"])} &nbsp;|&nbsp;
      Contractor: ${escapeHTML(emp["Contractor"] || PPE_CONTRACTOR_NAME)}
    </div>

    <h4>Last Issued PPE</h4>
    <div class="stlp-table-container" style="margin-bottom:1.5rem;">
      <table class="stlp-table">
        <thead><tr><th>PPE Item</th><th>Last Issue Date</th><th>Details</th></tr></thead>
        <tbody>${lastIssuedRows}</tbody>
      </table>
    </div>

    <h4>Complete PPE History (newest first)</h4>
    <div class="stlp-table-container" style="margin-bottom:1rem;">
      <table class="stlp-table">
        <thead>
          <tr>
            <th>Issue Date</th><th>Jacket</th><th>Helmet</th><th>Goggle</th>
            <th>Shoe</th><th>Elec. Shoe</th><th>Ear Plug</th><th>Nose Mask</th><th>Gloves</th>
          </tr>
        </thead>
        <tbody>${historyRows}</tbody>
      </table>
    </div>

    <button type="button" class="stlp-btn-sm" onclick="exportEmployeePPEHistoryExcel('${gp}')">📤 Export This Employee's PPE History</button>
  `;
}


/* ------------------------------------------------------------
   EXPORT ISSUED PPE DUMP (NEW, ADDITIVE)
   Exports ppeRecords (the SAME array used everywhere else in the
   PPE module — no new data source) to Excel, optionally filtered
   down to just the records where one specific PPE type was issued.
   Does not touch ppeRecords itself, Supabase, or any other export.
   ------------------------------------------------------------ */

const PPE_DUMP_EXPORT_FIELDS = [
  "Gate Pass No.", "Employee Name", "Issue Date",
  "Jacket Size", "Helmet Colour", "Goggle Type", "Shoe Size",
  "Electrical Shoe Size", "Ear Plug", "Nose Mask", "Gloves Category", "Remarks"
];

function getPPEDumpFilteredRecords() {
  const select = document.getElementById('ppe-dump-type-filter');
  const typeKey = select ? select.value : 'ALL';

  if (!typeKey || typeKey === 'ALL') {
    return ppeRecords.slice();
  }
  return ppeRecords.filter(function(rec) {
    return String(rec[typeKey] || '').trim() !== '';
  });
}

function openPPEDumpModal() {
  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }
  const select = document.getElementById('ppe-dump-type-filter');
  if (select) select.value = 'ALL';
  updatePPEDumpCountPreview();
  const modal = document.getElementById('ppe-dump-modal');
  if (modal) modal.classList.remove('hidden-screen');
}

function closePPEDumpModal() {
  const modal = document.getElementById('ppe-dump-modal');
  if (modal) modal.classList.add('hidden-screen');
}

function updatePPEDumpCountPreview() {
  const preview = document.getElementById('ppe-dump-count-preview');
  if (!preview) return;
  const count = getPPEDumpFilteredRecords().length;
  preview.innerText = count + ' record(s) match this filter and will be exported.';
}

function exportPPEIssuedDump() {
  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }
  if (typeof XLSX === 'undefined') {
    alert('❌ SheetJS library is loading. Please try again in a moment.');
    return;
  }

  const select = document.getElementById('ppe-dump-type-filter');
  const typeKey = select ? select.value : 'ALL';
  const recordsToExport = getPPEDumpFilteredRecords();

  if (recordsToExport.length === 0) {
    alert('❌ No PPE issue records match this filter.');
    return;
  }

  const exportData = recordsToExport.map(function(rec) {
    const rowObj = {};
    PPE_DUMP_EXPORT_FIELDS.forEach(function(field) {
      rowObj[field] = rec[field] !== undefined && rec[field] !== null ? String(rec[field]) : '';
    });
    return rowObj;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData, { header: PPE_DUMP_EXPORT_FIELDS });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "PPE_ISSUED_DUMP");

  const typeLabelMap = {
    "ALL": "All_Types",
    "Jacket Size": "Safety_Jacket",
    "Helmet Colour": "Safety_Helmet",
    "Goggle Type": "Safety_Goggle",
    "Shoe Size": "Safety_Shoe",
    "Electrical Shoe Size": "Electrical_Safety_Shoe",
    "Ear Plug": "Ear_Plug",
    "Nose Mask": "Nose_Mask",
    "Gloves Category": "Hand_Gloves"
  };
  const fileLabel = typeLabelMap[typeKey] || 'All_Types';

  const todayObj = new Date();
  const day = String(todayObj.getDate()).padStart(2, '0');
  const month = String(todayObj.getMonth() + 1).padStart(2, '0');
  const year = todayObj.getFullYear();

  XLSX.writeFile(workbook, `PPE_Issued_Dump_${fileLabel}_${day}-${month}-${year}.xlsx`);
  closePPEDumpModal();
}


/* ------------------------------------------------------------
   EXCEL EXPORT — EMPLOYEE MASTER
   ------------------------------------------------------------ */

function exportPPEEmployeeMasterExcel() {
  if (typeof XLSX === 'undefined') {
    alert('❌ SheetJS library is loading. Please try again in a moment.');
    return;
  }
  if (ppeEmployeeData.length === 0) {
    alert('❌ No employee records available to export.');
    return;
  }

  const exportData = ppeEmployeeData.map(function(emp) {
    const rowObj = {};
    PPE_EMPLOYEE_MASTER_FIELDS.forEach(function(field) {
      rowObj[field] = emp[field] !== undefined && emp[field] !== null ? String(emp[field]) : '';
    });
    return rowObj;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData, { header: PPE_EMPLOYEE_MASTER_FIELDS });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "EMPLOYEE_MASTER");
  XLSX.writeFile(workbook, "Employee_Master.xlsx");
}


/* ------------------------------------------------------------
   EXCEL EXPORT — INDIVIDUAL EMPLOYEE PPE HISTORY
   ------------------------------------------------------------ */

function exportEmployeePPEHistoryExcel(gatePassNo) {
  if (typeof XLSX === 'undefined') {
    alert('❌ SheetJS library is loading. Please try again in a moment.');
    return;
  }

  const emp = ppeEmployeeData.find(e => String(e["Gate Pass No."]).trim() === String(gatePassNo).trim());
  const history = ppeRecords
    .filter(r => String(r["Gate Pass No."]).trim() === String(gatePassNo).trim())
    .slice()
    .sort(function(a, b) {
      const da = parseCustomDate(a["Issue Date"]);
      const db = parseCustomDate(b["Issue Date"]);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return db.getTime() - da.getTime();
    });

  if (history.length === 0) {
    alert('❌ No PPE issue history available for this employee to export.');
    return;
  }

  const exportData = history.map(function(rec) {
    return {
      "Gate Pass No.": gatePassNo,
      "Employee Name": emp ? emp["Employee Name"] : rec["Employee Name"],
      "Department": emp ? emp["Department"] : '',
      "Designation": emp ? emp["Designation"] : '',
      "Joining Date": emp ? emp["Joining Date"] : '',
      "PPE Issue Date": rec["Issue Date"],
      "Jacket Size": rec["Jacket Size"],
      "Helmet Colour": rec["Helmet Colour"],
      "Goggle Type": rec["Goggle Type"],
      "Shoe Size": rec["Shoe Size"],
      "Electrical Shoe Size": rec["Electrical Shoe Size"],
      "Ear Plug": rec["Ear Plug"],
      "Nose Mask": rec["Nose Mask"],
      "Gloves Category": rec["Gloves Category"],
      "Remarks": rec["Remarks"]
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "PPE_HISTORY");
  XLSX.writeFile(workbook, `PPE_History_${gatePassNo}.xlsx`);
}


/* ------------------------------------------------------------
   EXCEL IMPORT — BULK EMPLOYEE MASTER UPLOAD
   ------------------------------------------------------------ */

function triggerPPEEmployeeExcelImport() {
  if (!userState.isAdmin) {
    alert('❌ Admin access required to import records.');
    return;
  }
  const fileInput = document.getElementById('ppe-employee-excel-file');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
}

/* ------------------------------------------------------------
   FORMAT SAMPLE — EMPLOYEE MASTER IMPORT (NEW, ADDITIVE)
   Downloads a sample .xlsx with correct headers + one example
   row, so Admin knows exactly what format to upload.
   ------------------------------------------------------------ */
function downloadPPEEmployeeFormatSample() {
  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }
  if (typeof XLSX === 'undefined') {
    alert('❌ SheetJS library is loading. Please try again in a moment.');
    return;
  }

  const headers = ['Gate Pass No.', 'Employee Name', 'Department', 'Designation', 'Joining Date'];
  const sampleRows = [
    { 'Gate Pass No.': 'GP-1001', 'Employee Name': 'Ram Singh', 'Department': 'Mechanical', 'Designation': 'Fitter', 'Joining Date': '01-01-2023' },
    { 'Gate Pass No.': 'GP-1002', 'Employee Name': 'Suresh Kumar', 'Department': 'Electrical', 'Designation': 'Technician', 'Joining Date': '15-06-2022' }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "FORMAT_SAMPLE");
  XLSX.writeFile(workbook, "Employee_Master_Format_Sample.xlsx");
}

function normalizePPEEmployeeHeader(rawHeader) {
  if (!rawHeader) return '';
  const clean = String(rawHeader).trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  if (clean.includes('gatepass')) return 'Gate Pass No.';
  if (clean.includes('employeename') || clean === 'name') return 'Employee Name';
  if (clean.includes('department') || clean === 'dept') return 'Department';
  if (clean.includes('designation')) return 'Designation';
  if (clean.includes('joining') || clean.includes('doj')) return 'Joining Date';

  return String(rawHeader).trim();
}

function handlePPEEmployeeExcelImport(e) {
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

      const existingGatePassSet = new Set(ppeEmployeeData.map(e2 => String(e2["Gate Pass No."]).trim()));

      let newCount = 0, updatedCount = 0, skippedCount = 0;
      const recordsToUpsert = [];
      const processedInFile = new Set();

      rawRows.forEach(function(row) {
        const mapped = {};
        Object.keys(row).forEach(function(rawKey) {
          const normKey = normalizePPEEmployeeHeader(rawKey);
          mapped[normKey] = row[rawKey];
        });

        const gatePassNo = String(mapped["Gate Pass No."] || '').trim();

        if (!gatePassNo) {
          skippedCount++;
          return;
        }
        if (processedInFile.has(gatePassNo)) {
          // Later row with same Gate Pass in this file updates the earlier one; no duplicate created.
        }
        processedInFile.add(gatePassNo);

        if (existingGatePassSet.has(gatePassNo)) {
          updatedCount++;
        } else {
          newCount++;
        }

        const empObj = {
          "Gate Pass No.": gatePassNo,
          "Employee Name": String(mapped["Employee Name"] || '').trim(),
          "Department": String(mapped["Department"] || '').trim(),
          "Designation": String(mapped["Designation"] || '').trim(),
          "Joining Date": formatExcelDate(mapped["Joining Date"]),
          "Contractor": PPE_CONTRACTOR_NAME
        };

        recordsToUpsert.push(mapPPEEmployeeToSupabase(empObj));
      });

      const BATCH_SIZE = 100;
      for (let i = 0; i < recordsToUpsert.length; i += BATCH_SIZE) {
        const batch = recordsToUpsert.slice(i, i + BATCH_SIZE);
        const { error } = await client
          .from('ppe_employees')
          .upsert(batch, { onConflict: 'gate_pass_no' });

        if (error) {
          alert(`❌ Import stopped at Batch ${Math.floor(i / BATCH_SIZE) + 1} due to Error:\n${error.message}`);
          return;
        }
      }

      await fetchPPEEmployeesFromSupabase();
      renderPPEModule(true);

      alert(
        `📊 Employee Master Import Complete\n` +
        `===================================\n` +
        `🟢 New Employees: ${newCount}\n` +
        `🔵 Updated Employees: ${updatedCount}\n` +
        `🟡 Skipped Rows (missing Gate Pass): ${skippedCount}\n` +
        `-----------------------------------\n` +
        `📦 Total Employees in Master: ${ppeEmployeeData.length}`
      );

    } catch (err) {
      console.error("Employee import error:", err);
      alert('❌ Failed to process Excel file. Please ensure it is a valid .xlsx file.');
    }
  };

  reader.readAsArrayBuffer(file);
}


/* ------------------------------------------------------------
   EXCEL IMPORT — BULK PPE REGISTER UPLOAD
   (Matched against Employee Master by Gate Pass No.;
    unmatched Gate Pass Numbers are reported, not silently created)
   ------------------------------------------------------------ */

function triggerPPERecordsExcelImport() {
  if (!userState.isAdmin) {
    alert('❌ Admin access required to import records.');
    return;
  }
  const fileInput = document.getElementById('ppe-records-excel-file');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
}

/* ------------------------------------------------------------
   FORMAT SAMPLE — PPE REGISTER IMPORT (NEW, ADDITIVE)
   Downloads a sample .xlsx with correct headers + example rows,
   including a "pending PPE record" from a past date, so Admin
   knows exactly what format to upload (e.g. old pending records).
   Gate Pass No. must already exist in Employee Master.
   ------------------------------------------------------------ */
function downloadPPERecordsFormatSample() {
  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }
  if (typeof XLSX === 'undefined') {
    alert('❌ SheetJS library is loading. Please try again in a moment.');
    return;
  }

  const headers = [
    'Gate Pass No.', 'Issue Date', 'Jacket Size', 'Helmet Colour', 'Goggle Type',
    'Shoe Size', 'Electrical Shoe Size', 'Ear Plug', 'Nose Mask', 'Gloves Category', 'Remarks'
  ];
  const sampleRows = [
    {
      'Gate Pass No.': 'GP-1001', 'Issue Date': '01-01-2024', 'Jacket Size': 'L', 'Helmet Colour': 'Blue',
      'Goggle Type': 'Safety Goggle', 'Shoe Size': '9', 'Electrical Shoe Size': '', 'Ear Plug': 'Yes',
      'Nose Mask': 'Yes', 'Gloves Category': 'Cat-2', 'Remarks': 'Regular issue'
    },
    {
      'Gate Pass No.': 'GP-1002', 'Issue Date': '10-03-2023', 'Jacket Size': '', 'Helmet Colour': '',
      'Goggle Type': '', 'Shoe Size': '', 'Electrical Shoe Size': '8', 'Ear Plug': '',
      'Nose Mask': '', 'Gloves Category': '', 'Remarks': 'Pending record from last year'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "FORMAT_SAMPLE");
  XLSX.writeFile(workbook, "PPE_Register_Format_Sample.xlsx");
}

function normalizePPERecordHeader(rawHeader) {
  if (!rawHeader) return '';
  const clean = String(rawHeader).trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  if (clean.includes('gatepass')) return 'Gate Pass No.';
  if (clean.includes('issuedate') || clean.includes('date')) return 'Issue Date';
  if (clean.includes('electrical') || clean.includes('elecshoe')) return 'Electrical Shoe Size';
  if (clean.includes('jacket')) return 'Jacket Size';
  if (clean.includes('helmet')) return 'Helmet Colour';
  if (clean.includes('goggle')) return 'Goggle Type';
  if (clean.includes('shoe')) return 'Shoe Size';
  if (clean.includes('earplug') || clean.includes('ear')) return 'Ear Plug';
  if (clean.includes('nosemask') || clean.includes('mask')) return 'Nose Mask';
  if (clean.includes('gloves')) return 'Gloves Category';
  if (clean.includes('remark')) return 'Remarks';

  return String(rawHeader).trim();
}

function handlePPERecordsExcelImport(e) {
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

      const employeeMap = new Map(ppeEmployeeData.map(emp => [String(emp["Gate Pass No."]).trim(), emp]));

      const recordsToInsert = [];
      const unmatchedGatePasses = [];
      let skippedNoDate = 0;

      rawRows.forEach(function(row, index) {
        const mapped = {};
        Object.keys(row).forEach(function(rawKey) {
          const normKey = normalizePPERecordHeader(rawKey);
          mapped[normKey] = row[rawKey];
        });

        const gatePassNo = String(mapped["Gate Pass No."] || '').trim();
        const issueDate = formatExcelDate(mapped["Issue Date"]);

        if (!gatePassNo) return;
        if (!issueDate) { skippedNoDate++; return; }

        const emp = employeeMap.get(gatePassNo);
        if (!emp) {
          unmatchedGatePasses.push(gatePassNo + ' (row ' + (index + 2) + ')');
          return;
        }

        const recObj = {
          "Gate Pass No.": gatePassNo,
          "Employee Name": emp["Employee Name"],
          "Issue Date": issueDate,
          "Jacket Size": String(mapped["Jacket Size"] || '').trim(),
          "Helmet Colour": String(mapped["Helmet Colour"] || '').trim(),
          "Goggle Type": String(mapped["Goggle Type"] || '').trim(),
          "Shoe Size": String(mapped["Shoe Size"] || '').trim(),
          "Electrical Shoe Size": String(mapped["Electrical Shoe Size"] || '').trim(),
          "Ear Plug": String(mapped["Ear Plug"] || '').trim(),
          "Nose Mask": String(mapped["Nose Mask"] || '').trim(),
          "Gloves Category": String(mapped["Gloves Category"] || '').trim(),
          "Remarks": String(mapped["Remarks"] || '').trim()
        };

        recordsToInsert.push(mapPPERecordToSupabase(recObj));
      });

      if (recordsToInsert.length > 0) {
        const BATCH_SIZE = 100;
        for (let i = 0; i < recordsToInsert.length; i += BATCH_SIZE) {
          const batch = recordsToInsert.slice(i, i + BATCH_SIZE);
          const { error } = await client.from('ppe_records').insert(batch);

          if (error) {
            alert(`❌ Import stopped at Batch ${Math.floor(i / BATCH_SIZE) + 1} due to Error:\n${error.message}`);
            return;
          }
        }
      }

      await fetchPPERecordsFromSupabase();
      renderPPEModule(true);

      let summaryMsg =
        `📊 PPE Register Import Complete\n` +
        `===================================\n` +
        `🟢 Records Inserted: ${recordsToInsert.length}\n` +
        `🔴 Unmatched Gate Pass Numbers (skipped): ${unmatchedGatePasses.length}\n` +
        `🟡 Rows Skipped (missing Issue Date): ${skippedNoDate}\n`;

      if (unmatchedGatePasses.length > 0) {
        summaryMsg += `\nUnmatched Gate Pass Numbers — add them to Employee Master first, then re-import:\n` +
          unmatchedGatePasses.slice(0, 20).join(', ') +
          (unmatchedGatePasses.length > 20 ? ` ...and ${unmatchedGatePasses.length - 20} more` : '');
      }

      alert(summaryMsg);

    } catch (err) {
      console.error("PPE records import error:", err);
      alert('❌ Failed to process Excel file. Please ensure it is a valid .xlsx file.');
    }
  };

  reader.readAsArrayBuffer(file);
}


/* ============================================================
   SAFETY INSTRUMENTS MODULE (Calibration Tracking)
   Multi Gas Detector / H2 Gas Detector / O2 Gas Detector /
   Digital Lux Meter / Sound Meter
   ============================================================ */

const INSTRUMENT_MASTER_FIELDS = [
  "S. No.",
  "Owner",
  "Instrument Type",
  "Product No.",
  "Serial No.",
  "Certification No.",
  "Calibration Date",
  "Calibration Due Date",
  "Status",
  "Handover To",
  "Remarks",
  "Expiry Reminder",
  "Expired"
];

let currentInstrumentFilters = {
  globalSearch: '',
  type: '',
  calStatus: '',
  status: '',
  owner: ''
};

function mapInstrumentFromSupabase(item) {
  return {
    id: String(item.id || ''),
    "S. No.": String(item.s_no || ''),
    "Owner": item.owner || '',
    "Instrument Type": item.instrument_type || '',
    "Product No.": item.product_no || '',
    "Serial No.": item.serial_no || '',
    "Certification No.": item.certification_no || '',
    "Calibration Date": item.calibration_date || '',
    "Calibration Due Date": item.calibration_due_date || '',
    "Status": item.status || 'Working',
    "Handover To": item.handover_to || '',
    "Remarks": item.remarks || ''
  };
}

function mapInstrumentToSupabase(inst) {
  return {
    s_no: String(inst["S. No."] || ''),
    owner: String(inst["Owner"] || ''),
    instrument_type: String(inst["Instrument Type"] || ''),
    product_no: String(inst["Product No."] || ''),
    serial_no: String(inst["Serial No."] || ''),
    certification_no: String(inst["Certification No."] || ''),
    calibration_date: String(inst["Calibration Date"] || ''),
    calibration_due_date: String(inst["Calibration Due Date"] || ''),
    status: String(inst["Status"] || 'Working'),
    handover_to: String(inst["Handover To"] || ''),
    remarks: String(inst["Remarks"] || '')
  };
}


/* ============================================================
   FETCH SAFETY INSTRUMENTS FROM SUPABASE
   ============================================================ */

async function fetchInstrumentsFromSupabase() {

  const client = initSupabase();

  if (!client) {
    console.warn("Supabase client is not available.");
    return;
  }

  try {

    const { data, error } = await client
      .from('safety_instrument_records')
      .select('*');

    if (error) {
      console.error("Supabase fetch error (instruments):", error);
      return;
    }

    if (data) {
      dbData.instruments = data.map(mapInstrumentFromSupabase);

      populateInstrumentFilterDropdowns();

      const instScreen = document.getElementById('instruments-module-screen');
      if (instScreen && !instScreen.classList.contains('hidden-screen')) {
        renderInstrumentsModule(true);
      }
    }

  } catch (err) {
    console.error("Failed to fetch instruments from Supabase:", err);
  }

}


/* ============================================================
   FILTER ENGINE & DROPDOWN INITIALIZATION
   ============================================================ */

function populateInstrumentFilterDropdowns() {

  const typeSelect = document.getElementById('filter-instrument-type');
  const ownerSelect = document.getElementById('filter-instrument-owner');
  const statusSelect = document.getElementById('filter-instrument-status');

  if (!typeSelect || !ownerSelect) return;

  const types = new Set();
  const owners = new Set();
  const statuses = new Set(["Working", "Calibration Due", "Missing from CCR", "Not in Use"]);

  dbData.instruments.forEach(function(inst) {
    if (inst["Instrument Type"]) types.add(inst["Instrument Type"]);
    if (inst["Owner"]) owners.add(inst["Owner"]);
    if (inst["Status"]) statuses.add(inst["Status"]);
  });

  typeSelect.innerHTML = '<option value="">All Types</option>' +
    Array.from(types).sort().map(t => `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`).join('');

  ownerSelect.innerHTML = '<option value="">All Owners</option>' +
    Array.from(owners).sort().map(o => `<option value="${escapeHTML(o)}">${escapeHTML(o)}</option>`).join('');

  if (statusSelect) {
    statusSelect.innerHTML = '<option value="">All Status</option>' +
      Array.from(statuses).sort().map(s => `<option value="${escapeHTML(s)}">${escapeHTML(s)}</option>`).join('');
    statusSelect.value = currentInstrumentFilters.status || '';
  }

}

function sortInstruments(instruments) {
  if (!currentInstrumentSortColumn) return instruments;

  return [...instruments].sort((a, b) => {
    let valA = a[currentInstrumentSortColumn] || '';
    let valB = b[currentInstrumentSortColumn] || '';

    valA = String(valA).toLowerCase();
    valB = String(valB).toLowerCase();

    if (valA < valB) return currentInstrumentSortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return currentInstrumentSortOrder === 'asc' ? 1 : -1;
    return 0;
  });
}

function getFilteredInstruments() {

  const filtered = dbData.instruments.filter(function(inst) {

    const days = getDaysLeft(inst["Calibration Due Date"]);
    const statusObj = getHoistStatus(days);

    if (currentInstrumentFilters.globalSearch) {
      const searchStr = currentInstrumentFilters.globalSearch.toLowerCase();
      const searchableText = [
        inst["S. No."],
        inst["Owner"],
        inst["Instrument Type"],
        inst["Product No."],
        inst["Serial No."],
        inst["Certification No."],
        inst["Handover To"],
        inst["Remarks"]
      ].join(' ').toLowerCase();

      if (!searchableText.includes(searchStr)) return false;
    }

    if (currentInstrumentFilters.type && inst["Instrument Type"] !== currentInstrumentFilters.type) return false;
    if (currentInstrumentFilters.calStatus && statusObj.statusKey !== currentInstrumentFilters.calStatus) return false;
    if (currentInstrumentFilters.status && inst["Status"] !== currentInstrumentFilters.status) return false;
    if (currentInstrumentFilters.owner && inst["Owner"] !== currentInstrumentFilters.owner) return false;

    return true;

  });

  return sortInstruments(filtered);

}

function handleInstrumentTableSort(columnKey) {
  if (currentInstrumentSortColumn === columnKey) {
    currentInstrumentSortOrder = currentInstrumentSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    currentInstrumentSortColumn = columnKey;
    currentInstrumentSortOrder = 'asc';
  }
  renderInstrumentsModule(true);
}

function applyInstrumentFilters() {

  currentInstrumentFilters.globalSearch = document.getElementById('filter-instrument-search')?.value.trim() || '';
  currentInstrumentFilters.type = document.getElementById('filter-instrument-type')?.value || '';
  currentInstrumentFilters.calStatus = document.getElementById('filter-instrument-cal-status')?.value || '';
  currentInstrumentFilters.status = document.getElementById('filter-instrument-status')?.value || '';
  currentInstrumentFilters.owner = document.getElementById('filter-instrument-owner')?.value || '';

  updateInstrumentFilterIndicator();
  renderInstrumentsModule(true);

}

function resetInstrumentFilters() {

  currentInstrumentFilters = { globalSearch: '', type: '', calStatus: '', status: '', owner: '' };

  const elSearch = document.getElementById('filter-instrument-search');
  const elType = document.getElementById('filter-instrument-type');
  const elCal = document.getElementById('filter-instrument-cal-status');
  const elOwner = document.getElementById('filter-instrument-owner');
  const elStatus = document.getElementById('filter-instrument-status');

  if (elSearch) elSearch.value = '';
  if (elType) elType.value = '';
  if (elCal) elCal.value = '';
  if (elStatus) elStatus.value = '';
  if (elOwner) elOwner.value = '';

  updateInstrumentFilterIndicator();
  renderInstrumentsModule(true);

}

function updateInstrumentFilterIndicator() {
  const indicator = document.getElementById('instrument-filter-active-indicator');
  if (!indicator) return;

  const activeTerms = [];
  if (currentInstrumentFilters.globalSearch) activeTerms.push(`Search: "${currentInstrumentFilters.globalSearch}"`);
  if (currentInstrumentFilters.type) activeTerms.push(`Type: ${currentInstrumentFilters.type}`);
  if (currentInstrumentFilters.calStatus) activeTerms.push(`Status: ${currentInstrumentFilters.calStatus.toUpperCase()}`);
  if (currentInstrumentFilters.status) activeTerms.push(`Instrument Status: ${currentInstrumentFilters.status}`);
  if (currentInstrumentFilters.owner) activeTerms.push(`Owner: ${currentInstrumentFilters.owner}`);

  if (activeTerms.length === 0) {
    indicator.innerHTML = 'Showing all instrument records.';
  } else {
    indicator.innerHTML = '⚡ <strong>Active Filters:</strong> ' + activeTerms.join(' | ');
  }
}


/* ============================================================
   CHARTS
   ============================================================ */

function renderInstrumentCharts(filteredInstruments) {

  if (typeof Chart === 'undefined') return;

  const textColor = getChartTextColor();
  const gridColor = getChartGridColor();

  const datalabelsConfig = {
    color: '#ffffff',
    font: { weight: 'bold', size: 11 },
    formatter: function(val) { return val > 0 ? val : ''; }
  };

  let validCount = 0, dueCount = 0, expiredCount = 0;
  filteredInstruments.forEach(inst => {
    const days = getDaysLeft(inst["Calibration Due Date"]);
    const st = getHoistStatus(days);
    if (st.statusKey === 'valid') validCount++;
    else if (st.statusKey === 'due') dueCount++;
    else if (st.statusKey === 'expired') expiredCount++;
  });

  renderChart('chart-instrument-status-donut', {
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

  const typeCounts = {};
  filteredInstruments.forEach(inst => {
    const tp = inst["Instrument Type"] || 'Other';
    typeCounts[tp] = (typeCounts[tp] || 0) + 1;
  });

  renderChart('chart-instrument-type-bar', {
    type: 'bar',
    data: {
      labels: Object.keys(typeCounts),
      datasets: [{
        label: 'Instrument Count',
        data: Object.values(typeCounts),
        backgroundColor: '#2563eb',
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


/* ============================================================
   RENDER, SELECTION & BULK DELETE
   ============================================================ */

function toggleSelectAllInstruments(masterCheckbox) {
  if (!userState.isAdmin) return;

  const filteredInstruments = getFilteredInstruments();
  if (masterCheckbox.checked) {
    filteredInstruments.forEach(inst => {
      const recId = String(inst.id || '').trim();
      if (recId) selectedInstrumentIds.add(recId);
    });
  } else {
    filteredInstruments.forEach(inst => {
      const recId = String(inst.id || '').trim();
      if (recId) selectedInstrumentIds.delete(recId);
    });
  }
  renderInstrumentsModule(true);
}

function toggleSingleInstrumentSelect(recId) {
  if (!userState.isAdmin) return;

  const cleanId = String(recId || '').trim();
  if (!cleanId) return;

  if (selectedInstrumentIds.has(cleanId)) {
    selectedInstrumentIds.delete(cleanId);
  } else {
    selectedInstrumentIds.add(cleanId);
  }
  renderInstrumentsModule(true);
}

async function deleteSelectedInstruments() {
  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }

  const selectedList = Array.from(selectedInstrumentIds);
  if (selectedList.length === 0) {
    alert('⚠️ Please select at least one record to delete.');
    return;
  }

  if (!confirm(`⚠️ Are you sure you want to permanently delete ${selectedList.length} selected instrument record(s)?`)) {
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
        .from('safety_instrument_records')
        .delete()
        .in('id', batch);

      if (error) {
        alert('❌ Supabase Delete Error: ' + error.message);
        return;
      }
    }

    selectedInstrumentIds.clear();
    await fetchInstrumentsFromSupabase();
    alert(`✅ Successfully deleted ${selectedList.length} selected instrument record(s).`);

  } catch (err) {
    alert('❌ Exception during bulk deletion: ' + err.message);
  }
}

function renderInstrumentsModule(skipScreenSwitch) {

  if (!skipScreenSwitch) {
    showScreen('instruments-module-screen');
  }

  const tbody = document.getElementById('instrument-table-body');
  if (!tbody) return;

  const filteredInstruments = getFilteredInstruments();

  let valid = 0;
  let due = 0;
  let expired = 0;

  const visibleWithId = filteredInstruments.filter(inst => inst.id);
  const selectedVisibleCount = visibleWithId.filter(inst => selectedInstrumentIds.has(String(inst.id))).length;

  const topSelectAllContainer = document.getElementById('instrument-top-select-all-container');
  if (topSelectAllContainer) {
    topSelectAllContainer.style.display = userState.isAdmin ? 'inline-flex' : 'none';
  }

  const masterCheckEl = document.getElementById('select-all-instruments-checkbox');
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

  const bulkDeleteBtn = document.getElementById('btn-instrument-bulk-delete');
  if (bulkDeleteBtn) {
    if (userState.isAdmin) {
      bulkDeleteBtn.style.display = 'inline-block';
      const count = selectedInstrumentIds.size;
      bulkDeleteBtn.innerText = `🗑️ Delete Selected (${count})`;
      bulkDeleteBtn.disabled = (count === 0);
    } else {
      bulkDeleteBtn.style.display = 'none';
    }
  }

  tbody.innerHTML = filteredInstruments.map(function(inst) {

    const days = getDaysLeft(inst["Calibration Due Date"]);
    const status = getHoistStatus(days);

    if (days !== null) {
      if (days <= 0) expired++;
      else if (days <= 30) due++;
      else valid++;
    }

    let actionHTML = '';
    if (userState.isAdmin) {
      actionHTML = '<button type="button" class="stlp-btn-sm" onclick="editInstrument(\'' + inst.id + '\')">Edit</button>';
    } else {
      actionHTML = '<span style="color:#94a3b8; font-size:0.75rem;">View Only</span>';
    }

    const recId = String(inst.id || '').trim();
    const isChecked = selectedInstrumentIds.has(recId) ? 'checked' : '';
    const safeIdForJs = recId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const checkboxHTML = userState.isAdmin ? `<input type="checkbox" ${isChecked} onchange="toggleSingleInstrumentSelect('${safeIdForJs}')" />` : '-';

    return `
      <tr>
        <td style="text-align:center;">${checkboxHTML}</td>
        <td><strong>${escapeHTML(inst["S. No."])}</strong></td>
        <td>${escapeHTML(inst["Owner"])}</td>
        <td>${escapeHTML(inst["Instrument Type"])}</td>
        <td>${escapeHTML(inst["Product No."])}</td>
        <td><code class="tag-nom">${escapeHTML(inst["Serial No."])}</code></td>
        <td>${escapeHTML(inst["Certification No."])}</td>
        <td>${escapeHTML(inst["Calibration Date"])}</td>
        <td>${escapeHTML(inst["Calibration Due Date"])}</td>
        <td>${escapeHTML(inst["Status"])}</td>
        <td>${escapeHTML(inst["Handover To"])}</td>
        <td>${escapeHTML(inst["Remarks"])}</td>
        <td>
          <span class="badge-status ${status.className}">
            ${status.label}
            ${days !== null ? `(${days}d)` : ''}
          </span>
        </td>
        <td>${actionHTML}</td>
      </tr>
    `;
  }).join('');

  const totalElement = document.getElementById('stat-instrument-total');
  const validElement = document.getElementById('stat-instrument-valid');
  const dueElement = document.getElementById('stat-instrument-due');
  const expiredElement = document.getElementById('stat-instrument-expired');

  if (totalElement) totalElement.innerText = filteredInstruments.length;
  if (validElement) validElement.innerText = valid;
  if (dueElement) dueElement.innerText = due;
  if (expiredElement) expiredElement.innerText = expired;

  renderInstrumentCharts(filteredInstruments);

}


/* ============================================================
   ADD & EDIT SAFETY INSTRUMENT MODAL FUNCTIONS
   ============================================================ */

function openAddInstrumentModal() {
  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }
  const form = document.getElementById('instrument-form');
  if (form) form.reset();

  const editIdInput = document.getElementById('i-editing-id');
  if (editIdInput) editIdInput.value = '';

  const modalTitle = document.getElementById('instrument-modal-title-text');
  if (modalTitle) modalTitle.innerText = 'Add New Safety Instrument';

  const modal = document.getElementById('instrument-modal');
  if (modal) modal.classList.remove('hidden-screen');
}

function editInstrument(id) {
  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }

  const inst = dbData.instruments.find(item => String(item.id) === String(id));
  if (!inst) {
    alert('❌ Instrument record not found.');
    return;
  }

  const editIdInput = document.getElementById('i-editing-id');
  if (editIdInput) editIdInput.value = inst.id;

  const setValue = (inputId, val) => {
    const el = document.getElementById(inputId);
    if (el) el.value = val !== undefined && val !== null ? String(val) : '';
  };

  setValue('i-type', inst["Instrument Type"]);
  setValue('i-owner', inst["Owner"]);
  setValue('i-product-no', inst["Product No."]);
  setValue('i-serial-no', inst["Serial No."]);
  setValue('i-cert-no', inst["Certification No."]);
  setValue('i-status', inst["Status"] || 'Working');
  setValue('i-handover', inst["Handover To"]);
  setValue('i-remarks', inst["Remarks"]);

  const convertToInputDate = (str) => {
    const d = parseCustomDate(str);
    if (!d) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  setValue('i-cal-date', convertToInputDate(inst["Calibration Date"]));
  setValue('i-cal-due-date', convertToInputDate(inst["Calibration Due Date"]));

  const modalTitle = document.getElementById('instrument-modal-title-text');
  if (modalTitle) modalTitle.innerText = 'Edit Instrument (' + (inst["Serial No."] || inst["Instrument Type"]) + ')';

  const modal = document.getElementById('instrument-modal');
  if (modal) modal.classList.remove('hidden-screen');
}

function closeInstrumentModal() {
  const modal = document.getElementById('instrument-modal');
  if (modal) modal.classList.add('hidden-screen');
}

async function saveInstrumentRecord(e) {

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

  const editingId = getVal('i-editing-id');
  const instType = getVal('i-type');
  const serialNo = getVal('i-serial-no');
  const rawCalDueDate = getVal('i-cal-due-date');
  const rawCalDate = getVal('i-cal-date');

  if (!instType || !serialNo || !rawCalDueDate) {
    alert('❌ Please fill in all required fields (Instrument Type, Serial No., Calibration Due Date).');
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

  const calDueDate = formatToDDMMYYYY(rawCalDueDate);
  const calDate = formatToDDMMYYYY(rawCalDate);

  const instObj = {
    "S. No.": editingId ? (dbData.instruments.find(i => String(i.id) === String(editingId))?.["S. No."] || '1') : String(dbData.instruments.length + 1),
    "Owner": getVal('i-owner'),
    "Instrument Type": instType,
    "Product No.": getVal('i-product-no'),
    "Serial No.": serialNo,
    "Certification No.": getVal('i-cert-no'),
    "Calibration Date": calDate,
    "Calibration Due Date": calDueDate,
    "Status": getVal('i-status') || 'Working',
    "Handover To": getVal('i-handover'),
    "Remarks": getVal('i-remarks')
  };

  const supabaseRow = mapInstrumentToSupabase(instObj);

  try {

    if (editingId) {
      const targetRecord = dbData.instruments.find(i => String(i.id) === String(editingId));
      const targetSerial = targetRecord ? targetRecord["Serial No."] : supabaseRow.serial_no;

      const { error } = await client
        .from('safety_instrument_records')
        .update(supabaseRow)
        .eq('serial_no', targetSerial);

      if (error) {
        alert('❌ Supabase Update Error: ' + error.message);
        return;
      }
    } else {
      const { error } = await client
        .from('safety_instrument_records')
        .upsert([supabaseRow], { onConflict: 'serial_no' });

      if (error) {
        alert('❌ Supabase Insert Error: ' + error.message);
        return;
      }
    }

    closeInstrumentModal();
    await fetchInstrumentsFromSupabase();
    alert('✅ Safety instrument record saved permanently to Supabase.');

  } catch (err) {
    alert('❌ Exception during save: ' + err.message);
  }

}


/* ============================================================
   EXCEL EXPORT ENGINE
   ============================================================ */

function exportInstrumentExcel() {

  if (typeof XLSX === 'undefined') {
    alert('❌ SheetJS library is loading. Please try again in a moment.');
    return;
  }

  const recordsToExport = getFilteredInstruments();

  if (!recordsToExport || recordsToExport.length === 0) {
    alert('❌ No instrument records available to export.');
    return;
  }

  const exportData = recordsToExport.map(function(inst) {
    const days = getDaysLeft(inst["Calibration Due Date"]);
    const status = getHoistStatus(days);
    const rowObj = {};
    INSTRUMENT_MASTER_FIELDS.forEach(function(field) {
      if (field === "Expiry Reminder") {
        rowObj[field] = status.statusKey === 'expired' ? 'EXPIRED' : (status.statusKey === 'due' ? 'DUE SOON' : 'VALID');
      } else if (field === "Expired") {
        rowObj[field] = status.statusKey === 'expired' ? 'Expired' : 'No';
      } else {
        rowObj[field] = inst[field] !== undefined && inst[field] !== null ? String(inst[field]) : '';
      }
    });
    return rowObj;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData, { header: INSTRUMENT_MASTER_FIELDS });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "SAFETY_INSTRUMENTS");

  const todayObj = new Date();
  const day = String(todayObj.getDate()).padStart(2, '0');
  const month = String(todayObj.getMonth() + 1).padStart(2, '0');
  const year = todayObj.getFullYear();
  const todayStr = `${day}-${month}-${year}`;

  const fileName = 'Safety_Instruments_' + todayStr + '.xlsx';

  XLSX.writeFile(workbook, fileName);

}


/* ============================================================
   EXCEL IMPORT ENGINE
   ============================================================ */

function triggerInstrumentExcelImport() {
  if (!userState.isAdmin) {
    alert('❌ Admin access required to import records.');
    return;
  }

  const fileInput = document.getElementById('instrument-excel-file');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
}

function normalizeInstrumentImportHeader(rawHeader, seenStatusCountRef) {
  if (!rawHeader) return '';
  const clean = String(rawHeader).trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  if (clean.includes('srno') || clean.includes('sno') || clean === 'sr') return 'S. No.';
  if (clean === 'owner') return 'Owner';
  if (clean.includes('instrumenttype') || clean.includes('instrumentstype') || clean === 'type') return 'Instrument Type';
  if (clean.includes('productno') || clean === 'product' || clean.includes('model')) return 'Product No.';
  if (clean.includes('serialno') || clean === 'serial') return 'Serial No.';
  if (clean.includes('certificationno') || clean.includes('certno') || clean.includes('cert')) return 'Certification No.';
  if (clean.includes('calibrationdate') && !clean.includes('due')) return 'Calibration Date';
  if (clean.includes('calibrationduedate') || clean.includes('duedate')) return 'Calibration Due Date';
  if (clean.includes('handover')) return 'Handover To';
  if (clean.includes('remark') || clean.includes('note')) return 'Remarks';
  // The source workbook may have TWO columns literally named "Status": the
  // first (working status e.g. Working/Not in Use) and a second, computed
  // one (Active/Expiry Reminder). We only want the first — the computed
  // one is recalculated automatically here from the due date, so any
  // repeat "Status" column (and any "Expired" column) is ignored.
  if (clean === 'status') {
    seenStatusCountRef.count++;
    return seenStatusCountRef.count > 1 ? '__ignore__' : 'Status';
  }
  if (clean === 'expired') return '__ignore__';

  return String(rawHeader).trim();
}

function handleInstrumentExcelImport(e) {

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

      // Read as an array-of-arrays (positional) instead of header-keyed
      // objects, so a source sheet with a duplicate "Status" header does
      // not silently overwrite the first "Status" column's values.
      const rawGrid = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: true });

      if (!rawGrid || rawGrid.length < 2) {
        alert('❌ No data rows found in Excel sheet.');
        return;
      }

      const headerRow = rawGrid[0];
      const statusCountRef = { count: 0 };
      const normHeaders = headerRow.map(function(h) { return normalizeInstrumentImportHeader(h, statusCountRef); });
      const dataRows = rawGrid.slice(1).filter(row => row.some(cell => cell !== "" && cell !== null && cell !== undefined));

      if (dataRows.length === 0) {
        alert('❌ No data rows found in Excel sheet.');
        return;
      }

      const client = initSupabase();
      if (!client) {
        alert('❌ Supabase client is not available.');
        return;
      }

      const existingSerialSet = new Set(dbData.instruments.map(i => String(i["Serial No."]).trim().toUpperCase()));

      let autoGeneratedCount = 0;
      let newRecordsCount = 0;
      let updatedRecordsCount = 0;

      const recordsToUpsert = [];
      const processedInFile = new Set();

      dataRows.forEach(function(row, index) {
        const mappedRecord = {};
        normHeaders.forEach(function(normKey, colIdx) {
          if (!normKey || normKey === '__ignore__') return;
          mappedRecord[normKey] = row[colIdx];
        });

        let rawSerial = String(mappedRecord["Serial No."] || '').trim();

        if (!rawSerial) {
          rawSerial = 'SI-AUTO-' + (index + 1) + '-' + Date.now().toString().slice(-4);
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

        const calDate = formatExcelDate(mappedRecord["Calibration Date"]);
        const calDueDate = formatExcelDate(mappedRecord["Calibration Due Date"]);

        const instObj = {
          "S. No.": String(mappedRecord["S. No."] || '').trim() || String(index + 1),
          "Owner": String(mappedRecord["Owner"] || '').trim(),
          "Instrument Type": String(mappedRecord["Instrument Type"] || '').trim() || 'Multi Gas Detector',
          "Product No.": String(mappedRecord["Product No."] || '').trim(),
          "Serial No.": rawSerial,
          "Certification No.": String(mappedRecord["Certification No."] || '').trim(),
          "Calibration Date": calDate,
          "Calibration Due Date": calDueDate,
          "Status": String(mappedRecord["Status"] || '').trim() || 'Working',
          "Handover To": String(mappedRecord["Handover To"] || '').trim(),
          "Remarks": String(mappedRecord["Remarks"] || '').trim()
        };

        recordsToUpsert.push(mapInstrumentToSupabase(instObj));
      });

      const BATCH_SIZE = 100;
      for (let i = 0; i < recordsToUpsert.length; i += BATCH_SIZE) {
        const batch = recordsToUpsert.slice(i, i + BATCH_SIZE);

        const { error } = await client
          .from('safety_instrument_records')
          .upsert(batch, { onConflict: 'serial_no' });

        if (error) {
          alert(`❌ Import stopped at Batch ${Math.floor(i / BATCH_SIZE) + 1} due to Error:\n${error.message}`);
          return;
        }
      }

      await fetchInstrumentsFromSupabase();

      const summaryMsg =
        `📊 Excel Import Complete Summary\n` +
        `===================================\n` +
        `🟢 New Records: ${newRecordsCount}\n` +
        `🔵 Updated Records: ${updatedRecordsCount}\n` +
        `🏷️ Auto-Generated Serial Numbers: ${autoGeneratedCount}\n` +
        `-----------------------------------\n` +
        `📋 Total Records Processed: ${dataRows.length}\n` +
        `📦 Total Instruments in Portal: ${dbData.instruments.length}`;

      alert(summaryMsg);

    } catch (err) {
      console.error("Instrument import error:", err);
      alert('❌ Failed to process Excel file. Please ensure it is a valid .xlsx file.');
    }

  };

  reader.readAsArrayBuffer(file);

}


/* ============================================================
   J&FC TRACKER MODULE
   Red / Green / Yellow / White notices (Excel columns A to S)
   ============================================================ */

const JFC_FIELDS = [
  "Sr. No.", "Date", "Area", "Location", "Observee Name", "Dept", "Sub Dept",
  "Observee GP ID/Emp. ID", "Observee Designation", "Observee Company",
  "Descriptions of Positive / At-Risk Behavior", "Deviation Category",
  "Type of Ticket Issued", "Observer Name", "Observer GP ID/Emp. ID",
  "Observer Designation", "Observer Company", "Type of Action Taken", "Remarks, If any"
];

const JFC_DB_COLS = [
  "sr_no", "notice_date", "area", "location", "observee_name", "observee_dept", "observee_sub_dept",
  "observee_gp_id", "observee_designation", "observee_company",
  "description", "deviation_category",
  "notice_type", "observer_name", "observer_gp_id",
  "observer_designation", "observer_company", "action_taken", "remarks"
];

// [field, table heading, min width px]
const JFC_TABLE_COLS = [
  ["Sr. No.", "SR. NO.", 0], ["Date", "DATE", 90], ["Area", "AREA", 0], ["Location", "LOCATION", 140],
  ["Observee Name", "OBSERVEE NAME", 150], ["Dept", "DEPT", 0], ["Sub Dept", "SUB DEPT", 0],
  ["Observee GP ID/Emp. ID", "OBSERVEE GP ID", 0], ["Observee Designation", "OBSERVEE DESIGNATION", 130],
  ["Observee Company", "OBSERVEE COMPANY", 130],
  ["Descriptions of Positive / At-Risk Behavior", "DESCRIPTION", 300], ["Deviation Category", "DEVIATION CATEGORY", 130],
  ["Type of Ticket Issued", "NOTICE TYPE", 0], ["Observer Name", "OBSERVER NAME", 150],
  ["Observer GP ID/Emp. ID", "OBSERVER GP ID", 0], ["Observer Designation", "OBSERVER DESIGNATION", 130],
  ["Observer Company", "OBSERVER COMPANY", 130], ["Type of Action Taken", "ACTION TAKEN", 280], ["Remarks, If any", "REMARKS", 110]
];

const JFC_NOTICE_TYPES = ["Red", "Green", "Yellow", "White"];
const JFC_PAGE_SIZE = 200;

dbData.jfc = [];
let selectedJfcIds = new Set();
let jfcSortColumn = 'Date';
let jfcSortOrder = 'desc';
let jfcVisibleLimit = JFC_PAGE_SIZE;
let currentJfcFilters = { search: '', type: '', area: '', dept: '', company: '', category: '', from: '', to: '' };


function mapJfcFromSupabase(item) {
  const rec = { id: String(item.id || '') };
  JFC_FIELDS.forEach(function(f, i) {
    const v = item[JFC_DB_COLS[i]];
    rec[f] = (v === null || v === undefined) ? '' : String(v);
  });
  return rec;
}

function mapJfcToSupabase(rec) {
  const row = {};
  JFC_FIELDS.forEach(function(f, i) {
    row[JFC_DB_COLS[i]] = String(rec[f] === null || rec[f] === undefined ? '' : rec[f]);
  });
  row.sr_no = parseInt(rec["Sr. No."], 10);
  return row;
}

function jfcToDDMMYYYY(str) {
  const d = parseCustomDate(str);
  if (!d) return str || '';
  return String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear();
}

function jfcNextSrNo() {
  let max = 0;
  dbData.jfc.forEach(function(r) {
    const n = parseInt(r["Sr. No."], 10);
    if (!isNaN(n) && n > max) max = n;
  });
  return max + 1;
}


/* ---------- FETCH (paged: Supabase returns max 1000 rows per request) ---------- */

async function fetchJfcFromSupabase() {

  const client = initSupabase();
  if (!client) return;

  try {
    let all = [];
    let from = 0;
    const step = 1000;

    while (true) {
      const { data, error } = await client
        .from('jfc_tracker_records')
        .select('*')
        .order('id', { ascending: true })
        .range(from, from + step - 1);

      if (error) {
        console.error("Supabase fetch error (J&FC tracker):", error);
        return;
      }
      all = all.concat(data || []);
      if (!data || data.length < step) break;
      from += step;
    }

    dbData.jfc = all.map(mapJfcFromSupabase);
    populateJfcFilterDropdowns();

    const scr = document.getElementById('jfc-module-screen');
    if (scr && !scr.classList.contains('hidden-screen')) {
      renderJfcModule(true);
    }

  } catch (err) {
    console.error("Failed to fetch J&FC tracker from Supabase:", err);
  }

}


/* ---------- FILTERS ---------- */

function jfcUnique(fields) {
  const set = new Set();
  dbData.jfc.forEach(function(r) {
    fields.forEach(function(f) { if (r[f]) set.add(r[f]); });
  });
  return Array.from(set).sort(function(a, b) { return a.localeCompare(b); });
}

function populateJfcFilterDropdowns() {

  const fill = function(id, label, field) {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = `<option value="">${label}</option>` +
      jfcUnique([field]).map(v => `<option value="${escapeHTML(v)}">${escapeHTML(v)}</option>`).join('');
    el.value = cur;
  };

  fill('filter-jfc-area', 'All Areas', 'Area');
  fill('filter-jfc-dept', 'All Depts', 'Dept');
  fill('filter-jfc-company', 'All Companies', 'Observee Company');
  fill('filter-jfc-category', 'All Categories', 'Deviation Category');

  // Suggestions for the Add/Edit form (keeps spellings consistent)
  const dl = function(id, fields) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = jfcUnique(fields).map(v => `<option value="${escapeHTML(v)}"></option>`).join('');
  };
  dl('jfc-dl-area', ['Area']);
  dl('jfc-dl-dept', ['Dept']);
  dl('jfc-dl-subdept', ['Sub Dept']);
  dl('jfc-dl-company', ['Observee Company', 'Observer Company']);
  dl('jfc-dl-category', ['Deviation Category']);

}

function sortJfc(list) {
  const col = jfcSortColumn;
  const dir = jfcSortOrder === 'asc' ? 1 : -1;
  const dateVal = function(s) { const d = parseCustomDate(s); return d ? d.getTime() : 0; };
  const srVal = function(r) { const n = parseInt(r["Sr. No."], 10); return isNaN(n) ? 0 : n; };

  return [...list].sort(function(a, b) {
    let x, y;
    if (col === 'Date') { x = dateVal(a[col]); y = dateVal(b[col]); }
    else if (col === 'Sr. No.') { x = srVal(a); y = srVal(b); }
    else { x = String(a[col] || '').toLowerCase(); y = String(b[col] || '').toLowerCase(); }
    if (x < y) return -1 * dir;
    if (x > y) return 1 * dir;
    return (srVal(a) - srVal(b)) * dir;
  });
}

// ignoreType = true -> used for the 4 colour cards so each card shows the
// count for the other active filters, regardless of which card is selected.
function getJfcFiltered(ignoreType) {

  const f = currentJfcFilters;
  const q = f.search.toLowerCase();
  const fromD = f.from ? parseCustomDate(f.from) : null;
  const toD = f.to ? parseCustomDate(f.to) : null;

  const list = dbData.jfc.filter(function(r) {
    if (!ignoreType && f.type && r["Type of Ticket Issued"] !== f.type) return false;
    if (f.area && r["Area"] !== f.area) return false;
    if (f.dept && r["Dept"] !== f.dept) return false;
    if (f.company && r["Observee Company"] !== f.company) return false;
    if (f.category && r["Deviation Category"] !== f.category) return false;

    if (fromD || toD) {
      const d = parseCustomDate(r["Date"]);
      if (!d) return false;
      if (fromD && d < fromD) return false;
      if (toD && d > toD) return false;
    }

    if (q) {
      const hay = [
        r["Sr. No."], r["Observee Name"], r["Observee GP ID/Emp. ID"], r["Observer Name"], r["Location"],
        r["Dept"], r["Observee Company"], r["Descriptions of Positive / At-Risk Behavior"],
        r["Type of Action Taken"], r["Remarks, If any"]
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return ignoreType ? list : sortJfc(list);

}

function applyJfcFilters() {
  const val = function(id) { return document.getElementById(id)?.value || ''; };
  currentJfcFilters.search = val('filter-jfc-search').trim();
  currentJfcFilters.type = val('filter-jfc-type');
  currentJfcFilters.area = val('filter-jfc-area');
  currentJfcFilters.dept = val('filter-jfc-dept');
  currentJfcFilters.company = val('filter-jfc-company');
  currentJfcFilters.category = val('filter-jfc-category');
  currentJfcFilters.from = val('filter-jfc-from');
  currentJfcFilters.to = val('filter-jfc-to');
  jfcVisibleLimit = JFC_PAGE_SIZE;
  updateJfcFilterIndicator();
  renderJfcModule(true);
}

function resetJfcFilters() {
  currentJfcFilters = { search: '', type: '', area: '', dept: '', company: '', category: '', from: '', to: '' };
  ['search', 'type', 'area', 'dept', 'company', 'category', 'from', 'to'].forEach(function(k) {
    const el = document.getElementById('filter-jfc-' + k);
    if (el) el.value = '';
  });
  jfcVisibleLimit = JFC_PAGE_SIZE;
  updateJfcFilterIndicator();
  renderJfcModule(true);
}

function toggleJfcType(type) {
  currentJfcFilters.type = currentJfcFilters.type === type ? '' : type;
  const sel = document.getElementById('filter-jfc-type');
  if (sel) sel.value = currentJfcFilters.type;
  jfcVisibleLimit = JFC_PAGE_SIZE;
  updateJfcFilterIndicator();
  renderJfcModule(true);
}

function updateJfcFilterIndicator() {
  const el = document.getElementById('jfc-filter-active-indicator');
  if (!el) return;
  const f = currentJfcFilters;
  const terms = [];
  if (f.search) terms.push(`Search: "${f.search}"`);
  if (f.type) terms.push(`Notice: ${f.type}`);
  if (f.area) terms.push(`Area: ${f.area}`);
  if (f.dept) terms.push(`Dept: ${f.dept}`);
  if (f.company) terms.push(`Company: ${f.company}`);
  if (f.category) terms.push(`Category: ${f.category}`);
  if (f.from) terms.push(`From: ${jfcToDDMMYYYY(f.from)}`);
  if (f.to) terms.push(`To: ${jfcToDDMMYYYY(f.to)}`);
  el.innerHTML = terms.length
    ? '🔍 <strong>Active Filters:</strong> ' + escapeHTML(terms.join(' | '))
    : 'Showing all J&amp;FC tracker records.';
}

function handleJfcSort(col) {
  if (jfcSortColumn === col) {
    jfcSortOrder = jfcSortOrder === 'asc' ? 'desc' : 'asc';
  } else {
    jfcSortColumn = col;
    jfcSortOrder = 'asc';
  }
  jfcVisibleLimit = JFC_PAGE_SIZE;
  renderJfcModule(true);
}

function showMoreJfc() {
  jfcVisibleLimit += JFC_PAGE_SIZE;
  renderJfcModule(true);
}


/* ---------- SELECT / BULK DELETE ---------- */

function toggleSelectAllJfc(master) {
  if (!userState.isAdmin) return;
  getJfcFiltered(false).forEach(function(r) {
    if (!r.id) return;
    if (master.checked) selectedJfcIds.add(r.id); else selectedJfcIds.delete(r.id);
  });
  renderJfcModule(true);
}

function toggleSingleJfcSelect(recId) {
  if (!userState.isAdmin) return;
  const id = String(recId || '').trim();
  if (!id) return;
  if (selectedJfcIds.has(id)) selectedJfcIds.delete(id); else selectedJfcIds.add(id);
  renderJfcModule(true);
}

async function deleteSelectedJfc() {

  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }

  const selectedList = Array.from(selectedJfcIds);
  if (selectedList.length === 0) {
    alert('⚠️ Please select at least one record to delete.');
    return;
  }

  if (!confirm(`⚠️ Are you sure you want to permanently delete ${selectedList.length} selected J&FC record(s)?`)) return;

  const client = initSupabase();
  if (!client) {
    alert('❌ Supabase client not available.');
    return;
  }

  try {
    const BATCH_SIZE = 100;
    for (let i = 0; i < selectedList.length; i += BATCH_SIZE) {
      const batch = selectedList.slice(i, i + BATCH_SIZE);
      const { error } = await client.from('jfc_tracker_records').delete().in('id', batch);
      if (error) {
        alert('❌ Supabase Delete Error: ' + error.message);
        return;
      }
    }

    selectedJfcIds.clear();
    await fetchJfcFromSupabase();
    alert(`✅ Successfully deleted ${selectedList.length} J&FC record(s).`);

  } catch (err) {
    alert('❌ Exception during bulk deletion: ' + err.message);
  }

}


/* ---------- RENDER ---------- */

function renderJfcModule(skipScreenSwitch) {

  if (!skipScreenSwitch) {
    showScreen('jfc-module-screen');
    populateJfcFilterDropdowns();
  }

  const tbody = document.getElementById('jfc-table-body');
  if (!tbody) return;

  const head = document.getElementById('jfc-thead');
  if (head && !head.dataset.built) {
    head.innerHTML = '<tr><th style="width:40px; text-align:center;">SELECT</th>' +
      JFC_TABLE_COLS.map(function(c) {
        return `<th onclick="handleJfcSort('${c[0]}')" style="cursor:pointer;${c[2] ? ' min-width:' + c[2] + 'px;' : ''}">${c[1]} ↕️</th>`;
      }).join('') + '<th>ACTIONS</th></tr>';
    head.dataset.built = '1';
  }

  // 4 colour cards (counts respect all other active filters)
  const counts = { Red: 0, Green: 0, Yellow: 0, White: 0 };
  getJfcFiltered(true).forEach(function(r) {
    const t = r["Type of Ticket Issued"];
    if (counts[t] !== undefined) counts[t]++;
  });
  const cardsEl = document.getElementById('jfc-cards');
  if (cardsEl) {
    const icons = { Red: '🔴', Green: '🟢', Yellow: '🟡', White: '⚪' };
    const totalCard = `<div class="ppe-kpi-card jfc-kpi jfc-kpi-total" onclick="toggleJfcType('')" role="button" tabindex="0">
        <div class="ppe-kpi-icon">📋</div>
        <div class="ppe-kpi-body">
          <span class="ppe-kpi-title">Total Notices</span>
          <span class="ppe-kpi-value">${counts.Red + counts.Green + counts.Yellow + counts.White}</span>
          <span class="ppe-kpi-sub">All notice types</span>
        </div>
      </div>`;
    cardsEl.innerHTML = totalCard + JFC_NOTICE_TYPES.map(function(t) {
      return `<div class="ppe-kpi-card jfc-kpi jfc-kpi-${t.toLowerCase()}${currentJfcFilters.type === t ? ' active' : ''}" onclick="toggleJfcType('${t}')" role="button" tabindex="0">
        <div class="ppe-kpi-icon">${icons[t]}</div>
        <div class="ppe-kpi-body">
          <span class="ppe-kpi-title">${t} Notices</span>
          <span class="ppe-kpi-value">${counts[t]}</span>
          <span class="ppe-kpi-sub">${currentJfcFilters.type === t ? 'Click to clear filter' : 'Click to filter'}</span>
        </div>
      </div>`;
    }).join('');
  }

  const filtered = getJfcFiltered(false);
  const visible = filtered.slice(0, jfcVisibleLimit);

  // select-all + bulk delete controls
  const withId = filtered.filter(r => r.id);
  const selCount = withId.filter(r => selectedJfcIds.has(r.id)).length;

  const topSel = document.getElementById('jfc-top-select-all-container');
  if (topSel) topSel.style.display = userState.isAdmin ? 'inline-flex' : 'none';

  const master = document.getElementById('select-all-jfc-checkbox');
  if (master) {
    master.disabled = !userState.isAdmin || withId.length === 0;
    master.checked = userState.isAdmin && withId.length > 0 && selCount === withId.length;
    master.indeterminate = userState.isAdmin && selCount > 0 && selCount < withId.length;
  }

  const bulkBtn = document.getElementById('btn-jfc-bulk-delete');
  if (bulkBtn) {
    if (userState.isAdmin) {
      bulkBtn.style.display = 'inline-block';
      bulkBtn.innerText = `🗑️ Delete Selected (${selectedJfcIds.size})`;
      bulkBtn.disabled = selectedJfcIds.size === 0;
    } else {
      bulkBtn.style.display = 'none';
    }
  }

  tbody.innerHTML = visible.map(function(r) {

    const recId = String(r.id || '').trim();
    const safeId = recId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const checkbox = userState.isAdmin
      ? `<input type="checkbox" ${selectedJfcIds.has(recId) ? 'checked' : ''} onchange="toggleSingleJfcSelect('${safeId}')" />`
      : '-';
    const action = userState.isAdmin
      ? `<button type="button" class="ppe-btn ppe-btn-secondary" onclick="editJfc('${safeId}')">Edit</button>`
      : '<span style="color:#94a3b8; font-size:0.75rem;">View Only</span>';

    const cells = JFC_TABLE_COLS.map(function(c) {
      const f = c[0];
      const v = escapeHTML(r[f]);
      if (f === "Sr. No.") return `<td><strong>${v}</strong></td>`;
      if (f === "Type of Ticket Issued") {
        const t = r[f];
        return `<td><span class="jfc-badge jfc-${escapeHTML(t.toLowerCase())}">${v}</span></td>`;
      }
      if (f === "Descriptions of Positive / At-Risk Behavior" || f === "Type of Action Taken") {
        return `<td class="jfc-desc-cell">${v}</td>`;
      }
      return `<td>${v}</td>`;
    }).join('');

    return `<tr><td style="text-align:center;">${checkbox}</td>${cells}<td>${action}</td></tr>`;

  }).join('');

  const info = document.getElementById('jfc-showing-info');
  if (info) {
    info.innerHTML = `Showing <strong style="color:var(--text-dark);">${visible.length}</strong> of ` +
      `<strong style="color:var(--text-dark);">${filtered.length}</strong> records` +
      (filtered.length !== dbData.jfc.length ? ` (total in portal: ${dbData.jfc.length})` : '');
  }

  const more = document.getElementById('jfc-more-wrap');
  if (more) {
    more.innerHTML = filtered.length > visible.length
      ? `<button type="button" class="ppe-btn ppe-btn-primary" onclick="showMoreJfc()">⬇ Show ${Math.min(JFC_PAGE_SIZE, filtered.length - visible.length)} more</button>`
      : '';
  }

  renderJfcCharts(filtered);

}


/* ---------- ADD / EDIT MODAL ---------- */

function openAddJfcModal() {
  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }
  const form = document.getElementById('jfc-form');
  if (form) form.reset();
  document.getElementById('j-editing-id').value = '';
  const now = new Date();
  document.getElementById('j-date').value =
    now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  document.getElementById('jfc-modal-title-text').innerText = 'Add New J&FC Notice';
  document.getElementById('jfc-modal').classList.remove('hidden-screen');
}

const JFC_FORM_MAP = [
  ["Area", "j-area"], ["Location", "j-location"], ["Observee Name", "j-observee-name"], ["Dept", "j-dept"],
  ["Sub Dept", "j-subdept"], ["Observee GP ID/Emp. ID", "j-observee-gp"], ["Observee Designation", "j-observee-desig"],
  ["Observee Company", "j-observee-company"], ["Descriptions of Positive / At-Risk Behavior", "j-desc"],
  ["Deviation Category", "j-category"], ["Type of Ticket Issued", "j-notice-type"], ["Observer Name", "j-observer-name"],
  ["Observer GP ID/Emp. ID", "j-observer-gp"], ["Observer Designation", "j-observer-desig"],
  ["Observer Company", "j-observer-company"], ["Type of Action Taken", "j-action"], ["Remarks, If any", "j-remarks"]
];

function editJfc(id) {
  if (!userState.isAdmin) {
    alert('❌ Admin access required.');
    return;
  }
  const rec = dbData.jfc.find(r => String(r.id) === String(id));
  if (!rec) {
    alert('❌ Record not found.');
    return;
  }

  document.getElementById('j-editing-id').value = rec.id;
  JFC_FORM_MAP.forEach(function(m) {
    const el = document.getElementById(m[1]);
    if (el) el.value = rec[m[0]] || '';
  });

  const d = parseCustomDate(rec["Date"]);
  document.getElementById('j-date').value = d
    ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    : '';

  document.getElementById('jfc-modal-title-text').innerText = 'Edit J&FC Notice (Sr. No. ' + rec["Sr. No."] + ')';
  document.getElementById('jfc-modal').classList.remove('hidden-screen');
}

function closeJfcModal() {
  const modal = document.getElementById('jfc-modal');
  if (modal) modal.classList.add('hidden-screen');
}

async function saveJfcRecord(e) {

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

  const getVal = function(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; };

  const editingId = getVal('j-editing-id');
  const rawDate = getVal('j-date');

  if (!rawDate || !getVal('j-observee-name') || !getVal('j-notice-type') || !getVal('j-desc')) {
    alert('❌ Please fill in Date, Observee Name, Notice Type and Description.');
    return;
  }

  const rec = {};
  JFC_FORM_MAP.forEach(function(m) { rec[m[0]] = getVal(m[1]); });
  rec["Date"] = jfcToDDMMYYYY(rawDate);

  if (editingId) {
    const existing = dbData.jfc.find(r => String(r.id) === String(editingId));
    rec["Sr. No."] = existing ? existing["Sr. No."] : String(jfcNextSrNo());
  } else {
    rec["Sr. No."] = String(jfcNextSrNo());
  }

  const row = mapJfcToSupabase(rec);

  try {
    let result;
    if (editingId) {
      result = await client.from('jfc_tracker_records').update(row).eq('id', editingId);
    } else {
      result = await client.from('jfc_tracker_records').insert([row]);
    }

    if (result.error) {
      alert('❌ Supabase Save Error: ' + result.error.message);
      return;
    }

    closeJfcModal();
    await fetchJfcFromSupabase();
    alert('✅ J&FC record saved permanently to Supabase.');

  } catch (err) {
    alert('❌ Exception during save: ' + err.message);
  }

}


/* ---------- EXCEL EXPORT: see "EXCEL EXPORT (ExcelJS...)" block below ---------- */


/* ---------- CHARTS (follow all active filters) ---------- */

const JFC_COLORS = { Red: '#ef4444', Green: '#22c55e', Yellow: '#eab308', White: '#f1f5f9' };
const JFC_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function jfcGroupCounts(records, keyFn) {
  const out = {};
  records.forEach(function(r) {
    const k = keyFn(r);
    const t = r["Type of Ticket Issued"];
    if (!k || JFC_NOTICE_TYPES.indexOf(t) === -1) return;
    if (!out[k]) out[k] = { Red: 0, Green: 0, Yellow: 0, White: 0, total: 0 };
    out[k][t]++;
    out[k].total++;
  });
  return out;
}

function jfcStackedConfig(labels, groups, horizontal, showLabels) {

  const textColor = getChartTextColor();
  const gridColor = getChartGridColor();

  const datasets = JFC_NOTICE_TYPES.map(function(t) {
    return {
      label: t,
      data: labels.map(l => groups[l][t]),
      backgroundColor: JFC_COLORS[t],
      borderColor: t === 'White' ? '#94a3b8' : JFC_COLORS[t],
      borderWidth: 1
    };
  });

  return {
    type: 'bar',
    data: { labels: labels, datasets: datasets },
    options: {
      indexAxis: horizontal ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: textColor, font: { size: 11, weight: 'bold' } } },
        datalabels: {
          display: showLabels ? function(ctx) { return ctx.dataset.data[ctx.dataIndex] > 0; } : false,
          color: function(ctx) { return (ctx.dataset.label === 'Yellow' || ctx.dataset.label === 'White') ? '#1f2937' : '#ffffff'; },
          font: { weight: 'bold', size: 10 }
        }
      },
      scales: {
        x: { stacked: true, ticks: { color: textColor }, grid: { color: gridColor } },
        y: { stacked: true, ticks: { color: textColor }, grid: { color: gridColor } }
      }
    }
  };

}

function renderJfcCharts(records) {

  if (typeof Chart === 'undefined') return;

  const textColor = getChartTextColor();

  // 1) Donut — share of the 4 notice types
  const typeCounts = jfcGroupCounts(records, r => r["Type of Ticket Issued"]);
  renderChart('chart-jfc-donut', {
    type: 'doughnut',
    data: {
      labels: JFC_NOTICE_TYPES,
      datasets: [{
        data: JFC_NOTICE_TYPES.map(t => typeCounts[t] ? typeCounts[t].total : 0),
        backgroundColor: JFC_NOTICE_TYPES.map(t => JFC_COLORS[t]),
        borderWidth: 2,
        borderColor: '#94a3b8'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: textColor, font: { size: 11, weight: 'bold' } } },
        datalabels: {
          color: function(ctx) { const l = ctx.chart.data.labels[ctx.dataIndex]; return (l === 'Yellow' || l === 'White') ? '#1f2937' : '#ffffff'; },
          font: { weight: 'bold', size: 12 },
          formatter: function(val) { return val > 0 ? val : ''; }
        }
      }
    }
  });

  // 2) Area-wise / Dept-wise (stacked by notice type)
  const groupField = document.getElementById('jfc-chart-group')?.value === 'Dept' ? 'Dept' : 'Area';
  const byGroup = jfcGroupCounts(records, r => r[groupField]);
  const groupLabels = Object.keys(byGroup).sort((a, b) => byGroup[b].total - byGroup[a].total).slice(0, 12);
  renderChart('chart-jfc-area', jfcStackedConfig(groupLabels, byGroup, true, true));

  // 3) Month-wise trend (chronological, empty months filled in)
  const byMonth = {};
  let minM = null, maxM = null;
  records.forEach(function(r) {
    const d = parseCustomDate(r["Date"]);
    const t = r["Type of Ticket Issued"];
    if (!d || JFC_NOTICE_TYPES.indexOf(t) === -1) return;
    const idx = d.getFullYear() * 12 + d.getMonth();
    if (minM === null || idx < minM) minM = idx;
    if (maxM === null || idx > maxM) maxM = idx;
    if (!byMonth[idx]) byMonth[idx] = { Red: 0, Green: 0, Yellow: 0, White: 0, total: 0 };
    byMonth[idx][t]++;
    byMonth[idx].total++;
  });
  const monthKeys = [];
  const monthGroups = {};
  if (minM !== null) {
    for (let m = minM; m <= maxM; m++) {
      const label = JFC_MONTHS[m % 12] + ' ' + Math.floor(m / 12);
      monthKeys.push(label);
      monthGroups[label] = byMonth[m] || { Red: 0, Green: 0, Yellow: 0, White: 0, total: 0 };
    }
  }
  renderChart('chart-jfc-month', jfcStackedConfig(monthKeys, monthGroups, false, false));

  // 4) Top 10 Deviation Categories
  const byCat = jfcGroupCounts(records, r => r["Deviation Category"]);
  const catLabels = Object.keys(byCat).sort((a, b) => byCat[b].total - byCat[a].total).slice(0, 10);
  renderChart('chart-jfc-category', jfcStackedConfig(catLabels, byCat, true, true));

  // 5) Top 10 Companies (observee company)
  const byComp = jfcGroupCounts(records, r => r["Observee Company"]);
  const compLabels = Object.keys(byComp).sort((a, b) => byComp[b].total - byComp[a].total).slice(0, 10);
  renderChart('chart-jfc-company', jfcStackedConfig(compLabels, byComp, true, true));

}


/* ---------- EXCEL EXPORT (ExcelJS: wrap text, column widths, colours) ---------- */

const JFC_XL_WIDTHS = [7, 12, 12, 22, 22, 12, 12, 13, 18, 20, 60, 20, 12, 22, 13, 18, 18, 50, 24];

function buildJfcWorkbook(records) {

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('JFC_TRACKER', { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.columns = JFC_FIELDS.map(function(f, i) {
    return { header: f, key: 'c' + i, width: JFC_XL_WIDTHS[i] };
  });

  records.forEach(function(r) {
    const row = {};
    JFC_FIELDS.forEach(function(f, i) {
      let v = r[f] === undefined || r[f] === null ? '' : String(r[f]);
      if (f === "Sr. No." && v !== '' && !isNaN(v)) v = Number(v);
      row['c' + i] = v;
    });
    ws.addRow(row);
  });

  const border = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
  };

  const fills = {
    Red: { bg: 'FFDC2626', fg: 'FFFFFFFF' },
    Green: { bg: 'FF16A34A', fg: 'FFFFFFFF' },
    Yellow: { bg: 'FFEAB308', fg: 'FF1F2937' },
    White: { bg: 'FFF8FAFC', fg: 'FF1F2937' }
  };
  const typeCol = JFC_FIELDS.indexOf("Type of Ticket Issued") + 1;

  // header row
  const head = ws.getRow(1);
  head.height = 34;
  head.eachCell(function(cell) {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = border;
  });

  // data rows: wrap text everywhere, top-aligned
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= JFC_FIELDS.length; c++) {
      const cell = row.getCell(c);
      cell.alignment = { vertical: 'top', horizontal: c === 1 ? 'center' : 'left', wrapText: true };
      cell.border = border;
    }
    const typeCell = row.getCell(typeCol);
    const style = fills[typeCell.value];
    if (style) {
      typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: style.bg } };
      typeCell.font = { bold: true, color: { argb: style.fg } };
      typeCell.alignment = { vertical: 'top', horizontal: 'center', wrapText: true };
    }
  }

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: JFC_FIELDS.length } };

  return wb;

}

function jfcExportFileName() {
  const t = new Date();
  return 'JFC_Tracker_' + String(t.getDate()).padStart(2, '0') + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + t.getFullYear() + '.xlsx';
}

// Plain fallback (no formatting) — only used if the ExcelJS library could not load
function exportJfcExcelBasic(records) {
  const exportData = records.map(function(r) {
    const row = {};
    JFC_FIELDS.forEach(function(f) { row[f] = r[f] !== undefined && r[f] !== null ? String(r[f]) : ''; });
    return row;
  });
  const worksheet = XLSX.utils.json_to_sheet(exportData, { header: JFC_FIELDS });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "JFC_TRACKER");
  XLSX.writeFile(workbook, jfcExportFileName());
}

async function exportJfcExcel() {

  const records = getJfcFiltered(false);
  if (!records.length) {
    alert('❌ No J&FC records available to export.');
    return;
  }

  if (typeof ExcelJS === 'undefined') {
    if (typeof XLSX !== 'undefined' && confirm('⚠️ The Excel formatting library (ExcelJS) could not be loaded.\n\nExport a plain Excel file (without wrap text / colours) instead?')) {
      exportJfcExcelBasic(records);
    } else if (typeof XLSX === 'undefined') {
      alert('❌ Excel library is loading. Please try again in a moment.');
    }
    return;
  }

  try {
    const wb = buildJfcWorkbook(records);
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = jfcExportFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function() { URL.revokeObjectURL(url); }, 3000);
  } catch (err) {
    console.error("J&FC export error:", err);
    alert('❌ Failed to create the Excel file: ' + err.message);
  }

}


/* ---------- EXCEL IMPORT (only columns A to S are read) ---------- */

function triggerJfcExcelImport() {
  if (!userState.isAdmin) {
    alert('❌ Admin access required to import records.');
    return;
  }
  const fileInput = document.getElementById('jfc-excel-file');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
}

// Collapse spaces + trim (short fields such as Area / Dept / Company)
function jfcCleanText(v) {
  return String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim();
}

// Maps every spelling of a value (ignoring upper/lower case) to its most
// common spelling, e.g. "M/S Sukhmani" -> "M/s Sukhmani", "ppe" -> "PPE".
function jfcCanonicalizer(values) {
  const groups = new Map();
  values.forEach(function(v) {
    if (!v) return;
    const key = v.toLowerCase();
    if (!groups.has(key)) groups.set(key, new Map());
    const m = groups.get(key);
    m.set(v, (m.get(v) || 0) + 1);
  });
  const best = new Map();
  groups.forEach(function(m, key) {
    let top = null, topCount = -1;
    m.forEach(function(n, v) { if (n > topCount) { topCount = n; top = v; } });
    best.set(key, top);
  });
  return function(v) { return v ? (best.get(v.toLowerCase()) || v) : v; };
}

function handleJfcExcelImport(e) {

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

      // Dates are read as Excel serial numbers (timezone-safe), then converted
      const workbook = XLSX.read(new Uint8Array(evt.target.result), { type: 'array' });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        alert('❌ Selected Excel file contains no worksheets.');
        return;
      }

      const grid = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '', raw: true });
      if (!grid || grid.length < 2) {
        alert('❌ No data rows found in Excel sheet.');
        return;
      }

      // Only columns A to S (first 19 columns)
      const hdr = grid[0].slice(0, 19).map(h => String(h).toLowerCase().replace(/[^a-z0-9]/g, ''));
      const looksOk = hdr.length === 19 && hdr[0].includes('sr') && hdr[1] === 'date' &&
        (hdr[12].includes('ticket') || hdr[12].includes('notice'));
      if (!looksOk && !confirm('⚠️ The column headings (A to S) do not look like the J&FC Tracker format.\n\nContinue anyway? Columns will be read by position.')) {
        return;
      }

      const rows = grid.slice(1)
        .map(r => r.slice(0, 19))
        .filter(r => r.some(c => String(c).trim() !== ''));

      if (rows.length === 0) {
        alert('❌ No data rows found in Excel sheet.');
        return;
      }

      // Spelling clean-up (same value written in different case / with extra spaces)
      const canonArea = jfcCanonicalizer(rows.map(r => jfcCleanText(r[2])));
      const canonDept = jfcCanonicalizer(rows.map(r => jfcCleanText(r[5])));
      const canonSub = jfcCanonicalizer(rows.map(r => jfcCleanText(r[6])));
      const canonCat = jfcCanonicalizer(rows.map(r => jfcCleanText(r[11])));
      const canonComp = jfcCanonicalizer(rows.map(r => jfcCleanText(r[9])).concat(rows.map(r => jfcCleanText(r[16]))));

      const skipped = [];
      const records = [];

      rows.forEach(function(r, idx) {

        const typeRaw = jfcCleanText(r[12]);
        const noticeType = JFC_NOTICE_TYPES.find(t => t.toLowerCase() === typeRaw.toLowerCase());
        if (!noticeType) {
          skipped.push(`Row ${idx + 2}: notice type "${typeRaw}"`);
          return;
        }

        const rec = {};
        JFC_FIELDS.forEach(function(f, i) { rec[f] = jfcCleanText(r[i]); });

        rec["Date"] = formatExcelDate(r[1]);
        rec["Area"] = canonArea(rec["Area"]);
        rec["Dept"] = canonDept(rec["Dept"]);
        rec["Sub Dept"] = canonSub(rec["Sub Dept"]);
        rec["Deviation Category"] = canonCat(rec["Deviation Category"]);
        rec["Observee Company"] = canonComp(rec["Observee Company"]);
        rec["Observer Company"] = canonComp(rec["Observer Company"]);
        rec["Type of Ticket Issued"] = noticeType;
        // long text: only trim, keep the wording as written
        ["Descriptions of Positive / At-Risk Behavior", "Type of Action Taken", "Remarks, If any"].forEach(function(f) {
          rec[f] = String(r[JFC_FIELDS.indexOf(f)] === null || r[JFC_FIELDS.indexOf(f)] === undefined ? '' : r[JFC_FIELDS.indexOf(f)]).trim();
        });

        records.push(rec);
      });

      if (records.length === 0) {
        alert('❌ No valid rows found to import.\n\n' + skipped.slice(0, 10).join('\n'));
        return;
      }

      // Sr. No.: keep the Excel number; fill blanks / duplicates with new numbers
      const existingSr = new Set(dbData.jfc.map(x => parseInt(x["Sr. No."], 10)));
      const usedInFile = new Set();
      let maxSr = 0;
      existingSr.forEach(n => { if (!isNaN(n) && n > maxSr) maxSr = n; });
      records.forEach(function(rec) {
        const n = parseInt(rec["Sr. No."], 10);
        if (!isNaN(n) && n > maxSr) maxSr = n;
      });

      let renumbered = 0;
      records.forEach(function(rec) {
        const n = parseInt(rec["Sr. No."], 10);
        if (isNaN(n) || usedInFile.has(n)) {
          maxSr++;
          rec["Sr. No."] = String(maxSr);
          renumbered++;
        }
        usedInFile.add(parseInt(rec["Sr. No."], 10));
      });

      let newCount = 0, updatedCount = 0;
      records.forEach(function(rec) {
        if (existingSr.has(parseInt(rec["Sr. No."], 10))) updatedCount++; else newCount++;
      });

      if (!confirm(`📥 ${records.length} record(s) found (columns A to S).\n\n🟢 New: ${newCount}\n🔵 Existing Sr. No. (will be updated): ${updatedCount}\n\nContinue import?`)) {
        return;
      }

      const client = initSupabase();
      if (!client) {
        alert('❌ Supabase client is not available.');
        return;
      }

      const payload = records.map(mapJfcToSupabase);
      const BATCH_SIZE = 100;
      for (let i = 0; i < payload.length; i += BATCH_SIZE) {
        const { error } = await client
          .from('jfc_tracker_records')
          .upsert(payload.slice(i, i + BATCH_SIZE), { onConflict: 'sr_no' });

        if (error) {
          alert(`❌ Import stopped at Batch ${Math.floor(i / BATCH_SIZE) + 1} due to Error:\n${error.message}`);
          return;
        }
      }

      await fetchJfcFromSupabase();

      const byType = { Red: 0, Green: 0, Yellow: 0, White: 0 };
      records.forEach(rec => byType[rec["Type of Ticket Issued"]]++);

      alert(
        `📊 J&FC Import Complete\n` +
        `===================================\n` +
        `🟢 New Records: ${newCount}\n` +
        `🔵 Updated Records: ${updatedCount}\n` +
        `🔢 Re-numbered (blank/duplicate Sr. No.): ${renumbered}\n` +
        `⚠️ Skipped (unknown notice type): ${skipped.length}\n` +
        `-----------------------------------\n` +
        `🔴 Red: ${byType.Red}   🟢 Green: ${byType.Green}   🟡 Yellow: ${byType.Yellow}   ⚪ White: ${byType.White}\n` +
        `📦 Total J&FC Records in Portal: ${dbData.jfc.length}` +
        (skipped.length ? '\n\nSkipped:\n' + skipped.slice(0, 10).join('\n') : '')
      );

    } catch (err) {
      console.error("J&FC import error:", err);
      alert('❌ Failed to process Excel file. Please ensure it is a valid .xlsx file.');
    }

  };

  reader.readAsArrayBuffer(file);

}
