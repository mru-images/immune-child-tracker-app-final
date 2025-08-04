// Authentication utilities for the application

const auth = {
  // Current user data
  currentUser: null,
  
  // Initialize authentication
  init() {
    const userData = storage.get('currentUser');
    if (userData) {
      this.currentUser = userData;
    }
  },
  
  // Register new user
  async register(userData) {
    try {
      // Check if email already exists
      const existingUser = await this.getUserByEmail(userData.email);
      if (existingUser) {
        return { success: false, error: 'Email already registered' };
      }
      
      // Create user ID
      const userId = generateId();
      
      // Hash password (simple hash for demo - in production use proper hashing)
      const hashedPassword = btoa(userData.password); // Base64 encoding for demo
      
      // Prepare user data
      const userRecord = {
        id: userId,
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        phone: userData.phone,
        address: userData.address,
        password: hashedPassword,
        createdAt: Date.now(),
        lastLogin: Date.now()
      };
      
      // Save to Firebase
      const userRef = database.ref(`users/${userId}`);
      await userRef.set(userRecord);
      
      // Set current user (remove password from memory)
      const { password, ...userWithoutPassword } = userRecord;
      this.currentUser = userWithoutPassword;
      storage.set('currentUser', this.currentUser);
      
      return { success: true, user: this.currentUser };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Login user
  async login(email, password) {
    try {
      // Get user by email
      const user = await this.getUserByEmail(email);
      if (!user) {
        return { success: false, error: 'Invalid email or password' };
      }
      
      // Check password (simple check for demo)
      const hashedPassword = btoa(password);
      if (user.password !== hashedPassword) {
        return { success: false, error: 'Invalid email or password' };
      }
      
      // Update last login
      await database.ref(`users/${user.id}`).update({
        lastLogin: Date.now()
      });
      
      // Set current user (remove password from memory)
      const { password: pwd, ...userWithoutPassword } = user;
      this.currentUser = userWithoutPassword;
      storage.set('currentUser', this.currentUser);
      
      return { success: true, user: this.currentUser };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Logout user
  logout() {
    this.currentUser = null;
    storage.remove('currentUser');
    window.location.href = 'login.html';
  },
  
  // Get current user
  getCurrentUser() {
    if (!this.currentUser) {
      const userData = storage.get('currentUser');
      if (userData) {
        this.currentUser = userData;
      }
    }
    return this.currentUser;
  },
  
  // Check if user is authenticated
  isAuthenticated() {
    return !!this.getCurrentUser();
  },
  
  // Get user by email
  async getUserByEmail(email) {
    try {
      const snapshot = await database.ref('users').orderByChild('email').equalTo(email).once('value');
      const users = snapshot.val();
      
      if (users) {
        const userId = Object.keys(users)[0];
        return users[userId];
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return null;
    }
  },
  
  // Update user profile
  async updateProfile(updates) {
    try {
      if (!this.currentUser) {
        return { success: false, error: 'Not authenticated' };
      }
      
      const userId = this.currentUser.id;
      await database.ref(`users/${userId}`).update({
        ...updates,
        updatedAt: Date.now()
      });
      
      // Update current user data
      this.currentUser = { ...this.currentUser, ...updates };
      storage.set('currentUser', this.currentUser);
      
      return { success: true };
    } catch (error) {
      console.error('Profile update error:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Require authentication (redirect to login if not authenticated)
  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }
};

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', () => {
  auth.init();
});

function showSuccessMessage(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
    `;
    toast.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}