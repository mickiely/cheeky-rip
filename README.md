# Cheeky Rip

React + TypeScript + Vite app restored from `Cheeky Rip.zip`. The export archive is retained as the original design reference; Figma preview tooling and duplicate static app files are excluded from the runtime.

Use Node 22. Run `npm ci`, `npm run build`, and `npm test`. Netlify builds `dist` and serves `netlify/functions`. `npm run dev` serves the frontend and mounts `netlify/functions/rip.js` at `/.netlify/functions/rip` via a Vite dev middleware; `npx netlify-cli dev` also works.

Paste a direct public audio URL to receive a streamed audio download (maximum 19 MB and 55 seconds). The server validates each redirect and pins public DNS addresses. HTML track pages, protected streams, playlists, and HLS manifests are not supported; Spotify/SoundCloud page extraction needs a separate authorized resolver. There is no transcoding: the downloaded file preserves the source format.

Local MP3/WAV files stay on the device. Download the selected audio and use the TDAH SoundLab link to load the file in that app. SoundLab has no documented file handoff API in this repository, so opening it does not automatically import a file.
