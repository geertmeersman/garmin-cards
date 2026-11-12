# Garmin Cards

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg?style=for-the-badge)](https://github.com/hacs/integration)
[![maintainer](https://img.shields.io/badge/maintainer-Geert%20Meersman-green?style=for-the-badge&logo=github)](https://github.com/geertmeersman)
[![buyme_coffee](https://img.shields.io/badge/Buy%20me%20an%20Omer-donate-yellow?style=for-the-badge&logo=buymeacoffee)](https://www.buymeacoffee.com/geertmeersman)

A collection of Lovelace cards for [Home Assistant](https://www.home-assistant.io/) that display data from the [Garmin Connect integration](https://github.com/cyberjunky/home-assistant-garmin_connect).

## Cards

| Card | Type | Description |
|---|---|---|
| `garmin-activity-card` | Last activity | Route map, stats, power, HR zones and power zones |
| `garmin-sleep-card` | Sleep | Score, sleep stages, HRV, SpO2, respiration, body battery |
| `garmin-hrv-card` | HRV | Status, baseline, nightly values and history chart |
| `garmin-training-card` | Training | Readiness, VO2max, training status, endurance & hill score |
| `garmin-body-card` | Body | Body battery history, weight, body composition, fitness age |
| `garmin-activity-summary-card` | Daily activity | Steps, intensity minutes, calories |
| `garmin-sensors-card` | Sensors | Connected Garmin sensors with battery status |

## Requirements

- [Garmin Connect integration](https://github.com/cyberjunky/home-assistant-garmin_connect) installed

## Installation via HACS

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=geertmeersman&repository=garmin-cards&category=lovelace)

Or add it manually:

1. Go to **Settings → Marketplace**
2. Click **Add from link** (top right)
3. Enter `https://github.com/geertmeersman/garmin-cards`
4. Select **Dashboard** as content type if not detected automatically
5. Click **Add** and install

## Configuration

All cards have a visual editor. The `entity` field accepts any `sensor.garmin_connect_*` sensor — it is used only to determine which Garmin account to use (supports multiple accounts).

### garmin-activity-card

Displays the last recorded activity with a route map, statistics, power data and heart rate / power zones.

```yaml
type: custom:garmin-activity-card
entity: sensor.garmin_connect_last_activity
title: Laatste activiteit
map_height: 350px
color: '#2d5bff'
show_map: true
show_stats: true
show_power: true
show_hr_zones: true
show_pwr_zones: true
```

| Option | Default | Description |
|---|---|---|
| `entity` | required | Any `sensor.garmin_connect_*` sensor |
| `title` | `Laatste activiteit` | Card title |
| `map_height` | `300px` | Height of the route map |
| `color` | `#2d5bff` | Accent color for the route and icons |
| `show_map` | `true` | Show route map |
| `show_stats` | `true` | Show activity statistics |
| `show_power` | `true` | Show power data (avg, max, normalized) |
| `show_hr_zones` | `true` | Show heart rate zones |
| `show_pwr_zones` | `true` | Show power zones |

### garmin-sleep-card

Displays sleep score, sleep stages, and vitals (HRV, SpO2, respiration, body battery).

```yaml
type: custom:garmin-sleep-card
entity: sensor.garmin_connect_sleep_score
title: Slaap
show_score: true
show_stages: true
show_vitals: true
```

| Option | Default | Description |
|---|---|---|
| `entity` | required | Any `sensor.garmin_connect_*` sensor |
| `title` | `Slaap` | Card title |
| `show_score` | `true` | Show sleep score, bedtime and wake time |
| `show_stages` | `true` | Show sleep stages (deep, light, REM, awake) |
| `show_vitals` | `true` | Show HRV, resting HR, SpO2, respiration, body battery |

### garmin-hrv-card

Displays HRV status, baseline, nightly stats and a history chart.

```yaml
type: custom:garmin-hrv-card
entity: sensor.garmin_connect_hrv_status
title: HRV
history_days: 30
show_status: true
show_stats: true
show_history: true
```

| Option | Default | Description |
|---|---|---|
| `entity` | required | Any `sensor.garmin_connect_*` sensor |
| `title` | `HRV` | Card title |
| `history_days` | `30` | Number of days to show in the history chart |
| `show_status` | `true` | Show HRV status and baseline |
| `show_stats` | `true` | Show last night, weekly average and 5-min peak |
| `show_history` | `true` | Show history chart |

### garmin-training-card

Displays training readiness, VO2max, training status and scores.

```yaml
type: custom:garmin-training-card
entity: sensor.garmin_connect_training_readiness
title: Training
show_readiness: true
show_vo2max: true
show_status: true
show_scores: true
```

| Option | Default | Description |
|---|---|---|
| `entity` | required | Any `sensor.garmin_connect_*` sensor |
| `title` | `Training` | Card title |
| `show_readiness` | `true` | Show training readiness, morning readiness and recovery time |
| `show_vo2max` | `true` | Show VO2max (running & cycling) and lactate threshold |
| `show_status` | `true` | Show training status |
| `show_scores` | `true` | Show endurance score and hill score |

### garmin-body-card

Displays body battery history, body composition and fitness age.

```yaml
type: custom:garmin-body-card
entity: sensor.garmin_connect_body_battery
title: Lichaam
history_days: 14
show_body_battery: true
show_composition: true
show_fitness_age: true
```

| Option | Default | Description |
|---|---|---|
| `entity` | required | Any `sensor.garmin_connect_*` sensor |
| `title` | `Lichaam` | Card title |
| `history_days` | `14` | Number of days to show in the body battery history chart |
| `show_body_battery` | `true` | Show body battery with history chart |
| `show_composition` | `true` | Show body composition (weight, BMI, fat, water, muscle, bone) |
| `show_fitness_age` | `true` | Show fitness age, achievable age and calendar age |

### garmin-activity-summary-card

Displays daily steps, intensity minutes and calories.

```yaml
type: custom:garmin-activity-summary-card
entity: sensor.garmin_connect_steps
title: Dagelijkse activiteit
show_steps: true
show_intensity: true
show_calories: true
```

| Option | Default | Description |
|---|---|---|
| `entity` | required | Any `sensor.garmin_connect_*` sensor |
| `title` | `Dagelijkse activiteit` | Card title |
| `show_steps` | `true` | Show steps with goal progress bar and distance |
| `show_intensity` | `true` | Show intensity minutes (total, moderate, vigorous) with progress bar |
| `show_calories` | `true` | Show active calories, BMR, total calories, active time and sedentary time |

### garmin-sensors-card

Displays all connected Garmin sensors (heart rate monitor, bike sensors, etc.) with battery status, grouped by device.

```yaml
type: custom:garmin-sensors-card
entity: sensor.garmin_connect_connected_sensors
title: Sensoren
only_low: false
```

| Option | Default | Description |
|---|---|---|
| `entity` | required | `sensor.garmin_connect_connected_sensors` |
| `title` | `Sensors` | Card title |
| `only_low` | `false` | Show only sensors with low or critical battery |

## Supported languages

All cards support the following languages via the Home Assistant locale setting:

- 🇳🇱 Dutch (nl)
- 🇫🇷 French (fr)
- 🇩🇪 German (de)
- 🇬🇧 English (en) — default
