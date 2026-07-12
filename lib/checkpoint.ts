import type { SessionCheckpoint, ConditionId, StudyId } from '@/types/log-event';

const CHECKPOINT_KEY = 'interactionkit-session';

export function saveCheckpoint(cp: SessionCheckpoint): void {
  try {
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(cp));
  } catch {
    // localStorage may be full or unavailable — silently fail
  }
}

export function loadCheckpoint(): SessionCheckpoint | null {
  try {
    const raw = localStorage.getItem(CHECKPOINT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionCheckpoint;
  } catch {
    return null;
  }
}

export function clearCheckpoint(): void {
  try {
    localStorage.removeItem(CHECKPOINT_KEY);
  } catch {
    // silently fail
  }
}

export function createCheckpoint(
  participantId: string,
  condition: ConditionId,
  studyId: StudyId,
  scenarioOrderIds: string[]
): SessionCheckpoint {
  return {
    participantId,
    condition,
    studyId,
    completedScenariosCount: 0,
    currentScenarioIndex: 0,
    scenarioOrderIds,
    createdAt: new Date().toISOString(),
  };
}
