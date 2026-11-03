// ═══════════════════════════════════════════════════════════════════════════════
// Garmin Cards — combined bundle
// Kaarten: activity, sleep, hrv, training, body, activity-summary
// ═══════════════════════════════════════════════════════════════════════════════

// ── Map tiles ─────────────────────────────────────────────────────────────────
const MAP_TILES_RASTER_PATH = '/api/map_tiles/raster/{z}/{x}/{y}.png?token={token}';
const MAP_TILES_TOKEN_REFRESH_MS = 20 * 60 * 1000;
const OSM_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const OSM_DIRECT_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

// ── Shared state helpers ──────────────────────────────────────────────────────
function stateNum(hass, id) { const s=hass?.states[id]; if(!s)return null; const v=parseFloat(s.state); return isNaN(v)?null:v; }
function stateStr(hass, id) { return hass?.states[id]?.state??null; }
function attrNum(hass, id, attr) { const v=hass?.states[id]?.attributes?.[attr]; return v!=null?parseFloat(v):null; }
function attrVal(hass, id, attr) { return hass?.states[id]?.attributes?.[attr]??null; }

// ── Shared formatters ─────────────────────────────────────────────────────────
function fmtDistance(m) { return m==null?'—':m>=1000?(m/1000).toFixed(2)+' km':Math.round(m)+' m'; }
function fmtDuration(s) {
  if (s==null) return '—';
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=Math.floor(s%60);
  return h>0?`${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`:`${m}:${String(sec).padStart(2,'0')}`;
}
function fmtMinutes(min) { if(min==null)return'—'; const h=Math.floor(min/60),m=Math.round(min%60); return h>0?`${h}u ${String(m).padStart(2,'0')}m`:`${m}m`; }
function fmtPace(mps) { if(!mps||mps<=0)return'—'; const s=1000/mps; return`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')} /km`; }
function fmtSpeed(mps) { return mps!=null?(mps*3.6).toFixed(1)+' km/h':'—'; }
function fmtWatt(w)    { return w!=null?Math.round(w)+' W':'—'; }
function fmtHR(b)      { return b!=null?b+' bpm':'—'; }
function fmtElev(m)    { return m!=null?Math.round(m)+' m':'—'; }
function fmtCal(k)     { return k!=null?Math.round(k)+' kcal':'—'; }
function fmtNum(n, d=0){ return n!=null?n.toFixed(d):'—'; }
function fmtTime(v) {
  if (!v||v==='unknown'||v==='unavailable') return '—';
  try { const d=new Date(v); return isNaN(d)?'—':d.toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit'}); } catch(_){return'—';}
}

// ── Shared color helpers ──────────────────────────────────────────────────────
function isCycling(t) { if(!t)return false; const l=t.toLowerCase(); return l.includes('cycling')||l.includes('bike')||l.includes('biking')||l.includes('ride'); }
function scoreColor(v, max=100) { if(v==null)return'var(--secondary-text-color)'; const p=v/max; if(p>=0.7)return'#6bcb77'; if(p>=0.4)return'#ffd166'; return'#f4845f'; }
function sleepScoreColor(s) { if(s==null)return'var(--secondary-text-color)'; if(s>=80)return'#6bcb77'; if(s>=60)return'#ffd166'; return'#e63946'; }
function statusColor(s) { if(!s)return'var(--secondary-text-color)'; const l=s.toLowerCase(); if(['balanced','peaking','productive'].includes(l))return'#6bcb77'; if(['low','maintaining','recovery'].includes(l))return'#ffd166'; return'#f4845f'; }
function batteryColor(p) { if(p==null)return'var(--secondary-text-color)'; if(p>=75)return'#6bcb77'; if(p>=40)return'#ffd166'; return'#f4845f'; }
function batteryIcon(p) { if(p==null)return'mdi:battery-unknown'; if(p>=90)return'mdi:battery'; if(p>=75)return'mdi:battery-80'; if(p>=55)return'mdi:battery-60'; if(p>=35)return'mdi:battery-40'; if(p>=15)return'mdi:battery-20'; return'mdi:battery-alert'; }

// ── Shared UI helpers ─────────────────────────────────────────────────────────
function zonesHtml(times, colors, labels) {
  const total=times.reduce((a,b)=>a+b,0);
  if (!total) return '';
  const bars=times.map((t,i)=>`<div class="zone-bar" style="flex:${t};background:${colors[i]}" title="${labels[i]}: ${fmtDuration(t)} (${(t/total*100).toFixed(1)}%)"></div>`).join('');
  const legend=times.map((t,i)=>{if(!t)return'';return`<div class="zone-legend-item"><span class="zone-dot" style="background:${colors[i]}"></span><span class="zone-legend-label">${labels[i]}</span><span class="zone-legend-val">${fmtDuration(t)} <span class="zone-pct">${(t/total*100).toFixed(0)}%</span></span></div>`;}).join('');
  return `<div class="zone-bars">${bars}</div><div class="zone-legend">${legend}</div>`;
}

function progressBar(value, goal, color) {
  if (value==null||goal==null||goal===0) return '';
  const pct=Math.min(100,(value/goal)*100);
  return `<div class="progress-wrap"><div class="progress-track"><div class="progress-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div></div><span class="progress-label">${Math.round(pct)}% van doel</span></div>`;
}

// ── Shared history loader ─────────────────────────────────────────────────────
async function loadHistory(hass, entityId, days) {
  const end=new Date(), start=new Date(end-days*86400*1000);
  try {
    const result=await hass.connection.sendMessagePromise({type:'recorder/statistics_during_period',start_time:start.toISOString(),end_time:end.toISOString(),statistic_ids:[entityId],period:'day',units:{},types:['mean']});
    const stats=result?.[entityId]||[];
    if (stats.length) return stats.filter(s=>s.mean!=null).map(s=>({date:s.start,value:Math.round(s.mean)}));
  } catch(_e){ /* ignore */ }
  try {
    const result=await hass.connection.sendMessagePromise({type:'history/history_during_period',start_time:start.toISOString(),end_time:end.toISOString(),entity_ids:[entityId],minimal_response:true,no_attributes:true,significant_changes_only:false});
    const states=result?.[entityId]||[];
    const byDay={};
    for(const s of states){const v=parseFloat(s.s??s.state);if(isNaN(v))continue;const day=(s.lu?new Date(s.lu*1000):new Date(s.last_updated)).toISOString().slice(0,10);byDay[day]=v;}
    return Object.entries(byDay).sort(([a],[b])=>a.localeCompare(b)).map(([date,value])=>({date,value:Math.round(value)}));
  } catch(_e2){ /* ignore */ }
  return [];
}

// ── Shared SVG line chart ─────────────────────────────────────────────────────
function buildLineChart(points, color, opts={}, noHistoryMsg) {
  if (!points.length) return noHistoryMsg || '<div class="no-history">No history available</div>';
  const {minY:forceMin, maxY:forceMax, refLines=[], H=120} = opts;
  const W=600, PAD={top:10,right:32,bottom:24,left:36};
  const cW=W-PAD.left-PAD.right, cH=H-PAD.top-PAD.bottom;
  const vals=points.map(p=>p.value);
  const allY=[...vals,...refLines.map(r=>[r.value,r.y1,r.y2]).flat()].filter(v=>v!=null);
  const minY=forceMin??Math.floor(allY.reduce((a,b)=>Math.min(a,b),Infinity)*0.95);
  const maxY=forceMax??Math.ceil(allY.reduce((a,b)=>Math.max(a,b),-Infinity)*1.05);
  const rangeY=maxY-minY||1;
  const xScale=i=>PAD.left+(i/(points.length-1||1))*cW;
  const yScale=v=>PAD.top+cH-((v-minY)/rangeY)*cH;
  const zones=refLines.filter(r=>r.type==='zone'&&r.y1!=null&&r.y2!=null).map(r=>`<rect x="${PAD.left}" y="${yScale(r.y2)}" width="${cW}" height="${Math.abs(yScale(r.y1)-yScale(r.y2))}" fill="${r.color}" opacity="0.12"/>`);
  const refs=refLines.filter(r=>r.type==='line'&&r.value!=null).map(r=>`<line x1="${PAD.left}" y1="${yScale(r.value)}" x2="${PAD.left+cW}" y2="${yScale(r.value)}" stroke="${r.color}" stroke-width="1" stroke-dasharray="4,3" opacity="0.6"/><text x="${PAD.left+cW+2}" y="${yScale(r.value)+4}" font-size="9" fill="${r.color}" opacity="0.8">${r.value}</text>`);
  const linePts=points.map((p,i)=>`${i===0?'M':'L'}${xScale(i).toFixed(1)},${yScale(p.value).toFixed(1)}`).join(' ');
  const areaPath=`${linePts} L${xScale(points.length-1).toFixed(1)},${(PAD.top+cH).toFixed(1)} L${PAD.left.toFixed(1)},${(PAD.top+cH).toFixed(1)} Z`;
  const lastX=xScale(points.length-1), lastY=yScale(points[points.length-1].value);
  const labelStep=Math.max(1,Math.floor((points.length-1)/(Math.min(5,points.length)-1||1)));
  const xLabels=[],yLabels=[];
  for(let i=0;i<points.length;i+=labelStep){const d=new Date(points[i].date);xLabels.push(`<text x="${xScale(i).toFixed(1)}" y="${H-4}" font-size="9" fill="var(--secondary-text-color)" text-anchor="middle">${d.getDate()}/${d.getMonth()+1}</text>`);}
  for(let i=0;i<=4;i++){const val=Math.round(minY+(rangeY/4)*i);const y=yScale(val);yLabels.push(`<text x="${PAD.left-4}" y="${y+3}" font-size="9" fill="var(--secondary-text-color)" text-anchor="end">${val}</text><line x1="${PAD.left}" y1="${y}" x2="${PAD.left+cW}" y2="${y}" stroke="var(--divider-color)" stroke-width="0.5"/>`);}
  const uid=Math.random().toString(36).slice(2,7);
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">${zones.join('')}${yLabels.join('')}${refs.join('')}<defs><linearGradient id="g-${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.3"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient><clipPath id="c-${uid}"><rect x="${PAD.left}" y="${PAD.top}" width="${cW}" height="${cH}"/></clipPath></defs><g clip-path="url(#c-${uid})"><path d="${areaPath}" fill="url(#g-${uid})"/><path d="${linePts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${lastX}" cy="${lastY}" r="4" fill="${color}"/></g>${xLabels.join('')}</svg>`;
}

// ── Translations ──────────────────────────────────────────────────────────────
const TRANSLATIONS = {
  nl: {
    no_data: 'Geen data beschikbaar', no_route: 'Geen routedata beschikbaar',
    no_history: 'Geen historiek beschikbaar', start: 'Start', end: 'Einde',
    of_goal: '% van doel',
    activity: 'Activiteit', distance: 'Afstand', duration: 'Duur',
    speed: 'Snelheid', pace: 'Tempo', calories: 'Calorieën',
    avg_hr: 'Gem. HR', max_hr: 'Max HR', elevation_gain: 'Stijging',
    elevation_loss: 'Daling', avg_power: 'Gem. vermogen', max_power: 'Max vermogen',
    norm_power: 'Norm. vermogen', hr_zones: 'Hartslagzones', power_zones: 'Vermogenszones',
    sleep_score: 'Slaapscore', bedtime: 'Slaaptijd', wake_time: 'Wektijd',
    total: 'Totaal', sleep_stages: 'Slaapfasen', deep_sleep: 'Diepe slaap',
    light_sleep: 'Lichte slaap', rem_sleep: 'REM slaap', awake: 'Wakker',
    vitals: 'Metingen', hrv: 'HRV', resting_hr: 'Rust HR',
    spo2: 'SpO2', respiration: 'Ademhaling', body_battery: 'Body Battery',
    hrv_status: 'HRV Status', baseline: 'Baseline', last_night: 'Afgelopen nacht',
    weekly_avg: 'Weekgemiddelde', five_min_peak: '5-min piek',
    history: 'Historiek', days: 'dagen',
    readiness: 'Gereedheid', morning: 'Ochtend', recovery_time: 'Hersteltijd',
    training_readiness: 'Trainingsgereedheid', vo2max: 'VO2max',
    running: 'Lopen', cycling: 'Fietsen', lactate_threshold: 'Lactaatdrempel',
    training_status: 'Trainingsstatus', endurance: 'Uithoudingsvermogen',
    hill_score: 'Heuvel score', scores: 'Scores',
    body_battery_highest: 'Hoogste', body_battery_lowest: 'Laagste',
    charged: 'Opgeladen', drained: 'Verbruikt',
    composition: 'Lichaamssamenstelling', weight: 'Gewicht', bmi: 'BMI',
    body_fat: 'Vetpercentage', body_water: 'Waterpercentage',
    muscle_mass: 'Spiermassa', bone_mass: 'Botmassa',
    fitness_age: 'Fitnessleeftijd', achievable: 'Haalbaar',
    calendar_age: 'Kalenderleeftijd', metabolic_age: 'Metabolische leeftijd',
    steps: 'Stappen', yesterday: 'gisteren', intensity_minutes: 'Intensiteitsminuten',
    moderate: 'Matig', vigorous: 'Intensief', active_calories: 'Actief',
    bmr: 'BMR', total_calories: 'Totaal', active_time: 'Actief', sedentary_time: 'Zittend',
    entity_label: 'Garmin sensor (bepaalt het account)',
    title_label: 'Titel', map_height_label: 'Kaart hoogte',
    color_label: 'Kleur', history_days_label: 'Historiek (dagen)',
    sections: 'Secties', show_map: 'Kaart', show_stats: 'Statistieken',
    show_power: 'Vermogen', show_hr_zones: 'Hartslagzones',
    show_pwr_zones: 'Vermogenszones', show_score: 'Score & tijden',
    show_stages: 'Slaapfasen', show_vitals: 'Metingen (HRV, SpO2, ...)',
    show_status: 'Status & baseline', show_history: 'Historiek grafiek',
    show_readiness: 'Trainingsgereedheid', show_vo2max: 'VO2max',
    show_scores: 'Scores (uithoudingsvermogen, heuvel)',
    show_body_battery: 'Body battery', show_composition: 'Lichaamssamenstelling',
    show_fitness_age: 'Fitnessleeftijd', show_steps: 'Stappen',
    show_intensity: 'Intensiteitsminuten', show_calories: 'Calorieën & activiteit',
  },
  fr: {
    no_data: 'Aucune donnée disponible', no_route: 'Aucune donnée de route',
    no_history: 'Aucun historique disponible', start: 'Départ', end: 'Arrivée',
    of_goal: '% de l\'objectif',
    activity: 'Activité', distance: 'Distance', duration: 'Durée',
    speed: 'Vitesse', pace: 'Allure', calories: 'Calories',
    avg_hr: 'FC moy.', max_hr: 'FC max', elevation_gain: 'Montée',
    elevation_loss: 'Descente', avg_power: 'Puissance moy.', max_power: 'Puissance max',
    norm_power: 'Puissance norm.', hr_zones: 'Zones FC', power_zones: 'Zones de puissance',
    sleep_score: 'Score sommeil', bedtime: 'Coucher', wake_time: 'Réveil',
    total: 'Total', sleep_stages: 'Phases de sommeil', deep_sleep: 'Sommeil profond',
    light_sleep: 'Sommeil léger', rem_sleep: 'Sommeil REM', awake: 'Éveillé',
    vitals: 'Mesures', hrv: 'VFC', resting_hr: 'FC repos',
    spo2: 'SpO2', respiration: 'Respiration', body_battery: 'Batterie corporelle',
    hrv_status: 'Statut VFC', baseline: 'Référence', last_night: 'Nuit dernière',
    weekly_avg: 'Moy. hebdo.', five_min_peak: 'Pic 5 min',
    history: 'Historique', days: 'jours',
    readiness: 'Préparation', morning: 'Matin', recovery_time: 'Récupération',
    training_readiness: 'Préparation entraînement', vo2max: 'VO2max',
    running: 'Course', cycling: 'Vélo', lactate_threshold: 'Seuil lactate',
    training_status: 'Statut entraînement', endurance: 'Endurance',
    hill_score: 'Score côtes', scores: 'Scores',
    body_battery_highest: 'Max', body_battery_lowest: 'Min',
    charged: 'Chargé', drained: 'Consommé',
    composition: 'Composition corporelle', weight: 'Poids', bmi: 'IMC',
    body_fat: '% graisse', body_water: '% eau',
    muscle_mass: 'Masse musculaire', bone_mass: 'Masse osseuse',
    fitness_age: 'Âge fitness', achievable: 'Atteignable',
    calendar_age: 'Âge réel', metabolic_age: 'Âge métabolique',
    steps: 'Pas', yesterday: 'hier', intensity_minutes: "Minutes d'intensité",
    moderate: 'Modéré', vigorous: 'Intense', active_calories: 'Actif',
    bmr: 'MB', total_calories: 'Total', active_time: 'Actif', sedentary_time: 'Sédentaire',
    entity_label: 'Capteur Garmin (détermine le compte)',
    title_label: 'Titre', map_height_label: 'Hauteur carte',
    color_label: 'Couleur', history_days_label: 'Historique (jours)',
    sections: 'Sections', show_map: 'Carte', show_stats: 'Statistiques',
    show_power: 'Puissance', show_hr_zones: 'Zones FC',
    show_pwr_zones: 'Zones de puissance', show_score: 'Score & horaires',
    show_stages: 'Phases de sommeil', show_vitals: 'Mesures (VFC, SpO2, ...)',
    show_status: 'Statut & référence', show_history: 'Graphique historique',
    show_readiness: 'Préparation entraînement', show_vo2max: 'VO2max',
    show_scores: 'Scores (endurance, côtes)',
    show_body_battery: 'Batterie corporelle', show_composition: 'Composition corporelle',
    show_fitness_age: 'Âge fitness', show_steps: 'Pas',
    show_intensity: "Minutes d'intensité", show_calories: 'Calories & activité',
  },
  de: {
    no_data: 'Keine Daten verfügbar', no_route: 'Keine Routendaten',
    no_history: 'Kein Verlauf verfügbar', start: 'Start', end: 'Ende',
    of_goal: '% des Ziels',
    activity: 'Aktivität', distance: 'Distanz', duration: 'Dauer',
    speed: 'Geschwindigkeit', pace: 'Tempo', calories: 'Kalorien',
    avg_hr: 'Ø HF', max_hr: 'Max HF', elevation_gain: 'Anstieg',
    elevation_loss: 'Abstieg', avg_power: 'Ø Leistung', max_power: 'Max Leistung',
    norm_power: 'Norm. Leistung', hr_zones: 'HF-Zonen', power_zones: 'Leistungszonen',
    sleep_score: 'Schlafwert', bedtime: 'Schlafenszeit', wake_time: 'Aufwachzeit',
    total: 'Gesamt', sleep_stages: 'Schlafphasen', deep_sleep: 'Tiefschlaf',
    light_sleep: 'Leichtschlaf', rem_sleep: 'REM-Schlaf', awake: 'Wach',
    vitals: 'Messwerte', hrv: 'HRV', resting_hr: 'Ruhe-HF',
    spo2: 'SpO2', respiration: 'Atmung', body_battery: 'Body Battery',
    hrv_status: 'HRV-Status', baseline: 'Grundlinie', last_night: 'Letzte Nacht',
    weekly_avg: 'Wochendurchschnitt', five_min_peak: '5-Min-Spitze',
    history: 'Verlauf', days: 'Tage',
    readiness: 'Bereitschaft', morning: 'Morgen', recovery_time: 'Erholungszeit',
    training_readiness: 'Trainingsbereitschaft', vo2max: 'VO2max',
    running: 'Laufen', cycling: 'Radfahren', lactate_threshold: 'Laktatschwelle',
    training_status: 'Trainingsstatus', endurance: 'Ausdauer',
    hill_score: 'Bergwertung', scores: 'Wertungen',
    body_battery_highest: 'Höchst', body_battery_lowest: 'Niedrigst',
    charged: 'Geladen', drained: 'Verbraucht',
    composition: 'Körperzusammensetzung', weight: 'Gewicht', bmi: 'BMI',
    body_fat: 'Körperfett', body_water: 'Körperwasser',
    muscle_mass: 'Muskelmasse', bone_mass: 'Knochenmasse',
    fitness_age: 'Fitnessalter', achievable: 'Erreichbar',
    calendar_age: 'Kalenderalter', metabolic_age: 'Stoffwechselalter',
    steps: 'Schritte', yesterday: 'gestern', intensity_minutes: 'Intensitätsminuten',
    moderate: 'Moderat', vigorous: 'Intensiv', active_calories: 'Aktiv',
    bmr: 'Grundumsatz', total_calories: 'Gesamt', active_time: 'Aktiv', sedentary_time: 'Sitzend',
    entity_label: 'Garmin-Sensor (bestimmt das Konto)',
    title_label: 'Titel', map_height_label: 'Kartenhöhe',
    color_label: 'Farbe', history_days_label: 'Verlauf (Tage)',
    sections: 'Abschnitte', show_map: 'Karte', show_stats: 'Statistiken',
    show_power: 'Leistung', show_hr_zones: 'HF-Zonen',
    show_pwr_zones: 'Leistungszonen', show_score: 'Wert & Zeiten',
    show_stages: 'Schlafphasen', show_vitals: 'Messwerte (HRV, SpO2, ...)',
    show_status: 'Status & Grundlinie', show_history: 'Verlaufsdiagramm',
    show_readiness: 'Trainingsbereitschaft', show_vo2max: 'VO2max',
    show_scores: 'Wertungen (Ausdauer, Berge)',
    show_body_battery: 'Body Battery', show_composition: 'Körperzusammensetzung',
    show_fitness_age: 'Fitnessalter', show_steps: 'Schritte',
    show_intensity: 'Intensitätsminuten', show_calories: 'Kalorien & Aktivität',
  },
};

const EN_TRANSLATIONS = {
  no_data: 'No data available', no_route: 'No route data available',
  no_history: 'No history available', start: 'Start', end: 'End',
  of_goal: '% of goal',
  activity: 'Activity', distance: 'Distance', duration: 'Duration',
  speed: 'Speed', pace: 'Pace', calories: 'Calories',
  avg_hr: 'Avg HR', max_hr: 'Max HR', elevation_gain: 'Elevation gain',
  elevation_loss: 'Elevation loss', avg_power: 'Avg power', max_power: 'Max power',
  norm_power: 'Norm. power', hr_zones: 'Heart rate zones', power_zones: 'Power zones',
  sleep_score: 'Sleep score', bedtime: 'Bedtime', wake_time: 'Wake time',
  total: 'Total', sleep_stages: 'Sleep stages', deep_sleep: 'Deep sleep',
  light_sleep: 'Light sleep', rem_sleep: 'REM sleep', awake: 'Awake',
  vitals: 'Vitals', hrv: 'HRV', resting_hr: 'Resting HR',
  spo2: 'SpO2', respiration: 'Respiration', body_battery: 'Body Battery',
  hrv_status: 'HRV Status', baseline: 'Baseline', last_night: 'Last night',
  weekly_avg: 'Weekly avg', five_min_peak: '5-min peak',
  history: 'History', days: 'days',
  readiness: 'Readiness', morning: 'Morning', recovery_time: 'Recovery time',
  training_readiness: 'Training readiness', vo2max: 'VO2max',
  running: 'Running', cycling: 'Cycling', lactate_threshold: 'Lactate threshold',
  training_status: 'Training status', endurance: 'Endurance',
  hill_score: 'Hill score', scores: 'Scores',
  body_battery_highest: 'Highest', body_battery_lowest: 'Lowest',
  charged: 'Charged', drained: 'Drained',
  composition: 'Body composition', weight: 'Weight', bmi: 'BMI',
  body_fat: 'Body fat', body_water: 'Body water',
  muscle_mass: 'Muscle mass', bone_mass: 'Bone mass',
  fitness_age: 'Fitness age', achievable: 'Achievable',
  calendar_age: 'Calendar age', metabolic_age: 'Metabolic age',
  steps: 'Steps', yesterday: 'yesterday', intensity_minutes: 'Intensity minutes',
  moderate: 'Moderate', vigorous: 'Vigorous', active_calories: 'Active',
  bmr: 'BMR', total_calories: 'Total', active_time: 'Active', sedentary_time: 'Sedentary',
  entity_label: 'Garmin sensor (determines the account)',
  title_label: 'Title', map_height_label: 'Map height',
  color_label: 'Color', history_days_label: 'History (days)',
  sections: 'Sections', show_map: 'Map', show_stats: 'Statistics',
  show_power: 'Power', show_hr_zones: 'Heart rate zones',
  show_pwr_zones: 'Power zones', show_score: 'Score & times',
  show_stages: 'Sleep stages', show_vitals: 'Vitals (HRV, SpO2, ...)',
  show_status: 'Status & baseline', show_history: 'History chart',
  show_readiness: 'Training readiness', show_vo2max: 'VO2max',
  show_scores: 'Scores (endurance, hill)',
  show_body_battery: 'Body battery', show_composition: 'Body composition',
  show_fitness_age: 'Fitness age', show_steps: 'Steps',
  show_intensity: 'Intensity minutes', show_calories: 'Calories & activity',
};

function t(hass, key) {
  const lang = (hass?.locale?.language || 'en').slice(0, 2).toLowerCase();
  return (TRANSLATIONS[lang]?.[key]) ?? EN_TRANSLATIONS[key] ?? key;
}

// ── Shared editor helpers ─────────────────────────────────────────────────────
function editorStyles() {
  return `<style>
    .editor{display:flex;flex-direction:column;gap:16px;padding:16px}
    .section-header{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--secondary-text-color);padding:4px 0 2px;border-top:1px solid var(--divider-color);margin-top:4px}
    label{font-size:12px;color:var(--secondary-text-color);margin-bottom:4px;display:block}
    ha-selector{width:100%;display:block}
    .field input{width:100%;box-sizing:border-box;padding:8px 12px;border-radius:4px;border:1px solid var(--divider-color);background:var(--card-background-color);color:var(--primary-text-color);font-size:14px;font-family:inherit}
    .field input:focus{outline:none;border-color:var(--primary-color)}
    .toggle-row{display:flex;align-items:center;justify-content:space-between;padding:4px 0}
    .toggle-label{font-size:13px;color:var(--primary-text-color)}
  </style>`;
}
function renderToggle(id, label, checked) {
  return `<div class="toggle-row"><span class="toggle-label">${label}</span><ha-switch id="${id}" ${checked?'checked':''}></ha-switch></div>`;
}
function bindToggle(root, id, config, fireChange) {
  const el=root.getElementById(id); if(!el)return;
  el.addEventListener('change',e=>{config[id]=e.target.checked;fireChange();});
}


const HR_ZONE_COLORS    = ['#6ec6f5', '#6bcb77', '#ffd166', '#f4845f', '#e63946'];
const POWER_ZONE_COLORS = ['#b0b0b0', '#6bcb77', '#6ec6f5', '#ffd166', '#f4845f'];
const HR_ZONE_LABELS    = ['Z1 Herstel', 'Z2 Aëroob', 'Z3 Tempo', 'Z4 Drempel', 'Z5 VO2max'];
const POWER_ZONE_LABELS = ['Z1 Actief herstel', 'Z2 Uithoudingsvermogen', 'Z3 Tempo', 'Z4 Drempel', 'Z5 VO2max'];

const ACTIVITY_TYPE_ICON = {
  road_biking:'mdi:bike', cycling:'mdi:bike', gravel_cycling:'mdi:bike',
  mountain_biking:'mdi:bike', indoor_cycling:'mdi:bike-fast', virtual_ride:'mdi:bike',
  e_bike_fitness:'mdi:bicycle-electric', e_bike_mountain:'mdi:bicycle-electric',
  running:'mdi:run', trail_running:'mdi:run', treadmill_running:'mdi:run',
  track_running:'mdi:run', ultra_run:'mdi:run',
  walking:'mdi:walk', hiking:'mdi:hiking', casual_walking:'mdi:walk', speed_walking:'mdi:walk',
  swimming:'mdi:swim', lap_swimming:'mdi:swim', open_water_swimming:'mdi:swim',
  triathlon:'mdi:triathlon',
  strength_training:'mdi:weight-lifter', cardio_training:'mdi:heart-pulse',
  yoga:'mdi:yoga', rowing:'mdi:rowing', indoor_rowing:'mdi:rowing',
  skiing:'mdi:ski', snowboarding:'mdi:snowboard',
};

function activityIcon(typeKey) {
  return ACTIVITY_TYPE_ICON[typeKey] || 'mdi:run';
}

const ACTIVITY_TYPE_NL = {
  road_biking:'Wielrennen', cycling:t(hass,'cycling'), gravel_cycling:'Gravel fietsen',
  mountain_biking:'Mountainbiken', indoor_cycling:'Indoor fietsen', virtual_ride:'Virtueel fietsen',
  e_bike_fitness:'E-bike', e_bike_mountain:'E-bike mountainbike', recumbent_cycling:'Ligfiets',
  running:'Hardlopen', trail_running:'Trailrunning', treadmill_running:'Loopband',
  track_running:'Baanloop', ultra_run:'Ultraloop', obstacle_run:'Hindernisloop',
  walking:'Wandelen', hiking:'Wandelen', casual_walking:'Wandelen', speed_walking:'Snelwandelen',
  swimming:'Zwemmen', lap_swimming:'Baanzwemmen', open_water_swimming:'Openwaterzwemmen',
  triathlon:'Triathlon', strength_training:'Krachttraining', cardio_training:'Cardiotraining',
  yoga:'Yoga', pilates:'Pilates', fitness_equipment:'Fitnessapparaat', elliptical:'Crosstrainer',
  stair_climbing:'Trapklimmen', rowing:'Roeien', indoor_rowing:'Indoor roeien',
  skiing:'Skiën', backcountry_skiing:'Backcountry skiën', snowboarding:'Snowboarden',
  tennis:'Tennis', golf:'Golf', surfing:'Surfen', kayaking:'Kajakken',
  stand_up_paddleboarding:'Stand-up paddleboarden', other:'Overig',
};

function translateActivityType(k) {
  return ACTIVITY_TYPE_NL[k] ?? k?.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) ?? '';
}

function routeEntityId(id) {
  if (!id) return null;
  const s = id.match(/_(\d+)$/);
  const b = s ? id.slice(0,-s[0].length) : id;
  return b + '_route' + (s ? s[0] : '');
}




// ── Editor ────────────────────────────────────────────────────────────────────

class GarminActivityCardEditor extends HTMLElement {
  constructor() { super(); this.attachShadow({mode:'open'}); this._config={}; this._hass=null; }

  set hass(hass) { this._hass=hass; const s=this.shadowRoot.getElementById('entity'); if(s)s.hass=hass; }

  setConfig(config) { this._config={...config}; this._render(); }

  _render() {
    const c = this._config;
    const v = (k,d) => c[k]!==undefined ? c[k] : d;

    this.shadowRoot.innerHTML = editorStyles() + `
      <div class="editor">
        <div><label>${t(this._hass,'entity_label')}</label><ha-selector id="entity"></ha-selector></div>
        <div class="field"><label>${t(this._hass,'title_label')}</label><input id="title" type="text" value="${v('title','Laatste activiteit')}" /></div>
        <div class="field"><label>${t(this._hass,'map_height_label')}</label><input id="map_height" type="text" value="${v('map_height','300px')}" /></div>
        <div class="field"><label>${t(this._hass,'color_label')}</label><input id="color" type="text" value="${v('color','#2d5bff')}" /></div>
        <div class="section-header">Secties</div>
        ${renderToggle('show_map',      'Kaart',           v('show_map',true))}
        ${renderToggle('show_stats',    'Statistieken',    v('show_stats',true))}
        ${renderToggle('show_power',    'Vermogen',        v('show_power',true))}
        ${renderToggle('show_hr_zones', 'Hartslagzones',   v('show_hr_zones',true))}
        ${renderToggle('show_pwr_zones','Vermogenszones',  v('show_pwr_zones',true))}
      </div>`;

    const sel = this.shadowRoot.getElementById('entity');
    sel.hass=this._hass; sel.selector={entity:{integration:'garmin_connect',domain:'sensor'}}; sel.value=c.entity||''; sel.label='Entiteit';
    sel.addEventListener('value-changed', e => { this._config={...this._config,entity:e.detail.value}; this._fireChange(); });

    for (const id of ['title','map_height','color']) {
      this.shadowRoot.getElementById(id).addEventListener('input', e => { this._config={...this._config,[id]:e.target.value}; this._fireChange(); });
    }
    for (const id of ['show_map','show_stats','show_power','show_hr_zones','show_pwr_zones']) {
      bindToggle(this.shadowRoot, id, this._config, () => this._fireChange());
    }
  }

  _fireChange() { this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:this._config}})); }
}

