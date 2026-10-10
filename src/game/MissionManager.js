import missions from "../data/missions.js";

class MissionManager {
  constructor() {
    this.missions = missions;
    this.currentMissionIndex = 0;
    this.score = 0;
  }

  getCurrentMission() {
    return this.missions[this.currentMissionIndex] ?? null;
  }

  hasCurrentMission() {
    return this.currentMissionIndex < this.missions.length;
  }

  completeCurrentMission() {
    const mission = this.getCurrentMission();

    if (!mission) {
      return false;
    }

    this.score += mission.reward ?? 0;
    this.currentMissionIndex++;

    return true;
  }

  hasNextMission() {
    return this.currentMissionIndex < this.missions.length;
  }

  getScore() {
    return this.score;
  }

  getCurrentMissionIndex() {
    return this.currentMissionIndex;
  }

  getMissionCount() {
    return this.missions.length;
  }

  reset() {
    this.currentMissionIndex = 0;
    this.score = 0;
  }
}

const missionManager = new MissionManager();

export default missionManager;