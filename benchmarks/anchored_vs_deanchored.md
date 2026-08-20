# Benchmarks: Anchored vs. Deanchored Redesigns ⚓➡️🌌

This document demonstrates how the Deanchor Protocol breaks local maxima compared to standard "anchored" AI coding results.

---

## 1. UI Design (Visual Layout) Redesign

### The Challenge
Redesign a standard user dashboard displaying key system metrics.

#### The Anchored Approach (Standard AI Output)
When given the existing code/screenshot, the AI stays in the same structural paradigm:
- **Layout:** Standard left sidebar navigation, top bar, and a 3-column grid containing metric card items (CPU, Memory, Storage).
- **Style:** Standard light gray backgrounds, colored borders, and minor hover-translate-y animations.
- **Local Maximum:** A cleaner, slightly more rounded version of the same layout.

#### The Deanchored Approach (Deanchor Protocol)
1. **Decouple Data:**
   - Metrics to display: CPU (percentage), Memory (used/total), Storage (used/total).
   - System state: Ok, warning, or error.
2. **Banned Paradigms:**
   - 🚫 Sidebar + Topbar layout
   - 🚫 3-column metric cards
   - 🚫 Traditional header text
3. **New Visual Concept:**
   - **Atmosphere:** *Art Gallery Airy* with clinical focus.
   - **Vibe:** A single, massive, dynamic circle gauge in the center representing the *Total System Load* using a gradient stroke.
   - **Sub-metrics:** Listed in a monospace font at the bottom inline with a small, glowing status bullet.
   - **Navigation:** Replaced with a keyboard-driven overlay panel (Command Palette) triggered by clicking any corner of the screen, leaving the UI completely clean.
   - **Result:** A premium, artwork-like cockpit view that completely breaks the standard dashboard mold.

---

## 2. Code Architecture Refactoring

### The Challenge
Refactor a React data fetching component that polls an API every 10 seconds.

#### The Anchored Approach (Standard AI Output)
When refactoring, the AI stays anchored to the current file structure and React hook logic:
- **Structure:** Keeps the API call inside `useEffect` with `setInterval`, updating component state `setData` and `setError` inside the component.
- **Local Maximum:** Extracts the logic into a `usePoll` custom hook in the same file or `hooks/usePoll.ts`.

#### The Deanchored Approach (Deanchor Protocol)
1. **Decouple Data & Flow:**
   - Input: API Endpoint URL, polling interval (10s).
   - State: Loading state, current dataset, error status.
   - Output: Emit fresh data to subscribers.
2. **Banned Code Paradigms:**
   - 🚫 React `useEffect` timers
   - 🚫 Component-bound polling loops
   - 🚫 Storing raw HTTP state inside component lifecycle
3. **New Architecture Concept:**
   - **Structure:** Define a centralized, framework-agnostic **State Machine & Poll Manager** class using RxJS or standard EventEmitters.
   - **Flow:** The manager runs in a worker thread or background controller. The React components simply subscribe to the event stream.
   - **Result:** Complete decoupling of state from UI. The data fetcher can now be tested in pure Node.js, run in a web worker, or reused in React Native without touching a single component file.
