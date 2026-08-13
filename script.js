
/**
 * Apex Trading Journal - Core Logic
 * Handles data persistence, performance calculations, customization, and UI rendering.
 */

// --- State Management ---
let trades = JSON.parse(localStorage.getItem('apex_trades')) || [];
let settings = JSON.parse(localStorage.getItem('apex_settings')) || {
    appName: 'Apex Journal',
    appQuote: '"The goal of a successful trader is to make the best trades. Money is secondary."',
    theme: 'blue',
    customColor: '#3b82f6',
    mode: 'dark',
    bgColor: '#0f172a',
    goalTarget: 10,
    goalPeriod: 'monthly',
    defaultPnlPeriod: 'all'
};
let layouts = JSON.parse(localStorage.getItem('apex_layouts')) || {};
let currentCalendarDate = new Date();

const THEMES = {
    blue: { color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.2)', text: '#60a5fa' },
    emerald: { color: '#10b981', glow: 'rgba(16, 185, 129, 0.2)', text: '#34d399' },
    purple: { color: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.2)', text: '#a78bfa' },
    rose: { color: '#f43f5e', glow: 'rgba(244, 63, 94, 0.2)', text: '#fb7185' },
    amber: { color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.2)', text: '#fbbf24' }
};

const PRESETS = {
    Classic: { appName: 'Apex Journal', appQuote: '"The goal of a successful trader is to make the best trades. Money is secondary."', theme: 'blue' },
    Modern: { appName: 'Edge Analytics', appQuote: '"Discipline is the bridge between goals and accomplishment."', theme: 'emerald' },
    Midnight: { appName: 'Dark Edge', appQuote: '"Trade the chart, not your emotions."', theme: 'purple' },
    Crimson: { appName: 'Power Trade', appQuote: '"Risk comes from not knowing what you\'re doing."', theme: 'rose' }
};

// --- Utilities ---
function normalizeDate(dateInput) {
    if (!dateInput) return '';
    if (typeof dateInput === 'number' || (!isNaN(dateInput) && !isNaN(parseFloat(dateInput)))) {
        const excelDate = new Date((parseFloat(dateInput) - 25569) * 86400 * 1000);
        if (!isNaN(excelDate.getTime())) return excelDate.toISOString().substring(0, 10);
    }
    const d = new Date(dateInput);
    if (!isNaN(d.getTime())) return d.toISOString().substring(0, 10);
    return '';
}

function bulkImportTrades(data) {
    const importedTrades = data.map(item => {
        const outcome = item.OUTCOME || '';
        let normalizedOutcome = 'breakeven';
        if (outcome.includes('WIN')) normalizedOutcome = 'win';
        else if (outcome.includes('LOSS')) normalizedOutcome = 'loss';
        return {
            id: Date.now() + Math.random(),
            pair: item.PAIR || 'Unknown',
            tradeType: (item.TRADE || 'buy').toLowerCase(),
            outcome: normalizedOutcome,
            bias: (item['MY BIAS'] || 'neutral').toLowerCase(),
            rr: parseFloat(item.RR) || 1.0,
            pnl: parseFloat(item.PNL) || 0,
            pips: parseFloat(item.PIPS) || 0,
            tpsHit: item['Aantal Take Profits HIT'] || 0,
            date: normalizeDate(item.Date),
            confluences: item.Confluences ? item.Confluences.split(',').map(s => s.trim()) : [],
            notes: item.Reden || '',
            feeling: '',
            screenshots: []
        };
    });
    trades = [...trades, ...importedTrades];
    localStorage.setItem('apex_trades', JSON.stringify(trades));
    return `${importedTrades.length} trades imported successfully!`;
}

function addScreenshotInput() {
    const container = document.getElementById('screenshot-container');
    const input = document.createElement('div');
    input.className = 'flex gap-2';
    input.innerHTML = `
        <input type="url" name="screenshot" placeholder="https://imgur.com/..." class="flex-1 p-3 rounded-xl outline-none focus:ring-2 ring-blue-500 transition-all">
        <button type="button" onclick="this.parentElement.remove()" class="p-3 text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
    `;
    container.appendChild(input);
    lucide.createIcons();
}

function hexToRgba(hex, opacity) {

    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function lightenColor(hex, amount) {
    // Simple lighten: convert to RGB, increase, then back to hex
    const num = parseInt(hex.slice(1), 16);
    let r = (num >> 16) + amount;
    let g = ((num >> 8) & 0x00FF) + amount;
    let b = (num & 0x00FF) + amount;

    const clamp = (val) => Math.min(255, Math.max(0, val));
    return '#' + (
        (clamp(r) << 16) | (clamp(g) << 8) | clamp(b)
    ).toString(16).padStart(6, '0');
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    applySettings();
    updateDashboard();
    renderTrades();
    renderCalendar();
    renderLayouts();

    // Set default date to today
    document.getElementById('date').valueAsDate = new Date();

    // Initialize settings inputs
    document.getElementById('set-app-name').value = settings.appName;
    document.getElementById('set-app-quote').value = settings.appQuote;
    document.getElementById('set-goal-target').value = settings.goalTarget;
    document.getElementById('set-goal-period').value = settings.goalPeriod;
    document.getElementById('set-default-pnl-period').value = settings.defaultPnlPeriod || 'all';
});

