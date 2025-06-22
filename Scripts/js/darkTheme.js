class ThemeManager {
  constructor() {
    // Cache DOM reference
    this.themeToggleBtn = null;
    
    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
      this.createThemeToggleButton();
      this.loadThemePreference();
    });
  }
  
  toggleTheme() {
    const body = document.body;
    const isDark = body.classList.toggle('dark-theme');
    
    // Store preference
    localStorage.setItem('darkTheme', isDark);
    
    // Update appearance based on theme
    this.updateThemeAppearance(isDark);
  }
  
  loadThemePreference() {
    const isDark = localStorage.getItem('darkTheme') === 'true';
    if (isDark) document.body.classList.add('dark-theme');
    
    // Update appearance based on theme
    this.updateThemeAppearance(isDark);
  }
  
  updateThemeAppearance(isDark) {
    // Update button color
    if (this.themeToggleBtn) {
      this.themeToggleBtn.style.color = isDark ? 'var(--white-container)' : 'var(--deep-blue)';
    }
    
    // Toggle icon styles
    this.toggleIconStyles(isDark);
  }
  
  toggleIconStyles(toDarkTheme) {
    document.querySelectorAll('i.fa-solid, i.fa-regular').forEach(icon => {
      if (icon.classList.contains('fa-circle-half-stroke')) return;

      icon.classList.toggle('fa-solid', !toDarkTheme);
      icon.classList.toggle('fa-regular', toDarkTheme);
    });
  }
  
  createThemeToggleButton() {
    this.themeToggleBtn = document.createElement('button');
    this.themeToggleBtn.id = 'theme-toggle-btn';
    this.themeToggleBtn.innerHTML = '<i class="fa-solid fa-circle-half-stroke"></i>';
    
    Object.assign(this.themeToggleBtn.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: '1000',
      backgroundColor: 'transparent',
      border: 'none',
      fontSize: '24px',
      cursor: 'pointer'
    });
    
    // Bind this context to event handler
    this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    document.body.appendChild(this.themeToggleBtn);
  }
}

// Initialize theme manager
const themeManager = new ThemeManager();