// ── Card ──────────────────────────────────────────────────────────────────────

class GarminActivityCard extends HTMLElement {
  constructor() {
    super(); this.attachShadow({mode:'open'});
    this._hass=null; this._config=null; this._map=null; this._tileLayer=null;
    this._tokenRefreshInterval=null; this._polyline=null; this._initPending=false;
    this._lastPolylineKey=null; this._lastActivityKey=null;
  }

  setConfig(config) {
    if (!config.entity) throw new Error('entity is required');
    this._config = { title:'Laatste activiteit', map_height:'300px', color:'#2d5bff', weight:4,
      show_map:true, show_stats:true, show_power:true, show_hr_zones:true, show_pwr_zones:true, ...config };
  }

  set hass(hass) {
    this._hass=hass; if(!this._config)return;
    const routeState    = hass.states[routeEntityId(this._config.entity)];
    const activityState = hass.states[this._config.entity];
    const polylineKey   = routeState?.last_changed ?? null;
    const activityKey   = activityState?.last_changed ?? null;
    const polylineChanged = polylineKey!==this._lastPolylineKey;
    const activityChanged = activityKey!==this._lastActivityKey;
    if (!polylineChanged&&!activityChanged) return;
    this._lastPolylineKey=polylineKey; this._lastActivityKey=activityKey;
    if (polylineChanged) { this._map=null; this._polyline=null; }
    this._render(activityState, routeState);
  }

