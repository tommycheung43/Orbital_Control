export default class UIShell {
  constructor() {
    // =====================================================
    // Shared backdrop
    // =====================================================

    this.backdrop =
      document.getElementById(
        "shell-backdrop"
      );

    // =====================================================
    // Mission
    // =====================================================

    this.missionModal =
      document.getElementById(
        "mission-modal"
      );

    this.openMissionButton =
      document.getElementById(
        "open-mission"
      );

    this.closeMissionButton =
      document.getElementById(
        "close-mission"
      );

    // =====================================================
    // Database
    // =====================================================

    this.databaseWorkspace =
      document.getElementById(
        "database-workspace"
      );

    this.openDatabaseButton =
      document.getElementById(
        "open-database"
      );

    this.closeDatabaseButton =
      document.getElementById(
        "close-database"
      );

    // =====================================================
    // SQL Reference
    // =====================================================

    this.referencePanel =
      document.getElementById(
        "reference-panel"
      );

    this.openReferenceButton =
      document.getElementById(
        "open-reference"
      );

    this.closeReferenceButton =
      document.getElementById(
        "close-reference"
      );

    // =====================================================
    // History
    // =====================================================

    this.historyModal =
      document.getElementById(
        "history-modal"
      );

    this.openHistoryButton =
      document.getElementById(
        "open-history"
      );

    this.closeHistoryButton =
      document.getElementById(
        "close-history"
      );

    // =====================================================
    // State
    // =====================================================

    this.activeOverlay =
      null;

    this.previousFocus =
      null;

    // =====================================================
    // Bind
    // =====================================================

    this.handleBackdropClick =
      this.handleBackdropClick.bind(this);

    this.handleKeyDown =
      this.handleKeyDown.bind(this);

    this.handleOpenMission =
      () => this.openMission();

    this.handleCloseMission =
      () => this.closeMission();

    this.handleOpenDatabase =
      () => this.openDatabase();

    this.handleCloseDatabase =
      () => this.closeDatabase();

    this.handleOpenReference =
      () => this.openReference();

    this.handleCloseReference =
      () => this.closeReference();

    this.handleOpenHistory =
      () => this.openHistory();

    this.handleCloseHistory =
      () => this.closeHistory();
  }

  // =======================================================
  // Initialize
  // =======================================================

  init() {
    this.validateElements();

    this.openMissionButton
      .addEventListener(
        "click",
        this.handleOpenMission
      );

    this.closeMissionButton
      .addEventListener(
        "click",
        this.handleCloseMission
      );

    this.openDatabaseButton
      .addEventListener(
        "click",
        this.handleOpenDatabase
      );

    this.closeDatabaseButton
      .addEventListener(
        "click",
        this.handleCloseDatabase
      );

    this.openReferenceButton
      .addEventListener(
        "click",
        this.handleOpenReference
      );

    this.closeReferenceButton
      .addEventListener(
        "click",
        this.handleCloseReference
      );

    this.openHistoryButton
      .addEventListener(
        "click",
        this.handleOpenHistory
      );

    this.closeHistoryButton
      .addEventListener(
        "click",
        this.handleCloseHistory
      );

    this.backdrop
      .addEventListener(
        "click",
        this.handleBackdropClick
      );

    document.addEventListener(
      "keydown",
      this.handleKeyDown
    );

    console.log(
      "UI Shell with History initialized."
    );
  }

  // =======================================================
  // Validation
  // =======================================================

  validateElements() {
    const required = [
      [
        "shell-backdrop",
        this.backdrop,
      ],

      [
        "mission-modal",
        this.missionModal,
      ],

      [
        "open-mission",
        this.openMissionButton,
      ],

      [
        "close-mission",
        this.closeMissionButton,
      ],

      [
        "database-workspace",
        this.databaseWorkspace,
      ],

      [
        "open-database",
        this.openDatabaseButton,
      ],

      [
        "close-database",
        this.closeDatabaseButton,
      ],

      [
        "reference-panel",
        this.referencePanel,
      ],

      [
        "open-reference",
        this.openReferenceButton,
      ],

      [
        "close-reference",
        this.closeReferenceButton,
      ],

      [
        "history-modal",
        this.historyModal,
      ],

      [
        "open-history",
        this.openHistoryButton,
      ],

      [
        "close-history",
        this.closeHistoryButton,
      ],
    ];

    const missing =
      required
        .filter(
          ([, element]) =>
            !element
        )
        .map(
          ([name]) =>
            name
        );

    if (
      missing.length > 0
    ) {
      throw new Error(
        `UIShell could not find required HTML element(s): ${missing.join(", ")}`
      );
    }
  }

  // =======================================================
  // Generic Overlay
  // =======================================================

  openOverlay(
    element,
    firstFocusElement
  ) {
    this.closeAll(false);

    this.previousFocus =
      document.activeElement;

    element.classList.add(
      "open"
    );

    this.backdrop.classList.add(
      "open"
    );

    this.activeOverlay =
      element;

    requestAnimationFrame(
      () => {
        firstFocusElement
          ?.focus();
      }
    );
  }

  closeOverlay(
    element,
    restoreFocus = true
  ) {
    element
      ?.classList.remove(
        "open"
      );

    if (
      this.activeOverlay ===
      element
    ) {
      this.activeOverlay =
        null;
    }

    if (
      !this.activeOverlay
    ) {
      this.backdrop
        .classList.remove(
          "open"
        );
    }

    if (
      restoreFocus &&
      this.previousFocus instanceof
        HTMLElement
    ) {
      this.previousFocus.focus();
    }
  }

  closeAll(
    restoreFocus = true
  ) {
    this.missionModal
      .classList.remove(
        "open"
      );

    this.databaseWorkspace
      .classList.remove(
        "open"
      );

    this.referencePanel
      .classList.remove(
        "open"
      );

    this.historyModal
      .classList.remove(
        "open"
      );

    this.backdrop
      .classList.remove(
        "open"
      );

    this.activeOverlay =
      null;

    if (
      restoreFocus &&
      this.previousFocus instanceof
        HTMLElement
    ) {
      this.previousFocus.focus();
    }
  }

  // =======================================================
  // Mission
  // =======================================================

  openMission() {
    this.openOverlay(
      this.missionModal,
      this.closeMissionButton
    );
  }

  closeMission() {
    this.closeOverlay(
      this.missionModal
    );
  }

  // =======================================================
  // Database
  // =======================================================

  openDatabase() {
    this.openOverlay(
      this.databaseWorkspace,
      this.closeDatabaseButton
    );
  }

  closeDatabase() {
    this.closeOverlay(
      this.databaseWorkspace
    );
  }

  // =======================================================
  // Reference
  // =======================================================

  openReference() {
    this.openOverlay(
      this.referencePanel,
      this.closeReferenceButton
    );
  }

  closeReference() {
    this.closeOverlay(
      this.referencePanel
    );
  }

  // =======================================================
  // History
  // =======================================================

  openHistory() {
    this.openOverlay(
      this.historyModal,
      this.closeHistoryButton
    );
  }

  closeHistory() {
    this.closeOverlay(
      this.historyModal
    );
  }

  // =======================================================
  // Keyboard
  // =======================================================

  handleBackdropClick() {
    this.closeAll();
  }

  handleKeyDown(event) {
    if (
      event.key === "Escape"
    ) {
      this.closeAll();

      return;
    }

    if (
      event.ctrlKey &&
      event.key === "Enter"
    ) {
      document
        .getElementById(
          "execute-sql"
        )
        ?.click();
    }
  }

  // =======================================================
  // Cleanup
  // =======================================================

  destroy() {
    this.openMissionButton
      ?.removeEventListener(
        "click",
        this.handleOpenMission
      );

    this.closeMissionButton
      ?.removeEventListener(
        "click",
        this.handleCloseMission
      );

    this.openDatabaseButton
      ?.removeEventListener(
        "click",
        this.handleOpenDatabase
      );

    this.closeDatabaseButton
      ?.removeEventListener(
        "click",
        this.handleCloseDatabase
      );

    this.openReferenceButton
      ?.removeEventListener(
        "click",
        this.handleOpenReference
      );

    this.closeReferenceButton
      ?.removeEventListener(
        "click",
        this.handleCloseReference
      );

    this.openHistoryButton
      ?.removeEventListener(
        "click",
        this.handleOpenHistory
      );

    this.closeHistoryButton
      ?.removeEventListener(
        "click",
        this.handleCloseHistory
      );

    this.backdrop
      ?.removeEventListener(
        "click",
        this.handleBackdropClick
      );

    document.removeEventListener(
      "keydown",
      this.handleKeyDown
    );
  }
}