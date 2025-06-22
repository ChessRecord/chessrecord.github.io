const hideDropdown = () => document.querySelector('.dropdown').classList.remove('show');
const showDropdown = () => document.querySelector('.dropdown').classList.toggle('show');

document.addEventListener('DOMContentLoaded', () => {
    const optionsButton = document.querySelector('.options');
    const dropdown = document.querySelector('.dropdown');

    if (optionsButton) {
        optionsButton.addEventListener('click', (e) => {
            e.stopPropagation();
            showDropdown();
        });
    }

    if (dropdown) {
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                hideDropdown();
            }
        });
    }
});