  connectedCallback() {
    if (this._hass&&this._config) {
      this._map=null; this._polyline=null; this._lastPolylineKey=null; this._lastActivityKey=null;
      this._render(this._hass.states[this._config.entity], this._hass.states[routeEntityId(this._config.entity)]);
    }
  }

  disconnectedCallback() { this._teardownMap(); }

  _teardownMap() {
    clearInterval(this._tokenRefreshInterval); this._tokenRefreshInterval=null;
    if (this._map) { this._map.remove(); this._map=null; this._tileLayer=null; this._polyline=null; }
  }

  _render(activityState, routeState) {
    const cfg   = this._config;
    const attrs = activityState?.attributes ?? {};
    const activityName = activityState?.state || attrs.activityName || 'Activiteit';
    const activityType = attrs.activityType || '';
    const cycling      = isCycling(activityType);
    const color        = cfg.color;
    const typeLabel    = translateActivityType(activityType);

    const statsHtml = cfg.show_stats !== false ? `
      <div class="stats">${[
        {icon:'mdi:map-marker-distance', label:t(hass,'distance'),   value:fmtDistance(attrs.distance)},
        {icon:'mdi:timer-outline',       label:t(hass,'duration'),      value:fmtDuration(attrs.duration)},
        cycling?{icon:'mdi:speedometer',label:t(hass,'speed'),  value:fmtSpeed(attrs.averageSpeed)}
               :{icon:'mdi:run-fast',   label:t(hass,'pace'),     value:fmtPace(attrs.averageSpeed)},
        {icon:'mdi:fire',               label:t(hass,'calories'), value:fmtCal(attrs.calories)},
        {icon:'mdi:heart-pulse',        label:t(hass,'avg_hr'),   value:fmtHR(attrs.averageHR)},
        {icon:'mdi:heart',              label:t(hass,'max_hr'),    value:fmtHR(attrs.maxHR)},
        {icon:'mdi:elevation-rise',     label:t(hass,'elevation_gain'),  value:fmtElev(attrs.elevationGain)},
        {icon:'mdi:elevation-decline',  label:t(hass,'elevation_loss'),    value:fmtElev(attrs.elevationLoss)},
      ].map(s=>`<div class="stat"><ha-icon icon="${s.icon}"></ha-icon><span class="value">${s.value}</span><span class="label">${s.label}</span></div>`).join('')}
      </div>` : '';

    const hasPower = attrs.avgPower!=null||attrs.maxPower!=null||attrs.normPower!=null;
    const powerHtml = cfg.show_power!==false && hasPower ? `
      <div class="stats power-stats">
        <div class="stat"><ha-icon icon="mdi:lightning-bolt"></ha-icon><span class="value">${fmtWatt(attrs.avgPower)}</span><span class="label">Gem. vermogen</span></div>
        <div class="stat"><ha-icon icon="mdi:lightning-bolt-circle"></ha-icon><span class="value">${fmtWatt(attrs.maxPower)}</span><span class="label">Max vermogen</span></div>
        <div class="stat"><ha-icon icon="mdi:chart-bell-curve"></ha-icon><span class="value">${fmtWatt(attrs.normPower)}</span><span class="label">Norm. vermogen</span></div>
      </div>` : '';

    const hrTimes = [1,2,3,4,5].map(i=>attrs[`hrTimeInZone_${i}`]??0);
    const hrZonesHtml = cfg.show_hr_zones!==false && hrTimes.some(t=>t>0) ? `
      <div class="section-title">${t(hass,'hr_zones')}</div>
      <div class="zones-wrap">${zonesHtml(hrTimes,HR_ZONE_COLORS,HR_ZONE_LABELS)}</div>` : '';

    const pwTimes = [1,2,3,4,5].map(i=>attrs[`powerTimeInZone_${i}`]??0);
    const pwZonesHtml = cfg.show_pwr_zones!==false && pwTimes.some(t=>t>0) ? `
      <div class="section-title">${t(hass,'power_zones')}</div>
      <div class="zones-wrap">${zonesHtml(pwTimes,POWER_ZONE_COLORS,POWER_ZONE_LABELS)}</div>` : '';

    const polylineData = routeState?.attributes?.polyline;
    const hasRoute = Array.isArray(polylineData)&&polylineData.length>0;
    const mapSection = cfg.show_map===false ? '' : hasRoute
      ? `<div id="map" style="height:${cfg.map_height};width:100%;"></div>`
      : `<div class="no-route">${t(hass,'no_route')}</div>`;

    this.shadowRoot.innerHTML = `
      <ha-card>
        <div class="card-header"><ha-icon icon="${activityIcon(activityType)}"></ha-icon><span>${cfg.title}</span></div>
        <div class="activity-name">${activityName}${typeLabel?' · '+typeLabel:''}</div>
        ${mapSection}${statsHtml}${powerHtml}${hrZonesHtml}${pwZonesHtml}
      </ha-card>
      <link rel="stylesheet" href="/garmin_connect/leaflet.css" />
      <style>
        ha-card{overflow:hidden}
        .card-header{display:flex;align-items:center;gap:8px;padding:12px 16px 0;font-size:14px;font-weight:500;color:var(--secondary-text-color);text-transform:uppercase;letter-spacing:.05em}
        .activity-name{padding:4px 16px 10px;font-size:16px;font-weight:600;color:var(--primary-text-color)}
        .no-route{height:${cfg.map_height};display:flex;align-items:center;justify-content:center;color:var(--secondary-text-color);font-size:14px}
        .section-title{padding:10px 16px 4px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--secondary-text-color);border-top:1px solid var(--divider-color)}
        .stats{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--divider-color)}
        .power-stats{grid-template-columns:repeat(3,1fr);border-top:none}
        .stat{display:flex;flex-direction:column;align-items:center;padding:12px 8px;border-right:1px solid var(--divider-color);border-bottom:1px solid var(--divider-color)}
        .stat:nth-child(4n){border-right:none}
        .power-stats .stat:nth-child(4n){border-right:1px solid var(--divider-color)}
        .power-stats .stat:nth-child(3n){border-right:none}
        .stat ha-icon{color:${color};--mdc-icon-size:20px;margin-bottom:4px}
        .value{font-size:13px;font-weight:600;color:var(--primary-text-color)}
        .label{font-size:11px;color:var(--secondary-text-color);margin-top:2px}
        .zones-wrap{padding:6px 16px 12px}
        .zone-bars{display:flex;height:12px;border-radius:6px;overflow:hidden;gap:2px;margin-bottom:8px}
        .zone-bar{border-radius:3px;min-width:2px}
        .zone-legend{display:flex;flex-direction:column;gap:4px}
        .zone-legend-item{display:flex;align-items:center;gap:6px;font-size:12px}
        .zone-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
        .zone-legend-label{flex:1;color:var(--secondary-text-color)}
        .zone-legend-val{font-weight:600}
        .zone-pct{font-weight:400;color:var(--secondary-text-color)}
      </style>`;

    if (cfg.show_map===false||!hasRoute) return;
    const coordinates = polylineData.filter(p=>p.lat!=null&&p.lon!=null).map(p=>[p.lat,p.lon]);
    if (!coordinates.length) return;
    if (!window.L) {
      if (this._initPending) return;
      this._initPending=true;
      const script=document.createElement('script'); script.src='/garmin_connect/leaflet.js';
      script.onload=()=>{this._initPending=false;this._initMapWhenReady(coordinates);};
      script.onerror=()=>{this._initPending=false;};
      document.head.appendChild(script);
    } else { this._initMapWhenReady(coordinates); }
  }

