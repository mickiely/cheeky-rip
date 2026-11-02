console.log("Cheeky Rip Client initialized.");
const ripBtn = document.getElementById('ripBtn');
const urlInput = document.getElementById('urlInput');
const statusLog = document.getElementById('statusLog');

ripBtn.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (!url) return alert('Paste a URL first!');
    statusLog.textContent = `Status: Fetching stream from backend...`;
    
    // Direct link to backend extractor
    const audioStreamUrl = `http://localhost:3000/api/extract?url=${encodeURIComponent(url)}`;
    
    const audio = new Audio(audioStreamUrl);
    audio.play().then(() => {
        statusLog.textContent = `Status: Playing ripped stream successfully!`;
    }).catch(err => {
        statusLog.textContent = `Status: Error playing stream - check server console.`;
        console.error(err);
    });
});
