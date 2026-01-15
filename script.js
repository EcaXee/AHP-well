let kriteria = [], alternatif = [], dataAtribut = [], chartInstance = null;
const RI = [0, 0, 0, 0.58, 0.90, 1.12, 1.24, 1.32, 1.41, 1.45];

function prosesUpload() {
    const file = document.getElementById('excelFile').files[0];
    if (!file) return alert("Pilih file Excel!");
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
        kriteria = json[0].slice(1);
        dataAtribut = json.slice(1);
        alternatif = dataAtribut.map(row => row[0]);
        renderMatriksKriteria();
    };
    reader.readAsArrayBuffer(file);
}

function renderMatriksKriteria() {
    document.getElementById('panelMatriksKriteria').style.display = 'block';
    const container = document.getElementById('matriksKriteriaContainer');
    let html = `<table class="table table-bordered text-center"><thead><tr><th>KRITERIA</th>` + 
               kriteria.map(k => `<th>${k}</th>`).join('') + `</tr></thead><tbody>`;
    for (let i = 0; i < kriteria.length; i++) {
        html += `<tr><td class="fw-bold text-neon-blue">${kriteria[i]}</td>`;
        for (let j = 0; j < kriteria.length; j++) {
            if (i === j) html += `<td><input type="text" class="matrix-input" value="1" disabled></td>`;
            else html += `<td><input type="number" class="matrix-input" id="m_${i}_${j}" value="1" onchange="kebalikan(${i}, ${j})"></td>`;
        }
        html += `</tr>`;
    }
    container.innerHTML = html + `</tbody></table>`;
}

function kebalikan(i, j) {
    let val = parseFloat(document.getElementById(`m_${i}_${j}`).value);
    let target = document.getElementById(`m_${j}_${i}`);
    if (val === 3) target.value = 0.33; 
    else if (val === 5) target.value = 0.20;
    else if (val > 0) target.value = (1 / val).toFixed(2);
}

