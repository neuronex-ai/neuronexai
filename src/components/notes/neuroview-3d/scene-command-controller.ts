import type { GravityBreakdown, NeuroViewLens, NeuroViewTimeWindow } from "../clinical-evidence/evidence-types";
import type { NeuroViewDynamicsSettings } from "./three-scene";

export type NeuroViewSceneCommand =
  | { type: "prepare-session"; patientId: string }
  | { type: "select-patient"; patientId: string }
  | { type: "focus-evidence"; nodeId: string }
  | { type: "set-lens"; lens: NeuroViewLens }
  | { type: "set-time-window"; window: NeuroViewTimeWindow }
  | { type: "highlight-path"; nodeId: string | null }
  | { type: "highlight-nodes"; nodeIds: string[]; focusNodeId?: string }
  | { type: "set-physics"; settings: NeuroViewDynamicsSettings }
  | { type: "explain-gravity"; nodeId: string }
  | { type: "enter-fullscreen" }
  | { type: "restore-panorama" };

export type NeuroViewCommandResult = {
  ok: true;
  command: NeuroViewSceneCommand["type"];
  message: string;
  gravity?: GravityBreakdown;
};

export type NeuroViewSceneCommandAdapter = {
  execute: (command: NeuroViewSceneCommand) => Promise<NeuroViewCommandResult>;
};

type PendingCommand = {
  command: NeuroViewSceneCommand;
  resolve: (result: NeuroViewCommandResult) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

const COMMAND_READY_TIMEOUT_MS = 20_000;

export class NeuroViewSceneCommandController {
  private adapter: NeuroViewSceneCommandAdapter | null = null;
  private pending: PendingCommand[] = [];

  attach(adapter: NeuroViewSceneCommandAdapter) {
    this.adapter = adapter;
    const queued = this.pending.splice(0);
    queued.forEach((pending) => {
      clearTimeout(pending.timeoutId);
      void adapter.execute(pending.command).then(pending.resolve, pending.reject);
    });
    return () => {
      if (this.adapter === adapter) this.adapter = null;
    };
  }

  dispatch(command: NeuroViewSceneCommand): Promise<NeuroViewCommandResult> {
    if (this.adapter) return this.adapter.execute(command);
    return new Promise((resolve, reject) => {
      const pending: PendingCommand = {
        command,
        resolve,
        reject,
        timeoutId: setTimeout(() => {
          this.pending = this.pending.filter((candidate) => candidate !== pending);
          reject(new Error("A cena do NeuroView 3d não ficou pronta a tempo."));
        }, COMMAND_READY_TIMEOUT_MS),
      };
      this.pending.push(pending);
    });
  }
}

export const neuroViewSceneCommands = new NeuroViewSceneCommandController();