  _initMapWhenReady(coordinates, retries=0) {
    requestAnimationFrame(()=>{
      const el=this.shadowRoot.getElementById('map');
      if (!el||!window.L) return;
      if (el.offsetWidth===0||el.offsetHeight===0) { if(retries<10)this._initMapWhenReady(coordinates,retries+1); return; }
      this._initMap(coordinates);
    });
  }

  _initMap(coordinates) {
    const el=this.shadowRoot.getElementById('map');
    if (!el||!window.L) return;
    this._teardownMap();
    this._map=L.map(el,{zoomControl:true,scrollWheelZoom:false});
    this._addTileLayer();
    this._polyline=L.polyline(coordinates,{color:this._config.color,weight:this._config.weight,opacity:0.8}).addTo(this._map);
    setTimeout(()=>{ try{ if(this._map&&this._polyline){this._map.invalidateSize();this._map.fitBounds(this._polyline.getBounds(),{padding:[20,20]});}}catch(_e){ /* ignore */ }},50);
    L.circleMarker(coordinates[0],{radius:8,color:'#4CAF50',fillColor:'#4CAF50',fillOpacity:1}).addTo(this._map).bindPopup(t(hass,'start'));
    L.circleMarker(coordinates[coordinates.length-1],{radius:8,color:'#F44336',fillColor:'#F44336',fillOpacity:1}).addTo(this._map).bindPopup(t(hass,'end'));
  }

  async _fetchMapTilesToken() {
    if (!this._hass?.connection) return null;
    try { const r=await this._hass.connection.sendMessagePromise({type:'map_tiles/access_token'}); return typeof r?.token==='string'&&r.token?r.token:null; } catch(_e){return null;}
  }

  async _addTileLayer() {
    const targetMap=this._map; const token=await this._fetchMapTilesToken(); if(this._map!==targetMap)return;
    if (token) { this._tileLayer=L.tileLayer(MAP_TILES_RASTER_PATH,{attribution:OSM_ATTRIBUTION,maxZoom:19,token}).addTo(targetMap); this._scheduleTokenRefresh(); return; }
    const DirectTileLayer=L.TileLayer.extend({createTile(coords,done){const tile=document.createElement('img');tile.referrerPolicy='strict-origin-when-cross-origin';L.DomEvent.on(tile,'load',L.Util.bind(this._tileOnLoad,this,done,tile));L.DomEvent.on(tile,'error',L.Util.bind(this._tileOnError,this,done,tile));tile.alt='';tile.setAttribute('role','presentation');tile.src=this.getTileUrl(coords);return tile;}});
    this._tileLayer=new DirectTileLayer(OSM_DIRECT_URL,{attribution:OSM_ATTRIBUTION,maxZoom:19}).addTo(targetMap);
  }

  _scheduleTokenRefresh() {
    clearInterval(this._tokenRefreshInterval);
    this._tokenRefreshInterval=setInterval(async()=>{ const token=await this._fetchMapTilesToken(); if(token&&this._tileLayer){this._tileLayer.options.token=token;this._tileLayer.redraw();}},MAP_TILES_TOKEN_REFRESH_MS);
  }

  getCardSize() { return 8; }
  static getConfigElement() { return document.createElement('garmin-activity-card-editor'); }
  static getStubConfig() { return {entity:'sensor.garmin_connect_last_activity',title:'Laatste activiteit'}; }
}

if (!customElements.get('garmin-activity-card-editor')) customElements.define('garmin-activity-card-editor',GarminActivityCardEditor);
if (!customElements.get('garmin-activity-card')) {
  customElements.define('garmin-activity-card',GarminActivityCard);
  window.customCards=window.customCards||[];
  window.customCards.push({type:'garmin-activity-card',name:'Garmin Activity Card',description:'Toont de laatste Garmin activiteit met kaart, statistieken, vermogen en zones'});
  console.info('%c GARMIN-ACTIVITY-CARD %c loaded ','background:#2d5bff;color:white;','');
}
const SLEEP_COLORS = { deep:'#3a5fc8', light:'#6ec6f5', rem:'#9b59b6', awake:'#f4845f' };

const SLEEP_ENTITY_SUFFIXES = {
  sleep_score:'sleep_score', deep_sleep:'deep_sleep', light_sleep:'light_sleep',
  rem_sleep:'rem_sleep', awake_sleep:'awake_time', total_sleep_duration:'total_sleep_duration',
  bedtime:'bedtime', wake_time:'wake_time', hrv_last_night_avg:'hrv_last_night_average',
  avg_spo2:'average_spo2', avg_sleep_respiration:'average_sleep_respiration',
  body_battery_most_recent:'body_battery', resting_heart_rate:'resting_heart_rate',
};

function sleepEntityPrefix(entityId) {
  if (!entityId) return null;
  for (const suffix of Object.values(SLEEP_ENTITY_SUFFIXES)) {
    const m = entityId.match(new RegExp(`^(sensor\\.garmin_connect(?:_\\d+)?)_${suffix}$`));
    if (m) return m[1];
  }
  const m = entityId.match(/^(sensor\.garmin_connect(?:_\d+)?)_/);
  return m ? m[1] : null;
}

function sleepEntity(prefix, key) { return `${prefix}_${SLEEP_ENTITY_SUFFIXES[key]??key}`; }

function stagesHtml(deep, light, rem, awake) {
  const stages=[{label:t(hass,'deep_sleep'),val:deep,color:SLEEP_COLORS.deep},{label:t(hass,'light_sleep'),val:light,color:SLEEP_COLORS.light},{label:t(hass,'rem_sleep'),val:rem,color:SLEEP_COLORS.rem},{label:t(hass,'awake'),val:awake,color:SLEEP_COLORS.awake}].filter(s=>s.val>0);
  const total=stages.reduce((a,s)=>a+s.val,0);
  if (!total) return '';
  const bars=stages.map(s=>`<div class="stage-bar" style="flex:${s.val};background:${s.color}" title="${s.label}: ${fmtMinutes(s.val)}"></div>`).join('');
  const legend=stages.map(s=>`<div class="stage-legend-item"><span class="stage-dot" style="background:${s.color}"></span><span class="stage-label">${s.label}</span><span class="stage-val">${fmtMinutes(s.val)} <span class="stage-pct">${(s.val/total*100).toFixed(0)}%</span></span></div>`).join('');
  return `<div class="stage-bars">${bars}</div><div class="stage-legend">${legend}</div>`;
}


class GarminSleepCardEditor extends HTMLElement {
  constructor() { super(); this.attachShadow({mode:'open'}); this._config={}; this._hass=null; }
  set hass(hass) { this._hass=hass; const s=this.shadowRoot.getElementById('entity'); if(s)s.hass=hass; }
  setConfig(config) { this._config={...config}; this._render(); }

  _render() {
    const c=this._config;
    const v=(k,d)=>c[k]!==undefined?c[k]:d;
    const toggle=(id,label)=>`<div class="toggle-row"><span class="toggle-label">${label}</span><ha-switch id="${id}" ${v(id,true)?'checked':''}></ha-switch></div>`;

    this.shadowRoot.innerHTML = editorStyles() + `
      <div class="editor">
        <div><label>${t(this._hass,'entity_label')}</label><ha-selector id="entity"></ha-selector></div>
        <div class="field"><label>${t(this._hass,'title_label')}</label><input id="title" type="text" value="${v('title','Slaap')}" /></div>
        <div class="section-header">Secties</div>
        ${toggle('show_score',  'Score & tijden')}
        ${toggle('show_stages', t(this._hass,'show_stages'))}
        ${toggle('show_vitals', t(this._hass,'show_vitals'))}
      </div>`;

    const sel=this.shadowRoot.getElementById('entity');
    sel.hass=this._hass; sel.selector={entity:{integration:'garmin_connect',domain:'sensor'}}; sel.value=c.entity||''; sel.label='Entiteit';
    sel.addEventListener('value-changed',e=>{this._config={...this._config,entity:e.detail.value};this._fireChange();});
    this.shadowRoot.getElementById('title').addEventListener('input',e=>{this._config={...this._config,title:e.target.value};this._fireChange();});
    for (const id of ['show_score','show_stages','show_vitals']) {
      this.shadowRoot.getElementById(id).addEventListener('change',e=>{this._config={...this._config,[id]:e.target.checked};this._fireChange();});
    }
  }

  _fireChange() { this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:this._config}})); }
}

class GarminSleepCard extends HTMLElement {
  constructor() { super(); this.attachShadow({mode:'open'}); this._hass=null; this._config=null; this._lastKey=null; }

  setConfig(config) {
    if (!config.entity) throw new Error('entity is required');
    this._config={title:'Slaap',show_score:true,show_stages:true,show_vitals:true,...config};
  }

  set hass(hass) {
    this._hass=hass; if(!this._config)return;
    const prefix=sleepEntityPrefix(this._config.entity);
    const key=['sleep_score','deep_sleep','light_sleep','rem_sleep','awake_sleep','total_sleep_duration','bedtime','wake_time','hrv_last_night_avg','avg_spo2','avg_sleep_respiration','body_battery_most_recent','resting_heart_rate']
      .map(k=>hass.states[sleepEntity(prefix,k)]?.last_changed).join('|');
    if (key===this._lastKey) return;
    this._lastKey=key; this._render(prefix);
  }

  connectedCallback() { if(this._hass&&this._config){this._lastKey=null;this._render(sleepEntityPrefix(this._config.entity));} }

