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

    const prompt = `You are a light pollution analyst assisting with 1050 Lab 25, a student field study based in London, Ontario. The goal of this lab is to measure and characterise light pollution across the city using an AS7341 spectral sensor. The sensor captures 8 visible bands (F1=415nm violet, F2=445nm blue, F3=480nm blue-cyan, F4=515nm green, F5=555nm green-yellow, F6=590nm yellow-orange, F7=630nm red-orange, F8=680nm red), plus NIR and a broadband Clear channel.

Session summary:
- Date: ${summary.date}
- Readings: ${summary.rowCount} (one per 2 seconds, total ~${Math.round(summary.durationS / 60)} min)
- Clear channel — avg: ${summary.avgClear}, peak: ${summary.peakClear}, min: ${summary.minClear}
- Avg NIR: ${summary.avgNIR}
- Avg Lux_Est: ${summary.avgLux}
- Average per spectral band: ${summary.avgBands}

Write a concise plain-English analysis (4–6 sentences, no bullet points, no markdown headers) covering these points in order:

1. LIGHT POLLUTION ASSESSMENT: State clearly whether this session is likely to represent light pollution. Note that light pollution can only be definitively confirmed from night-time readings of sufficient duration (ideally 10+ minutes). If the session is short or taken during the day, flag this limitation explicitly and explain what would be needed for a definitive assessment.

2. TYPE OF LIGHT POLLUTION: If light pollution is detected or suspected, identify which type(s) are most likely present based on the data — sky glow (diffuse brightening of the night sky from scattered artificial light, indicated by broadly elevated readings across all bands), glare (excessive brightness causing visual discomfort, indicated by very high peak Clear values), light trespass (artificial light spilling beyond its intended area, indicated by elevated readings in a location not expected to be directly lit), or clutter (confusing groupings of light sources, harder to determine from spectral data alone). Also note the most likely artificial light source type based on the spectral signature — for example LED street lighting (blue-heavy), high-pressure sodium (orange-dominant), metal halide (blue-white), fluorescent (green spike), or mercury vapour (blue-violet dominant).

3. BLUE LIGHT LEVELS: Assess the blue light content specifically using F2 (445nm) and F3 (480nm) band values. State whether these levels are negligible, moderate, or elevated relative to the other bands. Note that elevated blue light at night is considered harmful because it suppresses melatonin and disrupts circadian rhythms in both humans and wildlife — if blue levels are elevated in a night-time session, flag this as a concern.

4. OVERALL BRIGHTNESS AND SPECTRAL CHARACTER: Comment on overall brightness, any dominant spectral bands, NIR levels, and whether the intensity varied significantly over the session.

Keep the tone factual and suitable for a student lab report.`;

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
