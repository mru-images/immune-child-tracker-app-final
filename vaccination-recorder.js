// Vaccination Recording Module
class VaccinationRecorder {
    constructor() {
        this.currentChild = null;
    }

    initialize() {
        this.setupEventListeners();
        this.setupModalFunctionality();
    }

    setupEventListeners() {
        const vaccinationForm = document.getElementById('vaccinationForm');
        if (vaccinationForm) {
            vaccinationForm.addEventListener('submit', (e) => this.handleVaccinationSubmit(e));
        }

        // Set max date to today
        const dateInput = document.getElementById('dateAdministered');
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.setAttribute('max', today);
        }
    }

    setupModalFunctionality() {
        // Modal close functionality
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('vaccinationModal');
            if (e.target.classList.contains('modal-close') || e.target === modal) {
                this.closeModal();
            }
        });
    }

    closeModal() {
        const modal = document.getElementById('vaccinationModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.resetForm();
    }

    resetForm() {
        const form = document.getElementById('vaccinationForm');
        if (form) {
            form.reset();
        }
    }

    async handleVaccinationSubmit(e) {
        e.preventDefault();

        const form = e.target;
        const formData = new FormData(form);
        const saveBtn = document.getElementById('saveVaccinationBtn');

        if (!this.validateForm(form)) {
            this.showError('Please fill in all required fields.');
            return;
        }

        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<div class="loading"></div> Saving...';
        saveBtn.disabled = true;

        try {
            const scheduleId = formData.get('vaccine');
            const selectedOption = document.querySelector(`#vaccineSelect option[value="${scheduleId}"]`);
            const vaccineName = selectedOption ? selectedOption.getAttribute('data-name') : '';

            if (!scheduleId || !vaccineName) {
                throw new Error('Please select a vaccine');
            }

            // Get the selected child from schedule manager
            const selectedChild = scheduleManager.selectedChild;
            if (!selectedChild) {
                throw new Error('No child selected');
            }

            // Update the schedule item
            const scheduleUpdates = {
                completed: true,
                dateCompleted: formData.get('dateAdministered'),
                administeredBy: formData.get('administeredBy'),
                location: formData.get('location'),
                batchNumber: formData.get('batchNumber'),
                notes: formData.get('notes'),
                status: 'completed'
            };

            console.log('Updating schedule item:', scheduleId, scheduleUpdates);

            const scheduleResult = await scheduleOperations.updateScheduleItem(
                selectedChild.id, 
                scheduleId, 
                scheduleUpdates
            );

            if (!scheduleResult.success) {
                throw new Error(scheduleResult.error || 'Failed to update schedule');
            }

            // Also create a vaccination record for backward compatibility
            const vaccinationData = {
                vaccine: vaccineName,
                dateAdministered: formData.get('dateAdministered'),
                batchNumber: formData.get('batchNumber'),
                administeredBy: formData.get('administeredBy'),
                location: formData.get('location'),
                notes: formData.get('notes'),
                administered: true
            };

            await vaccinationOperations.addVaccination(selectedChild.id, vaccinationData);

            this.showSuccess('Vaccination recorded successfully!');
            this.closeModal();
            
            // Reload schedule
            if (scheduleManager) {
                await scheduleManager.loadChildSchedule();
            }

        } catch (error) {
            console.error('Error recording vaccination:', error);
            this.showError(`Failed to record vaccination: ${error.message}`);
        } finally {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    }

    validateForm(form) {
        const requiredInputs = form.querySelectorAll('[required]');
        let isValid = true;

        requiredInputs.forEach(input => {
            if (!input.value.trim()) {
                input.style.borderColor = '#dc2626';
                isValid = false;
            } else {
                input.style.borderColor = '';
            }
        });

        return isValid;
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        const bgColor = type === 'error' ? '#ef4444' : '#10b981';
        const icon = type === 'error' ? 'fas fa-exclamation-triangle' : 'fas fa-check-circle';

        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${bgColor};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            z-index: 1000;
            max-width: 400px;
            animation: slideIn 0.3s ease-out;
        `;
        toast.innerHTML = `<i class="${icon}"></i> ${message}`;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, type === 'error' ? 5000 : 3000);
    }
}

// Global instance
const vaccinationRecorder = new VaccinationRecorder();

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);