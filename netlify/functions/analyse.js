exports.handler = async function (event) {
    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
 
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'ANTHROPIC_API_KEY environment variable is not set.' })
        };
    }
 
    let body;
    try {
        body = JSON.parse(event.body);
    } catch {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
    }
 
    const { summary } = body;
    if (!summary) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing summary field.' }) };
    }
 
    const prompt = `You are a light pollution data assistant for a student lab (1050 Lab 25, London, Ontario).
A student has uploaded a sensor session. The AS7341 spectral sensor captures 8 visible bands (F1=violet to F8=red), NIR, and a broadband Clear channel.
 
Session summary:
- Date: ${summary.date}
- Readings: ${summary.rowCount} (one per 2 seconds, total ~${Math.round(summary.durationS / 60)} min)
- Clear channel — avg: ${summary.avgClear}, peak: ${summary.peakClear}, min: ${summary.minClear}
- Avg NIR: ${summary.avgNIR}
- Average per spectral band: ${summary.avgBands}
 
Give a concise 3–4 sentence plain-English analysis of what this data suggests about the light environment at this location. Comment on overall brightness level, any notable spectral signature (e.g. warm/cool light, heavy NIR), and whether the intensity trend (rising, falling, steady) is consistent with a typical outdoor recording session. Keep it factual and helpful for a student lab report. No bullet points — just prose.`;
 
    try {
        const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 1000,
                messages: [{ role: 'user', content: prompt }]
            })
        });
 
        if (!anthropicRes.ok) {
            const err = await anthropicRes.json().catch(() => ({}));
            throw new Error(err.error?.message || `Anthropic API error ${anthropicRes.status}`);
        }
 
        const data = await anthropicRes.json();
        const text = data.content
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join('');
 
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ analysis: text })
        };
 
    } catch (err) {
        return {
            statusCode: 502,
            body: JSON.stringify({ error: err.message })
        };
    }
};
