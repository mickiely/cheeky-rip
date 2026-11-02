const express = require('express');
const cors = require('cors');
const youtubedl = require('yt-dlp-exec');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/extract', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).json({ error: 'Missing target URL parameter.' });
    }

    try {
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const subprocess = youtubedl.raw(targetUrl, {
            extractAudio: true,
            audioFormat: 'mp3',
            output: '-',
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
        }, { stdio: ['ignore', 'pipe', 'inherit'] });

        subprocess.stdout.pipe(res);

        subprocess.on('error', (err) => {
            console.error('Extraction error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to extract audio stream.' });
            }
        });
    } catch (err) {
        console.error('Server error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Cheeky Rip running locally at http://localhost:${PORT}`);
});
