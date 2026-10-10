# Orbital Control

A local station-management prototype built with Phaser, Vite and sql.js.

**Restore power → contain an alert → investigate if needed → assign crew → review the outcome.**

## AI Agent Prerequisites

Before running the full application with the AI SQL Agent, make sure you have installed and configured the following dependencies:
1. **uv (Python Package & Environment Manager)**

   Install uv from 
   
   UV webpage [uv](https://docs.astral.sh/uv/)

   or
   
   - PyPI using Python:

   ```bash
   pipx install uv
   ```

   Verify the installation:

   ```bash
   uv --version
   ```

2. Install the project dependencies

   From the repository root, run:

   ```bash
    uv init
    uv add deepagents
    uv sync
   ```

   This installs the dependencies declared in [pyproject.toml](pyproject.toml), including the Deep Agents package.

   For more details, see the official uv installation guide: https://docs.astral.sh/uv/getting-started/installation/

3. **Ollama (Local LLM Engine)**
   - Download and install [Ollama](https://ollama.com/download).
   - Start Ollama and pull your desired local model (e.g., `ollama pull qwen2.5-coder` or `ollama pull llama3`).

4. **API Key Setup (Cloud Models)**
    - Go to Ollama webpage (https://ollama.com/)
    - Register and login
    - Go to setting and find Keys
    - Add API keys

   ```bash
   # Local: Ollama must be running on your machine
    # Cloud: Under the dictionary, Set your Ollama API key for hosted inference
    set OLLAMA_API_KEY="your-api-key"
   ```
    After setting the API key, under the API key webpage, Device Keys should have your device key.
---

## Run

Use Node.js 22 or later. Install dependencies once:

```sh
npm install
npm run dev-nolog
```

Open the local URL printed by Vite. In PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

```sh
npm test
npm run build-nolog
```

The no-log scripts avoid the upstream template's optional logging script. No network service is needed during gameplay; SQLite/WASM and all assets are bundled locally.

## Try the game loop

New runs begin paused with a Habitat power shortfall. The first button restores power; the result appears immediately. Resume time for the Reactor alert, or investigate the first change with SQL if you want more detail. The main station view then shows a compact power, oxygen, crew, spares and work-queue summary.

1. Restore Habitat power using the highlighted action. **Crew & tasks** remains available from the start, so you can inspect the roster and routine work whenever you choose.
2. Resume time and contain the Reactor alert. Open **Crew & tasks** and compare engineers.
3. If past performance matters, use Investigation to inspect earlier repair records; return to assign an engineer and choose a priority. Active emergency tasks consume power, so check the station balance before resuming.
4. If Habitat oxygen falls too far, the game creates a scrubber recovery task. Assign an Oxygen-certified technician and balance its temporary power cost against the Reactor recovery.
5. Read the qualitative debrief and its recommendation for the next run.
6. Open **Teacher tools** to add, edit or remove modules and start a variant.

SQL evidence is optional and supports reasoning; it does not unlock controls. Each default run contains over 3,000 telemetry rows, but beginner views such as `current_modules` expose useful current data without a long JOIN.

SQL learning progresses through four levels:

1. `SELECT`, `FROM`, `WHERE`
2. `ORDER BY`, `LIMIT`, aggregates and `GROUP BY`
3. `JOIN`, `ON`, aliases and `WITH`
4. `INSERT`, `UPDATE`, `DELETE` on `work_orders`

The in-game SQL Toolkit always shows the current functions, goal, examples, quick views and table reference. `crew_roster`, `tasks`, `repair_history` and `crew_task_history` let you investigate current assignments, earlier shifts and this run's work. Guided evidence questions are optional. SQL writes are restricted to the maintenance queue; crew assignment happens in the GUI.

## Current scope

This implements the **first Reactor Instability vertical slice** plus a configurable system-control loop. It has Power/Oxygen/Crew/Maintenance, direct module controls, incident responses, task-based Reactor and scrubber recovery, an autonomous routine inspection, task power costs, delayed effects and a local teacher scenario builder. The 48 crew records support filtering practice; crew have distinct certification, skill, fatigue and health trade-offs.

The prototype runs for 90 five-second ticks (7.5 minutes of simulation, excluding investigation pauses). This is a compressed verification scenario, not the report's eventual 15–20 minute multi-event MVP. Change the seed to vary occupancy, battery reserve and repair duration.

The teacher workspace is intentionally local: it validates 3–12 modules and supports JSON import/export, but it is not an account, permission or online publishing system. Still pending: full Oxygen/Cargo scenario templates, a multi-event director, save/resume, broader content and the usability study.

## Architecture

- `src/game/SimulationEngine.js`: deterministic state creation, ticks, metrics and consequences.
- `src/game/ActionService.js`: current-state requirements and atomic operations.
- `src/game/CrewTaskService.js`: eligibility, assignment, priority and task progress.
- `src/game/SystemControlService.js`: direct learner controls and hidden consequences.
- `src/game/MissionGuide.js`: derived mission objectives and qualitative debrief.
- `src/game/StationSession.js`: application coordination, snapshot publication, pause, investigation and ordered timeline.
- `src/database/GameplayRepository.js`: transactional-by-replacement SQLite projection of authoritative state.
- `src/investigation/`: read policy, worker timeout, query execution and semantic evidence checks.
- `src/investigation/curriculum.js`: progressive SQL unlocks and examples.
- `src/data/reactorScenario.js`: scenario, evidence questions, action labels and costs.
- `src/data/crewServiceHistory.js`: deterministic prior-shift repair records for SQL comparisons.
- `src/data/scenarioConfig.js`: teacher scenario validation and normalization.
- `src/ui/OperationsApp.js`: DOM presentation and commands; no direct SQL writes.
- `src/scenes/GameScene.js`: Phaser display/lifecycle adapter only.

Legacy `MissionManager`, `MissionValidator`, `StationSimulationManager`, `StationStateManager`, `DatabaseManager`, `SQLTerminal`, `DatabaseExplorer` and `UIShell` files remain for migration reference. They are not imported by the active application entry path. Do not connect them to the new session: that would create a second authority.

See [architecture decisions](docs/reactor-slice.md) for contracts and known limits.
See [settlement crew audit](docs/settlement-crew-audit.md), [implementation plan](docs/settlement-crew-plan.md) and [review](docs/settlement-crew-review.md) for the current game-design pass.
See [first-time experience audit](docs/first-time-experience-audit.md) and [implementation plan](docs/first-time-experience-plan.md) for the latest simplification review.
See [game and UI review](docs/game-design-ui-review.md) and the resulting [implementation prompt](docs/game-improvement-prompt.md) for the latest design rationale.
The second pass is recorded in [review v2](docs/game-design-ui-review-v2.md) and [prompt v2](docs/game-improvement-prompt-v2.md).
