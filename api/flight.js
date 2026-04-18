export default async function handler(req, res) {
  // Permetti richieste dal tuo frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { flightNum } = req.query;

  if (!flightNum) {
    return res.status(400).json({ error: 'Numero di volo mancante' });
  }

  // La API key è sicura sul server — nessuno la vede
  const API_KEY = process.env.AVIATION_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'API key non configurata sul server' });
  }

  try {
    const response = await fetch(
      `https://api.aviationstack.com/v1/flights?access_key=${API_KEY}&flight_iata=${encodeURIComponent(flightNum)}&limit=1`
    );
    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Errore nel contattare AviationStack', detail: err.message });
  }
}
