/* ============================================================
   weight.js - Controle de peso e evolução
   ============================================================ */

function bmiCategory(bmi) {
  if (bmi < 18.5) return { label: 'Abaixo do peso', color: 'var(--amber)' };
  if (bmi < 25) return { label: 'Peso normal', color: 'var(--accent)' };
  if (bmi < 30) return { label: 'Sobrepeso', color: 'var(--amber)' };
  if (bmi < 35) return { label: 'Obesidade grau I', color: 'var(--rose)' };
  if (bmi < 40) return { label: 'Obesidade grau II', color: 'var(--rose)' };
  return { label: 'Obesidade grau III', color: 'var(--rose)' };
}

function openWeightModal(w) {
  const title = document.getElementById('weightModalTitle');
  if (title) title.textContent = w ? 'Editar pesagem' : 'Registrar peso';
  const id = document.getElementById('weightId');
  if (id) id.value = w ? w.id : '';
  const val = document.getElementById('weightValue');
  if (val) val.value = w ? w.weight : '';
  const date = document.getElementById('weightDate');
  if (date) date.value = w ? w.date : todayISO();
  const notes = document.getElementById('weightNotes');
  if (notes) notes.value = w ? (w.notes || '') : '';
  openModal('weightModal');
}

function editWeight(id) {
  const w = Store.weights.byId(id);
  if (w) openWeightModal(w);
}

function deleteWeight(id) {
  if (confirm('Excluir esta pesagem?')) {
    Store.weights.remove(id);
    toast('Pesagem excluída', 'info');
    renderWeight();
  }
}