// --- Navigation ---
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${pageId}`).classList.remove('hidden');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`nav-${pageId}`).classList.add('active');

    if (pageId === 'dashboard') updateDashboard();
    if (pageId === 'journal') renderTrades();
    if (pageId === 'calendar') renderCalendar();
}

function toggleModal(show) {
    const modal = document.getElementById('modal-trade');
    modal.classList.toggle('hidden', !show);
}

function toggleDetailsModal(show) {
    const modal = document.getElementById('modal-trade-details');
    modal.classList.toggle('hidden', !show);
}

function showTradeDetails(tradeId) {
    const trade = trades.find(t => t.id == tradeId);
    if (!trade) return;

    document.getElementById('det-pair').textContent = trade.pair;
    document.getElementById('det-date').textContent = trade.date;
    document.getElementById('det-outcome').textContent = trade.outcome.toUpperCase();
    document.getElementById('det-bias').textContent = (trade.bias || 'neutral').toUpperCase();
    document.getElementById('det-pnl').textContent = `${trade.pnl}%`;
    document.getElementById('det-pnl').className = `font-bold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
    document.getElementById('det-pips').textContent = trade.pips || '0';
    document.getElementById('det-rr').textContent = parseFloat(trade.rr).toFixed(2);
    document.getElementById('det-tps').textContent = trade.tpsHit || 0;
    document.getElementById('det-notes').textContent = trade.notes || 'No notes provided.';
    document.getElementById('det-feeling').textContent = trade.feeling || 'No psychology notes provided.';

    const confContainer = document.getElementById('det-confluences');
    confContainer.innerHTML = trade.confluences.length
        ? trade.confluences.map(c => `<span class="text-[10px] px-2 py-0.5 rounded-md bg-slate-700 text-slate-300">${c}</span>`).join('')
        : '<span class="text-xs text-slate-500">None</span>';

    const screenContainer = document.getElementById('det-screenshots');
    const screenshots = trade.screenshots || (trade.screenshot ? [trade.screenshot] : []);
    screenContainer.innerHTML = screenshots.length
        ? screenshots.map(url => `
            <a href="${url}" target="_blank" class="p-2 glass rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 text-xs">
                <i data-lucide="image" class="w-4 h-4"></i> View
            </a>
        `).join('')
        : '<span class="text-xs text-slate-500 col-span-full">No screenshots</span>';

    document.getElementById('btn-edit-trade').onclick = () => editTrade(trade.id);

    toggleDetailsModal(true);
    lucide.createIcons();
}

