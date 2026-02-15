let carIndex = [];
const detailsCache = new Map();
let currentView = 'tree-view'; // Default to Tree View
let filteredData = [];
const TOTAL_SPECS = 78864;

// --- INITIALIZATION ---
async function init() {
    toggleLoader(true);
    try {
        const response = await fetch('./web_data/index.json');
        carIndex = await response.json();

        setupTheme();
        initUI();
        setupFilters();

        // Initial setup
        applyFilters();
        toggleLoader(false);
    } catch (e) {
        console.error('System Failure', e);
    }
}

// --- THEME ---
function setupTheme() {
    const btn = document.getElementById('theme-btn');
    const html = document.documentElement;
    const icon = document.getElementById('theme-icon');

    const saved = localStorage.getItem('theme') || 'dark';
    html.setAttribute('data-theme', saved);
    updateThemeIcon(saved);

    btn.onclick = () => {
        const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        updateThemeIcon(next);
    };
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (theme === 'dark') {
        icon.setAttribute('data-lucide', 'moon');
    } else {
        icon.setAttribute('data-lucide', 'sun');
    }
    lucide.createIcons();
}

// --- UI SETUP ---
function initUI() {
    lucide.createIcons();
    // Populate simple make select
    const makeSelect = document.getElementById('make-select');
    carIndex.sort((a, b) => a.n.localeCompare(b.n)).forEach(make => {
        makeSelect.add(new Option(make.n, make.i));
    });

    // Populate Year Selects
    const minS = document.getElementById('year-min');
    const maxS = document.getElementById('year-max');
    for (let y = 2025; y >= 1940; y--) {
        minS.add(new Option(y, y));
        maxS.add(new Option(y, y));
    }

    // Nav Logic
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const target = btn.dataset.view;
            document.querySelectorAll('.view-content').forEach(v => v.classList.add('hidden'));
            document.getElementById(target).classList.remove('hidden');

            currentView = target;
            if (currentView === 'tree-view') renderTreeView();
            else renderCurrentView();
        };
    });

    document.getElementById('close-modal').onclick = () => document.getElementById('detail-modal').classList.remove('active');
}

// --- FILTERING ---
function setupFilters() {
    const inputs = ['make-select', 'model-select', 'trim-select', 'search-input', 'year-min', 'year-max', 'us-only', 'body-style'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        el.oninput = el.onchange = (e) => {
            if (id === 'make-select') updateModelSelect(e.target.value);
            if (id === 'model-select') updateTrimSelect(document.getElementById('make-select').value, e.target.value);
            applyFilters();
        };
    });
}

function updateModelSelect(makeId) {
    const modelS = document.getElementById('model-select');
    const trimS = document.getElementById('trim-select');
    modelS.innerHTML = '<option value="">All Models</option>';
    trimS.innerHTML = '<option value="">Select Model first</option>';
    trimS.disabled = true;

    if (!makeId) {
        modelS.disabled = true;
        return;
    }

    const make = carIndex.find(m => m.i === makeId);
    make.m.sort((a, b) => a.n.localeCompare(b.n)).forEach(model => {
        modelS.add(new Option(model.n, model.n));
    });
    modelS.disabled = false;
}

function updateTrimSelect(makeId, modelName) {
    const trimS = document.getElementById('trim-select');
    trimS.innerHTML = '<option value="">All Trims</option>';

    if (!modelName) {
        trimS.disabled = true;
        return;
    }

    const make = carIndex.find(m => m.i === makeId);
    const model = make.m.find(m => m.n === modelName);
    model.t.sort((a, b) => b.y - a.y).forEach(trim => {
        trimS.add(new Option(`${trim.y} ${trim.t || 'Base'}`, trim.i));
    });
    trimS.disabled = false;
}

function applyFilters() {
    const criteria = {
        makeId: document.getElementById('make-select').value,
        modelName: document.getElementById('model-select').value,
        trimId: document.getElementById('trim-select').value,
        keyword: document.getElementById('search-input').value.toLowerCase(),
        yMin: parseInt(document.getElementById('year-min').value) || 0,
        yMax: parseInt(document.getElementById('year-max').value) || 3000
    };

    filteredData = [];
    carIndex.forEach(make => {
        if (criteria.makeId && make.i !== criteria.makeId) return;
        make.m.forEach(model => {
            if (criteria.modelName && model.n !== criteria.modelName) return;
            model.t.forEach(trim => {
                if (criteria.trimId && trim.i !== criteria.trimId) return;
                if (trim.y < criteria.yMin || trim.y > criteria.yMax) return;

                const fullName = `${make.n} ${model.n} ${trim.t || ''}`.toLowerCase();
                if (criteria.keyword && !fullName.includes(criteria.keyword)) return;

                filteredData.push({
                    makeId: make.i, makeName: make.n,
                    modelName: model.n, trimId: trim.i,
                    year: trim.y, trimName: trim.t || 'Base'
                });
            });
        });
    });

    renderCurrentView();
}

// --- RENDERERS ---
function renderCurrentView() {
    const count = document.getElementById('result-count');
    count.innerHTML = `Displaying <strong>${filteredData.length}</strong> of <strong>${TOTAL_SPECS}</strong> specifications`;

    if (currentView === 'grid-view') renderGrid();
    else if (currentView === 'list-view') renderTable();
    else if (currentView === 'tree-view') renderTreeView();
}

