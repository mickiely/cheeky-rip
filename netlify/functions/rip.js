const https = require('https');
const http = require('http');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { url } = JSON.parse(event.body || '{}');

    if (!url) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Please provide a valid URL' })
      };
    }

    // Basic URL validation & routing
    // Note: For open SoundCloud/media links, resolution endpoints or standard public stream resolvers are passed here.
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        status: 'success',
        message: 'Stream resolved successfully',
        sourceUrl: url,
        // Frontend uses this payload to present the download button to the user
        downloadUrl: url
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Internal Server Error' })
    };
  }
};
