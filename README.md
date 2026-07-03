# Ubudu RTLS × Node-RED — integration demo

A ready-to-run Docker image showing how to integrate with the
[Ubudu RTLS](https://www.ubudu.com) platform from
[Node-RED](https://nodered.org).

The pre-loaded flow **polls the RTLS API for the last known position of every
tag and works out which tag is currently in which zone**, then surfaces that
information four ways:

| Output | Where |
|--------|-------|
| 📊 Live dashboard | <http://localhost:1880/ui> |
| 🔎 Debug log (`tag X is in zone Y`) | Node-RED debug sidebar + container logs |
| 🌐 HTTP JSON endpoint | <http://localhost:1880/tags> |
| 📡 MQTT (optional) | topic `ubudu/rtls/zones/#` |

The Node-RED editor (the flow itself) is at <http://localhost:1880/>.

The dashboard has two parts:

- **Tags per zone** — a per-zone count card (e.g. `Biomedical — 17`,
  `Emergency — 12`), with tags currently outside any zone always shown last.
- **Live tag → zone** — a filterable table of every tag (name, MAC, zone,
  coordinates, age). Type in the **Filter** box to narrow by name, MAC, or zone
  (e.g. `cardio`, `emergency`, or a specific MAC); clear it to show all.

---

## What it demonstrates

The flow calls the RTLS **last-positions cache** endpoint:

```
GET {RTLS_BASE_URL}/cache/{RTLS_NAMESPACE}/positions
Header: X-API-Key: <your key>
```

Each entry returned is a *cached asset position* that includes a tag id
(`user_udid` / MAC, `external_id`, or `user_uuid`, depending on the
deployment), a display name (`user_name`), the coordinates, and an
embedded **`zone`** object (`id`, `name`, `color`). The flow turns that into a
simple `tag → zone` mapping.

Tags not inside any defined zone are normalized to a single
**`— outside any zone —`** label and carry `inZone: false`. (The RTLS API may
report these either by omitting the `zone` object or by using the sentinel zone
name `OUTSIDE_ALL_ZONES`; both are collapsed to the same label.)

This polling approach is the simplest, most readable way to demonstrate the
integration. The same data is also available over WebSocket and via the
official [`ubudu-rtls-sdk`](https://www.npmjs.com/package/ubudu-rtls-sdk) — see
[Going further](#going-further).

---

## Quick start

You need [Docker](https://docs.docker.com/get-docker/) (with Compose).

```bash
# 1. Configure your credentials
cp .env.example .env
#    then edit .env and set RTLS_NAMESPACE and RTLS_API_KEY

# 2. Build & run
docker compose up --build

# 3. Open the dashboard
#    http://localhost:1880/ui
```

That's it. Within a few seconds the dashboard table populates with each tag,
its name, current zone, coordinates and how long ago it was last seen. The
table refreshes on every poll (default every 5 s).

### Without Compose

```bash
docker build -t ubudu-rtls-nodered-demo .
docker run -p 1880:1880 \
  -e RTLS_NAMESPACE=your-app-namespace-uuid \
  -e RTLS_API_KEY=your-rtls-api-key \
  ubudu-rtls-nodered-demo
```

---

## Configuration

All configuration is via environment variables (set them in `.env` or pass
`-e` flags). Secrets never live in the image or the flow.

| Variable | Required | Default | Description |
|----------|:--------:|---------|-------------|
| `RTLS_NAMESPACE` | ✅ | — | Your RTLS app namespace UUID |
| `RTLS_API_KEY` | ✅ | — | Your RTLS API key (sent as `X-API-Key`) |
| `RTLS_BASE_URL` | | `https://rtls.ubudu.com/api` | RTLS API base URL |
| `POLL_INTERVAL_SEC` | | `5` | Poll interval in seconds |
| `MQTT_ENABLE` | | `false` | Set `true` to publish zone events to MQTT |
| `MQTT_TOPIC` | | `ubudu/rtls/zones` | Base MQTT topic |
| `MQTT_HOST` | | `mqtt` | MQTT broker host |
| `MQTT_PORT` | | `1883` | MQTT broker port |

The flow refuses to poll until `RTLS_NAMESPACE` and `RTLS_API_KEY` are set
(the "Build RTLS request" node shows a red status and logs an error).

---

## The `/tags` HTTP endpoint

`GET http://localhost:1880/tags` returns the latest snapshot as JSON:

```json
{
  "updatedAt": "2026-06-24T14:12:29.264Z",
  "count": 42,
  "zoneCount": 7,
  "tags": [
    {
      "tag": "aabbcc000001",
      "name": "Bed 25",
      "zone": "Emergency",
      "inZone": true,
      "zoneId": 101,
      "zoneColor": "#2e79ff",
      "lat": 48.856614,
      "lon": 2.352222,
      "mapUuid": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
      "lastSeen": "2026-06-24T05:18:12Z",
      "ageSeconds": 32057
    },
    {
      "tag": "aabbcc000002",
      "name": "Pump 124",
      "zone": "— outside any zone —",
      "inZone": false,
      "zoneId": null,
      "zoneColor": "#9e9e9e",
      "lat": 48.856200,
      "lon": 2.352800,
      "mapUuid": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
      "lastSeen": "2026-06-24T13:50:02Z",
      "ageSeconds": 1347
    }
  ],
  "byZone": {
    "Emergency": ["Bed 25", "..."],
    "— outside any zone —": ["Pump 124", "..."]
  },
  "zoneSummary": [
    { "zone": "Biomedical", "count": 17 },
    { "zone": "Emergency", "count": 12 },
    { "zone": "— outside any zone —", "count": 4 }
  ]
}
```

Field notes:

- `count` / `zoneCount` — totals for this snapshot.
- `tags[]` — one row per tag. `inZone` is `false` when the tag is outside all
  zones; `zoneId` / `zoneColor` are then `null` / grey.
- `byZone` — zone name → list of tag names (handy for a quick roster per zone).
- `zoneSummary` — zone name → tag count, sorted by count descending, with the
  *outside any zone* bucket always last. This is what feeds the dashboard's
  "Tags per zone" card.

Before the first poll completes it returns `503` with an explanatory message.

Quick ways to consume it:

```bash
# Pretty-print the whole snapshot
curl -s http://localhost:1880/tags | jq

# Just the per-zone counts
curl -s http://localhost:1880/tags | jq '.zoneSummary'

# Every tag currently in a cardiology zone
curl -s http://localhost:1880/tags \
  | jq '.tags[] | select(.zone | test("cardio"; "i")) | {name, tag, zone}'

# How many tags are outside any zone right now
curl -s http://localhost:1880/tags \
  | jq '[.tags[] | select(.inZone == false)] | length'

# Look up which zone a specific tag (by MAC) is in
curl -s http://localhost:1880/tags \
  | jq '.tags[] | select(.tag == "aabbcc000001") | .zone'
```

---

## Enabling MQTT (optional)

To re-publish per-tag zone state over MQTT for the partner's own systems:

1. In `docker-compose.yml`, uncomment the `mqtt` (Mosquitto) service.
2. In `.env`, set `MQTT_ENABLE=true` (keep `MQTT_HOST=mqtt`).
3. `docker compose up --build`
4. Subscribe:

   ```bash
   mosquitto_sub -h localhost -t 'ubudu/rtls/zones/#' -v
   ```

Published topics (retained):

- `ubudu/rtls/zones/snapshot` — the full snapshot (same shape as `/tags`)
- `ubudu/rtls/zones/tag/<tagId>` — per-tag zone state, e.g.

  ```json
  {
    "tag": "aabbcc000001",
    "name": "Bed 25",
    "zone": "Emergency",
    "inZone": true,
    "zoneId": 101,
    "lat": 48.856614,
    "lon": 2.352222,
    "lastSeen": "2026-06-24T05:18:12Z",
    "ageSeconds": 32057
  }
  ```

Because topics are **retained**, a subscriber that connects later immediately
receives the last known zone of every tag. Change the base topic with
`MQTT_TOPIC`.

Already have a broker? Skip the bundled service and point `MQTT_HOST` /
`MQTT_PORT` at it instead.

---

## Editing the flow

Open <http://localhost:1880/> to inspect or modify the flow in the Node-RED
editor. The flow is a single tab, **Ubudu RTLS — Tag → Zone**, laid out
left-to-right:

```
Poll timer → Build RTLS request → GET /cache/{ns}/positions → Map tag → zone ┬→ Apply filter → Dashboard table
                                                                             ├→ Zone summary → "Tags per zone" card
                                                                             ├→ Debug log
                                                                             └→ MQTT (optional)

Filter box ─────────────────────────────────────────────────────────────────┘  (re-renders the table on input)

GET /tags → Serve latest snapshot → Respond JSON
```

After editing, click **Deploy**. To persist edits across container restarts,
uncomment the `node_red_data` volume in `docker-compose.yml`.

---

## Use cases & examples

The `tag → zone` mapping this demo produces is the building block for most RTLS
integrations. Below are common scenarios and how to build each one on top of
the existing flow. The data looks the same in a hospital deployment
(beds, equipment, staff badges as "tags"; departments and rooms as "zones") or
in a warehouse, factory, retail or office deployment.

### 1. Live occupancy / asset count per zone

**Goal:** "How many infusion pumps are in the ICU right now?" / "How many
forklifts are on the loading dock?"

Already built — see the **Tags per zone** dashboard card, or:

```bash
curl -s http://localhost:1880/tags | jq '.zoneSummary'
# [{ "zone": "Biomedical", "count": 17 }, { "zone": "Emergency", "count": 12 }, ...]
```

Drive a wallboard, capacity alarm, or BI export straight from `zoneSummary`.

### 2. Find a specific asset

**Goal:** "Which room is `Bed 25` (`aabbcc000001`) in?"

```bash
curl -s http://localhost:1880/tags \
  | jq '.tags[] | select(.tag=="aabbcc000001") | {name, zone, lastSeen}'
```

In the dashboard, just type the name or MAC into the **Filter** box.

### 3. Zone entry / exit events ("geofencing")

**Goal:** notify when an asset *enters* or *leaves* a zone — e.g. equipment
leaving its department, a patient entering the OR, a pallet reaching shipping.

Add a small **change-detection** function after *Map tag → zone*: keep the
previous zone per tag in flow context and emit an event only when it changes.

```javascript
// Function node: "Detect zone changes"
const prev = flow.get('lastZoneByTag') || {};
const events = [];
for (const r of msg.payload) {
    if (prev[r.tag] !== undefined && prev[r.tag] !== r.zone) {
        events.push({ tag: r.tag, name: r.name, from: prev[r.tag], to: r.zone, at: r.lastSeen });
    }
    prev[r.tag] = r.zone;
}
flow.set('lastZoneByTag', prev);
return events.length ? { payload: events } : null; // only fire on real changes
```

Wire its output to an email / Slack / Teams / webhook node, or to the MQTT node
on a `…/events` topic. This is the basis for "equipment left the floor" or
"asset entered a restricted area" alerts.

### 4. Dwell time / "stuck asset" detection

**Goal:** flag assets that haven't moved or haven't been seen recently — a
proxy for "lost", "idle", or "needs attention".

Every tag already carries `ageSeconds` (time since its last position update):

```bash
# Tags not seen in over an hour
curl -s http://localhost:1880/tags \
  | jq '.tags[] | select(.ageSeconds > 3600) | {name, zone, ageSeconds}'
```

For true *dwell time in a zone*, combine this with the zone-change detector in
(3): record the timestamp when a tag entered its current zone and alert when
`now − entered > threshold` (e.g. a stretcher in a corridor for > 30 min).

### 5. Restricted / forbidden zone alerts

**Goal:** "no tag of type X should ever be in zone Y."

Filter the rows for the forbidden combination and raise an alert:

```javascript
// Function node: "Check restricted zones"
const FORBIDDEN_ZONE = 'Pharmacy';
const breaches = msg.payload.filter(r => r.zone.includes(FORBIDDEN_ZONE));
return breaches.length ? { payload: breaches } : null;
```

### 6. Feed the data into the partner's own systems

**Goal:** the partner's WMS / EMR / BMS / dashboard consumes the live mapping.

- **Pull model:** poll `GET /tags` (it already returns clean JSON). The `/tags`
  examples above show how to slice it with `jq`.
- **Push model:** enable MQTT (see [Enabling MQTT](#enabling-mqtt-optional)).
  Retained per-tag topics mean a newly-connected consumer instantly gets the
  current zone of every tag.
- **Custom HTTP shape:** duplicate the *GET /tags* branch, change the `url` on
  the `http in` node (e.g. `/zones/:zone/tags`) and reshape the payload in the
  function node to match the partner's contract.

### 7. Headcount / mustering (safety)

**Goal:** during an evacuation, "who is still inside, and where?"

`byZone` already gives a roster per zone. Combine with `ageSeconds` to discount
stale tags, and surface the result on a dedicated dashboard tab or push it to a
safety system over MQTT.

---

## Going further

This demo uses plain HTTP polling so it is easy to read and adapt. For
production integrations you may prefer:

- **WebSocket streaming** — live position/zone/alert pushes instead of polling.
- **The official SDK** —
  [`ubudu-rtls-sdk`](https://www.npmjs.com/package/ubudu-rtls-sdk)
  (`client.positions.listCached()`, `client.zones`, spatial queries, typed
  errors, and a WebSocket subscriber).
- **Full API reference** — <https://rtls.ubudu.com/api/docs>.

---

## License

[MIT](LICENSE)
