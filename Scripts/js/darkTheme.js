function toggleTheme() {
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    document.body.classList.toggle('dark-theme');

    // Update button color and icon based on the current theme
    const isDarkTheme = document.body.classList.contains('dark-theme');
    themeToggleBtn.innerHTML = isDarkTheme ? '<i class="fa-solid fa-circle-half-stroke"></i>' : '<i class="fa-solid fa-circle-half-stroke"></i>';
    themeToggleBtn.style.color = isDarkTheme ? "var(--white-container)" : "var(--deep-blue)";

    // Save theme preference in localStorage
    localStorage.setItem('darkTheme', isDarkTheme);
}

function loadThemePreference() {
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    const savedTheme = localStorage.getItem('darkTheme');
    const isDarkTheme = savedTheme === 'true';

    if (isDarkTheme) {
        document.body.classList.add('dark-theme');
        themeToggleBtn.innerHTML = '<i class="fa-solid fa-circle-half-stroke"></i>';
        themeToggleBtn.style.color = "var(--white-container)";
    } else {
        themeToggleBtn.innerHTML = '<i class="fa-solid fa-circle-half-stroke"></i>';
        themeToggleBtn.style.color = "var(--deep-blue)";
    }
}

function createThemeToggleButton() {
    const themeToggleBtn = document.createElement('button');
    themeToggleBtn.innerHTML = '<i class="fa-solid fa-circle-half-stroke"></i>';
    themeToggleBtn.id = 'theme-toggle-btn';
    themeToggleBtn.style.position = 'fixed';
    themeToggleBtn.style.bottom = '20px';
    themeToggleBtn.style.right = '20px';
    themeToggleBtn.style.zIndex = '1000';
    themeToggleBtn.style.backgroundColor = 'transparent';
    themeToggleBtn.style.border = 'none';
    themeToggleBtn.style.fontSize = '24px';
    themeToggleBtn.style.cursor = 'pointer';

    themeToggleBtn.addEventListener('click', toggleTheme);

    document.body.appendChild(themeToggleBtn);
}

document.addEventListener('DOMContentLoaded', () => {
    createThemeToggleButton();
    loadThemePreference();
});
