// Get all game entry elements
const gameEntries = document.querySelectorAll('.game-entry');

// Add mousemove event listener to each game entry
gameEntries.forEach(entry => {
    entry.addEventListener('mousemove', (e) => {
        // Get the mouse position relative to the game entry
        const rect = entry.getBoundingClientRect();
        const x = e.clientX - rect.left; // X position within the element
        const y = e.clientY - rect.top; // Y position within the element

        // Create a gradient based on the mouse position
        const gradient = `radial-gradient(circle at ${x}px ${y}px, #f2f2f2, var(--white-container))`;

        // Apply the gradient to the game entry
        entry.style.background = gradient;
    });

    // Reset background on mouse leave
    entry.addEventListener('mouseleave', () => {
        entry.style.background = 'var(--white-container)'; // Reset to original
    });
});