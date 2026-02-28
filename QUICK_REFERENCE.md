# UI Features - Quick Reference Card

## 📊 PANELS AT A GLANCE

### TOP BAR
```
Turn: 15 / 50          Special Agent: Agent 3         Status: Playing
[Green counter]        [Blue info]                     [Green badge]
```

### SIDE PANEL (Right)
```
┌─ AGENTS & STATUS
│  Agent 1: Active
│  ⚡ Special Agent (Charges: 1)
│  Location: (5, 3)
│  Turns: 30/50
│  Tasks: ☑ ☑ ☐ ☐
│  ████████░░
│
├─ 📋 TASK CHECKLIST
│  Agent 1:  ✅ ☕  ⏳ ⛽  ☐ Reach
│  Agent 2:  ✅ ☕  ☐ 🏥
│  Agent 3:  ⏳ 📮  ☐ 🧥
│
└─ 📊 STATISTICS
   Tasks: 8
   Photos: 5 turns
   Congestion: 6
   Abilities: 2
```

### ACTION PANEL (Bottom Right)
```
Turn Progress:
████████░░░░░░░░░░░░░░░░░░░░
15 / 50 turns

[End Turn]  [🚧 Roadblock]
```

### MAP LEGEND (Bottom Left - Scrollable)
```
🗺️ MAP LEGEND
──────────────
ROADS:
░ Road       ⚠ Congested    🚫 Blocked

SERVICES:
☕ Cafe      ⛽ Gas         🏥 Hospital
⚖️ Jail      📮 Postal

LANDMARKS:
🎨 Cultural  🏛️ Historic
```

---

## 🎨 COLOR CODING

| Color | Meaning | Example |
|-------|---------|---------|
| 🔵 Blue | Primary UI, active | Turn counter, borders |
| 🟢 Green | Success, complete | Checkmarks, progress |
| 🟡 Gold | Special, highlight | Special agent, current task |
| 🔴 Red | Injury, failure | Injured status |
| 🟣 Purple | Criminal, jail | Jail time |

---

## 👁️ STATUS INDICATORS

### Agent Badges (Colored and Animated)

| Badge | Meaning |
|-------|---------|
| ⚡ Special Agent | Agent can place roadblock (1 use) |
| 🏥 Injured | Must visit hospital next |
| ⚖️ In Jail | Serving jail sentence |
| 📷 Photo | Taking photo at landmark |

### Task Status

| Symbol | Meaning |
|--------|---------|
| ☑ / ✅ | Completed (green) |
| ⏳ | In progress (gold) |
| ☐ | Not started (gray) |

---

## 🖱️ INTERACTIONS

### Keyboard
- **End Turn Button** → Execute turn
- **Roadblock Toggle** → Place road obstacle

### Mouse
- **Hover over tile** → See position, type, congestion
- **Hover over agent card** → Full agent status
- **Hover over legend item** → No tooltip (self-explanatory)

### Touch (Mobile)
- **Long-press tile** → Show tile details
- **Tap agent** → Expand full details
- **Tap buttons** → Normal interaction

---

## 📈 STATISTICS EXPLAINED

| Statistic | Meaning | Why It Matters |
|-----------|---------|-----------------|
| **Tasks Completed** | Total tasks done across all agents | Progress toward game win |
| **Photo Delays** | Total turns spent taking photos | Landmark bonus/penalty tracking |
| **Congestion Incidents** | Tiles with traffic buildup | Map difficulty assessment |
| **Abilities Used** | Roadblocks placed by special agent | Special ability tracking |

---

## 🎯 LEGEND CATEGORIES

### Roads (Gray)
- **░ Regular** - Normal traversable road
- **⚠ Congested** - Slowed movement
- **🚫 Blocked** - Cannot pass (roadblock or accident)

### Services (Blue)
- **☕ Cafe** - Task destination
- **⛽ Gas Station** - Refuel location
- **🏥 Hospital** - Heal injuries
- **⚖️ Jail** - Serve jail time
- **📮 Postal Office** - Delivery task location

### Landmarks (Gold)
- **🎨 Cultural Sites** - Photo opportunities
- **🏛️ Historic Buildings** - Photo opportunities
- **🌳 Parks, 🏞️ Plazas, etc.** - Scenic photo locations

---

## 🎬 ANIMATIONS

| Animation | Trigger | Duration |
|-----------|---------|----------|
| Flip | Turn counter updates | 0.6s |
| Pulse | Special agent badge | 2s loop |
| Fade-in | Tooltip appears | 0.2s |
| Smooth | All color/size changes | 0.3s |

---

## 📱 RESPONSIVE BEHAVIOR

### Desktop (1200px+)
- All panels visible
- Legend always shown
- Full text and icons