  _render(prefix) {
    const hass=this._hass;
    const cfg=this._config;
    const score      =stateNum(hass,sleepEntity(prefix,'sleep_score'));
    const deep       =stateNum(hass,sleepEntity(prefix,'deep_sleep'));
    const light      =stateNum(hass,sleepEntity(prefix,'light_sleep'));
    const rem        =stateNum(hass,sleepEntity(prefix,'rem_sleep'));
    const awake      =stateNum(hass,sleepEntity(prefix,'awake_sleep'));
    const totalSleep =stateNum(hass,sleepEntity(prefix,'total_sleep_duration'));
    const bedtime    =stateStr(hass,sleepEntity(prefix,'bedtime'));
    const wakeTime   =stateStr(hass,sleepEntity(prefix,'wake_time'));
    const hrv        =stateNum(hass,sleepEntity(prefix,'hrv_last_night_avg'));
    const spo2       =stateNum(hass,sleepEntity(prefix,'avg_spo2'));
    const resp       =stateNum(hass,sleepEntity(prefix,'avg_sleep_respiration'));
    const bb         =stateNum(hass,sleepEntity(prefix,'body_battery_most_recent'));
    const rhr        =stateNum(hass,sleepEntity(prefix,'resting_heart_rate'));

    const scoreSection = cfg.show_score!==false ? `
      <div class="top">
        ${score!=null?`<div class="score-ring" style="--score-color:${sleepScoreColor(score)}"><span class="score-val">${Math.round(score)}</span><span class="score-label">Slaapscore</span></div>`:''}
        <div class="times">
          <div class="time-item"><ha-icon icon="mdi:weather-night"></ha-icon><span class="time-val">${fmtTime(bedtime)}</span><span class="time-label">Slaaptijd</span></div>
          <div class="time-item total"><ha-icon icon="mdi:sleep"></ha-icon><span class="time-val">${fmtMinutes(totalSleep)}</span><span class="time-label">Totaal</span></div>
          <div class="time-item"><ha-icon icon="mdi:weather-sunny"></ha-icon><span class="time-val">${fmtTime(wakeTime)}</span><span class="time-label">Wektijd</span></div>
        </div>
      </div>` : '';

    const stages=stagesHtml(deep,light,rem,awake);
    const stagesSection = cfg.show_stages!==false && stages ? `
      <div class="section-title">${t(hass,'sleep_stages')}</div><div class="stages-wrap">${stages}</div>` : '';

    const vitals=[
      hrv !=null?{icon:'mdi:heart-pulse',     label:t(hass,'hrv'),         value:Math.round(hrv)+' ms'}:null,
      rhr !=null?{icon:'mdi:heart',           label:t(hass,'resting_hr'),      value:Math.round(rhr)+' bpm'}:null,
      spo2!=null?{icon:'mdi:blood-bag',       label:t(hass,'spo2'),         value:Math.round(spo2)+' %'}:null,
      resp!=null?{icon:'mdi:lungs',           label:t(hass,'respiration'),   value:resp.toFixed(1)+' /min'}:null,
      bb  !=null?{icon:'mdi:battery-charging',label:t(hass,'body_battery'), value:Math.round(bb)+' %'}:null,
    ].filter(Boolean);
    const vitalsSection = cfg.show_vitals!==false && vitals.length ? `
      <div class="section-title">${t(hass,'vitals')}</div>
      <div class="stats" style="grid-template-columns:repeat(${Math.min(vitals.length,3)},1fr)">
        ${vitals.map(s=>`<div class="stat"><ha-icon icon="${s.icon}"></ha-icon><span class="value">${s.value}</span><span class="label">${s.label}</span></div>`).join('')}
      </div>` : '';

    this.shadowRoot.innerHTML = `
      <ha-card>
        <div class="card-header"><ha-icon icon="mdi:sleep"></ha-icon><span>${cfg.title}</span></div>
        ${scoreSection}${stagesSection}${vitalsSection}
      </ha-card>
      <style>
        ha-card{overflow:hidden}
        .card-header{display:flex;align-items:center;gap:8px;padding:12px 16px 0;font-size:14px;font-weight:500;color:var(--secondary-text-color);text-transform:uppercase;letter-spacing:.05em}
        .top{display:flex;align-items:center;gap:16px;padding:12px 16px}
        .score-ring{flex-shrink:0;width:72px;height:72px;border-radius:50%;border:4px solid var(--score-color);display:flex;flex-direction:column;align-items:center;justify-content:center}
        .score-val{font-size:22px;font-weight:700;color:var(--score-color);line-height:1}
        .score-label{font-size:9px;color:var(--secondary-text-color);text-transform:uppercase}
        .times{display:flex;flex:1;justify-content:space-around}
        .time-item{display:flex;flex-direction:column;align-items:center;gap:2px}
        .time-item ha-icon{color:var(--secondary-text-color);--mdc-icon-size:18px}
        .time-val{font-size:15px;font-weight:600;color:var(--primary-text-color)}
        .time-item.total .time-val{font-size:17px;color:var(--primary-color)}
        .time-label{font-size:11px;color:var(--secondary-text-color)}
        .section-title{padding:6px 16px 4px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--secondary-text-color);border-top:1px solid var(--divider-color)}
        .stages-wrap{padding:6px 16px 12px}
        .stage-bars{display:flex;height:12px;border-radius:6px;overflow:hidden;gap:2px;margin-bottom:8px}
        .stage-bar{border-radius:3px;min-width:2px}
        .stage-legend{display:flex;flex-direction:column;gap:4px}
        .stage-legend-item{display:flex;align-items:center;gap:6px;font-size:12px}
        .stage-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
        .stage-label{flex:1;color:var(--secondary-text-color)}
        .stage-val{font-weight:600}
        .stage-pct{font-weight:400;color:var(--secondary-text-color)}
        .stats{display:grid;border-top:1px solid var(--divider-color)}
        .stat{display:flex;flex-direction:column;align-items:center;padding:12px 8px;border-right:1px solid var(--divider-color);border-bottom:1px solid var(--divider-color)}
        .stat:last-child{border-right:none}
        .stat ha-icon{color:var(--primary-color);--mdc-icon-size:20px;margin-bottom:4px}
        .value{font-size:13px;font-weight:600;color:var(--primary-text-color)}
        .label{font-size:11px;color:var(--secondary-text-color);margin-top:2px}
      </style>`;
  }

  getCardSize() { return 5; }
  static getConfigElement() { return document.createElement('garmin-sleep-card-editor'); }
  static getStubConfig() { return {entity:'sensor.garmin_connect_sleep_score',title:'Slaap'}; }
}

if (!customElements.get('garmin-sleep-card-editor')) customElements.define('garmin-sleep-card-editor',GarminSleepCardEditor);
if (!customElements.get('garmin-sleep-card')) {
  customElements.define('garmin-sleep-card',GarminSleepCard);
  window.customCards=window.customCards||[];
  window.customCards.push({type:'garmin-sleep-card',name:'Garmin Sleep Card',description:'Toont Garmin slaapdata: score, fasen, HRV, SpO2 en meer'});
  console.info('%c GARMIN-SLEEP-CARD %c loaded ','background:#3a5fc8;color:white;','');
}
const HRV_STATUS_NL = { balanced:'Gebalanceerd', low:'Laag', unbalanced:'Ongebalanceerd', poor:'Slecht', unknown:'Onbekend' };

const HRV_ENTITY_SUFFIXES = {
  hrv_status:'hrv_status', hrv_weekly_avg:'hrv_weekly_average',
  hrv_last_night_avg:'hrv_last_night_average', hrv_last_night_5min_high:'hrv_last_night_5_min_high',
  hrv_baseline:'hrv_baseline',
};

function hrvEntityPrefix(entityId) {
  if (!entityId) return null;
  for (const suffix of Object.values(HRV_ENTITY_SUFFIXES)) {
    const m=entityId.match(new RegExp(`^(sensor\\.garmin_connect(?:_\\d+)?)_${suffix}$`));
    if (m) return m[1];
  }
  const m=entityId.match(/^(sensor\.garmin_connect(?:_\d+)?)_/);
  return m?m[1]:null;
}

function hrvEntity(prefix, key) { return `${prefix}_${HRV_ENTITY_SUFFIXES[key]??key}`; }



class GarminHrvCardEditor extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});this._config={};this._hass=null;}
  set hass(hass){this._hass=hass;const s=this.shadowRoot.getElementById('entity');if(s)s.hass=hass;}
  setConfig(config){this._config={...config};this._render();}

  _render() {
    const c=this._config;
    const v=(k,d)=>c[k]!==undefined?c[k]:d;
    const toggle=(id,label)=>`<div class="toggle-row"><span class="toggle-label">${label}</span><ha-switch id="${id}" ${v(id,true)?'checked':''}></ha-switch></div>`;

    this.shadowRoot.innerHTML = editorStyles() + `
      <div class="editor">
        <div><label>${t(this._hass,'entity_label')}</label><ha-selector id="entity"></ha-selector></div>
        <div class="field"><label>${t(this._hass,'title_label')}</label><input id="title" type="text" value="${v('title',t(hass,'hrv'))}" /></div>
        <div class="field"><label>${t(this._hass,'history_days_label')}</label><input id="history_days" type="number" value="${v('history_days',30)}" min="7" max="90" /></div>
        <div class="section-header">Secties</div>
        ${toggle('show_status',  'Status & baseline')}
        ${toggle('show_stats',   'Statistieken')}
        ${toggle('show_history', t(this._hass,'show_history'))}
      </div>`;

    const sel=this.shadowRoot.getElementById('entity');
    sel.hass=this._hass; sel.selector={entity:{integration:'garmin_connect',domain:'sensor'}}; sel.value=c.entity||''; sel.label='Entiteit';
    sel.addEventListener('value-changed',e=>{this._config={...this._config,entity:e.detail.value};this._fireChange();});
    this.shadowRoot.getElementById('title').addEventListener('input',e=>{this._config={...this._config,title:e.target.value};this._fireChange();});
    this.shadowRoot.getElementById('history_days').addEventListener('input',e=>{this._config={...this._config,history_days:parseInt(e.target.value)};this._fireChange();});
    for (const id of ['show_status','show_stats','show_history']) {
      this.shadowRoot.getElementById(id).addEventListener('change',e=>{this._config={...this._config,[id]:e.target.checked};this._fireChange();});
    }
  }

  _fireChange(){this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:this._config}}));}
}

class GarminHrvCard extends HTMLElement {
  constructor(){super();this.attachShadow({mode:'open'});this._hass=null;this._config=null;this._lastKey=null;this._historyLoaded=false;this._historyPoints=[];}

  setConfig(config){
    if(!config.entity)throw new Error('entity is required');
    this._config={title:t(hass,'hrv'),history_days:30,show_status:true,show_stats:true,show_history:true,...config};
  }

  set hass(hass){
    this._hass=hass; if(!this._config)return;
    const prefix=hrvEntityPrefix(this._config.entity);
    const key=['hrv_status','hrv_last_night_avg','hrv_weekly_avg','hrv_last_night_5min_high','hrv_baseline']
      .map(k=>hass.states[hrvEntity(prefix,k)]?.last_changed).join('|');
    if(key===this._lastKey)return;
    this._lastKey=key;
    this._render(prefix);
    const historyEntity=hrvEntity(prefix,'hrv_last_night_avg');
    if(this._config.show_history!==false&&(!this._historyLoaded||this._lastHistoryEntity!==historyEntity)){
      this._lastHistoryEntity=historyEntity; this._historyLoaded=false; this._loadHistory(historyEntity,prefix);
    }
  }

  connectedCallback(){
    if(this._hass&&this._config){
      this._lastKey=null; this._historyLoaded=false;
      const prefix=hrvEntityPrefix(this._config.entity);
      this._render(prefix);
      if(this._config.show_history!==false) this._loadHistory(hrvEntity(prefix,'hrv_last_night_avg'),prefix);
    }
  }

  async _loadHistory(entityId, prefix) {
    if (!this._hass?.connection) return;
    this._historyPoints = await loadHistory(this._hass, entityId, this._config.history_days||30);
    this._historyLoaded = true;
    this._render(prefix);
  }


  _render(prefix){
    const hass=this._hass, cfg=this._config, color='#3a5fc8';
    const statusRaw   =stateStr(hass,hrvEntity(prefix,'hrv_status'));
    const lastNight   =stateNum(hass,hrvEntity(prefix,'hrv_last_night_avg'));
    const weeklyAvg   =stateNum(hass,hrvEntity(prefix,'hrv_weekly_avg'));
    const lastNight5  =stateNum(hass,hrvEntity(prefix,'hrv_last_night_5min_high'));
    const baselineEnt =hrvEntity(prefix,'hrv_baseline');
    const balancedLow =attrNum(hass,baselineEnt,'balancedLow');
    const balancedUpper=attrNum(hass,baselineEnt,'balancedUpper');
    const lowUpper    =stateNum(hass,baselineEnt);
    const statusNl    =HRV_STATUS_NL[statusRaw?.toLowerCase()]??statusRaw??'—';
    const sColor      =statusColor(statusRaw);

    const statusSection = cfg.show_status!==false ? `
      <div class="top">
        <div class="status-badge" style="--s-color:${sColor}"><span class="status-val">${statusNl}</span><span class="status-sub">HRV Status</span></div>
        ${balancedLow!=null&&balancedUpper!=null?`<div class="baseline"><span class="baseline-label">Baseline</span><span class="baseline-range" style="color:${color}">${Math.round(balancedLow)}–${Math.round(balancedUpper)} ms</span>${lowUpper!=null?`<span class="baseline-low">min: ${Math.round(lowUpper)} ms</span>`:''}</div>`:''}
      </div>` : '';

    const statsSection = cfg.show_stats!==false ? `
      <div class="stats">
        <div class="stat"><ha-icon icon="mdi:sleep"></ha-icon><span class="value">${lastNight!=null?Math.round(lastNight)+' ms':'—'}</span><span class="label">Afgelopen nacht</span></div>
        <div class="stat"><ha-icon icon="mdi:chart-line"></ha-icon><span class="value">${weeklyAvg!=null?Math.round(weeklyAvg)+' ms':'—'}</span><span class="label">Weekgemiddelde</span></div>
        <div class="stat"><ha-icon icon="mdi:arrow-up-bold"></ha-icon><span class="value">${lastNight5!=null?Math.round(lastNight5)+' ms':'—'}</span><span class="label">5-min piek</span></div>
      </div>` : '';

    const historySection = cfg.show_history!==false ? `
      <div class="section-title">Historiek (${cfg.history_days} dagen)</div>
      <div class="chart-wrap">${buildLineChart(this._historyPoints,color,{refLines:[{type:"zone",y1:balancedLow??0,y2:balancedUpper??0,color:"#6bcb77"},{type:"zone",y1:lowUpper??0,y2:balancedLow??0,color:"#ffd166"},{type:"line",value:balancedUpper,color:"#6bcb77"},{type:"line",value:balancedLow,color:"#6bcb77"},{type:"line",value:lowUpper,color:"#ffd166"}]},`<div class="no-history">${t(hass,'no_history')}</div>`)}</div>` : '';

    this.shadowRoot.innerHTML = `
      <ha-card>
        <div class="card-header"><ha-icon icon="mdi:heart-pulse"></ha-icon><span>${cfg.title}</span></div>
        ${statusSection}${statsSection}${historySection}
      </ha-card>
      <style>
        ha-card{overflow:hidden}
        .card-header{display:flex;align-items:center;gap:8px;padding:12px 16px 0;font-size:14px;font-weight:500;color:var(--secondary-text-color);text-transform:uppercase;letter-spacing:.05em}
        .top{display:flex;align-items:center;justify-content:space-between;padding:12px 16px}
        .status-badge{display:flex;flex-direction:column;align-items:center;background:color-mix(in srgb,var(--s-color) 15%,transparent);border:2px solid var(--s-color);border-radius:10px;padding:8px 20px}
        .status-val{font-size:18px;font-weight:700;color:var(--s-color)}
        .status-sub{font-size:10px;color:var(--secondary-text-color);text-transform:uppercase}
        .baseline{display:flex;flex-direction:column;align-items:flex-end;gap:2px}
        .baseline-label{font-size:11px;color:var(--secondary-text-color);text-transform:uppercase}
        .baseline-range{font-size:16px;font-weight:600}
        .baseline-low{font-size:11px;color:var(--secondary-text-color)}
        .stats{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--divider-color)}
        .stat{display:flex;flex-direction:column;align-items:center;padding:12px 8px;border-right:1px solid var(--divider-color);border-bottom:1px solid var(--divider-color)}
        .stat:last-child{border-right:none}
        .stat ha-icon{color:${color};--mdc-icon-size:20px;margin-bottom:4px}
        .value{font-size:13px;font-weight:600;color:var(--primary-text-color)}
        .label{font-size:11px;color:var(--secondary-text-color);margin-top:2px}
        .section-title{padding:8px 16px 4px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--secondary-text-color);border-top:1px solid var(--divider-color)}
        .chart-wrap{padding:4px 12px 12px}
        .no-history{padding:16px;text-align:center;color:var(--secondary-text-color);font-size:13px}
      </style>`;
  }

