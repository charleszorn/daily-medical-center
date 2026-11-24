/* ============================================================
   reports.js - Geração de relatórios PDF
   ============================================================ */

function buildReportData(period, opts) {
  const data = Store.get();
  const today = new Date();
  let start;
  if (period === 'all') {
    start = new Date('2000-01-01');
  } else {
    const days = parseInt(period, 10);
    start = new Date();
    start.setDate(today.getDate() - (days - 1));
    start.setHours(0,0,0,0);
  }
  const inRange = (iso) => {
    const d = new Date(iso + 'T00:00:00');
    return d >= start && d <= today;
  };

  const meds = data.medications;
  const doses = data.doses.filter(d => inRange(d.date));
  const symptoms = data.symptoms.filter(s => inRange(s.date));
  const doctors = data.doctors || [];

  // symptom counts
  const symCounts = {};
  symptoms.forEach(s => { symCounts[s.type] = (symCounts[s.type] || 0) + 1; });

  // days monitored in range
  const daysSet = new Set();
  doses.forEach(d => daysSet.add(d.date));
  symptoms.forEach(s => daysSet.add(s.date));

  return { period, start, today, meds, doses, symptoms, symCounts, daysSet, doctors, opts };
}

function generateReport() {
  const period = document.getElementById('reportPeriod').value;
  const opts = {
    meds: document.getElementById('incMeds').checked,
    doses: document.getElementById('incDoses').checked,
    symptoms: document.getElementById('incSymptoms').checked,
    stats: document.getElementById('incStats').checked,
    doctors: document.getElementById('incDoctors').checked
  };

  const rd = buildReportData(period, opts);

  // Preview
  const preview = document.getElementById('reportPreview');
  const u = (window.currentUser && window.currentUser()) ? window.currentUser() : null;
  preview.innerHTML = `
    <h3>Relatório - ${period === 'all' ? 'Todo o histórico' : 'Últimos ' + period + ' dias'}</h3>
    <p class="muted">Paciente: ${u ? u.name + ' (' + u.email + ')' : 'Não identificado'}</p>
    <p class="muted">Período: ${formatDate(rd.start.toISOString().slice(0,10))} a ${formatDate(todayISO())}</p>
    ${opts.stats ? `<div class="stat-line"><span>Medicamentos cadastrados</span><strong>${rd.meds.length}</strong></div>
    <div class="stat-line"><span>Doses registradas</span><strong>${rd.doses.length}</strong></div>
    <div class="stat-line"><span>Sintomas registrados</span><strong>${rd.symptoms.length}</strong></div>
    <div class="stat-line"><span>Dias monitorados</span><strong>${rd.daysSet.size}</strong></div>` : ''}
    ${opts.symptoms && rd.symptoms.length ? `<p style="margin-top:10px;font-weight:600">Sintomas mais frequentes:</p><ul>${Object.entries(rd.symCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>`<li>${(SYMPTOMS[k]||SYMPTOMS.other).label}: ${v}</li>`).join('')}</ul>` : ''}
    ${opts.doctors && rd.doctors.length ? `<p style="margin-top:10px;font-weight:600">Médicos responsáveis:</p><ul>${rd.doctors.map(d=>`<li>${d.name}${d.specialty ? ' — ' + d.specialty : ''}</li>`).join('')}</ul>` : ''}
    <p class="muted" style="margin-top:12px">Clique em "Gerar relatório PDF" para baixar o arquivo.</p>
  `;

  // Generate PDF
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, margin = 16;
    let y = 16;

    // Header (gradient blue->green, with logo in translucent square)
    const headerH = 34;
    // gradient approximation: draw vertical strips
    for (let i = 0; i < headerH; i++) {
      const t = i / (headerH - 1);
      const rr = Math.round(37 + (16 - 37) * t);
      const gg = Math.round(99 + (185 - 99) * t);
      const bb = Math.round(235 + (129 - 235) * t);
      doc.setFillColor(rr, gg, bb);
      doc.rect(0, i, W, 1, 'F');
    }
    // Logo container (translucent white rounded square)
    const logoX = margin, logoY = 6, logoSize = 22;
    doc.setFillColor(255, 255, 255);
    doc.setGState(new doc.GState({ opacity: 0.18 }));
    doc.roundedRect(logoX, logoY, logoSize, logoSize, 3, 3, 'F');
    doc.setGState(new doc.GState({ opacity: 1 }));
    // Logo (white cross +)
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(2.2);
    doc.line(logoX + logoSize / 2, logoY + 5, logoX + logoSize / 2, logoY + logoSize - 5);
    doc.line(logoX + 5, logoY + logoSize / 2, logoX + logoSize - 5, logoY + logoSize / 2);
    // Site name + subtitle
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(19);
    doc.setFont('helvetica', 'bold');
    doc.text('Daily Medical Center', logoX + logoSize + 5, 13);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Relatório de Saúde do Paciente', logoX + logoSize + 5, 19);
    // Patient (right of logo, two lines) + date (right, last line)
    const u = (window.currentUser && window.currentUser()) ? window.currentUser() : null;
    const textX = logoX + logoSize + 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Paciente: ' + (u ? u.name : 'Não identificado'), textX, 24);
    if (u && u.email) {
      doc.text('E-mail: ' + u.email, textX, 28.5);
    }
    doc.setFontSize(8.5);
    doc.text('Gerado em: ' + new Date().toLocaleString('pt-BR'), W - margin, 28.5, { align: 'right' });

    y = 42;
    doc.setTextColor(15, 23, 42);

    // Period
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text('Período do relatório', margin, y); y += 2;
    // bottom border line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(margin, y, W - margin, y); y += 5;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`${formatDate(rd.start.toISOString().slice(0,10))} a ${formatDate(todayISO())}`, margin, y); y += 4;
    doc.text(`(${period === 'all' ? 'Todo o histórico' : 'Últimos ' + period + ' dias'})`, margin, y); y += 8;

    // Stats
    if (opts.stats) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text('Resumo geral', margin, y); y += 2;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, y, W - margin, y); y += 5;
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const stats = [
        ['Medicamentos cadastrados', String(rd.meds.length)],
        ['Doses registradas no período', String(rd.doses.length)],
        ['Sintomas registrados no período', String(rd.symptoms.length)],
        ['Dias monitorados no período', String(rd.daysSet.size)]
      ];
      stats.forEach(([k,v]) => {
        doc.text(k, margin, y);
        doc.setFont('helvetica', 'bold');
        doc.text(v, W - margin, y, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        y += 5;
      });
      y += 4;
    }

    // Medications
    if (opts.meds && rd.meds.length) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text('Medicamentos cadastrados', margin, y); y += 2;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, y, W - margin, y); y += 5;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      rd.meds.forEach(m => {
        const cat = CATEGORIES[m.category] || CATEGORIES.other;
        const lineH = 4.5;
        const padTop = 2.5;
        const padBottom = 3;
        const lines = [
          { text: `${m.name} (${cat.label})`, bold: true },
          { text: `Dosagem: ${m.dosage} | Quantidade: ${m.amount} ${m.unit} por dose` },
          { text: `Horários: ${(m.times||[]).join(', ') || '—'}` }
        ];
        if (m.notes) lines.push({ text: `Obs: ${m.notes}` });
        const cardH = padTop + lines.length * lineH + padBottom;
        // card background
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin, y, W - margin * 2, cardH, 2, 2, 'F');
        // colored left border
        const hex = (cat.color || '#2563eb').replace('#', '');
        const cr = parseInt(hex.slice(0,2), 16);
        const cg = parseInt(hex.slice(2,4), 16);
        const cb = parseInt(hex.slice(4,6), 16);
        doc.setFillColor(cr, cg, cb);
        doc.rect(margin, y, 1.5, cardH, 'F');
        // text
        let ty = y + padTop + 3;
        lines.forEach(ln => {
          doc.setFont('helvetica', ln.bold ? 'bold' : 'normal');
          doc.text(ln.text, margin + 4, ty);
          ty += lineH;
        });
        y += cardH + 5;
        if (y > 265) { doc.addPage(); y = 16; }
      });
      y += 2;
    }

    // Doctors
    if (opts.doctors && rd.doctors && rd.doctors.length) {
      if (y > 250) { doc.addPage(); y = 16; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text('Médicos responsáveis', margin, y); y += 2;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, y, W - margin, y); y += 5;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      rd.doctors.forEach(d => {
        doc.setFont('helvetica', 'bold');
        doc.text(d.name, margin, y); y += 4;
        doc.setFont('helvetica', 'normal');
        if (d.specialty) { doc.text('Especialidade: ' + d.specialty, margin + 2, y); y += 4; }
        if (d.notes) { doc.text('Obs: ' + d.notes, margin + 2, y); y += 4; }
        y += 2;
        if (y > 275) { doc.addPage(); y = 16; }
      });
      y += 2;
    }

    // Doses
    if (opts.doses && rd.doses.length) {
      if (y > 250) { doc.addPage(); y = 16; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text('Doses tomadas no período', margin, y); y += 2;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, y, W - margin, y); y += 5;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      rd.doses.slice().sort((a,b)=> (a.date+a.time).localeCompare(b.date+b.time)).forEach(d => {
        const m = Store.medications.byId(d.medId);
        const name = m ? m.name : 'Medicamento removido';
        doc.text(`${formatDate(d.date)} ${d.time} - ${name}${d.notes ? ' (' + d.notes + ')' : ''}`, margin, y); y += 5;
        if (y > 275) { doc.addPage(); y = 16; }
      });
      y += 2;
    }

    // Symptoms
    if (opts.symptoms && rd.symptoms.length) {
      if (y > 250) { doc.addPage(); y = 16; }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text('Sintomas registrados no período', margin, y); y += 2;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, y, W - margin, y); y += 5;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      rd.symptoms.slice().sort((a,b)=> (a.date+a.time).localeCompare(b.date+b.time)).forEach(s => {
        const sym = SYMPTOMS[s.type] || SYMPTOMS.other;
        doc.text(`${formatDate(s.date)} ${s.time} - ${sym.label} (${SEVERITY_LABEL[s.severity]})${s.notes ? ' - ' + s.notes : ''}`, margin, y); y += 5;
        if (y > 275) { doc.addPage(); y = 16; }
      });
      y += 2;

      // symptom frequency
      if (y > 230) { doc.addPage(); y = 16; }
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(37, 99, 235);
      doc.text('Frequência de sintomas', margin, y); y += 2;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, y, W - margin, y); y += 5;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      Object.entries(rd.symCounts).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => {
        const sym = SYMPTOMS[k] || SYMPTOMS.other;
        doc.text(`${sym.label}: ${v} ocorrência(s)`, margin, y); y += 4;
      });
    }

    // Footer
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setTextColor(148,163,184);
      doc.text(`Daily Medical Center - Relatório de saúde | Página ${p} de ${pages}`, W/2, 290, { align: 'center' });
    }

    const fileName = `relatorio-saude-${todayISO()}.pdf`;
    doc.save(fileName);

    // record
    Store.reports.add({
      name: fileName,
      period: period,
      date: todayISO(),
      summary: `${rd.meds.length} medicamentos, ${rd.doses.length} doses, ${rd.symptoms.length} sintomas, ${rd.daysSet.size} dias`
    });
    renderReportList();

    toast('Relatório PDF gerado com sucesso', 'success');
  } catch (err) {
    console.error(err);
    toast('Erro ao gerar PDF: ' + err.message, 'error');
  }
}

