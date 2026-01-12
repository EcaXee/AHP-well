/* script.js - Robust & Corrected Logic */

let kriteria = [], alternatif = [], dataAtribut = [], chartInstance = null;
const RI = [0, 0, 0, 0.58, 0.90, 1.12, 1.24, 1.32, 1.41, 1.45];

// Memproses Unggah Excel
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

// Render Input Matriks Kriteria
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

// Logika Reciprocal (Kebalikan) - Sesuai Slide 18
function kebalikan(i, j) {
    let val = parseFloat(document.getElementById(`m_${i}_${j}`).value);
    let target = document.getElementById(`m_${j}_${i}`);
    if (val === 3) target.value = 0.33; 
    else if (val === 5) target.value = 0.20;
    else if (val > 0) target.value = (1 / val).toFixed(2);
}

// Analisis Utama AHP
function jalankanAHPPremium() {
    const nK = kriteria.length, nA = alternatif.length;
    document.getElementById('panelLaporan').style.display = 'block';

    // --- A. ANALISIS KRITERIA ---
    let matK = Array.from({ length: nK }, () => Array(nK).fill(0));
    for(let i=0; i<nK; i++) for(let j=0; j<nK; j++) matK[i][j] = (i===j)?1:parseFloat(document.getElementById(`m_${i}_${j}`).value || 1);
    
    let sumK = new Array(nK).fill(0);
    for(let j=0; j<nK; j++) for(let i=0; i<nK; i++) sumK[j] += matK[i][j];
    
    let bobotK = new Array(nK).fill(0);
    for(let i=0; i<nK; i++) {
        let rs = 0;
        for(let j=0; j<nK; j++) rs += (matK[i][j] / sumK[j]);
        bobotK[i] = rs / nK;
    }

    // --- B. ANALISIS ALTERNATIF (Ratio Matrix Xi/Xj) ---
    // Variabel ini dideklarasikan dengan benar agar tidak error di baris 83
    let bobotAltFinal = Array.from({ length: nA }, () => new Array(nK).fill(0));
    let htmlAlt = "";
    
    kriteria.forEach((kName, kIdx) => {
        let vals = dataAtribut.map(r => parseFloat(r[kIdx+1]) || 1);
        let isCost = (kName.toLowerCase().includes("harga") || kName.toLowerCase().includes("berat"));
        let matA = Array.from({ length: nA }, () => Array(nA).fill(0)), colSumA = new Array(nA).fill(0);
        
        for(let i=0; i<nA; i++) for(let j=0; j<nA; j++) {
            matA[i][j] = isCost ? (vals[j]/vals[i]) : (vals[i]/vals[j]);
            colSumA[j] += matA[i][j];
        }

        htmlAlt += `<div class="mb-4 border-bottom border-secondary pb-3"><strong class="text-neon-blue">Rasio Matriks: ${kName}</strong><table class="table table-sm text-center mt-2"><thead><tr><th>${kName}</th>` + alternatif.map(a => `<th>${a}</th>`).join('') + `<th>Bobot</th></tr></thead><tbody>`;
        for(let i=0; i<nA; i++) {
            htmlAlt += `<tr><td>${alternatif[i]}</td>`;
            let rsA = 0;
            for(let j=0; j<nA; j++) {
                htmlAlt += `<td class="text-muted small">${matA[i][j].toFixed(2)}</td>`;
                rsA += (matA[i][j] / colSumA[j]);
            }
            bobotAltFinal[i][kIdx] = rsA / nA;
            htmlAlt += `<td class="fw-bold text-neon-purple">${bobotAltFinal[i][kIdx].toFixed(4)}</td></tr>`;
        }
        htmlAlt += `</tbody></table></div>`;
    });
    document.getElementById('areaAlternatifDetail').innerHTML = htmlAlt;

    // --- C. SINTESIS GLOBAL (iPhone = 0,2994) ---
    let skorFinal = alternatif.map(() => 0);
    let htmlSyn = `<table class="table table-bordered text-center"><thead><tr><th>Alternatif</th>` + 
                  kriteria.map(k => `<th>${k}</th>`).join('') + `<th>Skor Sj</th></tr></thead><tbody>`;
    
    alternatif.forEach((alt, i) => {
        htmlSyn += `<tr><td class="fw-bold text-light">${alt}</td>`;
        for(let j=0; j<nK; j++) {
            htmlSyn += `<td class="text-muted">${bobotAltFinal[i][j].toFixed(4)}</td>`;
            skorFinal[i] += bobotAltFinal[i][j] * bobotK[j];
        }
        htmlSyn += `<td class="fw-bold text-neon-green">${skorFinal[i].toFixed(4)}</td></tr>`;
    });
    document.getElementById('tabelSynthesis').innerHTML = htmlSyn + `</tbody></table>`;

    // Ranking List
    let sorted = alternatif.map((name, i) => ({ name, score: skorFinal[i] })).sort((a,b) => b.score - a.score);
    document.getElementById('finalRankingList').innerHTML = sorted.map((d, i) => `
        <div class="ranking-item">
            <div><span class="badge bg-secondary me-2">#${i+1}</span> <b>${d.name}</b></div>
            <div class="fw-bold text-neon-green">${d.score.toFixed(4)}</div>
        </div>`).join('');
    
    renderChart(alternatif, skorFinal);
}

// Render Grafik (Polar Area) - Fixed Syntax Error
function renderChart(labels, data) {
    const ctx = document.getElementById('rankingChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'polarArea',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    'rgba(255,107,0,0.7)', 
                    'rgba(0,210,252,0.7)', 
                    'rgba(188,19,254,0.7)', 
                    'rgba(46,204,113,0.7)'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            scales: { r: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { backdropColor: 'transparent', color: '#fff' } } },
            plugins: { legend: { position: 'bottom', labels: { color: '#fff', font: { family: 'Orbitron' } } } }
        }
    });
}