function jalankanAHPPremium() {
    const nK = kriteria.length, nA = alternatif.length;
    document.getElementById('panelLaporan').style.display = 'block';

    // A. KRITERIA & KONSISTENSI
    let matK = Array.from({ length: nK }, () => Array(nK).fill(0));
    for(let i=0; i<nK; i++) for(let j=0; j<nK; j++) matK[i][j] = (i===j)?1:parseFloat(document.getElementById(`m_${i}_${j}`).value || 1);
    
    let sumK = new Array(nK).fill(0);
    for(let j=0; j<nK; j++) for(let i=0; i<nK; i++) sumK[j] += matK[i][j];
    
    let bobotK = new Array(nK).fill(0);
    let hNormK = `<table class="table table-bordered text-center"><thead><tr><th>Kriteria</th>` + kriteria.map(k => `<th>${k}</th>`).join('') + `<th>Bobot (W)</th></tr></thead><tbody>`;
    let normSumsK = new Array(nK).fill(0);

    for(let i=0; i<nK; i++) {
        hNormK += `<tr><td class="fw-bold">${kriteria[i]}</td>`;
        let rs = 0;
        for(let j=0; j<nK; j++) {
            let valNorm = matK[i][j] / sumK[j];
            rs += valNorm;
            normSumsK[j] += valNorm;
            hNormK += `<td class="text-muted small">${valNorm.toFixed(3)}</td>`;
        }
        bobotK[i] = rs / nK;
        hNormK += `<td class="fw-bold text-neon-blue">${bobotK[i].toFixed(4)}</td></tr>`;
    }
    hNormK += `<tr class="table-active fw-bold text-dark"><td>Total Penjumlahan</td>` + normSumsK.map(s => `<td>${Math.round(s)}</td>`).join('') + `<td>1.0000</td></tr>`;
    document.getElementById('tabelNormKriteria').innerHTML = hNormK + `</tbody></table>`;

    // Konsistensi
    let lambda = 0;
    for(let i=0; i<nK; i++) { let rs = 0; for(let j=0; j<nK; j++) rs += matK[i][j] * bobotK[j]; lambda += rs / bobotK[i]; }
    let Lmax = lambda / nK, CI = (Lmax - nK) / (nK - 1), CR = CI / RI[nK];
    document.getElementById('statusKonsistensi').innerHTML = `<div class="p-3 bg-black border rounded-3 text-center small"><div class="row"><div class="col-3">L-Max: ${Lmax.toFixed(3)}</div><div class="col-3">CI: ${CI.toFixed(3)}</div><div class="col-3">RI: ${RI[nK]}</div><div class="col-3 fw-bold ${CR <= 0.1 ? 'text-success' : 'text-danger'}">CR: ${CR.toFixed(3)}</div></div></div>`;

    // B. ANALISIS ALTERNATIF (RASIO + NORMALISASI)
    let bobotAltFinal = Array.from({ length: nA }, () => new Array(nK).fill(0));
    let htmlAlt = "";
    kriteria.forEach((kName, kIdx) => {
        let vals = dataAtribut.map(r => parseFloat(r[kIdx+1]) || 1);
        let isCost = (kName.toLowerCase().includes("harga") || kName.toLowerCase().includes("berat"));
        let matA = Array.from({ length: nA }, () => Array(nA).fill(0)), colSumA = new Array(nA).fill(0);
        for(let i=0; i<nA; i++) for(let j=0; j<nA; j++) { matA[i][j] = isCost ? (vals[j]/vals[i]) : (vals[i]/vals[j]); colSumA[j] += matA[i][j]; }
        
        let normSumsA = new Array(nA).fill(0);
        htmlAlt += `<div class="mb-5 p-3 bg-black bg-opacity-25 border rounded-3">
            <div class="d-flex justify-content-between mb-2">
                <strong class="text-neon-blue">Analisis Kriteria: ${kName}</strong>
                <span class="badge ${isCost ? 'bg-danger' : 'bg-success'} small">${isCost ? 'Cost' : 'Benefit'}</span>
            </div>
            
            <p class="small text-muted mb-1">1. Matriks Rasio Perbandingan:</p>
            <table class="table table-sm table-bordered text-center mb-3">
                <thead class="table-dark text-white"><tr><th>Rasio</th>` + alternatif.map(a => `<th>${a}</th>`).join('') + `</tr></thead>
                <tbody>` + alternatif.map((a, i) => `<tr><td class="small fw-bold">${a}</td>` + matA[i].map(v => `<td>${v.toFixed(2)}</td>`).join('') + `</tr>`).join('') + `
                <tr class="table-secondary text-dark fw-bold"><td>Total Kolom</td>` + colSumA.map(s => `<td>${s.toFixed(2)}</td>`).join('') + `</tr></tbody>
            </table>

            <p class="small text-muted mb-1">2. Matriks Normalisasi:</p>
            <table class="table table-sm table-bordered text-center">
                <thead class="table-info text-dark"><tr><th>Normalisasi</th>` + alternatif.map(a => `<th>${a}</th>`).join('') + `<th>Bobot</th></tr></thead><tbody>`;
        
        for(let i=0; i<nA; i++) {
            htmlAlt += `<tr><td class="small fw-bold">${alternatif[i]}</td>`;
            let rsA = 0;
            for(let j=0; j<nA; j++) {
                let normVal = matA[i][j] / colSumA[j];
                rsA += normVal;
                normSumsA[j] += normVal;
                htmlAlt += `<td class="text-muted small">${normVal.toFixed(3)}</td>`;
            }
            bobotAltFinal[i][kIdx] = rsA / nA;
            htmlAlt += `<td class="fw-bold text-neon-purple">${bobotAltFinal[i][kIdx].toFixed(4)}</td></tr>`;
        }
        htmlAlt += `<tr class="table-secondary text-dark fw-bold"><td>Total Penjumlahan</td>` + normSumsA.map(s => `<td>${Math.round(s)}</td>`).join('') + `<td>1.0000</td></tr>`;
        htmlAlt += `</tbody></table></div>`;
    });
    document.getElementById('areaAlternatifDetail').innerHTML = htmlAlt;

    // C. SINTESIS GLOBAL
    let skorFinal = alternatif.map(() => 0);
    let htmlSyn = `<table class="table table-bordered text-center"><thead><tr><th>Alternatif</th>` + kriteria.map(k => `<th>${k}</th>`).join('') + `<th>Skor Sj</th></tr></thead><tbody>`;
    alternatif.forEach((alt, i) => {
        htmlSyn += `<tr><td class="fw-bold text-light">${alt}</td>`;
        for(let j=0; j<nK; j++) { htmlSyn += `<td class="text-muted small">${bobotAltFinal[i][j].toFixed(4)}</td>`; skorFinal[i] += bobotAltFinal[i][j] * bobotK[j]; }
        htmlSyn += `<td class="fw-bold text-neon-green">${skorFinal[i].toFixed(4)}</td></tr>`;
    });
    document.getElementById('tabelSynthesis').innerHTML = htmlSyn + `</tbody></table>`;
    
    let sorted = alternatif.map((name, i) => ({ name, score: skorFinal[i] })).sort((a,b) => b.score - a.score);
    document.getElementById('finalRankingList').innerHTML = sorted.map((d, i) => `<div class="ranking-item"><div><span class="badge bg-secondary me-2">#${i+1}</span> <b>${d.name}</b></div><div class="fw-bold text-neon-green">${d.score.toFixed(4)}</div></div>`).join('');
    renderChart(alternatif, skorFinal);
}

function renderChart(labels, data) {
    const ctx = document.getElementById('rankingChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, { type: 'polarArea', data: { labels: labels, datasets: [{ data: data, backgroundColor: ['#ff6b00', '#00d2fc', '#bc13fe', '#2ecc71'] }] }, options: { responsive: true, scales: { r: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { backdropColor: 'transparent', color: '#fff' } } }, plugins: { legend: { position: 'bottom', labels: { color: '#fff', font: { family: 'Orbitron' } } } } } });
}