function renderReportList() {
  const container = document.getElementById('reportList');
  if (!container) return;
  const list = Store.reports.all().slice().reverse();
  if (list.length === 0) {
    container.innerHTML = '<p class="muted">Nenhum relatório gerado ainda.</p>';
    return;
  }
  container.innerHTML = list.map(r => `
    <div class="report-list__item">
      <div class="report-list__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
      </div>
      <div class="report-list__info">
        <div class="report-list__name">${escapeHtml(r.name)}</div>
        <div class="report-list__meta">${formatDate(r.date)} · ${r.summary}</div>
      </div>
      <div class="report-list__actions">
        <button class="btn btn--ghost btn--sm" onclick="regenerateReport('${r.period}')" title="Gerar novamente">↻ Regenerar</button>
        <button class="btn btn--ghost btn--sm btn--danger" onclick="deleteReport('${r.id}')" title="Excluir registro">✕</button>
      </div>
    </div>
  `).join('');
}

// Regenera um relatório antigo (recria o PDF com os dados atuais do período)
function regenerateReport(period) {
  const sel = document.getElementById('reportPeriod');
  if (sel) sel.value = period;
  generateReport();
}
window.regenerateReport = regenerateReport;

// Exclui um registro de relatório antigo
function deleteReport(id) {
  if (!confirm('Excluir este registro de relatório?')) return;
  if (Store.reports && Store.reports.remove) Store.reports.remove(id);
  renderReportList();
  toast('Registro excluído', 'info');
}
window.deleteReport = deleteReport;

document.getElementById('generateReportBtn')?.addEventListener('click', generateReport);

window.renderers.reports = () => renderReportList();
window.generateReport = generateReport;
window.renderReportList = renderReportList;
window.buildReportData = buildReportData;
