/* ============================================================
   doctors.js - Cadastro de médicos do usuário
   ============================================================ */

function openDoctorModal(doc = null) {
  const title = document.getElementById('doctorModalTitle');
  if (title) title.textContent = doc ? 'Editar médico' : 'Novo médico';
  const id = document.getElementById('doctorId');
  if (id) id.value = doc ? doc.id : '';
  const name = document.getElementById('doctorName');
  if (name) name.value = doc ? doc.name : '';
  const spec = document.getElementById('doctorSpecialty');
  if (spec) spec.value = doc ? doc.specialty : '';
  const notes = document.getElementById('doctorNotes');
  if (notes) notes.value = doc ? (doc.notes || '') : '';
  openModal('doctorModal');
}

function editDoctor(id) {
  const doc = Store.doctors.byId(id);
  if (doc) openDoctorModal(doc);
}

function openDoctorPhoto(id) {
  const doc = Store.doctors.byId(id);
  if (!doc) return;
  // Se já tiver foto, pergunta: alterar ou remover
  if (doc.photo) {
    const choice = confirm('Deseja remover a foto atual?\n\nOK = Remover foto\nCancelar = Alterar foto');
    if (choice) {
      Store.doctors.update(id, { photo: null }).then(() => {
        renderDoctors();
        toast('Foto removida e salva na nuvem!', 'info');
      });
      return;
    }
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    openImageCropper(file, async (dataUrl) => {
      await Store.doctors.update(id, { photo: dataUrl });
      renderDoctors();
      toast('Foto do médico atualizada e salva na nuvem!', 'success');
    });
  };
  input.click();
}

async function deleteDoctor(id) {
  if (confirm('Deseja realmente excluir este médico?')) {
    await Store.doctors.remove(id);
    toast('Médico excluído com sucesso!', 'success');
    renderDoctors();
  }
}

function renderDoctors() {
  const container = document.getElementById('doctorsList');
  if (!container) return;
  const list = Store.doctors.all();
  if (list.length === 0) {
    container.innerHTML = '<p class="muted">Nenhum médico cadastrado ainda.</p>';
    return;
  }
  container.innerHTML = list.map(d => `
    <div class="doctor-card">
      <div class="doctor-card__avatar" onclick="openDoctorPhoto('${d.id}')" title="Clique para alterar a foto" ${d.photo ? 'style="background-image:url(' + d.photo + ');background-size:cover;background-position:center"' : ''}>
        <span class="doctor-card__avatar-initials" ${d.photo ? 'style="display:none"' : ''}>${(d.name || '?').split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase()}</span>
      </div>
      <div class="doctor-card__info">
        <div class="doctor-card__name">${escapeHtml(d.name)}</div>
        <div class="doctor-card__specialty">${escapeHtml(d.specialty || 'Especialidade não informada')}</div>
        ${d.notes ? `<div class="doctor-card__notes">"${escapeHtml(d.notes)}"</div>` : ''}
      </div>
      <div class="doctor-card__actions">
        <button class="med-card__action" title="Editar" onclick="editDoctor('${d.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1"/></svg>
        </button>
        <button class="med-card__action med-card__action--danger" title="Excluir" onclick="deleteDoctor('${d.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 0-2 2H7a2 2 0 0 0-2-2V6M8 6V4a2 2 0 0 0 2-2h4a2 2 0 0 0 2 2v2"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

// form submit
document.getElementById('doctorForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const id = document.getElementById('doctorId').value;
    const doc = {
      name: document.getElementById('doctorName').value.trim(),
      specialty: document.getElementById('doctorSpecialty').value.trim(),
      notes: document.getElementById('doctorNotes').value.trim()
    };
    if (!doc.name) { toast('Informe o nome do médico', 'error'); return; }
    if (id) {
      await Store.doctors.update(id, doc);
      toast('Médico atualizado e sincronizado na nuvem!', 'success');
    } else {
      await Store.doctors.add(doc);
      toast('Médico cadastrado e sincronizado na nuvem!', 'success');
    }
    closeModal('doctorModal');
    document.getElementById('doctorForm').reset();
    renderDoctors();
  } catch (err) {
    console.error('Erro ao salvar médico:', err);
    toast('Erro: ' + (err.message || err), 'error');
  }
});

window.renderers.doctors = () => renderDoctors();
window.openDoctorModal = openDoctorModal;
window.editDoctor = editDoctor;
window.deleteDoctor = deleteDoctor;
window.renderDoctors = renderDoctors;