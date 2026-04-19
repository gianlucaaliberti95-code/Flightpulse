export default async function handler(req, res) {
res.setHeader(‘Access-Control-Allow-Origin’, ‘*’);
res.setHeader(‘Access-Control-Allow-Methods’, ‘GET, OPTIONS’);
if (req.method === ‘OPTIONS’) { res.status(200).end(); return; }

const { flightNum } = req.query;
if (!flightNum) return res.status(400).json({ error: ‘Numero volo mancante’ });

const clean = flightNum.trim().toUpperCase();

// ─── FONTE 1: AviationStack ───────────────────────────────────────────────
try {
const API_KEY = process.env.AVIATION_API_KEY;
if (API_KEY) {
const r = await fetch(
`https://api.aviationstack.com/v1/flights?access_key=${API_KEY}&flight_iata=${encodeURIComponent(clean)}&limit=1`
);
const json = await r.json();

```
// Se ha trovato dati validi → restituisci subito
if (json.data && json.data.length > 0) {
return res.status(200).json({ source: 'aviationstack', ...json });
}
}
```

} catch (e) {
// AviationStack fallito → proviamo OpenSky
console.error(‘AviationStack error:’, e.message);
}

// ─── FONTE 2: OpenSky Network (gratuito, nessuna API key) ─────────────────
try {
// OpenSky cerca per callsign — il callsign è solitamente il numero volo
// es. WMT956 → callsign “WMT956” (con spazi di padding a 8 char)
const callsign = clean.padEnd(8, ’ ’);
const encoded = encodeURIComponent(callsign.trim());

```
const r = await fetch(
`https://opensky-network.org/api/states/all?callsign=${encoded}`,
{
headers: {
'Accept': 'application/json',
}
}
);

if (!r.ok) throw new Error(`OpenSky HTTP ${r.status}`);

const json = await r.json();

// OpenSky restituisce un array "states" con i voli trovati
if (json.states && json.states.length > 0) {
const s = json.states[0];

// Mappa i campi OpenSky nel formato che il nostro frontend già capisce
// Indici array OpenSky: https://openskynetwork.github.io/opensky-api/rest.html
const mapped = {
source: 'opensky',
data: [
{
flight_date: new Date().toISOString().split('T')[0],
flight_status: s[8] ? 'landed' : (s[5] !== null ? 'active' : 'scheduled'),
departure: {
airport: s[11] || null, // origin country / airport (se disponibile)
iata: null,
icao: null,
terminal: null,
gate: null,
scheduled: null,
estimated: null,
actual: null,
},
arrival: {
airport: null,
iata: null,
icao: null,
terminal: null,
gate: null,
scheduled: null,
estimated: null,
actual: null,
},
airline: {
name: s[0]?.trim() || clean, // callsign come nome
iata: null,
icao: s[0]?.trim().slice(0, 3) || null,
},
aircraft: {
registration: s[0]?.trim() || null,
iata: null,
icao24: s[0] || null,
},
flight: {
number: clean,
iata: clean,
icao: s[0]?.trim() || clean,
},
// Dati live extra da OpenSky (posizione, quota, velocità)
live: {
latitude: s[6],
longitude: s[5],
altitude: s[7] ? Math.round(s[7]) : null, // metri
altitude_ft: s[7] ? Math.round(s[7] * 3.28084) : null, // piedi
speed_kmh: s[9] ? Math.round(s[9] * 3.6) : null, // m/s → km/h
heading: s[10] ? Math.round(s[10]) : null,
on_ground: s[8],
updated: s[4],
}
}
]
};

return res.status(200).json(mapped);
}

// Nessun risultato neanche su OpenSky
return res.status(200).json({
source: 'none',
data: [],
message: `Volo "${clean}" non trovato né su AviationStack né su OpenSky. Il volo potrebbe non essere ancora attivo o usare un callsign diverso.`
});
```

} catch (e) {
console.error(‘OpenSky error:’, e.message);
return res.status(500).json({
error: ‘Entrambe le fonti non disponibili’,
detail: e.message
});
}
}
