/**
 * Caregiver Module
 * Handles all caregiver-specific functionality
 */

const Caregiver = {
  mediaRecorder: null,
  audioChunks: [],
  recordedBlob: null,

  /**
   * Initialize caregiver dashboard
   */
  init() {
    const user = Auth.getCurrentUser();
    if (user && user.role === 'caregiver') {
      this.loadDashboard();
    }
  },

  /**
   * Load caregiver dashboard
   */
  loadDashboard() {
    const user = Auth.getCurrentUser();
    document.getElementById('caregiverName').textContent = user.name;
    document.getElementById('caregiverEmail').textContent = user.email;
    
    const planBadge = user.isPaid ? '⭐ Paid Plan (Unlimited)' : '📦 Free Plan (3 medicines max)';
    document.getElementById('planBadge').textContent = planBadge;
  },

  /**
   * Create patient account
   */
  async createPatient(patientEmail, patientName, patientPassword, patientPasswordConfirm) {
    const caregiver = Auth.getCurrentUser();

    // Validation
    if (!patientEmail || !patientName || !patientPassword) {
      return { success: false, message: 'Please fill all fields' };
    }

    if (!Auth.validateEmail(patientEmail)) {
      return { success: false, message: 'Invalid email format' };
    }

    if (patientPassword.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters' };
    }

    if (patientPassword !== patientPasswordConfirm) {
      return { success: false, message: 'Passwords do not match' };
    }

    // Create patient
    const result = await DB.createUser({
      role: 'patient',
      email: patientEmail,
      name: patientName,
      password: patientPassword,
      caregiverEmail: caregiver.email
    });

    return result;
  },

  /**
   * Load patients list
   */
  loadPatients() {
    const caregiver = Auth.getCurrentUser();
    const patients = DB.getPatientsByCaregiver(caregiver.email);

    // Populate select dropdown
    const select = document.getElementById('medicinePatientSelect');
    select.innerHTML = '<option value="">-- Select Patient --</option>';

    patients.forEach(patient => {
      const option = document.createElement('option');
      option.value = patient.email;
      option.textContent = `${patient.name} (${patient.email})`;
      select.appendChild(option);
    });

    return patients;
  },

  /**
   * View all patients
   */
  viewPatients() {
    const caregiver = Auth.getCurrentUser();
    const patients = DB.getPatientsByCaregiver(caregiver.email);

    const listEl = document.getElementById('patientsList');

    if (patients.length === 0) {
      listEl.innerHTML = '<div class="alert alert-info">No patients added yet. Click "Add New Patient" to create one.</div>';
      return;
    }

    listEl.innerHTML = '';

    patients.forEach(patient => {
      const patientDiv = document.createElement('div');
      patientDiv.className = 'patient-item';
      
      // Get medicines count for this patient
      const medicines = DB.getMedicinesByPatient(patient.email);
      
      patientDiv.innerHTML = `
        <h3>${patient.name}</h3>
        <p>📧 Email: ${patient.email}</p>
        <p>💊 Medicines: ${medicines.length}</p>
        <p>📅 Added: ${new Date(patient.createdAt).toLocaleDateString()}</p>
      `;
      
      listEl.appendChild(patientDiv);
    });
  },

  /**
   * Toggle instructions type (text/voice)
   */
  toggleInstructionsType() {
    const type = document.getElementById('instructionsType').value;
    
    if (type === 'text') {
      document.getElementById('textInstructionsGroup').style.display = 'block';
      document.getElementById('voiceInstructionsGroup').style.display = 'none';
    } else {
      document.getElementById('textInstructionsGroup').style.display = 'none';
      document.getElementById('voiceInstructionsGroup').style.display = 'block';
    }
  },

  /**
   * Toggle voice recording
   */
  async toggleRecording() {
    const recordBtn = document.getElementById('recordBtn');
    const playBtn = document.getElementById('playBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const statusEl = document.getElementById('recordingStatus');

    if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(stream);
        this.audioChunks = [];

        this.mediaRecorder.ondataavailable = (event) => {
          this.audioChunks.push(event.data);
        };

        this.mediaRecorder.onstop = () => {
          this.recordedBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          playBtn.style.display = 'inline-block';
          deleteBtn.style.display = 'inline-block';
          statusEl.textContent = '✓ Recording saved! You can play it or save the medicine.';
          statusEl.style.color = '#28a745';
          recordBtn.textContent = '🎤 Record Again';
          recordBtn.classList.remove('recording');
        };

        this.mediaRecorder.start();
        recordBtn.textContent = '⏹️ Stop Recording';
        recordBtn.classList.add('recording');
        statusEl.textContent = '🔴 Recording in progress...';
        statusEl.style.color = '#dc3545';
        playBtn.style.display = 'none';
        deleteBtn.style.display = 'none';
      } catch (error) {
        statusEl.textContent = '❌ Error: Could not access microphone. ' + error.message;
        statusEl.style.color = '#dc3545';
      }
    } else {
      // Stop recording
      this.mediaRecorder.stop();
      this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  },

  /**
   * Play recorded voice
   */
  playRecording() {
    if (this.recordedBlob) {
      const audioUrl = URL.createObjectURL(this.recordedBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    }
  },

  /**
   * Delete recorded voice
   */
  deleteRecording() {
    this.recordedBlob = null;
    this.audioChunks = [];
    document.getElementById('playBtn').style.display = 'none';
    document.getElementById('deleteBtn').style.display = 'none';
    document.getElementById('recordingStatus').textContent = '';
    document.getElementById('recordBtn').textContent = '🎤 Start Recording';
  },

  /**
   * Save medicine
   */
  async saveMedicine(patientEmail, name, time, stock, instructionsType) {
    const caregiver = Auth.getCurrentUser();

    // Validation
    if (!patientEmail || !name || !time || !stock || stock <= 0) {
      return { success: false, message: 'Please fill all required fields' };
    }

    let voiceFileId = null;
    let instructions = '';

    if (instructionsType === 'text') {
      instructions = document.getElementById('textInstructions').value.trim();
    } else {
      // Voice instructions
      if (!this.recordedBlob) {
        return { success: false, message: 'Please record voice instructions first' };
      }

      // Save voice file to IndexedDB
      const voiceResult = await DB.saveVoiceFile(this.recordedBlob);
      if (!voiceResult.success) {
        return { success: false, message: 'Failed to save voice file' };
      }
      voiceFileId = voiceResult.fileId;
    }

    // Add medicine
    const result = await DB.addMedicine({
      patientEmail: patientEmail,
      caregiverEmail: caregiver.email,
      name: name,
      time: time,
      stock: stock,
      instructions: instructions,
      voiceFileId: voiceFileId,
      isPaid: caregiver.isPaid
    });

    if (result.success) {
      // Reset form
      this.resetMedicineForm();
    }

    return result;
  },

  /**
   * Reset medicine form
   */
  resetMedicineForm() {
    document.getElementById('medicinePatientSelect').value = '';
    document.getElementById('medicineName').value = '';
    document.getElementById('medicineTime').value = '';
    document.getElementById('medicineStock').value = '30';
    document.getElementById('textInstructions').value = '';
    document.getElementById('instructionsType').value = 'text';
    this.toggleInstructionsType();
    this.deleteRecording();
  },

  /**
   * Load weekly report
   */
  loadWeeklyReport() {
    const caregiver = Auth.getCurrentUser();
    const result = DB.getWeeklyReport(caregiver.email);

    const contentEl = document.getElementById('weeklyReportContent');

    if (result.success) {
      const report = result.report;
      contentEl.innerHTML = `
        <div class="stats">
          <div class="stat-card" style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);">
            <h2>${report.takenCount}</h2>
            <p>Medicines Taken</p>
          </div>
          <div class="stat-card" style="background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);">
            <h2>${report.missedCount}</h2>
            <p>Medicines Missed</p>
          </div>
        </div>
        <div class="stats" style="grid-template-columns: 1fr; margin-top: 15px;">
          <div class="stat-card">
            <h2>${report.totalMedicines}</h2>
            <p>Total Medicines</p>
          </div>
        </div>
        <p style="text-align: center; color: #666; margin-top: 20px; font-size: 14px;">
          📅 Report for last ${report.period}
        </p>
      `;
    } else {
      contentEl.innerHTML = `<div class="alert alert-error">${result.message}</div>`;
    }
  }
};