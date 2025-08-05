// Schedule Management Module
class ScheduleManager {
    constructor() {
        this.allChildren = [];
        this.selectedChild = null;
        this.currentSchedule = [];
        this.currentFilter = 'all';
    }

    async initialize() {
        try {
            await this.loadChildren();
            this.setupEventListeners();
            
            // Check if child ID is in URL
            const urlParams = new URLSearchParams(window.location.search);
            const childId = urlParams.get('child');
            if (childId) {
                setTimeout(() => this.selectChildById(childId), 500);
            }
        } catch (error) {
            console.error('Error initializing schedule manager:', error);
        }
    }

    setupEventListeners() {
        const childSelect = document.getElementById('childSelect');
        const printBtn = document.getElementById('printScheduleBtn');
        const recordBtn = document.getElementById('recordVaccinationBtn');

        if (childSelect) {
            childSelect.addEventListener('change', () => this.handleChildSelection());
        }
        
        if (printBtn) {
            printBtn.addEventListener('click', () => this.printSchedule());
        }
        
        if (recordBtn) {
            recordBtn.addEventListener('click', () => this.openVaccinationModal());
        }

        // Filter buttons
        const filterButtons = [
            { id: 'showAllBtn', filter: 'all' },
            { id: 'showDueBtn', filter: 'due' },
            { id: 'showOverdueBtn', filter: 'overdue' },
            { id: 'showCompletedBtn', filter: 'completed' }
        ];

        filterButtons.forEach(({ id, filter }) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => this.setFilter(filter));
            }
        });
    }

    async loadChildren() {
        const childSelect = document.getElementById('childSelect');
        
        if (!childSelect) {
            console.error('Child select element not found');
            return;
        }

        try {
            childSelect.innerHTML = '<option value="">Loading children...</option>';
            
            const result = await childOperations.getAllChildren();
            
            if (result.success && result.data) {
                this.allChildren = result.data;
                
                if (this.allChildren.length === 0) {
                    childSelect.innerHTML = '<option value="">No children registered</option>';
                    this.showNoChildSelected();
                    return;
                }
                
                childSelect.innerHTML = '<option value="">Select a child...</option>' +
                    this.allChildren.map(child => 
                        `<option value="${child.id}">${child.firstName} ${child.lastName}</option>`
                    ).join('');
                    
                console.log('Loaded children:', this.allChildren.length);
            } else {
                throw new Error(result.error || 'Failed to load children');
            }
        } catch (error) {
            console.error('Error loading children:', error);
            childSelect.innerHTML = '<option value="">Error loading children</option>';
            this.showError('Failed to load children: ' + error.message);
        }
    }

    selectChildById(childId) {
        const childSelect = document.getElementById('childSelect');
        if (childSelect) {
            childSelect.value = childId;
            this.handleChildSelection();
        }
    }

    async handleChildSelection() {
        const childSelect = document.getElementById('childSelect');
        const childId = childSelect ? childSelect.value : null;

        if (!childId) {
            this.selectedChild = null;
            this.showNoChildSelected();
            return;
        }

        this.selectedChild = this.allChildren.find(child => child.id === childId);
        if (!this.selectedChild) {
            console.error('Selected child not found');
            return;
        }

        console.log('Selected child:', this.selectedChild);
        await this.loadChildSchedule();
    }

    async loadChildSchedule() {
        const scheduleContent = document.getElementById('scheduleContent');
        const noChildSelected = document.getElementById('noChildSelected');
        
        if (!scheduleContent) {
            console.error('Schedule content element not found');
            return;
        }

        scheduleContent.innerHTML = '<div class="loading-container"><div class="loading"></div> Loading schedule...</div>';
        if (noChildSelected) {
            noChildSelected.style.display = 'none';
        }

        try {
            // Get child's schedule from Firebase
            const scheduleResult = await scheduleOperations.getChildSchedule(this.selectedChild.id);
            
            if (scheduleResult.success && scheduleResult.data) {
                this.currentSchedule = scheduleResult.data;
                console.log('Loaded schedule items:', this.currentSchedule.length);
            } else {
                // If no schedule exists, create one
                console.log('No schedule found, creating new schedule...');
                const initResult = await scheduleOperations.initializeSchedule(
                    this.selectedChild.id, 
                    this.selectedChild.dateOfBirth
                );
                
                if (initResult.success) {
                    this.currentSchedule = initResult.data;
                } else {
                    throw new Error('Failed to initialize schedule');
                }
            }
            
            this.renderSchedule();
            
        } catch (error) {
            console.error('Error loading schedule:', error);
            scheduleContent.innerHTML = `
                <div class="card">
                    <div class="card-body text-center">
                        <i class="fas fa-exclamation-triangle" style="color: var(--error-500); font-size: 2rem; margin-bottom: 1rem;"></i>
                        <p style="color: var(--error-500);">Failed to load schedule: ${error.message}</p>
                        <button onclick="scheduleManager.loadChildSchedule()" class="btn btn-primary">
                            <i class="fas fa-retry"></i>
                            Retry
                        </button>
                    </div>
                </div>
            `;
        }
    }

    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update button states
        document.querySelectorAll('[id^="show"][id$="Btn"]').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.getElementById(`show${filter.charAt(0).toUpperCase() + filter.slice(1)}Btn`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        this.renderSchedule();
    }

    renderSchedule() {
        const scheduleContent = document.getElementById('scheduleContent');
        
        if (!this.selectedChild || !this.currentSchedule.length) {
            this.showNoChildSelected();
            return;
        }

        // Filter schedule based on current filter
        let filteredSchedule = this.currentSchedule;
        if (this.currentFilter !== 'all') {
            filteredSchedule = this.currentSchedule.filter(item => {
                if (this.currentFilter === 'completed') return item.completed;
                if (this.currentFilter === 'due') return item.status === 'due';
                if (this.currentFilter === 'overdue') return item.status === 'overdue';
                return true;
            });
        }

        if (filteredSchedule.length === 0) {
            scheduleContent.innerHTML = `
                <div class="card">
                    <div class="card-body text-center">
                        <i class="fas fa-filter" style="color: var(--gray-300); font-size: 2rem; margin-bottom: 1rem;"></i>
                        <p style="color: var(--gray-500);">No vaccinations found for the selected filter.</p>
                    </div>
                </div>
            `;
            return;
        }

        scheduleContent.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h3 class="card-title">
                        <i class="fas fa-user" style="color: var(--primary-500); margin-right: 0.5rem;"></i>
                        ${this.selectedChild.firstName} ${this.selectedChild.lastName}
                    </h3>
                    <p style="color: var(--gray-600); margin: 0;">
                        Born: ${this.formatDate(this.selectedChild.dateOfBirth)} • Age: ${this.calculateAge(this.selectedChild.dateOfBirth)}
                    </p>
                </div>
                <div class="card-body">
                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Vaccine</th>
                                    <th>Due Date</th>
                                    <th>Status</th>
                                    <th>Date Given</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filteredSchedule.map(vaccine => `
                                    <tr>
                                        <td>
                                            <strong>${vaccine.vaccineName}</strong><br>
                                            <small style="color: var(--gray-600);">${vaccine.vaccineDescription || ''}</small>
                                        </td>
                                        <td>${this.formatDate(vaccine.dueDate)}</td>
                                        <td>
                                            <span class="badge badge-${this.getStatusColor(vaccine.status)}">
                                                ${vaccine.status ? vaccine.status.toUpperCase() : 'PENDING'}
                                            </span>
                                        </td>
                                        <td>
                                            ${vaccine.completed && vaccine.dateCompleted ? 
                                                this.formatDate(vaccine.dateCompleted) : 
                                                '<span style="color: var(--gray-400);">Not given</span>'
                                            }
                                        </td>
                                        <td>
                                            ${!vaccine.completed ? 
                                                `<button onclick="scheduleManager.recordVaccination('${vaccine.id}', '${vaccine.vaccineName}', '${vaccine.vaccineDescription || ''}')" class="btn btn-primary" style="font-size: 0.8rem; padding: 0.5rem;">
                                                    <i class="fas fa-syringe"></i>
                                                    Record
                                                </button>` :
                                                `<button onclick="scheduleManager.viewVaccinationDetails('${vaccine.id}')" class="btn btn-outline" style="font-size: 0.8rem; padding: 0.5rem;">
                                                    <i class="fas fa-eye"></i>
                                                    View
                                                </button>`
                                            }
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    showNoChildSelected() {
        const scheduleContent = document.getElementById('scheduleContent');
        const noChildSelected = document.getElementById('noChildSelected');
        
        if (scheduleContent) {
            scheduleContent.innerHTML = '';
        }
        if (noChildSelected) {
            noChildSelected.style.display = 'block';
        }
    }

    showError(message) {
        const scheduleContent = document.getElementById('scheduleContent');
        if (scheduleContent) {
            scheduleContent.innerHTML = `
                <div class="card">
                    <div class="card-body text-center">
                        <i class="fas fa-exclamation-triangle" style="color: var(--error-500); font-size: 2rem; margin-bottom: 1rem;"></i>
                        <p style="color: var(--error-500);">${message}</p>
                    </div>
                </div>
            `;
        }
    }

    openVaccinationModal() {
        if (!this.selectedChild) {
            alert('Please select a child first');
            return;
        }

        const modal = document.getElementById('vaccinationModal');
        const vaccineSelect = document.getElementById('vaccineSelect');
        
        if (!modal || !vaccineSelect) {
            console.error('Vaccination modal elements not found');
            return;
        }

        // Populate vaccine options with pending vaccines
        const pendingVaccines = this.currentSchedule.filter(v => !v.completed);
        vaccineSelect.innerHTML = '<option value="">Select vaccine...</option>' +
            pendingVaccines.map(vaccine => 
                `<option value="${vaccine.id}" data-name="${vaccine.vaccineName}">${vaccine.vaccineName} - ${vaccine.vaccineDescription || ''}</option>`
            ).join('');

        modal.style.display = 'flex';
    }

    recordVaccination(scheduleId, vaccineName, vaccineDescription) {
        const modal = document.getElementById('vaccinationModal');
        const vaccineSelect = document.getElementById('vaccineSelect');
        const dateInput = document.getElementById('dateAdministered');
        
        if (vaccineSelect) {
            vaccineSelect.value = scheduleId;
            
            // Set today's date as default
            if (dateInput) {
                const today = new Date().toISOString().split('T')[0];
                dateInput.value = today;
            }
        }
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    viewVaccinationDetails(vaccinationId) {
        const vaccination = this.currentSchedule.find(v => v.id === vaccinationId);
        if (!vaccination) return;

        const details = `Vaccination Details:

Vaccine: ${vaccination.vaccineName}
Date: ${vaccination.dateCompleted ? this.formatDate(vaccination.dateCompleted) : 'Not given'}
Administered By: ${vaccination.administeredBy || 'Not specified'}
Location: ${vaccination.location || 'Not specified'}
Batch Number: ${vaccination.batchNumber || 'Not specified'}
Notes: ${vaccination.notes || 'None'}`;

        alert(details);
    }

    printSchedule() {
        if (!this.selectedChild || !this.currentSchedule.length) {
            alert('Please select a child first');
            return;
        }

        const printContent = `
            <html>
            <head>
                <title>Vaccination Schedule - ${this.selectedChild.firstName} ${this.selectedChild.lastName}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .child-info { background: #f5f5f5; padding: 15px; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .completed { background-color: #d4edda; }
                    .due { background-color: #fff3cd; }
                    .overdue { background-color: #f8d7da; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Vaccination Schedule</h1>
                    <h2>${this.selectedChild.firstName} ${this.selectedChild.lastName}</h2>
                </div>
                <div class="child-info">
                    <p><strong>Date of Birth:</strong> ${this.formatDate(this.selectedChild.dateOfBirth)}</p>
                    <p><strong>Age:</strong> ${this.calculateAge(this.selectedChild.dateOfBirth)}</p>
                    <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Vaccine</th>
                            <th>Due Date</th>
                            <th>Status</th>
                            <th>Date Given</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.currentSchedule.map(vaccine => `
                            <tr class="${vaccine.status}">
                                <td>${vaccine.vaccineName}<br><small>${vaccine.vaccineDescription || ''}</small></td>
                                <td>${this.formatDate(vaccine.dueDate)}</td>
                                <td>${vaccine.status ? vaccine.status.toUpperCase() : 'PENDING'}</td>
                                <td>${vaccine.completed && vaccine.dateCompleted ? this.formatDate(vaccine.dateCompleted) : 'Not given'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
    }

    formatDate(dateString) {
        if (!dateString) return 'Not specified';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    calculateAge(birthDate) {
        const birth = new Date(birthDate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }

        if (age === 0) {
            let months = monthDiff;
            if (today.getDate() < birth.getDate()) {
                months--;
            }
            return `${months} month${months !== 1 ? 's' : ''}`;
        }

        return `${age} year${age !== 1 ? 's' : ''}`;
    }

    getStatusColor(status) {
        switch (status) {
            case 'completed':
                return 'success';
            case 'due':
                return 'warning';
            case 'overdue':
                return 'error';
            default:
                return 'secondary';
        }
    }
}

// Global instance
const scheduleManager = new ScheduleManager();