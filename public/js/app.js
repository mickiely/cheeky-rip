document.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('downloadBtn');
    const urlInput = document.getElementById('urlInput');
    const statusLog = document.getElementById('statusLog');

    if (!downloadBtn || !urlInput) return;

    downloadBtn.addEventListener('click', async () => {
        const inputUrl = urlInput.value.trim();

        if (!inputUrl) {
            statusLog.textContent = 'Status: Please enter a valid URL.';
            return;
        }

        statusLog.textContent = 'Status: Resolving accessible audio stream...';
        downloadBtn.disabled = true;

        try {
            const response = await fetch('/.netlify/functions/rip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: inputUrl })
            });

            const data = await response.json();

            if (response.ok && data.downloadUrl) {
                statusLog.textContent = 'Status: Audio stream ready! Processing download...';

                // Trigger file handoff / download link
                const a = document.createElement('a');
                a.href = data.downloadUrl;
                a.download = 'ripped-track.mp3';
                a.target = '_blank';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                statusLog.textContent = 'Status: Complete! Drag your MP3 into TDAH SoundLab.';
            } else {
                statusLog.textContent = `Status: Error - ${data.error || 'Failed to extract stream'}`;
            }
        } catch (err) {
            statusLog.textContent = 'Status: Network error or serverless function unavailable.';
            console.error(err);
        } finally {
            downloadBtn.disabled = false;
        }
    });
});