  getCardSize(){return 6;}
  static getConfigElement(){return document.createElement('garmin-hrv-card-editor');}
  static getStubConfig(){return{entity:'sensor.garmin_connect_hrv_status',title:t(hass,'hrv')};}
}

if(!customElements.get('garmin-hrv-card-editor'))customElements.define('garmin-hrv-card-editor',GarminHrvCardEditor);
if(!customElements.get('garmin-hrv-card')){
  customElements.define('garmin-hrv-card',GarminHrvCard);
  window.customCards=window.customCards||[];
  window.customCards.push({type:'garmin-hrv-card',name:'Garmin HRV Card',description:'Toont HRV status, baseline en historiek'});
  console.info('%c GARMIN-HRV-CARD %c loaded ','background:#3a5fc8;color:white;','');
}
const TRAINING_ENTITY_SUFFIXES = {
  training_readiness:        'training_readiness',
  morning_readiness:         'morning_training_readiness',
  recovery_time:             'recovery_time',
  training_status:           'training_status',
  vo2max:                    'vo2_max',
  vo2max_cycling:            'vo2_max_cycling',
  endurance_score:           'endurance_score',
  hill_score:                'hill_score',
  hrv_status:                'hrv_status',
  lactate_hr:                'lactate_threshold_heart_rate',
};

const TRAINING_STATUS_NL = {
  'peaking':        'Piekfase',
  'productive':     'Productief',
  'maintaining':    'Onderhoud',
  'recovery':       'Herstel',
  'unproductive':   'Onproductief',
  'strained':       'Overbelast',
  'detraining':     'Detraining',
  'no status':      'Geen status',
  'unknown':        'Onbekend',
  'overreaching':   'Overbelast',
  'base':           'Basisopbouw',
};

function trainingEntityPrefix(entityId) {
  if (!entityId) return null;
  for (const suffix of Object.values(TRAINING_ENTITY_SUFFIXES)) {
    const m = entityId.match(new RegExp(`^(sensor\\.garmin_connect(?:_\\d+)?)_${suffix}$`));
    if (m) return m[1];
  }
  const m = entityId.match(/^(sensor\.garmin_connect(?:_\d+)?)_/);
  return m ? m[1] : null;
}

function te(prefix, key) { return `${prefix}_${TRAINING_ENTITY_SUFFIXES[key] ?? key}`; }




const READINESS_LEVEL_NL = {
  'excellent':    'Uitstekend',
  'good':         'Goed',
  'moderate':     t(hass,'moderate'),
  'low':          'Laag',
  'poor':         'Slecht',
  'recovery':     'Herstel',
  'high':         'Hoog',
};

function fmtRecovery(hours) {
  if (hours == null) return '—';
  const d = Math.floor(hours / 24), h = Math.round(hours % 24);
  return d > 0 ? `${d}d ${h}u` : `${hours.toFixed(1)}u`;
}

function translateLevel(level) {
  if (!level) return null;
  return READINESS_LEVEL_NL[level.toLowerCase()] ?? level;
}

function scoreRing(value, max, label, color) {
  const pct = Math.min(1, (value ?? 0) / max);
  const r = 28, cx = 34, cy = 34, stroke = 5;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  return `
    <div class="ring-wrap">
      <svg width="68" height="68" viewBox="0 0 68 68">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--divider-color)" stroke-width="${stroke}"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
          stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"
          stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>
        <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central"
          font-size="14" font-weight="700" fill="${color}">${value != null ? Math.round(value) : '—'}</text>
      </svg>
      <span class="ring-label">${label}</span>
    </div>`;
}


class GarminTrainingCardEditor extends HTMLElement {
  constructor() { super(); this.attachShadow({mode:'open'}); this._config={}; this._hass=null; }
  set hass(hass) { this._hass=hass; const s=this.shadowRoot.getElementById('entity'); if(s)s.hass=hass; }
  setConfig(config) { this._config={...config}; this._render(); }

  _render() {
    const c=this._config, v=(k,d)=>c[k]!==undefined?c[k]:d;
    const toggle=(id,label)=>`<div class="toggle-row"><span class="toggle-label">${label}</span><ha-switch id="${id}" ${v(id,true)?'checked':''}></ha-switch></div>`;
    this.shadowRoot.innerHTML = editorStyles() + `
      <div class="editor">
        <div><label>${t(this._hass,'entity_label')}</label><ha-selector id="entity"></ha-selector></div>
        <div class="field"><label>${t(this._hass,'title_label')}</label><input id="title" type="text" value="${v('title','Training')}" /></div>
        <div class="section-header">Secties</div>
        ${toggle('show_readiness', t(this._hass,'show_readiness'))}
        ${toggle('show_vo2max',    'VO2max')}
        ${toggle('show_status',    'Trainingsstatus')}
        ${toggle('show_scores',    'Scores (uithoudingsvermogen, heuvel)')}
      </div>`;

    const sel=this.shadowRoot.getElementById('entity');
    sel.hass=this._hass; sel.selector={entity:{integration:'garmin_connect',domain:'sensor'}}; sel.value=c.entity||''; sel.label='Entiteit';
    sel.addEventListener('value-changed',e=>{this._config={...this._config,entity:e.detail.value};this._fireChange();});
    this.shadowRoot.getElementById('title').addEventListener('input',e=>{this._config={...this._config,title:e.target.value};this._fireChange();});
    for (const id of ['show_readiness','show_vo2max','show_status','show_scores']) {
      this.shadowRoot.getElementById(id).addEventListener('change',e=>{this._config={...this._config,[id]:e.target.checked};this._fireChange();});
    }
  }
  _fireChange() { this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:this._config}})); }
}

class GarminTrainingCard extends HTMLElement {
  constructor() { super(); this.attachShadow({mode:'open'}); this._hass=null; this._config=null; this._lastKey=null; }

  setConfig(config) {
    if (!config.entity) throw new Error('entity is required');
    this._config={title:'Training',show_readiness:true,show_vo2max:true,show_status:true,show_scores:true,...config};
  }

  set hass(hass) {
    this._hass=hass; if(!this._config)return;
    const prefix=trainingEntityPrefix(this._config.entity);
    const key=Object.keys(TRAINING_ENTITY_SUFFIXES).map(k=>hass.states[te(prefix,k)]?.last_changed).join('|');
    if (key===this._lastKey) return;
    this._lastKey=key; this._render(prefix);
  }

  connectedCallback() { if(this._hass&&this._config){this._lastKey=null;this._render(trainingEntityPrefix(this._config.entity));} }

  _render(prefix) {
    const hass=this._hass, cfg=this._config;

    const readiness       = stateNum(hass, te(prefix,'training_readiness'));
    const readinessLevel  = attrVal(hass, te(prefix,'training_readiness'), 'level');
    const morningReady    = stateNum(hass, te(prefix,'morning_readiness'));
    // morningLevel reserved for future use
    const recoveryHours   = stateNum(hass, te(prefix,'recovery_time'));
    const statusRaw       = stateStr(hass, te(prefix,'training_status'));
    const statusNl        = TRAINING_STATUS_NL[statusRaw?.toLowerCase()] ?? (statusRaw ? statusRaw.charAt(0).toUpperCase()+statusRaw.slice(1) : '—');
    const vo2max          = stateNum(hass, te(prefix,'vo2max'));
    const vo2maxCycling   = stateNum(hass, te(prefix,'vo2max_cycling'));
    const endurance       = stateNum(hass, te(prefix,'endurance_score'));
    const hill            = stateNum(hass, te(prefix,'hill_score'));
    const lactateHR       = stateNum(hass, te(prefix,'lactate_hr'));

    const readinessSection = cfg.show_readiness !== false ? `
      <div class="section-title">${t(hass,'training_readiness')}</div>
      <div class="rings-row">
        ${scoreRing(readiness, 100, t(hass,'readiness'), scoreColor(readiness, 100))}
        ${scoreRing(morningReady, 100, t(hass,'morning'), scoreColor(morningReady, 100))}
        <div class="recovery-block">
          <span class="recovery-val">${fmtRecovery(recoveryHours)}</span>
          <span class="recovery-label">Hersteltijd</span>
          ${readinessLevel ? `<span class="level-badge">${translateLevel(readinessLevel)}</span>` : ''}
        </div>
      </div>` : '';

    const vo2maxSection = cfg.show_vo2max !== false ? `
      <div class="section-title">${t(hass,'vo2max')}</div>
      <div class="stats">
        <div class="stat">
          <ha-icon icon="mdi:run"></ha-icon>
          <span class="value">${vo2max != null ? vo2max.toFixed(1) : '—'}</span>
          <span class="label">Lopen</span>
        </div>
        <div class="stat">
          <ha-icon icon="mdi:bike"></ha-icon>
          <span class="value">${vo2maxCycling != null ? vo2maxCycling.toFixed(1) : '—'}</span>
          <span class="label">Fietsen</span>
        </div>
        ${lactateHR != null ? `<div class="stat">
          <ha-icon icon="mdi:heart-pulse"></ha-icon>
          <span class="value">${Math.round(lactateHR)} bpm</span>
          <span class="label">Lactaatdrempel</span>
        </div>` : ''}
      </div>` : '';

    const sColor = statusColor(statusRaw);
    const statusSection = cfg.show_status !== false ? `
      <div class="section-title">${t(hass,'training_status')}</div>
      <div class="status-row">
        <div class="status-badge" style="--s-color:${sColor}">
          <span class="status-val">${statusNl}</span>
        </div>
      </div>` : '';

    const scoresSection = cfg.show_scores !== false && (endurance != null || hill != null) ? `
      <div class="section-title">${t(hass,'scores')}</div>
      <div class="stats">
        ${endurance != null ? `<div class="stat">
          <ha-icon icon="mdi:run-fast"></ha-icon>
          <span class="value">${Math.round(endurance)}</span>
          <span class="label">Uithoudingsvermogen</span>
        </div>` : ''}
        ${hill != null ? `<div class="stat">
          <ha-icon icon="mdi:slope-uphill"></ha-icon>
          <span class="value">${Math.round(hill)}</span>
          <span class="label">Heuvel score</span>
        </div>` : ''}
      </div>` : '';

    this.shadowRoot.innerHTML = `
      <ha-card>
        <div class="card-header"><ha-icon icon="mdi:trophy-outline"></ha-icon><span>${cfg.title}</span></div>
        ${readinessSection}${vo2maxSection}${statusSection}${scoresSection}
      </ha-card>
      <style>
        ha-card{overflow:hidden}
        .card-header{display:flex;align-items:center;gap:8px;padding:12px 16px 0;font-size:14px;font-weight:500;color:var(--secondary-text-color);text-transform:uppercase;letter-spacing:.05em}
        .section-title{padding:8px 16px 4px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--secondary-text-color);border-top:1px solid var(--divider-color)}
        .rings-row{display:flex;align-items:center;gap:8px;padding:8px 16px 12px}
        .ring-wrap{display:flex;flex-direction:column;align-items:center;gap:2px}
        .ring-label{font-size:11px;color:var(--secondary-text-color)}
        .recovery-block{display:flex;flex-direction:column;align-items:center;gap:4px;margin-left:8px}
        .recovery-val{font-size:20px;font-weight:700;color:var(--primary-text-color)}
        .recovery-label{font-size:11px;color:var(--secondary-text-color)}
        .level-badge{font-size:11px;padding:2px 8px;border-radius:10px;background:var(--primary-color);color:var(--text-primary-color)}
        .stats{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--divider-color)}
        .stat{display:flex;flex-direction:column;align-items:center;padding:12px 8px;border-right:1px solid var(--divider-color);border-bottom:1px solid var(--divider-color)}
        .stat:last-child{border-right:none}
        .stat ha-icon{color:var(--primary-color);--mdc-icon-size:20px;margin-bottom:4px}
        .value{font-size:13px;font-weight:600;color:var(--primary-text-color)}
        .label{font-size:11px;color:var(--secondary-text-color);margin-top:2px}
        .status-row{padding:8px 16px 12px}
        .status-badge{display:inline-flex;align-items:center;background:color-mix(in srgb,var(--s-color) 15%,transparent);border:2px solid var(--s-color);border-radius:10px;padding:6px 20px}
        .status-val{font-size:16px;font-weight:700;color:var(--s-color)}
      </style>`;
  }