### Tablet (768px - 1200px)
- Smaller panel fonts
- Legend visible but compact
- Abbreviated text

### Mobile (<768px)
- Stacked layout (vertical)
- Touch-optimized sizes
- Simplified legends
- Larger touch targets

---

## 🔑 KEY TAKEAWAYS

1. **Agent Cards** show current status at a glance
   - See all conditions (injury, jail, photo, ability)
   - Track turn usage with progress bar

2. **Task Checklist** tells you what's done vs. pending
   - Green = complete (shows ✅)
   - Gold = current (shows ⏳)
   - Gray = pending (shows ☐)

3. **Statistics** reveal game progress
   - Tasks completed overall
   - Photo and congestion impact
   - Ability usage

4. **Timeline** shows time remaining
   - Visual progress bar
   - Current turn / Max turns

5. **Legend** explains all symbols
   - Color-coded categories
   - Always accessible
   - Scrollable for small screens

6. **Tooltips** provide detail on demand
   - Hover over tiles for info
   - Hover over agents for status
   - Auto-position near cursor

---

## ⚡ QUICK STATUS CHECK

**To see if agent is in trouble:**
1. Look at agent card in side panel
2. Check for red/purple/gold badges
3. Look at turn progress bar (how full?)
4. Check task status (any ☑ yet?)
5. Read task checklist (any completed?)

**Result:**
- ✅ Several tasks done, many turns left = Good
- ⚠️ Few tasks done, few turns left = Trouble
- ❌ No tasks done, turns almost up = Critical

---

## 🎮 GAMEPLAY FLOW WITH UI

```
START TURN
    ↓
Look at Agent Cards (who's doing what?)
    ↓
Check Task Checklist (what's completed?)
    ↓
Review Timeline (time remaining?)
    ↓
Check Statistics (overall progress?)
    ↓
Look at Map/Legend (where to go next?)
    ↓
Hover over tiles (any obstacles?)
    ↓
TAKE ACTION (move, place roadblock)
    ↓
END TURN
    ↓
UI UPDATES AUTOMATICALLY
    ↓
REPEAT
```

---

## 🐛 TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| Panels not visible | Scroll right/left on side panel |
| Stats not updating | End turn to refresh |
| Tooltip not showing | Move mouse more slowly over tile |
| Legend covers action buttons | Click canvas to dismiss (future feature) |
| Text too small | Use browser zoom (Ctrl/Cmd + +) |

---

## 💡 PRO TIPS

1. **Watch the Timeline** - Don't waste turns, check remaining time
2. **Use Task Checklist** - See who's close to finishing
3. **Monitor Statistics** - Congestion means slower movement
4. **Use Legend** - Know what tiles mean before moving
5. **Hover for Details** - Get exact info before committing moves
6. **Plan Ahead** - Use timeline to plan multi-turn paths

---

## 📊 INFORMATION HIERARCHY

### Most Important (Always Visible)
- Agent status (Active/Arrived/Failed)
- Current location
- Turns remaining

### Important (Side Panel)
- Special conditions (injury, jail, photo)
- Task progress
- Overall statistics

### Reference (Legend)
- What symbols mean
- Where to find services
- Tile type meanings

### Details On Demand (Tooltips)
- Exact coordinates
- Congestion levels
- Full status details

---

## 🎨 VISUAL GUIDE: Icon Legend

### Status Icons
| Icon | Meaning |
|------|---------|
| ⚡ | Special Agent / Power-up |
| 🏥 | Injured / Hospital |
| ⚖️ | Criminal / Jail |
| 📷 | Taking Photo |
| ✅ | Completed / Success |
| ☐ | Pending / Incomplete |
| ⏳ | In Progress |

### Location Icons
| Icon | Meaning |
|------|---------|
| ☕ | Cafe |
| ⛽ | Gas Station |
| 🏥 | Hospital |
| ⚖️ | Jail |
| 📮 | Postal Office |
| 🎨 | Cultural Site |
| 🏛️ | Historic Building |
| 🌳 | Park |
| 🏞️ | Plaza |
| 🌉 | Bridge |

### Road Icons
| Icon | Meaning |
|------|---------|
| ░ | Normal Road |
| ⚠ | Congested |
| 🚫 | Blocked |

---

## 🏆 GAME STATE SUMMARY

At any moment, the UI shows:
- ✅ What each agent is doing
- ✅ Where each agent is located
- ✅ How much time they have left
- ✅ What tasks they've completed
- ✅ What conditions affect them
- ✅ How the game is progressing overall
- ✅ What's available on the map

**No information is hidden!**

---

**Last Updated:** January 2026  
**Version:** 1.0 - Enhanced UI Release  
**Status:** Ready for Production ✅