function renderWeight() {
  const currentEl = document.getElementById('weightCurrentValue');
  const metaEl = document.getElementById('weightCurrentMeta');
  const chartEl = document.getElementById('weightChart');
  const historyEl = document.getElementById('weightHistory');

  const list = (Store.weights.all() || []).slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  // Current weight
  const latest = (Store.weights && Store.weights.latest) ? Store.weights.latest() : null;
  const currentWeight = latest ? parseFloat(latest.weight) : null;
  if (currentEl) currentEl.textContent = latest ? latest.weight : '—';
  if (metaEl) {
    if (latest) {
      metaEl.textContent = 'Registrado em ' + formatDate(latest.date);
    } else {
      metaEl.textContent = 'Nenhum registro';
    }
  }

  // Profile fields (height, goal)
  const u = (window.currentUser && window.currentUser()) ? window.currentUser() : null;
  const heightEl = document.getElementById('weightHeight');
  const goalEl = document.getElementById('weightGoal');
  if (heightEl) {
    if (u && u.height) heightEl.value = u.height;
    heightEl.onchange = async () => {
      const v = heightEl.value.trim();
      if (v === '') {
        if (u) { delete u.height; Auth.setCurrentUser(u); }
        if (window.Auth && Auth.updateProfileHeight) await Auth.updateProfileHeight(null);
        renderWeight();
        return;
      }
      const num = parseFloat(v.replace(',', '.'));
      if (isNaN(num) || num < 50 || num > 250) {
        toast('Altura inválida (50-250 cm).', 'error');
        if (u && u.height) heightEl.value = u.height; else heightEl.value = '';
        return;
      }
      if (u) { u.height = String(num); Auth.setCurrentUser(u); }
      if (window.Auth && Auth.updateProfileHeight) await Auth.updateProfileHeight(String(num));
      toast('Altura atualizada: ' + num + ' cm', 'success');
      renderWeight();
    };
  }
  if (goalEl) {
    if (u && u.weightGoal) goalEl.value = u.weightGoal;
    goalEl.onchange = async () => {
      const v = goalEl.value.trim();
      if (v === '') {
        if (u) { delete u.weightGoal; Auth.setCurrentUser(u); }
        if (window.Auth && Auth.updateProfileWeightGoal) await Auth.updateProfileWeightGoal(null);
        renderWeight();
        return;
      }
      const num = parseFloat(v.replace(',', '.'));
      if (isNaN(num) || num <= 0 || num > 500) {
        toast('Meta inválida (1-500 kg).', 'error');
        if (u && u.weightGoal) goalEl.value = u.weightGoal; else goalEl.value = '';
        return;
      }
      if (u) { u.weightGoal = String(num); Auth.setCurrentUser(u); }
      if (window.Auth && Auth.updateProfileWeightGoal) await Auth.updateProfileWeightGoal(String(num));
      toast('Meta atualizada: ' + num + ' kg', 'success');
      renderWeight();
    };
  }

  // BMI calculation
  const bmiEl = document.getElementById('weightBmi');
  const bmiStatEl = document.getElementById('weightStatBmi');
  let bmi = null;
  if (currentWeight && u && u.height) {
    const h = parseFloat(u.height) / 100;
    if (h > 0) bmi = currentWeight / (h * h);
  }
  if (bmiEl) {
    if (bmi) {
      const cat = bmiCategory(bmi);
      bmiEl.innerHTML = '<span style="color:' + cat.color + ';font-weight:700">' + bmi.toFixed(1) + '</span> <span style="color:var(--text-muted);font-size:12px">— ' + cat.label + '</span>';
    } else {
      bmiEl.innerHTML = '<span style="color:var(--text-muted);font-size:12px">Informe altura e peso para calcular o IMC</span>';
    }
  }
  if (bmiStatEl) {
    bmiStatEl.textContent = bmi ? bmi.toFixed(1) + ' — ' + bmiCategory(bmi).label : '—';
  }

  // Progress toward goal
  const progressEl = document.getElementById('weightProgress');
  if (progressEl) {
    if (currentWeight && u && u.weightGoal) {
      const goal = parseFloat(u.weightGoal);
      const first = list.length > 0 ? parseFloat(list[0].weight) : currentWeight;
      const totalChange = Math.abs(goal - first);
      const currentChange = Math.abs(currentWeight - first);
      const pct = totalChange > 0 ? Math.min(100, Math.round((currentChange / totalChange) * 100)) : 100;
      const remaining = (currentWeight - goal).toFixed(1);
      const remainingText = remaining > 0 ? remaining + ' kg para perder' : remaining < 0 ? Math.abs(remaining).toFixed(1) + ' kg para ganhar' : 'Meta atingida! 🎉';
      progressEl.innerHTML = '<div class="weight-progress"><div class="weight-progress__bar"><div class="weight-progress__fill" style="width:' + pct + '%"></div></div><div class="weight-progress__text">' + remainingText + ' · ' + pct + '% da meta</div></div>';
    } else {
      progressEl.innerHTML = '';
    }
  }

  // Update sidebar weight display
  const sidebarWeight = document.getElementById('userWeight');
  if (sidebarWeight) {
    if (latest) {
      sidebarWeight.textContent = 'Peso: ' + latest.weight + ' kg';
    } else {
      const u2 = (window.currentUser && window.currentUser()) ? window.currentUser() : null;
      sidebarWeight.textContent = u2 && u2.weight ? 'Peso: ' + u2.weight + ' kg' : 'Peso: registrar';
    }
  }

  // Stats
  if (list.length > 0) {
    const weights = list.map(w => parseFloat(w.weight)).filter(n => !isNaN(n));
    const first = weights[0];
    const current = weights[weights.length - 1];
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const change = current - first;
    const changeStr = (change >= 0 ? '+' : '') + change.toFixed(1) + ' kg';

    const firstEl = document.getElementById('weightStatFirst');
    const currentEl2 = document.getElementById('weightStatCurrent');
    const minEl = document.getElementById('weightStatMin');
    const maxEl = document.getElementById('weightStatMax');
    const changeEl = document.getElementById('weightStatChange');
    const countEl = document.getElementById('weightStatCount');
    if (firstEl) firstEl.textContent = first.toFixed(1) + ' kg';
    if (currentEl2) currentEl2.textContent = current.toFixed(1) + ' kg';
    if (minEl) minEl.textContent = min.toFixed(1) + ' kg';
    if (maxEl) maxEl.textContent = max.toFixed(1) + ' kg';
    if (changeEl) { changeEl.textContent = changeStr; changeEl.style.color = change > 0 ? 'var(--rose)' : change < 0 ? 'var(--accent)' : 'var(--text)'; }
    if (countEl) countEl.textContent = list.length;
  } else {
    const ids = ['weightStatFirst','weightStatCurrent','weightStatMin','weightStatMax','weightStatChange'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '—'; });
    const countEl = document.getElementById('weightStatCount');
    if (countEl) countEl.textContent = '0';
  }

  // Chart
  if (chartEl) {
    if (list.length < 2) {
      chartEl.innerHTML = '<p class="muted">Registre pelo menos 2 pesagens para ver o gráfico.</p>';
    } else {
      renderWeightChart(list, chartEl);
    }
  }

  // History
  if (historyEl) {
    if (list.length === 0) {
      historyEl.innerHTML = '<p class="muted">Nenhum registro ainda.</p>';
    } else {
      const reversed = list.slice().reverse();
      historyEl.innerHTML = reversed.map((w, i) => {
        const prev = i < reversed.length - 1 ? reversed[i + 1] : null;
        const diff = prev ? (parseFloat(w.weight) - parseFloat(prev.weight)) : 0;
        const trend = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
        const trendColor = diff > 0 ? 'var(--rose)' : diff < 0 ? 'var(--accent)' : 'var(--text-muted)';
        return `
          <div class="weight-history__item">
            <div class="weight-history__date">${formatDate(w.date)}</div>
            <div class="weight-history__value">${w.weight} kg</div>
            <div class="weight-history__trend" style="color:${trendColor}">${trend} ${diff !== 0 ? Math.abs(diff).toFixed(1) + ' kg' : ''}</div>
            <div class="weight-history__notes">${w.notes ? escapeHtml(w.notes) : ''}</div>
            <div class="weight-history__actions">
              <button class="med-card__action" title="Editar" onclick="editWeight('${w.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1"/></svg>
              </button>
              <button class="med-card__action med-card__action--danger" title="Excluir" onclick="deleteWeight('${w.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 0-2 2H7a2 2 0 0 0-2-2V6M8 6V4a2 2 0 0 0 2-2h4a2 2 0 0 0 2 2v2"/></svg>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

function renderWeightChart(list, container) {
  const weights = list.map(w => parseFloat(w.weight)).filter(n => !isNaN(n));
  if (weights.length < 2) {
    container.innerHTML = '<p class="muted">Dados insuficientes.</p>';
    return;
  }
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const pad = range * 0.15;
  const yMin = min - pad;
  const yMax = max + pad;
  const yRange = yMax - yMin;

  const W = 600, H = 200, margin = { top: 20, right: 20, bottom: 30, left: 45 };
  const plotW = W - margin.left - margin.right;
  const plotH = H - margin.top - margin.bottom;

  const points = weights.map((w, i) => {
    const x = margin.left + (i / (weights.length - 1)) * plotW;
    const y = margin.top + (1 - (w - yMin) / yRange) * plotH;
    return { x, y, w };
  });

  const pathD = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
  const areaD = pathD + ' L ' + points[points.length-1].x.toFixed(1) + ' ' + (margin.top + plotH) + ' L ' + points[0].x.toFixed(1) + ' ' + (margin.top + plotH) + ' Z';

  const yLabels = [];
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const val = yMin + (yRange * i / steps);
    const y = margin.top + (1 - i / steps) * plotH;
    yLabels.push('<text x="' + (margin.left - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10" fill="#94a3b8">' + val.toFixed(1) + '</text><line x1="' + margin.left + '" y1="' + y + '" x2="' + (margin.left + plotW) + '" y2="' + y + '" stroke="#e2e8f0" stroke-width="0.5" stroke-dasharray="3,3" />');
  }

  const xLabels = points.map((p, i) => {
    if (i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 5) === 0) {
      const date = list[i].date;
      const label = date ? date.slice(5) : '';
      return '<text x="' + p.x + '" y="' + (H - 8) + '" text-anchor="middle" font-size="9" fill="#94a3b8">' + label + '</text>';
    }
    return '';
  }).join('');

  const dots = points.map(p => '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="4" fill="#2563eb" stroke="#fff" stroke-width="2" />').join('');

  const last = points[points.length - 1];
  const lastLabel = '<text x="' + last.x + '" y="' + (last.y - 10) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#2563eb">' + weights[weights.length-1].toFixed(1) + ' kg</text>';

  container.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#2563eb" stop-opacity="0.15"/><stop offset="100%" stop-color="#2563eb" stop-opacity="0.02"/></linearGradient></defs>' + yLabels.join('') + '<path d="' + areaD + '" fill="url(#weightGrad)" /><path d="' + pathD + '" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />' + dots + lastLabel + xLabels + '<line x1="' + margin.left + '" y1="' + (margin.top + plotH) + '" x2="' + (margin.left + plotW) + '" y2="' + (margin.top + plotH) + '" stroke="#cbd5e1" stroke-width="1" /><line x1="' + margin.left + '" y1="' + margin.top + '" x2="' + margin.left + '" y2="' + (margin.top + plotH) + '" stroke="#cbd5e1" stroke-width="1" /></svg>';
}

// form submit
document.getElementById('weightForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  try {
    const id = document.getElementById('weightId').value;
    const val = document.getElementById('weightValue').value.trim().replace(',', '.');
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0 || num > 500) {
      toast('Peso inválido. Use um valor entre 1 e 500 kg.', 'error');
      return;
    }
    const date = document.getElementById('weightDate').value;
    if (!date) { toast('Informe a data.', 'error'); return; }
    const notes = document.getElementById('weightNotes').value.trim();
    const w = { weight: String(num), date: date, notes: notes };
    if (id) {
      Store.weights.update(id, w);
      toast('Pesagem atualizada', 'success');
    } else {
      Store.weights.add(w);
      toast('Peso registrado', 'success');
    }
    // Update user's current weight (latest)
    const latest = Store.weights.latest();
    if (latest && window.Auth && Auth.currentUser()) {
      const u = Auth.currentUser();
      u.weight = latest.weight;
      Auth.setCurrentUser(u);
      if (window.Auth.updateProfileWeight) Auth.updateProfileWeight(latest.weight).catch(()=>{});
    }
    closeModal('weightModal');
    document.getElementById('weightForm').reset();
    renderWeight();
  } catch (err) {
    console.error('Erro ao salvar peso:', err);
    toast('Erro: ' + (err.message || err), 'error');
  }
});

window.renderers.weight = () => renderWeight();
window.openWeightModal = openWeightModal;
window.editWeight = editWeight;
window.deleteWeight = deleteWeight;
window.renderWeight = renderWeight;