  getCardSize() { return 6; }
  static getConfigElement() { return document.createElement('garmin-training-card-editor'); }
  static getStubConfig() { return {entity:'sensor.garmin_connect_training_readiness',title:'Training'}; }
}

if (!customElements.get('garmin-training-card-editor')) customElements.define('garmin-training-card-editor',GarminTrainingCardEditor);
if (!customElements.get('garmin-training-card')) {
  customElements.define('garmin-training-card',GarminTrainingCard);
  window.customCards=window.customCards||[];
  window.customCards.push({type:'garmin-training-card',name:'Garmin Training Card',description:'Trainingsgereedheid, VO2max, status en scores'});
  console.info('%c GARMIN-TRAINING-CARD %c loaded ','background:#2d5bff;color:white;','');
}
const BODY_ENTITY_SUFFIXES = {
  body_battery:        'body_battery',
  body_battery_high:   'body_battery_highest',
  body_battery_low:    'body_battery_lowest',
  body_battery_charged:'body_battery_charged',
  body_battery_drained:'body_battery_drained',
  weight:              'weight',
  bmi:                 'bmi',
  body_fat:            'body_fat',
  body_water:          'body_water',
  muscle_mass:         'muscle_mass',
  bone_mass:           'bone_mass',
  fitness_age:         'fitness_age',
  achievable_age:      'achievable_fitness_age',
  chronological_age:   'chronological_age',
  metabolic_age:       'metabolic_age',
};

function bodyEntityPrefix(entityId) {
  if (!entityId) return null;
  for (const suffix of Object.values(BODY_ENTITY_SUFFIXES)) {
    const m = entityId.match(new RegExp(`^(sensor\\.garmin_connect(?:_\\d+)?)_${suffix}$`));
    if (m) return m[1];
  }
  const m = entityId.match(/^(sensor\.garmin_connect(?:_\d+)?)_/);
  return m ? m[1] : null;
}

function be(prefix, key) { return `${prefix}_${BODY_ENTITY_SUFFIXES[key] ?? key}`; }





class GarminBodyCardEditor extends HTMLElement {
  constructor() { super(); this.attachShadow({mode:'open'}); this._config={}; this._hass=null; }
  set hass(hass) { this._hass=hass; const s=this.shadowRoot.getElementById('entity'); if(s)s.hass=hass; }
  setConfig(config) { this._config={...config}; this._render(); }

  _render() {
    const c=this._config, v=(k,d)=>c[k]!==undefined?c[k]:d;
    const toggle=(id,label)=>`<div class="toggle-row"><span class="toggle-label">${label}</span><ha-switch id="${id}" ${v(id,true)?'checked':''}></ha-switch></div>`;
    this.shadowRoot.innerHTML = editorStyles() + `
      <div class="editor">
        <div><label>${t(this._hass,'entity_label')}</label><ha-selector id="entity"></ha-selector></div>
        <div class="field"><label>${t(this._hass,'title_label')}</label><input id="title" type="text" value="${v('title','Lichaam')}" /></div>
        <div class="field"><label>Historiek body battery (dagen)</label><input id="history_days" type="number" value="${v('history_days',14)}" min="7" max="90" /></div>
        <div class="section-header">Secties</div>
        ${toggle('show_body_battery', t(this._hass,'show_body_battery'))}
        ${toggle('show_composition',  'Lichaamssamenstelling')}
        ${toggle('show_fitness_age',  'Fitnessleeftijd')}
      </div>`;

    const sel=this.shadowRoot.getElementById('entity');
    sel.hass=this._hass; sel.selector={entity:{integration:'garmin_connect',domain:'sensor'}}; sel.value=c.entity||''; sel.label='Entiteit';
    sel.addEventListener('value-changed',e=>{this._config={...this._config,entity:e.detail.value};this._fireChange();});
    this.shadowRoot.getElementById('title').addEventListener('input',e=>{this._config={...this._config,title:e.target.value};this._fireChange();});
    this.shadowRoot.getElementById('history_days').addEventListener('input',e=>{this._config={...this._config,history_days:parseInt(e.target.value)};this._fireChange();});
    for (const id of ['show_body_battery','show_composition','show_fitness_age']) {
      this.shadowRoot.getElementById(id).addEventListener('change',e=>{this._config={...this._config,[id]:e.target.checked};this._fireChange();});
    }
  }
  _fireChange() { this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:this._config}})); }
}

class GarminBodyCard extends HTMLElement {
  constructor() { super(); this.attachShadow({mode:'open'}); this._hass=null; this._config=null; this._lastKey=null; this._historyLoaded=false; this._historyPoints=[]; }

  setConfig(config) {
    if (!config.entity) throw new Error('entity is required');
    this._config={title:'Lichaam',history_days:14,show_body_battery:true,show_composition:true,show_fitness_age:true,...config};
  }

  set hass(hass) {
    this._hass=hass; if(!this._config)return;
    const prefix=bodyEntityPrefix(this._config.entity);
    const key=Object.keys(BODY_ENTITY_SUFFIXES).map(k=>hass.states[be(prefix,k)]?.last_changed).join('|');
    if (key===this._lastKey) return;
    this._lastKey=key;
    this._render(prefix);
    const histEnt=be(prefix,'body_battery');
    if (this._config.show_body_battery!==false&&(!this._historyLoaded||this._lastHistEnt!==histEnt)) {
      this._lastHistEnt=histEnt; this._historyLoaded=false; this._loadHistory(histEnt,prefix);
    }
  }

  connectedCallback() {
    if (this._hass&&this._config) {
      this._lastKey=null; this._historyLoaded=false;
      const prefix=bodyEntityPrefix(this._config.entity);
      this._render(prefix);
      if (this._config.show_body_battery!==false) this._loadHistory(be(prefix,'body_battery'),prefix);
    }
  }

  async _loadHistory(entityId, prefix) {
    if (!this._hass?.connection) return;
    this._historyPoints = await loadHistory(this._hass, entityId, this._config.history_days||30);
    this._historyLoaded = true;
    this._render(prefix);
  }


  _render(prefix) {
    const hass=this._hass, cfg=this._config;
    const bb       = stateNum(hass, be(prefix,'body_battery'));
    const bbHigh   = stateNum(hass, be(prefix,'body_battery_high'));
    const bbLow    = stateNum(hass, be(prefix,'body_battery_low'));
    const bbCharged= stateNum(hass, be(prefix,'body_battery_charged'));
    const bbDrained= stateNum(hass, be(prefix,'body_battery_drained'));
    const weight   = stateNum(hass, be(prefix,'weight'));
    const bmi      = stateNum(hass, be(prefix,'bmi'));
    const fat      = stateNum(hass, be(prefix,'body_fat'));
    const water    = stateNum(hass, be(prefix,'body_water'));
    const muscle   = stateNum(hass, be(prefix,'muscle_mass'));
    const bone     = stateNum(hass, be(prefix,'bone_mass'));
    const fitAge   = stateNum(hass, be(prefix,'fitness_age'));
    const achAge   = stateNum(hass, be(prefix,'achievable_age'));
    const chronAge = stateNum(hass, be(prefix,'chronological_age'));
    const metaAge  = stateNum(hass, be(prefix,'metabolic_age'));

    const bbColor = batteryColor(bb);

    const bbSection = cfg.show_body_battery !== false ? `
      <div class="section-title">${t(hass,'body_battery')}</div>
      <div class="bb-top">
        <div class="bb-current">
          <ha-icon icon="${batteryIcon(bb)}" style="color:${bbColor};--mdc-icon-size:36px"></ha-icon>
          <span class="bb-val" style="color:${bbColor}">${bb != null ? Math.round(bb) : '—'}%</span>
        </div>
        <div class="bb-stats">
          ${bbHigh   != null ? `<div class="bb-stat"><span class="bb-stat-val">${Math.round(bbHigh)}%</span><span class="bb-stat-label">Hoogste</span></div>` : ''}
          ${bbLow    != null ? `<div class="bb-stat"><span class="bb-stat-val">${Math.round(bbLow)}%</span><span class="bb-stat-label">Laagste</span></div>` : ''}
          ${bbCharged!= null ? `<div class="bb-stat"><span class="bb-stat-val" style="color:#6bcb77">+${Math.round(bbCharged)}%</span><span class="bb-stat-label">Opgeladen</span></div>` : ''}
          ${bbDrained!= null ? `<div class="bb-stat"><span class="bb-stat-val" style="color:#f4845f">-${Math.round(bbDrained)}%</span><span class="bb-stat-label">Verbruikt</span></div>` : ''}
        </div>
      </div>
      <div class="chart-wrap">${buildLineChart(this._historyPoints,bbColor,{minY:0,maxY:100,H:80},`<div class="no-history">${t(hass,'no_history')}</div>`)}</div>` : '';

    const compItems = [
      weight  != null ? {icon:'mdi:scale',      label:t(hass,'weight'),    value:weight.toFixed(1)+' kg'} : null,
      bmi     != null ? {icon:'mdi:human',       label:t(hass,'bmi'),        value:bmi.toFixed(1)} : null,
      fat     != null ? {icon:'mdi:water',       label:t(hass,'body_fat'), value:fat.toFixed(1)+'%'} : null,
      water   != null ? {icon:'mdi:water-outline',label:t(hass,'body_water'),value:water.toFixed(1)+'%'} : null,
      muscle  != null ? {icon:'mdi:arm-flex',    label:t(hass,'muscle_mass'), value:muscle.toFixed(1)+' kg'} : null,
      bone    != null ? {icon:'mdi:bone',        label:t(hass,'bone_mass'),   value:bone.toFixed(1)+' kg'} : null,
    ].filter(Boolean);

    const compSection = cfg.show_composition !== false && compItems.length ? `
      <div class="section-title">${t(hass,'composition')}</div>
      <div class="stats" style="grid-template-columns:repeat(${Math.min(compItems.length,3)},1fr)">
        ${compItems.map(s=>`<div class="stat"><ha-icon icon="${s.icon}"></ha-icon><span class="value">${s.value}</span><span class="label">${s.label}</span></div>`).join('')}
      </div>` : '';

    const ageSection = cfg.show_fitness_age !== false && fitAge != null ? `
      <div class="section-title">${t(hass,'fitness_age')}</div>
      <div class="age-row">
        <div class="age-item">
          <span class="age-val" style="color:${fitAge <= (chronAge??99) ? '#6bcb77' : '#f4845f'}">${fitAge.toFixed(1)}</span>
          <span class="age-label">Fitnessleeftijd</span>
        </div>
        ${achAge   != null ? `<div class="age-item"><span class="age-val" style="color:#6bcb77">${achAge.toFixed(1)}</span><span class="age-label">Haalbaar</span></div>` : ''}
        ${chronAge != null ? `<div class="age-item"><span class="age-val">${Math.round(chronAge)}</span><span class="age-label">Kalenderleeftijd</span></div>` : ''}
        ${metaAge  != null ? `<div class="age-item"><span class="age-val">${Math.round(metaAge)}</span><span class="age-label">Metabolische leeftijd</span></div>` : ''}
      </div>` : '';

    this.shadowRoot.innerHTML = `
      <ha-card>
        <div class="card-header"><ha-icon icon="mdi:human"></ha-icon><span>${cfg.title}</span></div>
        ${bbSection}${compSection}${ageSection}
      </ha-card>
      <style>
        ha-card{overflow:hidden}
        .card-header{display:flex;align-items:center;gap:8px;padding:12px 16px 0;font-size:14px;font-weight:500;color:var(--secondary-text-color);text-transform:uppercase;letter-spacing:.05em}
        .section-title{padding:8px 16px 4px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--secondary-text-color);border-top:1px solid var(--divider-color)}
        .bb-top{display:flex;align-items:center;gap:16px;padding:8px 16px 4px}
        .bb-current{display:flex;align-items:center;gap:6px}
        .bb-val{font-size:28px;font-weight:700}
        .bb-stats{display:flex;gap:12px;flex-wrap:wrap}
        .bb-stat{display:flex;flex-direction:column;align-items:center}
        .bb-stat-val{font-size:14px;font-weight:600;color:var(--primary-text-color)}
        .bb-stat-label{font-size:10px;color:var(--secondary-text-color)}
        .chart-wrap{padding:4px 12px 8px}
        .no-history{padding:12px;text-align:center;color:var(--secondary-text-color);font-size:13px}
        .stats{display:grid;border-top:1px solid var(--divider-color)}
        .stat{display:flex;flex-direction:column;align-items:center;padding:12px 8px;border-right:1px solid var(--divider-color);border-bottom:1px solid var(--divider-color)}
        .stat:last-child{border-right:none}
        .stat ha-icon{color:var(--primary-color);--mdc-icon-size:20px;margin-bottom:4px}
        .value{font-size:13px;font-weight:600;color:var(--primary-text-color)}
        .label{font-size:11px;color:var(--secondary-text-color);margin-top:2px}
        .age-row{display:flex;justify-content:space-around;padding:8px 16px 12px}
        .age-item{display:flex;flex-direction:column;align-items:center;gap:2px}
        .age-val{font-size:22px;font-weight:700;color:var(--primary-text-color)}
        .age-label{font-size:11px;color:var(--secondary-text-color)}
      </style>`;
  }

