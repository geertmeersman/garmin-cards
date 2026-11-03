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

## Requirements

- [Garmin Connect integration](https://github.com/cyberjunky/home-assistant-garmin_connect) installed

## Installation via HACS

1. Go to HACS → Frontend
2. Click ⋮ → Custom repositories
3. Add: `https://github.com/geertmeersman/garmin-cards`
4. Category: `Lovelace`
5. Install "Garmin Cards"

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=geertmeersman&repository=garmin-cards&category=lovelace)

## Configuration

All cards have a visual editor. The `entity` field accepts any `sensor.garmin_connect_*` sensor — it is used only to determine which Garmin account to use (supports multiple accounts).

### garmin-activity-card

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

### garmin-sleep-card

```yaml
type: custom:garmin-sleep-card
entity: sensor.garmin_connect_sleep_score
title: Slaap
show_score: true
show_stages: true
show_vitals: true
```

### garmin-hrv-card

```yaml
type: custom:garmin-hrv-card
entity: sensor.garmin_connect_hrv_status
title: HRV
history_days: 30
show_status: true
show_stats: true
show_history: true
```

### garmin-training-card

```yaml
type: custom:garmin-training-card
entity: sensor.garmin_connect_training_readiness
title: Training
show_readiness: true
show_vo2max: true
show_status: true
show_scores: true
```

### garmin-body-card

```yaml
type: custom:garmin-body-card
entity: sensor.garmin_connect_body_battery
title: Lichaam
history_days: 14
show_body_battery: true
show_composition: true
show_fitness_age: true
```

### garmin-activity-summary-card

```yaml
type: custom:garmin-activity-summary-card
entity: sensor.garmin_connect_steps
title: Dagelijkse activiteit
show_steps: true
show_intensity: true
show_calories: true
```
