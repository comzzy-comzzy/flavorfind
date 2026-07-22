Continue, until you generate the final C:\Users\USER\Documents\cyopsproject\new-project\.humanize\rlcr\5c930e2e-00b4-424d-b99c-595ba59e0146\iter-002\implementation_result.json file.

Before writing the execution summary, confirm the current required artifact exists. If the current target names a missing `scripts/*.sh` artifact, create or edit that artifact first using the current AC/plan text already in the prompt. Do not read `.humanize/`, `.agents/`, logs, previous result/review files, generated prompt files, hidden datasets, or runner internals before that first artifact write.
Please write the execution summary JSON directly to the file `C:\Users\USER\Documents\cyopsproject\new-project\.humanize\rlcr\5c930e2e-00b4-424d-b99c-595ba59e0146\iter-002\implementation_result.json` using your available file write/edit tool.
The JSON object MUST contain the following keys:
{
  "summary": "Short explanation of the work done in this iteration",
  "target_ac_id": "The active AC ID, e.g. AC-1",
  "target_ac_status": "done" (or "pending" or "blocked"),
  "files_changed": ["list of modified files"],
  "validations_run": ["list of run commands/test suites"],
  "docs_updated": [],
  "generated_artifacts": [],
  "remaining_gaps": [],
  "blockers": []
}
Do not just output text. You MUST use a tool to write this file to disk to complete the iteration.

when ac2