  getCardSize() { return 6; }
  static getConfigElement() { return document.createElement('garmin-body-card-editor'); }
  static getStubConfig() { return {entity:'sensor.garmin_connect_body_battery',title:'Lichaam'}; }
}

if (!customElements.get('garmin-body-card-editor')) customElements.define('garmin-body-card-editor',GarminBodyCardEditor);
if (!customElements.get('garmin-body-card')) {
  customElements.define('garmin-body-card',GarminBodyCard);
  window.customCards=window.customCards||[];
  window.customCards.push({type:'garmin-body-card',name:'Garmin Body Card',description:'Body battery, lichaamssamenstelling en fitnessleeftijd'});
  console.info('%c GARMIN-BODY-CARD %c loaded ','background:#6bcb77;color:white;','');
}
const SUMMARY_ENTITY_SUFFIXES = {
  steps:              'steps',
  step_goal:          'daily_step_goal',
  yesterday_steps:    'yesterday_steps',
  intensity:          'intensity_minutes',
  intensity_goal:     'intensity_minutes_goal',
  moderate:           'moderate_intensity_minutes',
  vigorous:           'vigorous_intensity_minutes',
  active_calories:    'active_calories',
  total_calories:     'calories',
  bmr_calories:       'bmr_calories',
  active_time:        'active_time',
  sedentary_time:     'sedentary_time',
  distance:           'distance',
};

function summaryEntityPrefix(entityId) {
  if (!entityId) return null;
  for (const suffix of Object.values(SUMMARY_ENTITY_SUFFIXES)) {
    const m = entityId.match(new RegExp(`^(sensor\\.garmin_connect(?:_\\d+)?)_${suffix}$`));
    if (m) return m[1];
  }
  const m = entityId.match(/^(sensor\.garmin_connect(?:_\d+)?)_/);
  return m ? m[1] : null;
}

function se(prefix, key) { return `${prefix}_${SUMMARY_ENTITY_SUFFIXES[key] ?? key}`; }



class GarminActivitySummaryCardEditor extends HTMLElement {
  constructor() { super(); this.attachShadow({mode:'open'}); this._config={}; this._hass=null; }
  set hass(hass) { this._hass=hass; const s=this.shadowRoot.getElementById('entity'); if(s)s.hass=hass; }
  setConfig(config) { this._config={...config}; this._render(); }

  _render() {
    const c=this._config, v=(k,d)=>c[k]!==undefined?c[k]:d;
    const toggle=(id,label)=>`<div class="toggle-row"><span class="toggle-label">${label}</span><ha-switch id="${id}" ${v(id,true)?'checked':''}></ha-switch></div>`;
    this.shadowRoot.innerHTML = editorStyles() + `
      <div class="editor">
        <div><label>${t(this._hass,'entity_label')}</label><ha-selector id="entity"></ha-selector></div>
        <div class="field"><label>${t(this._hass,'title_label')}</label><input id="title" type="text" value="${v('title','Dagelijkse activiteit')}" /></div>
        <div class="section-header">Secties</div>
        ${toggle('show_steps',     'Stappen')}
        ${toggle('show_intensity', t(this._hass,'show_intensity'))}
        ${toggle('show_calories',  'Calorieën & activiteit')}
      </div>`;

    const sel=this.shadowRoot.getElementById('entity');
    sel.hass=this._hass; sel.selector={entity:{integration:'garmin_connect',domain:'sensor'}}; sel.value=c.entity||''; sel.label='Entiteit';
    sel.addEventListener('value-changed',e=>{this._config={...this._config,entity:e.detail.value};this._fireChange();});
    this.shadowRoot.getElementById('title').addEventListener('input',e=>{this._config={...this._config,title:e.target.value};this._fireChange();});
    for (const id of ['show_steps','show_intensity','show_calories']) {
      this.shadowRoot.getElementById(id).addEventListener('change',e=>{this._config={...this._config,[id]:e.target.checked};this._fireChange();});
    }
  }
  _fireChange() { this.dispatchEvent(new CustomEvent('config-changed',{detail:{config:this._config}})); }
}

class GarminActivitySummaryCard extends HTMLElement {
  constructor() { super(); this.attachShadow({mode:'open'}); this._hass=null; this._config=null; this._lastKey=null; }

  setConfig(config) {
    if (!config.entity) throw new Error('entity is required');
    this._config={title:'Dagelijkse activiteit',show_steps:true,show_intensity:true,show_calories:true,...config};
  }

  set hass(hass) {
    this._hass=hass; if(!this._config)return;
    const prefix=summaryEntityPrefix(this._config.entity);
    const key=Object.keys(SUMMARY_ENTITY_SUFFIXES).map(k=>hass.states[se(prefix,k)]?.last_changed).join('|');
    if (key===this._lastKey) return;
    this._lastKey=key; this._render(prefix);
  }

  connectedCallback() { if(this._hass&&this._config){this._lastKey=null;this._render(summaryEntityPrefix(this._config.entity));} }

  _render(prefix) {
    const hass=this._hass, cfg=this._config;
    const steps         = stateNum(hass, se(prefix,'steps'));
    const stepGoal      = stateNum(hass, se(prefix,'step_goal'));
    const yesterdaySteps= stateNum(hass, se(prefix,'yesterday_steps'));
    const intensity     = stateNum(hass, se(prefix,'intensity'));
    const intensityGoal = stateNum(hass, se(prefix,'intensity_goal'));
    const moderate      = attrVal(hass,  se(prefix,'intensity'), 'moderate_minutes') ?? stateNum(hass, se(prefix,'moderate'));
    const vigorous      = attrVal(hass,  se(prefix,'intensity'), 'vigorous_minutes') ?? stateNum(hass, se(prefix,'vigorous'));
    const activeCal     = stateNum(hass, se(prefix,'active_calories'));
    const totalCal      = stateNum(hass, se(prefix,'total_calories'));
    const bmrCal        = stateNum(hass, se(prefix,'bmr_calories'));
    const activeTime    = stateNum(hass, se(prefix,'active_time'));
    const sedentaryTime = stateNum(hass, se(prefix,'sedentary_time'));
    const distance      = stateNum(hass, se(prefix,'distance'));

    const stepColor = steps != null && stepGoal != null && steps >= stepGoal ? '#6bcb77' : 'var(--primary-color)';

    const stepsSection = cfg.show_steps !== false ? `
      <div class="section-title">${t(hass,'steps')}</div>
      <div class="steps-row">
        <div class="steps-main">
          <ha-icon icon="mdi:walk" style="color:${stepColor};--mdc-icon-size:28px"></ha-icon>
          <div class="steps-nums">
            <span class="steps-val" style="color:${stepColor}">${steps != null ? steps.toLocaleString('nl-BE') : '—'}</span>
            ${stepGoal != null ? `<span class="steps-goal">/ ${stepGoal.toLocaleString('nl-BE')}</span>` : ''}
          </div>
        </div>
        ${distance != null ? `<div class="steps-dist"><ha-icon icon="mdi:map-marker-distance"></ha-icon><span>${fmtDistance(distance)}</span></div>` : ''}
        ${yesterdaySteps != null ? `<div class="steps-dist"><ha-icon icon="mdi:calendar-today"></ha-icon><span>${yesterdaySteps.toLocaleString('nl-BE')} gisteren</span></div>` : ''}
      </div>
      ${progressBar(steps, stepGoal, stepColor)}` : '';

    const intensityColor = intensity != null && intensityGoal != null && intensity >= intensityGoal ? '#6bcb77' : 'var(--primary-color)';
    const intensitySection = cfg.show_intensity !== false ? `
      <div class="section-title">${t(hass,'intensity_minutes')}</div>
      <div class="intensity-row">
        <div class="intensity-item">
          <ha-icon icon="mdi:lightning-bolt" style="color:${intensityColor}"></ha-icon>
          <span class="intensity-val" style="color:${intensityColor}">${fmtNum(intensity)}${intensityGoal != null ? ' <span class="intensity-goal">/ '+Math.round(intensityGoal)+'</span>' : ''}</span>
          <span class="intensity-label">Totaal</span>
        </div>
        ${moderate != null ? `<div class="intensity-item"><ha-icon icon="mdi:walk"></ha-icon><span class="intensity-val">${fmtNum(moderate)}</span><span class="intensity-label">Matig</span></div>` : ''}
        ${vigorous != null ? `<div class="intensity-item"><ha-icon icon="mdi:run-fast"></ha-icon><span class="intensity-val">${fmtNum(vigorous)}</span><span class="intensity-label">Intensief</span></div>` : ''}
      </div>
      ${progressBar(intensity, intensityGoal, intensityColor)}` : '';

    const calItems = [
      activeCal  != null ? {icon:'mdi:fire',          label:'Actief',  value:Math.round(activeCal)+' kcal'} : null,
      bmrCal     != null ? {icon:'mdi:heart-pulse',   label:'BMR',     value:Math.round(bmrCal)+' kcal'} : null,
      totalCal   != null ? {icon:'mdi:sigma',         label:t(hass,'total'),  value:Math.round(totalCal)+' kcal'} : null,
      activeTime != null ? {icon:'mdi:timer-outline', label:'Actief',  value:fmtMinutes(activeTime)} : null,
      sedentaryTime!=null? {icon:'mdi:seat',          label:t(hass,'sedentary_time'), value:fmtMinutes(sedentaryTime)} : null,
    ].filter(Boolean);

    const calSection = cfg.show_calories !== false && calItems.length ? `
      <div class="section-title">${t(hass,'show_calories')}</div>
      <div class="stats" style="grid-template-columns:repeat(${Math.min(calItems.length,3)},1fr)">
        ${calItems.map(s=>`<div class="stat"><ha-icon icon="${s.icon}"></ha-icon><span class="value">${s.value}</span><span class="label">${s.label}</span></div>`).join('')}
      </div>` : '';

    this.shadowRoot.innerHTML = `
      <ha-card>
        <div class="card-header"><ha-icon icon="mdi:shoe-sneaker"></ha-icon><span>${cfg.title}</span></div>
        ${stepsSection}${intensitySection}${calSection}
      </ha-card>
      <style>
        ha-card{overflow:hidden}
        .card-header{display:flex;align-items:center;gap:8px;padding:12px 16px 0;font-size:14px;font-weight:500;color:var(--secondary-text-color);text-transform:uppercase;letter-spacing:.05em}
        .section-title{padding:8px 16px 4px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--secondary-text-color);border-top:1px solid var(--divider-color)}
        .steps-row{display:flex;align-items:center;gap:16px;padding:8px 16px 4px;flex-wrap:wrap}
        .steps-main{display:flex;align-items:center;gap:8px}
        .steps-nums{display:flex;align-items:baseline;gap:4px}
        .steps-val{font-size:28px;font-weight:700}
        .steps-goal{font-size:14px;color:var(--secondary-text-color)}
        .steps-dist{display:flex;align-items:center;gap:4px;font-size:13px;color:var(--secondary-text-color)}
        .steps-dist ha-icon{--mdc-icon-size:16px}
        .progress-wrap{padding:4px 16px 10px;display:flex;align-items:center;gap:8px}
        .progress-track{flex:1;height:6px;border-radius:3px;background:var(--divider-color);overflow:hidden}
        .progress-fill{height:100%;border-radius:3px;transition:width .3s}
        .progress-label{font-size:11px;color:var(--secondary-text-color);white-space:nowrap}
        .intensity-row{display:flex;align-items:center;gap:0;padding:8px 16px 4px}
        .intensity-item{display:flex;align-items:center;gap:6px;padding:0 16px 0 0}
        .intensity-item ha-icon{color:var(--primary-color);--mdc-icon-size:18px;flex-shrink:0}
        .intensity-val{font-size:15px;font-weight:600;color:var(--primary-text-color)}
        .intensity-goal{font-size:12px;font-weight:400;color:var(--secondary-text-color)}
        .intensity-label{font-size:11px;color:var(--secondary-text-color);margin-left:2px}
        .stats{display:grid;border-top:1px solid var(--divider-color)}
        .stat{display:flex;flex-direction:column;align-items:center;padding:12px 8px;border-right:1px solid var(--divider-color);border-bottom:1px solid var(--divider-color)}
        .stat:last-child{border-right:none}
        .stat ha-icon{color:var(--primary-color);--mdc-icon-size:20px;margin-bottom:4px}
        .value{font-size:13px;font-weight:600;color:var(--primary-text-color)}
        .label{font-size:11px;color:var(--secondary-text-color);margin-top:2px}
      </style>`;
  }

  getCardSize() { return 5; }
  static getConfigElement() { return document.createElement('garmin-activity-summary-card-editor'); }
  static getStubConfig() { return {entity:'sensor.garmin_connect_steps',title:'Dagelijkse activiteit'}; }
}

if (!customElements.get('garmin-activity-summary-card-editor')) customElements.define('garmin-activity-summary-card-editor',GarminActivitySummaryCardEditor);
if (!customElements.get('garmin-activity-summary-card')) {
  customElements.define('garmin-activity-summary-card',GarminActivitySummaryCard);
  window.customCards=window.customCards||[];
  window.customCards.push({type:'garmin-activity-summary-card',name:'Garmin Activity Summary Card',description:'Stappen, intensiteitsminuten en calorieën'});
  console.info('%c GARMIN-ACTIVITY-SUMMARY-CARD %c loaded ','background:#ffd166;color:#333;','');
}
