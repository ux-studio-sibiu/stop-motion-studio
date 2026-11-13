import type { ProjectRepository } from "../model";

// One change a child can undo. Every edit to an animation goes through a command, so undo
// works the same for all of them (PLAN.md §1). A command keeps just enough to reverse itself,
// and each do() and undo() is one repository call, so one transaction: it happens fully or
// not at all.
//
// do() runs again for redo, so it must work a second time after undo().
export interface Command {
  readonly label: string;   // "Delete picture", shown as "Undo: Delete picture"
  do(repository: ProjectRepository): Promise<CommandResult>;
  undo(repository: ProjectRepository): Promise<CommandResult>;
}

// What the studio should select afterwards, if anything.
export type CommandResult = { select?: readonly string[] } | void;