function renderGrid() {
    const container = document.getElementById('car-grid');
    container.innerHTML = '';
    filteredData.slice(0, 50).forEach(car => {
        const card = document.createElement('div');
        card.className = 'card';
        card.onclick = () => showDetail(car.makeId, car.trimId);
        card.innerHTML = `
            <span class="card-badge">${car.year}</span>
            <h3 style="margin-top:0.75rem">${car.makeName}</h3>
            <p style="color:var(--text-gray); font-size:0.9rem">${car.modelName}</p>
            <p style="color:var(--text-gray); font-size:0.8rem; margin-top:0.5rem">${car.trimName}</p>
        `;
        container.appendChild(card);
    });
}

function renderTable() {
    const body = document.getElementById('car-table-body');
    body.innerHTML = '';
    filteredData.slice(0, 100).forEach(car => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${car.makeName}</strong></td>
            <td>${car.modelName}</td>
            <td><span class="card-badge">${car.year}</span></td>
            <td style="color:var(--text-gray)">${car.trimName}</td>
            <td style="text-align:right"><button class="nav-btn" style="padding:0.3rem 0.6rem" onclick="showDetail('${car.makeId}', '${car.trimId}')">Specs</button></td>
        `;
        body.appendChild(row);
    });
}

function renderTreeView() {
    const root = document.getElementById('tree-root');
    root.innerHTML = '';

    // Group filtered data back into tree structure for high performance browsing
    const tree = {};
    filteredData.forEach(c => {
        if (!tree[c.makeName]) tree[c.makeName] = { id: c.makeId, models: {} };
        if (!tree[c.makeName].models[c.modelName]) tree[c.makeName].models[c.modelName] = [];
        tree[c.makeName].models[c.modelName].push(c);
    });

    Object.keys(tree).sort().forEach(makeName => {
        const makeNode = createTreeNode(makeName, () => {
            const models = tree[makeName].models;
            Object.keys(models).sort().forEach(modelName => {
                const modelNode = createTreeNode(modelName, () => {
                    models[modelName].sort((a, b) => b.year - a.year).forEach(trim => {
                        const tNode = document.createElement('div');
                        tNode.className = 'tree-label';
                        tNode.style.fontSize = '0.8rem';
                        tNode.innerHTML = `○ ${trim.year} ${trim.trimName}`;
                        tNode.onclick = (e) => { e.stopPropagation(); showDetail(trim.makeId, trim.trimId); };
                        modelNode.container.appendChild(tNode);
                    });
                });
                makeNode.container.appendChild(modelNode);
            });
        });
        root.appendChild(makeNode);
    });
}

function createTreeNode(label, onExpand) {
    const div = document.createElement('div');
    div.className = 'tree-node';
    const row = document.createElement('div');
    row.className = 'tree-label';
    row.innerHTML = `<span class="tree-icon">▶</span> <span>${label}</span>`;
    const children = document.createElement('div');
    children.className = 'tree-children hidden';
    row.onclick = () => {
        const isHidden = children.classList.contains('hidden');
        children.classList.toggle('hidden');
        row.querySelector('.tree-icon').classList.toggle('expanded');
        if (isHidden && children.innerHTML === '') onExpand();
    };
    div.appendChild(row);
    div.appendChild(children);
    div.container = children;
    return div;
}

// --- MODAL & SPECS ---
async function showDetail(makeId, trimId) {
    toggleLoader(true);
    let details = detailsCache.get(makeId);
    if (!details) {
        const res = await fetch(`./web_data/details/${makeId}.json`);
        details = await res.json();
        detailsCache.set(makeId, details);
    }
    const car = details[trimId];

    // Header
    document.getElementById('modal-title').textContent = `${car.model_year} ${car.make_display} ${car.model_name}`;

    const specsRoot = document.getElementById('specs-root');
    specsRoot.innerHTML = '';

    const categories = {
        "Engine & Power": ["model_engine_type", "model_engine_compression", "model_engine_fuel", "model_engine_power_hp", "model_engine_power_ps", "model_engine_power_kw", "model_engine_power_rpm", "model_engine_torque_nm", "model_engine_torque_lbft", "model_engine_torque_rpm", "model_engine_valves_per_cyl"],
        "Performance": ["model_top_speed_kph", "model_top_speed_mph", "model_0_to_100_kph", "model_lkm_hwy", "model_lkm_mixed", "model_lkm_city"],
        "Transmission & Drivetrain": ["model_transmission_type", "model_drive", "model_gears"],
        "Dimensions & Weight": ["model_weight_kg", "model_length_mm", "model_width_mm", "model_height_mm", "model_wheelbase_mm", "model_seats", "model_doors"],
        "General Info": ["model_body", "model_engine_position", "model_engine_bore_mm", "model_engine_stroke_mm", "model_engine_cc", "model_sold_in_us"]
    };

    Object.entries(categories).forEach(([name, keys]) => {
        const availableKeys = keys.filter(k => car[k] && car[k] !== '0' && car[k] !== 'None');
        if (availableKeys.length === 0) return;

        const section = document.createElement('div');
        section.className = 'specs-section';
        section.innerHTML = `
            <div class="specs-section-title">${name}</div>
            <div class="specs-grid"></div>
        `;
        const grid = section.querySelector('.specs-grid');

        availableKeys.forEach(k => {
            const item = document.createElement('div');
            item.className = 'spec-item';
            const label = k.replace('model_', '').replace(/_/g, ' ');
            item.innerHTML = `
                <div class="spec-label">${label}</div>
                <div class="spec-value">${car[k]}</div>
            `;
            grid.appendChild(item);
        });

        specsRoot.appendChild(section);
    });

    document.getElementById('detail-modal').classList.add('active');
    lucide.createIcons();
    toggleLoader(false);
}

function toggleLoader(show) { document.getElementById('loading-overlay').classList.toggle('hidden', !show); }

init();