function editTrade(tradeId) {
    const trade = trades.find(t => t.id == tradeId);
    if (!trade) return;

    toggleDetailsModal(false);
    toggleModal(true);

    document.getElementById('trade-id').value = trade.id;
    document.getElementById('pair').value = trade.pair;
    document.getElementById('trade-type').value = trade.tradeType || 'buy';
    document.getElementById('outcome').value = trade.outcome;
    document.getElementById('bias').value = trade.bias || 'neutral';
    document.getElementById('rr').value = trade.rr;
    document.getElementById('pnl').value = trade.pnl;
    document.getElementById('pips').value = trade.pips || '';
    document.getElementById('tps-hit').value = trade.tpsHit || '';
    document.getElementById('date').value = trade.date;
    document.getElementById('notes').value = trade.notes;
    document.getElementById('feeling').value = trade.feeling || '';

    // Set confluences
    document.querySelectorAll('input[name="confluence"]').forEach(cb => {
        cb.checked = trade.confluences.includes(cb.value);
    });

    // Set screenshots
    const container = document.getElementById('screenshot-container');
    container.innerHTML = '';
    const screenshots = trade.screenshots || (trade.screenshot ? [trade.screenshot] : []);

    if (screenshots.length === 0) {
        container.innerHTML = `<input type="url" name="screenshot" placeholder="https://imgur.com/..." class="w-full p-3 rounded-xl outline-none focus:ring-2 ring-blue-500 transition-all">`;
    } else {
        screenshots.forEach((url, index) => {
            const div = document.createElement('div');
            div.className = 'flex gap-2';
            div.innerHTML = `
                <input type="url" name="screenshot" value="${url}" class="flex-1 p-3 rounded-xl outline-none focus:ring-2 ring-blue-500 transition-all">
                ${index > 0 ? `<button type="button" onclick="this.parentElement.remove()" class="p-3 text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
            `;
            container.appendChild(div);
        });
    }
    lucide.createIcons();
}

// --- Settings & Customization ---
function applySettings() {
    // Update Title
    document.getElementById('app-title').textContent = settings.appName;

    // Update Quote
    document.getElementById('dashboard-quote').textContent = settings.appQuote;

    // Apply Theme
    setTheme(settings.theme, false);

    // Update Mode
    document.body.className = settings.mode === 'light' ? 'light-mode' : '';
    const modeBtn = document.getElementById('mode-toggle');
    if (modeBtn) {
        modeBtn.innerHTML = settings.mode === 'light'
            ? '<i data-lucide="moon" class="w-4 h-4"></i>'
            : '<i data-lucide="sun" class="w-4 h-4"></i>';
    }

    // Update Custom Color Input
    const colorInput = document.getElementById('custom-color');
    if (colorInput) colorInput.value = settings.customColor;

    // Update Background Color Input
    const bgInput = document.getElementById('custom-bg');
    if (bgInput) bgInput.value = settings.bgColor;

    // Apply Background Color
    document.documentElement.style.setProperty('--bg-color', settings.bgColor);

    // Set Default PnL Period
    const pnlSelect = document.getElementById('stat-pnl-period-select');
    if (pnlSelect) {
        pnlSelect.value = settings.defaultPnlPeriod || 'all';
    }

    // Update Dynamic Button Colors
    const primaryColor = settings.theme === 'custom' ? settings.customColor : THEMES[settings.theme].color;
    const buttons = ['btn-new-trade', 'btn-save-trade', 'btn-save-settings'];
    buttons.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.style.backgroundColor = primaryColor;
        }
    });
    lucide.createIcons();
}

function toggleMode() {
    settings.mode = settings.mode === 'dark' ? 'light' : 'dark';
    saveSettings();
}

function setCustomBg(color) {
    settings.bgColor = color;
    saveSettings();
}

function setTheme(themeName, save = true) {
    let theme;
    if (themeName === 'custom') {
        const color = settings.customColor;
        theme = {
            color: color,
            glow: hexToRgba(color, 0.2),
            text: lightenColor(color, 40)
        };
    } else {
        theme = THEMES[themeName];
    }

    document.documentElement.style.setProperty('--primary-color', theme.color);
    document.documentElement.style.setProperty('--primary-glow', theme.glow);
    document.documentElement.style.setProperty('--primary-text', theme.text);

    // Update theme selection buttons
    document.querySelectorAll('.theme-option-btn').forEach(btn => {
        btn.classList.remove('active');
        if (themeName !== 'custom' && btn.getAttribute('onclick').includes(`'${themeName}'`)) {
            btn.classList.add('active');
        }
    });

    if (save) {
        settings.theme = themeName;
        saveSettings();
    }
}

function setCustomTheme(color) {
    settings.customColor = color;
    setTheme('custom');
}

function applyPreset(presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) return;

    settings.appName = preset.appName;
    settings.appQuote = preset.appQuote;
    settings.theme = preset.theme;

    // Sync inputs
    document.getElementById('set-app-name').value = preset.appName;
    document.getElementById('set-app-quote').value = preset.appQuote;

    saveSettings();
}

function saveSettings() {
    settings.appName = document.getElementById('set-app-name').value;
    settings.appQuote = document.getElementById('set-app-quote').value;
    settings.defaultPnlPeriod = document.getElementById('set-default-pnl-period').value;
    settings.goalTarget = parseFloat(document.getElementById('set-goal-target')?.value) || 0;
    settings.goalPeriod = document.getElementById('set-goal-period')?.value || 'monthly';

    localStorage.setItem('apex_settings', JSON.stringify(settings));
    applySettings();
    updateDashboard();


    // Visual feedback
    const btn = document.getElementById('btn-save-settings');
    const originalText = btn.textContent;
    btn.textContent = 'Saved! ✓';
    setTimeout(() => btn.textContent = originalText, 2000);
}

function saveLayout() {
    const name = document.getElementById('layout-name').value.trim();
    if (!name) {
        alert('Please enter a layout name');
        return;
    }

    layouts[name] = { ...settings };
    localStorage.setItem('apex_layouts', JSON.stringify(layouts));

    document.getElementById('layout-name').value = '';
    renderLayouts();
}

function loadLayout(name) {
    const layout = layouts[name];
    if (!layout) return;

    settings = { ...layout };

    // Sync inputs
    document.getElementById('set-app-name').value = settings.appName;
    document.getElementById('set-app-quote').value = settings.appQuote;

    saveSettings();
    renderLayouts();
}

function deleteLayout(name) {
    if (confirm(`Delete layout "${name}"?`)) {
        delete layouts[name];
        localStorage.setItem('apex_layouts', JSON.stringify(layouts));
        renderLayouts();
    }
}

function renderLayouts() {
    const container = document.getElementById('layouts-list');
    if (!container) return;

    if (Object.keys(layouts).length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">No saved layouts yet</p>';
        return;
    }

    container.innerHTML = Object.keys(layouts).map(name => `
        <div class="flex justify-between items-center p-3 rounded-xl glass hover:bg-slate-800 transition-all group">
            <span class="text-sm font-medium">${name}</span>
            <div class="flex gap-2">
                <button onclick="loadLayout('${name}')" class="p-1.5 text-blue-400 hover:text-blue-300 transition-colors" title="Load Layout">
                    <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
                </button>
                <button onclick="deleteLayout('${name}')" class="p-1.5 text-slate-500 hover:text-rose-400 transition-colors" title="Delete Layout">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

// --- Data Handling ---
document.getElementById('trade-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const confluences = Array.from(document.querySelectorAll('input[name="confluence"]:checked'))
        .map(cb => cb.value);

    const screenshotInputs = document.querySelectorAll('input[name="screenshot"]');
    const screenshots = Array.from(screenshotInputs)
        .map(input => input.value.trim())
        .filter(val => val !== '');

    const tradeId = document.getElementById('trade-id').value;
    const tradeData = {
        pair: document.getElementById('pair').value,
        tradeType: document.getElementById('trade-type').value,
        outcome: document.getElementById('outcome').value,
        bias: document.getElementById('bias').value,
        rr: parseFloat(document.getElementById('rr').value),
        pnl: parseFloat(document.getElementById('pnl').value),
        pips: parseFloat(document.getElementById('pips').value) || 0,
        tpsHit: parseInt(document.getElementById('tps-hit').value) || 0,
        date: document.getElementById('date').value,
        confluences: confluences,
        notes: document.getElementById('notes').value,
        feeling: document.getElementById('feeling').value,
        screenshots: screenshots
    };

    if (tradeId) {
        const index = trades.findIndex(t => t.id == tradeId);
        if (index !== -1) {
            trades[index] = { ...trades[index], ...tradeData };
        }
    } else {
        trades.push({
            id: Date.now(),
            ...tradeData
        });
    }

    localStorage.setItem('apex_trades', JSON.stringify(trades));

    toggleModal(false);
    toggleDetailsModal(false);
    e.target.reset();
    document.getElementById('trade-id').value = '';
    document.getElementById('date').valueAsDate = new Date();

    // Reset screenshots to just one input
    document.getElementById('screenshot-container').innerHTML = `
        <input type="url" name="screenshot" placeholder="https://imgur.com/..." class="w-full p-3 rounded-xl outline-none focus:ring-2 ring-blue-500 transition-all">
    `;

    renderTrades();
    updateDashboard();
    renderCalendar();
});

function deleteTrade(id) {
    if (confirm('Are you sure you want to delete this trade?')) {
        trades = trades.filter(t => t.id !== id);
        localStorage.setItem('apex_trades', JSON.stringify(trades));
        renderTrades();
        updateDashboard();
        renderCalendar();
    }
}

// --- Dashboard & Stats ---
function updateDashboard() {
    const totalTrades = trades.length;
    const wins = trades.filter(t => t.outcome === 'win').length;
    const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0';

    const winningTrades = trades.filter(t => t.outcome === 'win');
    const avgRR = winningTrades.length > 0
        ? (winningTrades.reduce((sum, t) => sum + t.rr, 0) / winningTrades.length).toFixed(2)
        : '0.00';

    document.getElementById('stat-winrate').textContent = `${winRate}%`;
    document.getElementById('stat-trade-count').textContent = `${totalTrades} trades analyzed`;
    document.getElementById('stat-avgrr').textContent = avgRR;

    const now = new Date();
    const currentMonth = now.toISOString().substring(0, 7);

    // Monthly PnL (The KPI tile)
    const monthlyPnL = trades.filter(t => {
        const d = normalizeDate(t.date);
        return d && d.substring(0, 7) === currentMonth;
    }).reduce((sum, t) => sum + t.pnl, 0).toFixed(2);
    const monthlyPnLEl = document.getElementById('stat-monthlypnl');
    if (monthlyPnLEl) {
        monthlyPnLEl.textContent = `${monthlyPnL}%`;
        monthlyPnLEl.className = `text-4xl font-bold ${monthlyPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
    }

    // Total PnL based on Settings (The KPI tile)
    const pnlPeriod = settings.defaultPnlPeriod || 'all';
    let totalPnL = 0;
    let periodLabel = 'All time cumulative';

    if (pnlPeriod === 'all') {
        totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
        periodLabel = 'All time cumulative';
    } else if (pnlPeriod === 'daily') {
        const today = now.toISOString().substring(0, 10);
        totalPnL = trades.filter(t => normalizeDate(t.date) === today).reduce((sum, t) => sum + t.pnl, 0);
        periodLabel = 'Today';
    } else if (pnlPeriod === 'weekly') {
        totalPnL = trades.filter(t => {
            const d = new Date(normalizeDate(t.date));
            return d && (now - d) / (1000 * 60 * 60 * 24) <= 7;
        }).reduce((sum, t) => sum + t.pnl, 0);
        periodLabel = 'Last 7 days';
    } else if (pnlPeriod === 'monthly') {
        totalPnL = trades.filter(t => {
            const d = normalizeDate(t.date);
            return d && d.substring(0, 7) === currentMonth;
        }).reduce((sum, t) => sum + t.pnl, 0);
        periodLabel = 'Current month';
    } else if (pnlPeriod === 'yearly') {
        const currentYear = now.getFullYear().toString();
        totalPnL = trades.filter(t => {
            const d = normalizeDate(t.date);
            return d && d.substring(0, 4) === currentYear;
        }).reduce((sum, t) => sum + t.pnl, 0);
        periodLabel = 'Current year';
    }

    const totalPnLEl = document.getElementById('stat-totalpnl');
    if (totalPnLEl) {
        totalPnLEl.textContent = `${totalPnL.toFixed(2)}%`;
        totalPnLEl.className = `text-4xl font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
    }
    const labelEl = document.getElementById('stat-pnl-period-label');
    if (labelEl) {
        labelEl.textContent = periodLabel;
    }

    updatePeriodStats();
    updateGoalTracker();
    updateStreak();
}

function updateStreak() {
    if (trades.length === 0) {
        document.getElementById('glance-streak').textContent = '0 W / 0 L';
        return;
    }

    const sortedTrades = [...trades].sort((a, b) => {
        const dateA = new Date(normalizeDate(a.date));
        const dateB = new Date(normalizeDate(b.date));
        return dateB - dateA;
    });
    let wins = 0;
    let losses = 0;
    let currentStreakType = null;

    for (const t of sortedTrades) {
        const outcome = t.outcome === 'win' ? 'W' : (t.outcome === 'loss' ? 'L' : 'BE');
        if (outcome === 'BE') continue;

        if (currentStreakType === null) {
            currentStreakType = outcome;
        }

        if (outcome === currentStreakType) {
            if (outcome === 'W') wins++; else losses++;
        } else {
            break;
        }
    }

    const streakText = currentStreakType === 'W'
        ? `${wins} W / 0 L`
        : currentStreakType === 'L'
        ? `0 W / ${losses} L`
        : '0 W / 0 L';

    document.getElementById('glance-streak').textContent = streakText;
}

function updatePeriodStats() {
    const now = new Date();

    const weeklyPnL = calculatePnLForPeriod(t => {
        const d = new Date(normalizeDate(t.date));
        const diff = now - d;
        return diff / (1000 * 60 * 60 * 24) <= 7;
    });
    renderPeriod('weekly-stats', 'This Week', weeklyPnL);

    const monthlyPnL = calculatePnLForPeriod(t => {
        const d = normalizeDate(t.date);
        return d && d.substring(0, 7) === now.toISOString().substring(0, 7);
    });
    const monthPnLEl = document.getElementById('stat-month-pnl');
    if (monthPnLEl) {
        monthPnLEl.textContent = `${monthlyPnL}%`;
        monthPnLEl.className = `font-bold ml-1 ${monthlyPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
    }
    renderPeriod('monthly-stats', 'This Month', monthlyPnL);

    const yearlyPnL = calculatePnLForPeriod(t => {
        const d = normalizeDate(t.date);
        return d && d.substring(0, 4) === now.getFullYear().toString();
    });
    renderPeriod('yearly-stats', 'This Year', yearlyPnL);
}

function calculatePnLForPeriod(filterFn) {
    const filtered = trades.filter(filterFn);
    return filtered.reduce((sum, t) => sum + t.pnl, 0).toFixed(2);
}

function renderPeriod(elementId, label, value) {
    const container = document.getElementById(elementId);
    if (!container) return;
    const colorClass = value >= 0 ? 'text-emerald-400' : 'text-rose-400';
    container.innerHTML = `
        <div class="flex justify-between items-center p-3 rounded-xl glass">
            <span class="text-sm text-slate-400">${label}</span>
            <span class="font-bold ${colorClass}">${value}%</span>
        </div>
    `;
}

function updateGoalTracker() {
    const target = settings.goalTarget || 10;
    const period = settings.goalPeriod || 'monthly';
    const now = new Date();

    const periodLabels = {
        daily: 'Daily Goal',
        weekly: 'Weekly Goal',
        monthly: 'Monthly Goal',
        yearly: 'Yearly Goal'
    };
    const headerEl = document.getElementById('goal-header');
    if (headerEl) {
        headerEl.innerHTML = `
            <i data-lucide="target" class="w-6 h-6 text-rose-400"></i> ${periodLabels[period] || 'Monthly Goal'} Progress
        `;
    }
    lucide.createIcons();

    let currentPnL = 0;
    if (period === 'daily') {
        const today = now.toISOString().substring(0, 10);
        currentPnL = trades.filter(t => normalizeDate(t.date) === today).reduce((sum, t) => sum + t.pnl, 0);
    } else if (period === 'weekly') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        currentPnL = trades.filter(t => {
            const d = new Date(normalizeDate(t.date));
            return d && d >= sevenDaysAgo;
        }).reduce((sum, t) => sum + t.pnl, 0);
    } else if (period === 'monthly') {
        const currentMonth = now.toISOString().substring(0, 7);
        currentPnL = trades.filter(t => {
            const d = normalizeDate(t.date);
            return d && d.substring(0, 7) === currentMonth;
        }).reduce((sum, t) => sum + t.pnl, 0);
    } else if (period === 'yearly') {
        const currentYear = now.getFullYear().toString();
        currentPnL = trades.filter(t => {
            const d = normalizeDate(t.date);
            return d && d.substring(0, 4) === currentYear;
        }).reduce((sum, t) => sum + t.pnl, 0);
    }

    const currentPnLFixed = currentPnL.toFixed(2);
    const progress = target > 0 ? Math.min(100, Math.max(0, (currentPnL / target) * 100)) : 0;

    const targetEl = document.getElementById('goal-target');
    const currentEl = document.getElementById('goal-current');
    const progressEl = document.getElementById('goal-progress');
    const percentEl = document.getElementById('goal-percentage');

    if (targetEl) targetEl.textContent = `${target}%`;
    if (currentEl) currentEl.textContent = `${currentPnLFixed}%`;
    if (progressEl) progressEl.style.width = `${progress}%`;
    if (percentEl) percentEl.textContent = `${progress.toFixed(1)}%`;
}


// --- Journal Rendering ---
function renderTrades(filteredTrades = null) {
    const list = document.getElementById('trade-list');
    const data = filteredTrades || trades;

    updateJournalInsights(data);
    updateDashboard();

    if (data.length === 0) {

        list.innerHTML = `
            <div class="text-center py-20 glass rounded-3xl">
                <i data-lucide="database" class="w-12 h-12 text-slate-600 mx-auto mb-4"></i>
                <p class="text-slate-400">No trades found. Start your journey!</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    list.innerHTML = data.sort((a, b) => {
        const dateA = new Date(normalizeDate(a.date));
        const dateB = new Date(normalizeDate(b.date));
        return dateB - dateA;
    }).map(t => {
        // Data migration: convert old single screenshot to array
        if (t.screenshot && !t.screenshots) {
            t.screenshots = [t.screenshot];
            delete t.screenshot;
        }
        const screenshots = t.screenshots || [];

        return `
        <div onclick="showTradeDetails(${t.id})" class="trade-card glass p-4 rounded-2xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 cursor-pointer hover:ring-2 ring-blue-500/30 transition-all">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full flex items-center justify-center font-bold ${getOutcomeColor(t.outcome)}">
                    ${t.outcome === 'win' ? 'W' : t.outcome === 'loss' ? 'L' : 'BE'}
                </div>
                <div class="flex flex-col">
                    <h4 class="font-bold text-lg">${t.pair}</h4>
                    <div class="flex items-center gap-2">
                        <p class="text-xs text-slate-400">${t.date}</p>
                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 uppercase font-bold">${t.bias || 'neutral'}</span>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-8 flex-1 px-4">
                <div class="pointer-events-none">
                    <span class="block text-xs text-slate-500 uppercase font-semibold">Outcome</span>
                    <span class="font-medium ${getOutcomeTextClass(t.outcome)}">${t.outcome.toUpperCase()}</span>
                </div>
                <div class="flex-1 pointer-events-none">
                    <span class="block text-xs text-slate-500 uppercase font-semibold">TPs Hit</span>
                    <span class="font-medium">${t.tpsHit || 0}</span>
                </div>
                <div class="pointer-events-none">
                    <span class="block text-xs text-slate-500 uppercase font-semibold">RR</span>
                    <span class="font-medium">${parseFloat(t.rr).toFixed(2)}</span>
                </div>
                <div class="pointer-events-none">
                    <span class="block text-xs text-slate-500 uppercase font-semibold">Pips</span>
                    <span class="font-medium">${t.pips || 0}</span>
                </div>
                <div class="pointer-events-none">
                    <span class="block text-xs text-slate-500 uppercase font-semibold">PnL</span>
                    <span class="font-medium ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${t.pnl}%</span>
                </div>
                <div class="pointer-events-none">
                    <span class="block text-xs text-slate-500 uppercase font-semibold">Confluences</span>
                    <div class="flex flex-wrap gap-1 mt-1">
                        ${t.confluences.map(c => `<span class="text-[10px] px-2 py-0.5 rounded-md bg-slate-700 text-slate-300">${c}</span>`).join('')}
                    </div>
                </div>
            </div>

            <div class="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-end">
                <div class="flex gap-2">
                    ${screenshots.length > 0 ? `
                        <div class="p-2 glass rounded-lg text-slate-400 hover:text-blue-400 transition-colors flex items-center gap-1" title="${screenshots.length} Screenshots">
                            <i data-lucide="image" class="w-5 h-5"></i>
                            <span class="text-xs">${screenshots.length}</span>
                        </div>
                    ` : ''}
                </div>
                <button onclick="event.stopPropagation(); deleteTrade(${t.id})" class="p-2 text-slate-500 hover:text-rose-400 transition-colors">
                    <i data-lucide="trash-2" class="w-5 h-5"></i>
                </button>
            </div>
        </div>
    `}).join('');
    lucide.createIcons();
}

function updateJournalInsights(data) {
    const totalTrades = data.length;
    const wins = data.filter(t => t.outcome === 'win').length;
    const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0';

    const winningTrades = data.filter(t => t.outcome === 'win');
    const avgRR = winningTrades.length > 0
        ? (winningTrades.reduce((sum, t) => sum + t.rr, 0) / winningTrades.length).toFixed(2)
        : '0.00';

    // Top Pair Calculation
    const pairCounts = {};
    data.forEach(t => {
        pairCounts[t.pair] = (pairCounts[t.pair] || 0) + 1;
    });
    let topPair = '---';
    let maxCount = 0;
    for (const pair in pairCounts) {
        if (pairCounts[pair] > maxCount) {
            maxCount = pairCounts[pair];
            topPair = pair;
        }
    }

    document.getElementById('insight-total-trades').textContent = totalTrades;
    document.getElementById('insight-winrate').textContent = `${winRate}%`;
    document.getElementById('insight-avgrr').textContent = avgRR;
    document.getElementById('insight-top-pair').querySelector('.text-2xl').textContent = topPair;
}

function getOutcomeColor(outcome) {
    if (outcome === 'win') return 'bg-emerald-500/20 text-emerald-400';
    if (outcome === 'loss') return 'bg-rose-500/20 text-rose-400';
    return 'bg-slate-500/20 text-slate-400';
}

function getOutcomeTextClass(outcome) {
    if (outcome === 'win') return 'text-emerald-400';
    if (outcome === 'loss') return 'text-rose-400';
    return 'text-slate-400';
}

// --- Calendar Logic ---
function changeMonth(delta) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
    renderCalendar();
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const yearSelect = document.getElementById('calendar-year-select');
    if (yearSelect && yearSelect.options.length === 0) {
        const currentYear = new Date().getFullYear();
        for (let i = currentYear - 5; i <= currentYear + 5; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = i;
            if (i === year) opt.selected = true;
            yearSelect.appendChild(opt);
        }
    }

    const monthSelect = document.getElementById('calendar-month-select');
    if (monthSelect) monthSelect.value = month;

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    grid.innerHTML = '';

    for (let i = 0; i < firstDayOfMonth; i++) {
        grid.appendChild(document.createElement('div'));
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayEl = document.createElement('div');
        dayEl.className = 'h-24 p-2 glass rounded-xl flex flex-col justify-between cursor-pointer hover:ring-2 ring-blue-500/50 transition-all relative';

        const dayTrades = trades.filter(t => normalizeDate(t.date) === dateStr);
        const hasTrades = dayTrades.length > 0;

        if (hasTrades) {
            const dayPnL = dayTrades.reduce((sum, t) => sum + t.pnl, 0);
            const wins = dayTrades.filter(t => t.outcome === 'win').length;
            const winRate = ((wins / dayTrades.length) * 100).toFixed(0);
            const totalTrades = dayTrades.length;

            if (dayPnL > 0) {
                dayEl.classList.add('border-emerald-500/50', 'bg-emerald-500/10');
            } else if (dayPnL < 0) {
                dayEl.classList.add('border-rose-500/50', 'bg-rose-500/10');
            } else {
                dayEl.classList.add('border-slate-500/50', 'bg-slate-500/10');
            }

            dayEl.innerHTML = `
                <span class="text-xs font-medium text-slate-100">${day}</span>
                <div class="flex flex-col items-center justify-center gap-1">
                    <span class="text-sm font-bold ${dayPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${winRate}%</span>
                    <span class="text-[10px] text-slate-400 font-medium">${totalTrades} Trades</span>
                </div>
            `;
        } else {
            dayEl.innerHTML = `<span class="text-xs font-medium text-slate-500">${day}</span>`;
        }

        dayEl.onclick = () => filterJournalByDate(dateStr);
        grid.appendChild(dayEl);
    }
}

function filterJournalByDate(dateStr) {
    showPage('journal');
    const filtered = trades.filter(t => t.date === dateStr);
    renderTrades(filtered);
}

function jumpToDate(month, year) {
    currentCalendarDate = new Date(year, month);
    renderCalendar();
}


const MOHAM_DATA = [
  {
    "PAIR": "XAUUSD",
    "Date": "July 18, 2024",
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "LOSS ❌",
    "Confluences": "BoS, Liq Sweep, OB",
    "PIPS": -283,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "None",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "XAUUSD",
    "Date": "July 17, 2024",
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "WIN ✅️",
    "Confluences": "BoS, Liq Sweep, OB",
    "PIPS": 393,
    "TRADE": "SELL",
    "Aantal Take Profits HIT": "TP1",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "XAUUSD",
    "Date": "July 29, 2024",
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "WIN ✅️",
    "Confluences": "BoS, Liq Sweep, OB",
    "PIPS": 239,
    "TRADE": "SELL",
    "Aantal Take Profits HIT": "TP1",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "XAUUSD",
    "Date": "July 30, 2024",
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "LOSS ❌",
    "Confluences": "BoS, FVG, Liq Sweep, OB",
    "PIPS": -82,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "None",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "GBPJPY",
    "Date": "August 5, 2024",
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "WIN ✅️",
    "Confluences": "BoS, Liq Sweep, OB",
    "PIPS": 216,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "TP1, TP2, TP3",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "USDJPY",
    "Date": 45509,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "WIN ✅️",
    "Confluences": "Liq Sweep,BoS,Ob",
    "PIPS": 131,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "TP2",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "EURUSD",
    "Date": 45510,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "WIN ✅️",
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": 18,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "TP2",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "USDJPY",
    "Date": 45510,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "WIN ✅️",
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": 148,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "TP2",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "XAUUSD",
    "Date": 45511,
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "WIN ✅️",
    "Confluences": "Liq Sweep,BoS,OB,FVG",
    "PIPS": 730,
    "TRADE": "SELL",
    "Aantal Take Profits HIT": "TP1",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "GBPJPY",
    "Date": 45511,
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "WIN ✅️",
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": 165,
    "TRADE": "SELL",
    "Aantal Take Profits HIT": "TP3",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "USDJPY",
    "Date": 45511,
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "WIN ✅️",
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": 113,
    "TRADE": "SELL",
    "Aantal Take Profits HIT": "TP3",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "GBPUSD",
    "Date": 45523,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "WIN ✅️",
    "RR": 4,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": 25,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "TP4",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "USDJPY",
    "Date": 45524,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "LOSS ❌",
    "RR": 3,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": -7,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "None",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "EURUSD",
    "Date": 45525,
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "WIN ✅️",
    "RR": 2.4,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": 15,
    "TRADE": "SELL",
    "Aantal Take Profits HIT": "TP4",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "XAUUSD",
    "Date": 45530,
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "WIN ✅️",
    "RR": 2,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": 175,
    "TRADE": "SELL",
    "Aantal Take Profits HIT": "TP1",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "EURUSD",
    "Date": 45531,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "WIN ✅️",
    "RR": 3.7,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": 21,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "TP1",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "USDJPY",
    "Date": 45531,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "LOSS ❌",
    "RR": "4.2",
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": -18,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "None",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "GBPUSD",
    "Date": 45532,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "LOSS ❌",
    "RR": 4.8,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": -8,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "None",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "GBPJPY",
    "Date": 45532,
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "WIN ✅️",
    "RR": 3.3,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": 69,
    "TRADE": "SELL",
    "Aantal Take Profits HIT": "ALL",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "EURUSD",
    "Date": 45532,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "WIN ✅️",
    "RR": 3,
    "Confluences": "Liq Sweep,Bos,EQ",
    "PIPS": 39,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "TP1",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "XAUUSD",
    "Date": 45574,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "LOSS ❌",
    "RR": 1.2,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": -709,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "None",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "GBPJPY",
    "Date": 45586,
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "WIN ✅️",
    "RR": 5.3,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": 24,
    "TRADE": "SELL",
    "Aantal Take Profits HIT": "TP2/TP4",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "GBPUSD",
    "Date": 45586,
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "LOSS ❌",
    "RR": 4.2,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": 3,
    "TRADE": "SELL",
    "Aantal Take Profits HIT": "None",
    "SESSION": "NEW YORK",
    "Reden": "Spreads"
  },
  {
    "PAIR": "GBPJPY",
    "Date": 45588,
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "WIN ✅️",
    "RR": 8,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": 19,
    "TRADE": "SELL",
    "Aantal Take Profits HIT": "TP1/TP3",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "XAUUSD",
    "Date": 45593,
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "LOSS ❌",
    "RR": 8,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": 228,
    "TRADE": "SELL",
    "Aantal Take Profits HIT": "None",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "GBPUSD",
    "Date": 45594,
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "LOSS ❌",
    "RR": 2.6,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": -5,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "None",
    "SESSION": "NEW YORK",
    "Reden": "Stopeed out by 1 pip"
  },
  {
    "PAIR": "USDJPY",
    "Date": 45594,
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "WIN ✅️",
    "RR": 4.4,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": 43,
    "TRADE": "SELL",
    "Aantal Take Profits HIT": "TP4/4",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "USDJPY",
    "Date": 45596,
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "LOSS ❌",
    "RR": 3,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": 63.03703704,
    "TRADE": "SELL",
    "Aantal Take Profits HIT": "None",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "GBPJPY",
    "Date": 46219,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "WIN ✅️",
    "RR": 3.6,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": 54,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "TP2/3&",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "GBPJPY",
    "Date": 46222,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "LOSS ❌",
    "RR": 4,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": -14,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "None",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "USDJPY",
    "Date": 46223,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "LOSS ❌",
    "RR": 5,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": -8,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "None",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "EURUSD",
    "Date": 46235,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "WIN ✅️",
    "RR": 1.2,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": 13,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "TP",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "EURUSD",
    "Date": 45838,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "LOSS ❌",
    "RR": 1.6,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": -6,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "None",
    "SESSION": "NEW YORK",
    "Reden": " SL dan gelijk TP"
  },
  {
    "PAIR": "XAUUSD",
    "Date": 45839,
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "LOSS ❌",
    "RR": 5.2,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": 296,
    "TRADE": "SELL",
    "Aantal Take Profits HIT": "None",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "EURUSD",
    "Date": 45840,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "WIN ✅️",
    "RR": 3.36,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": 25,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "ALL/TP3",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "USDJPY",
    "Date": 45840,
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "WIN ✅️",
    "RR": 4.87,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": 33,
    "TRADE": "SELL",
    "Aantal Take Profits HIT": "ALL/TP4",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "GBPUSD",
    "Date": 45846,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "LOSS ❌",
    "RR": 9.57,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": -7,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "None",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "GBPUSD",
    "Date": 45847,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "LOSS ❌",
    "Confluences": "Liq Sweep,BoS,OB",
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "None",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "GBPJPY",
    "Date": 45847,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "WIN ✅️",
    "RR": 3.41,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": 16,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "TP1",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "GBPUSD",
    "Date": 45848,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "WIN ✅️",
    "RR": 5.43,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": -9,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "None",
    "SESSION": "NEW YORK",
    "Reden": "Spreads"
  },
  {
    "PAIR": "XAUUSD",
    "Date": 45848,
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "LOSS ❌",
    "RR": 1.3,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": -548,
    "TRADE": "SELL",
    "Aantal Take Profits HIT": "None",
    "SESSION": "NEW YORK",
    "Reden": "Niet goed strategie opgevolgd anders had ik een W"
  },
  {
    "PAIR": "EURUSD",
    "Date": 45852,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "LOSS ❌",
    "RR": 2.07,
    "Confluences": "Liq Sweep,BoS,OB.FVG,EQ",
    "PIPS": -5,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "None",
    "SESSION": "NEW YORK",
    "Reden": "No news monday + Bank holiday"
  },
  {
    "PAIR": "GBPUSD",
    "Date": 45852,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "LOSS ❌",
    "RR": 3.09,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": -5,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "None",
    "SESSION": "NEW YORK",
    "Reden": "No news monday + Bank holiday"
  },
  {
    "PAIR": "EURUSD",
    "Date": 45860,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "WIN ✅️",
    "RR": 3.55,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": 30,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "TP4/TP4",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "EURUSD",
    "Date": 45861,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "LOSS ❌",
    "RR": 9.5,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": "-1.8",
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "None",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "GBPUSD",
    "Date": 45861,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "WIN ✅️",
    "RR": 5.19,
    "Confluences": "Liq Sweep,BoS,OB",
    "PIPS": 14,
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "TP3/TP4",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "GBPUSD",
    "Date": 45867,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "WIN ✅️",
    "Confluences": "Liq Sweep,BoS,OB",
    "TRADE": "BUY",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "XAUUSD",
    "Date": 45867,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "WIN ✅️",
    "Confluences": "Liq Sweep,BoS,OB",
    "TRADE": "BUY",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "GBPJPY",
    "Date": 45992,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "WIN ✅️",
    "Confluences": "Liq Sweep,BoS,OB",
    "TRADE": "BUY",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "XAUUSD",
    "Date": 46029,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "WIN ✅️",
    "RR": 6.48,
    "Confluences": "Liq Sweep,BoS,OB",
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "TP3 dan SL BE",
    "SESSION": "NEW YORK",
    "Reden": "eerste trade van 2026, ging goed, moest wel beter optijd ready staan"
  },
  {
    "PAIR": "EURUSD",
    "Date": 46050,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "LOSS ❌",
    "RR": 2.55,
    "Confluences": "Liq Sweep,BoS,OB",
    "TRADE": "BUY",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "GBPUSD",
    "Date": 46050,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "LOSS ❌",
    "RR": 2.55,
    "Confluences": "Liq Sweep,BoS,OB",
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "None",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "USDJPY",
    "Date": 46051,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "WIN ✅️",
    "RR": 2.74,
    "Confluences": "Liq Sweep,BoS,OB",
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "TP1",
    "SESSION": "NEW YORK",
    "Reden": "unemployment claims"
  },
  {
    "PAIR": "XAUUSD",
    "Date": "04//02/2026",
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "WIN ✅️",
    "RR": 8.95,
    "Confluences": "Liq Sweep,BoS,OB",
    "TRADE": "SELL",
    "Aantal Take Profits HIT": "All",
    "SESSION": "NEW YORK",
    "Reden": "in call met Karam"
  },
  {
    "PAIR": "XAUUSD",
    "Date": 46059,
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "WIN ✅️",
    "RR": 10.25,
    "Confluences": "Liq Sweep,BoS,OB",
    "TRADE": "SELL",
    "Aantal Take Profits HIT": "TP1",
    "SESSION": "NEW YORK",
    "Reden": "na jumu3a"
  },
  {
    "PAIR": "EURUSD",
    "Date": 46059,
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "WIN ✅️",
    "RR": 4.33,
    "Confluences": "Liq Sweep,BoS,OB",
    "TRADE": "SELL",
    "Aantal Take Profits HIT": "All",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "GBPUSD",
    "Date": 46062,
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "WIN ✅️",
    "RR": 6.13,
    "Confluences": "Liq Sweep,BoS,OB",
    "TRADE": "SELL",
    "Aantal Take Profits HIT": "All",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "GBPJPY",
    "Date": "08/07/2°26",
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BULLISH",
    "OUTCOME": "LOSS ❌",
    "RR": 4.59,
    "Confluences": "Liq Sweep,BoS,OB",
    "TRADE": "SELL",
    "SESSION": "NEW YORK",
    "Reden": "pre fomc"
  },
  {
    "PAIR": "XAUUSD",
    "Date": 46219,
    "MY BIAS": "BULLISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "LOSS ❌",
    "RR": 3.8,
    "Confluences": "Liq Sweep,BoS,OB",
    "TRADE": "BUY",
    "Aantal Take Profits HIT": "None",
    "SESSION": "NEW YORK"
  },
  {
    "PAIR": "XAUUSD",
    "Date": 46233,
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "LOSS ❌",
    "RR": 4.47,
    "Confluences": "Liq Sweep,BoS,OB",
    "TRADE": "SELL",
    "Aantal Take Profits HIT": "None",
    "SESSION": "NEW YORK",
    "Reden": "was market open vergeten en daardoor mijn beste entry gemist, ook heeft er een juicy drake candle van 14:30 news mijn sl gesmashed"
  },
  {
    "PAIR": "GBPUSD",
    "Date": 46233,
    "MY BIAS": "BEARISH",
    "BIAS MARKET": "BEARISH",
    "OUTCOME": "WIN ✅️",
    "RR": 2.64,
    "Confluences": "Liq Sweep,BoS,OB",
    "TRADE": "SELL",
    "Aantal Take Profits HIT": 46054,
    "SESSION": "NEW YORK"
  }
];

function importMohamData() {
    const result = bulkImportTrades(MOHAM_DATA);
    alert(result);
}


function clearAllData() {
    if (confirm('Are you sure you want to delete EVERYTHING? This cannot be undone.')) {
        localStorage.clear();
        location.reload();
    }
}

function resetTrades() {
    if (confirm('Are you sure you want to clear all trades? Your settings will be kept.')) {
        trades = [];
        localStorage.setItem('apex_trades', JSON.stringify(trades));
        renderTrades();
        updateDashboard();
        renderCalendar();
        alert('All trades cleared!');
    }
}
