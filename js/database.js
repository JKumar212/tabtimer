/**
 * Database Module - LocalStorage & IndexedDB Management
 * Handles all data storage operations
 */

const DB = {
  // Database name for IndexedDB (for voice files)
  DB_NAME: 'MedicineReminderDB',
  DB_VERSION: 1,
  VOICE_STORE: 'voiceFiles',
  
  // Initialize IndexedDB
  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.VOICE_STORE)) {
          db.createObjectStore(this.VOICE_STORE, { keyPath: 'id' });
        }
      };
    });
  },

  // ========== USER MANAGEMENT ==========
  
  /**
   * Get all users from localStorage
   */
  getUsers() {
    const users = localStorage.getItem('users');
    return users ? JSON.parse(users) : [];
  },

  /**
   * Save users to localStorage
   */
  saveUsers(users) {
    localStorage.setItem('users', JSON.stringify(users));
  },

  /**
   * Hash password using SHA-256
   */
  async hashPassword(password) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Create new user (caregiver or patient)
   */
  async createUser(userData) {
    const users = this.getUsers();
    
    // Check if email already exists
    if (users.find(u => u.email === userData.email)) {
      return { success: false, message: 'Email already registered' };
    }

    // Hash password
    const passwordHash = await this.hashPassword(userData.password);

    const newUser = {
      id: this.generateId(),
      role: userData.role,
      email: userData.email,
      name: userData.name,
      passwordHash: passwordHash,
      caregiverEmail: userData.caregiverEmail || null,
      isPaid: userData.isPaid || false,
      createdAt: new Date().toISOString(),
      active: true
    };

    users.push(newUser);
    this.saveUsers(users);

    return { success: true, message: 'User created successfully', user: newUser };
  },

  /**
   * Authenticate user
   */
  async authenticateUser(email, password) {
    const users = this.getUsers();
    const passwordHash = await this.hashPassword(password);

    const user = users.find(u => 
      u.email === email && 
      u.passwordHash === passwordHash && 
      u.active
    );

    if (user) {
      return { success: true, user: user };
    }

    return { success: false, message: 'Invalid email or password' };
  },

  /**
   * Get patients for a specific caregiver
   */
  getPatientsByCaregiver(caregiverEmail) {
    const users = this.getUsers();
    return users.filter(u => u.role === 'patient' && u.caregiverEmail === caregiverEmail && u.active);
  },

  // ========== MEDICINE MANAGEMENT ==========

  /**
   * Get all medicines
   */
  getMedicines() {
    const medicines = localStorage.getItem('medicines');
    return medicines ? JSON.parse(medicines) : [];
  },

  /**
   * Save medicines to localStorage
   */
  saveMedicines(medicines) {
    localStorage.setItem('medicines', JSON.stringify(medicines));
  },

  /**
   * Add new medicine with scheduling options
   */
  async addMedicine(medicineData) {
    const medicines = this.getMedicines();

    // Check free plan limit
    if (!medicineData.isPaid) {
      const caregiverMedicines = medicines.filter(m => m.caregiverEmail === medicineData.caregiverEmail);
      if (caregiverMedicines.length >= 3) {
        return { success: false, message: 'Free plan limit reached (3 medicines max). Upgrade to paid plan.' };
      }
    }

    const newMedicine = {
      id: this.generateId(),
      patientEmail: medicineData.patientEmail,
      caregiverEmail: medicineData.caregiverEmail,
      name: medicineData.name,
      time: medicineData.time,
      stock: parseInt(medicineData.stock),
      instructions: medicineData.instructions || '',
      voiceFileId: medicineData.voiceFileId || null,
      
      // Advanced scheduling
      scheduleType: medicineData.scheduleType || 'daily', // daily, specific-days, one-time, custom-dates
      selectedDays: medicineData.selectedDays || [], // For specific-days: [0,1,2,3,4,5,6] (Sun-Sat)
      customDates: medicineData.customDates || [], // For custom-dates: ['2024-01-15', '2024-01-20']
      oneTimeDate: medicineData.oneTimeDate || null, // For one-time: 'YYYY-MM-DD'
      
      status: 'PENDING',
      lastTaken: null,
      takenDates: [], // Track all dates when medicine was taken
      createdAt: new Date().toISOString()
    };

    medicines.push(newMedicine);
    this.saveMedicines(medicines);

    return { success: true, message: 'Medicine added successfully', medicine: newMedicine };
  },

  /**
   * Update existing medicine
   */
  async updateMedicine(medicineId, medicineData) {
    const medicines = this.getMedicines();
    const index = medicines.findIndex(m => m.id === medicineId);

    if (index === -1) {
      return { success: false, message: 'Medicine not found' };
    }

    // Update medicine fields
    medicines[index] = {
      ...medicines[index],
      name: medicineData.name,
      time: medicineData.time,
      stock: parseInt(medicineData.stock),
      instructions: medicineData.instructions || '',
      voiceFileId: medicineData.voiceFileId !== undefined ? medicineData.voiceFileId : medicines[index].voiceFileId,
      
      // Update scheduling
      scheduleType: medicineData.scheduleType || medicines[index].scheduleType,
      selectedDays: medicineData.selectedDays || medicines[index].selectedDays,
      customDates: medicineData.customDates || medicines[index].customDates,
      oneTimeDate: medicineData.oneTimeDate !== undefined ? medicineData.oneTimeDate : medicines[index].oneTimeDate,
      
      updatedAt: new Date().toISOString()
    };

    this.saveMedicines(medicines);

    return { success: true, message: 'Medicine updated successfully', medicine: medicines[index] };
  },

  /**
   * Delete medicine
   */
  async deleteMedicine(medicineId) {
    const medicines = this.getMedicines();
    const medicine = medicines.find(m => m.id === medicineId);

    if (!medicine) {
      return { success: false, message: 'Medicine not found' };
    }

    // Delete associated voice file if exists
    if (medicine.voiceFileId) {
      try {
        await this.deleteVoiceFile(medicine.voiceFileId);
      } catch (error) {
        console.error('Error deleting voice file:', error);
      }
    }

    // Remove medicine from array
    const filteredMedicines = medicines.filter(m => m.id !== medicineId);
    this.saveMedicines(filteredMedicines);

    return { success: true, message: 'Medicine deleted successfully' };
  },

  /**
   * Get medicine by ID
   */
  getMedicineById(medicineId) {
    const medicines = this.getMedicines();
    return medicines.find(m => m.id === medicineId);
  },

  /**
   * Get medicines for a specific patient
   */
  getMedicinesByPatient(patientEmail) {
    const medicines = this.getMedicines();
    return medicines.filter(m => m.patientEmail === patientEmail);
  },

  /**
   * Get medicines for a specific caregiver
   */
  getMedicinesByCaregiver(caregiverEmail) {
    const medicines = this.getMedicines();
    return medicines.filter(m => m.caregiverEmail === caregiverEmail);
  },

  /**
   * Mark medicine as taken
   */
  markMedicineAsTaken(medicineId) {
    const medicines = this.getMedicines();
    const medicine = medicines.find(m => m.id === medicineId);

    if (!medicine) {
      return { success: false, message: 'Medicine not found' };
    }

    const today = this.formatDate(new Date());

    // Update status and reduce stock
    medicine.status = 'TAKEN';
    medicine.lastTaken = new Date().toISOString();
    medicine.stock = Math.max(0, medicine.stock - 1);
    
    // Track taken dates
    if (!medicine.takenDates) {
      medicine.takenDates = [];
    }
    if (!medicine.takenDates.includes(today)) {
      medicine.takenDates.push(today);
    }

    this.saveMedicines(medicines);

    const lowStock = medicine.stock <= 5;

    return { 
      success: true, 
      message: 'Medicine marked as taken',
      stock: medicine.stock,
      lowStock: lowStock
    };
  },

  /**
   * Check if medicine should alert today based on schedule
   */
  shouldAlertToday(medicine) {
    const now = new Date();
    const today = this.formatDate(now);
    const dayOfWeek = now.getDay(); // 0-6 (Sun-Sat)

    switch (medicine.scheduleType) {
      case 'daily':
        return true;

      case 'specific-days':
        return medicine.selectedDays && medicine.selectedDays.includes(dayOfWeek);

      case 'one-time':
        return medicine.oneTimeDate === today;

      case 'custom-dates':
        return medicine.customDates && medicine.customDates.includes(today);

      default:
        return true; // Default to daily for backward compatibility
    }
  },

  /**
   * Get next medicine alert for patient
   */
  getNextAlert(patientEmail) {
    const medicines = this.getMedicinesByPatient(patientEmail);
    const now = new Date();
    const currentTime = this.formatTime(now);
    const today = this.formatDate(now);

    for (let medicine of medicines) {
      // Check if medicine should alert today based on schedule
      if (!this.shouldAlertToday(medicine)) {
        continue;
      }

      // Check if medicine time matches current time
      if (medicine.time === currentTime) {
        // Check if already taken today
        if (medicine.takenDates && medicine.takenDates.includes(today)) {
          continue; // Already taken today
        }

        return {
          success: true,
          alert: medicine
        };
      }
    }

    return { success: true, alert: null };
  },

  // ========== VOICE FILE MANAGEMENT ==========

  /**
   * Save voice file to IndexedDB
   */
  async saveVoiceFile(blob) {
    const db = await this.initDB();
    const fileId = this.generateId();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.VOICE_STORE], 'readwrite');
      const store = transaction.objectStore(this.VOICE_STORE);

      const voiceData = {
        id: fileId,
        blob: blob,
        createdAt: new Date().toISOString()
      };

      const request = store.add(voiceData);

      request.onsuccess = () => resolve({ success: true, fileId: fileId });
      request.onerror = () => reject({ success: false, message: 'Failed to save voice file' });
    });
  },

  /**
   * Get voice file from IndexedDB
   */
  async getVoiceFile(fileId) {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.VOICE_STORE], 'readonly');
      const store = transaction.objectStore(this.VOICE_STORE);
      const request = store.get(fileId);

      request.onsuccess = () => {
        if (request.result) {
          resolve({ success: true, blob: request.result.blob });
        } else {
          reject({ success: false, message: 'Voice file not found' });
        }
      };
      request.onerror = () => reject({ success: false, message: 'Failed to retrieve voice file' });
    });
  },

  /**
   * Delete voice file from IndexedDB
   */
  async deleteVoiceFile(fileId) {
    const db = await this.initDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.VOICE_STORE], 'readwrite');
      const store = transaction.objectStore(this.VOICE_STORE);
      const request = store.delete(fileId);

      request.onsuccess = () => resolve({ success: true, message: 'Voice file deleted' });
      request.onerror = () => reject({ success: false, message: 'Failed to delete voice file' });
    });
  },

  // ========== REPORTS ==========

  /**
   * Get weekly report for caregiver
   */
  getWeeklyReport(caregiverEmail) {
    const medicines = this.getMedicinesByCaregiver(caregiverEmail);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let takenCount = 0;
    let missedCount = 0;

    medicines.forEach(medicine => {
      if (medicine.lastTaken) {
        const lastTaken = new Date(medicine.lastTaken);
        if (lastTaken >= weekAgo) {
          takenCount++;
        }
      }

      // Check for missed medicines (time has passed but not taken today)
      const createdAt = new Date(medicine.createdAt);
      if (createdAt >= weekAgo) {
        const currentTime = this.formatTime(now);
        if (medicine.time < currentTime && medicine.status === 'PENDING') {
          const today = this.formatDate(now);
          const takenToday = medicine.takenDates && medicine.takenDates.includes(today);
          
          if (!takenToday && this.shouldAlertToday(medicine)) {
            missedCount++;
          }
        }
      }
    });

    return {
      success: true,
      report: {
        takenCount: takenCount,
        missedCount: missedCount,
        totalMedicines: medicines.length,
        period: '7 days'
      }
    };
  },

  // ========== UTILITY FUNCTIONS ==========

  /**
   * Generate unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  /**
   * Format time as HH:mm
   */
  formatTime(date) {
    return date.toTimeString().slice(0, 5);
  },

  /**
   * Format date as YYYY-MM-DD
   */
  formatDate(date) {
    return date.toISOString().split('T')[0];
  },

  /**
   * Get day name from day number
   */
  getDayName(dayNumber) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNumber];
  },

  /**
   * Clear all data (for testing/reset)
   */
  clearAllData() {
    localStorage.removeItem('users');
    localStorage.removeItem('medicines');
    localStorage.removeItem('session');
    
    indexedDB.deleteDatabase(this.DB_NAME);
    
    return { success: true, message: 'All data cleared' };
  }
};
