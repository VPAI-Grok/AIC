#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/codex-loop.sh [options] [max-iterations]

Runs Codex in repeated non-interactive iterations until the prompt instructs
the agent to emit COMPLETE, or the max iteration count is reached.

Options:
  --prompt-file PATH   Prompt template to pass to Codex
                       Default: scripts/codex-loop/prompt.md
  --state-dir PATH     Directory for logs and per-run state
                       Default: .codex-loop
  --model MODEL        Model name to pass to codex exec
  --task-file PATH     Task file the loop should treat as backlog truth
                       Default: tasks/aic-current.md
  --progress-file PATH Shared append-only progress file
                       Default: <state-dir>/progress.txt
  --memory-file PATH   Curated operating memory file
                       Default: <state-dir>/operating-memory.md
  --notify MODE        Completion notification mode: auto, off, bell, desktop
                       Default: auto
  --full-auto          Pass --full-auto to codex exec
  --dangerous          Pass --dangerously-bypass-approvals-and-sandbox
  --search             Pass --search to codex exec
  --help               Show this help

Examples:
  scripts/codex-loop.sh
  scripts/codex-loop.sh 20
  scripts/codex-loop.sh --full-auto --search 15
EOF
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROMPT_FILE="${ROOT_DIR}/scripts/codex-loop/prompt.md"
STATE_DIR="${ROOT_DIR}/.codex-loop"
MAX_ITERATIONS="10"
MODEL=""
TASK_FILE="${ROOT_DIR}/tasks/aic-current.md"
PROGRESS_FILE=""
MEMORY_FILE=""
NOTIFY_MODE="auto"
USE_FULL_AUTO="0"
USE_DANGEROUS="0"
USE_SEARCH="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prompt-file)
      PROMPT_FILE="$2"
      shift 2
      ;;
    --state-dir)
      STATE_DIR="$2"
      shift 2
      ;;
    --model)
      MODEL="$2"
      shift 2
      ;;
    --task-file)
      TASK_FILE="$2"
      shift 2
      ;;
    --progress-file)
      PROGRESS_FILE="$2"
      shift 2
      ;;
    --memory-file)
      MEMORY_FILE="$2"
      shift 2
      ;;
    --notify)
      NOTIFY_MODE="$2"
      shift 2
      ;;
    --full-auto)
      USE_FULL_AUTO="1"
      shift
      ;;
    --dangerous)
      USE_DANGEROUS="1"
      shift
      ;;
    --search)
      USE_SEARCH="1"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        MAX_ITERATIONS="$1"
        shift
      else
        echo "Unknown argument: $1" >&2
        usage >&2
        exit 1
      fi
      ;;
  esac
done

if [[ "${NOTIFY_MODE}" != "auto" && "${NOTIFY_MODE}" != "off" && "${NOTIFY_MODE}" != "bell" && "${NOTIFY_MODE}" != "desktop" ]]; then
  echo "Unsupported notify mode: ${NOTIFY_MODE}. Use auto, off, bell, or desktop." >&2
  exit 1
fi

if ! command -v codex >/dev/null 2>&1; then
  echo "codex is not installed or not on PATH." >&2
  exit 1
fi

if [[ ! -f "${PROMPT_FILE}" ]]; then
  echo "Prompt file not found: ${PROMPT_FILE}" >&2
  exit 1
fi

if [[ ! -f "${TASK_FILE}" ]]; then
  echo "Task file not found: ${TASK_FILE}" >&2
  exit 1
fi

mkdir -p "${STATE_DIR}"

RUN_LOG="${STATE_DIR}/run.log"
PROGRESS_FILE="${PROGRESS_FILE:-${STATE_DIR}/progress.txt}"
MEMORY_FILE="${MEMORY_FILE:-${STATE_DIR}/operating-memory.md}"
KNOWN_GOOD_FILE="${STATE_DIR}/known-good-commands.md"
TOUCH_MATRIX_FILE="${STATE_DIR}/touch-matrix.md"
RECENT_REGRESSIONS_FILE="${STATE_DIR}/recent-regressions.md"
CURRENT_SLICE_FILE="${STATE_DIR}/current-slice.md"
LAST_SLICE_FILE="${STATE_DIR}/last-slice.txt"
RETROSPECTIVE_FILE="${STATE_DIR}/retrospective.md"
LAST_RUN_STATUS_FILE="${STATE_DIR}/last-run-status.txt"

notify_with_notify_send() {
  local title="$1"
  local body="$2"
  if command -v notify-send >/dev/null 2>&1; then
    notify-send "${title}" "${body}"
    return 0
  fi
  return 1
}

notify_with_powershell() {
  local title="$1"
  local body="$2"
  if ! command -v powershell.exe >/dev/null 2>&1; then
    return 1
  fi

  powershell.exe -NoProfile -Command "[void][reflection.assembly]::LoadWithPartialName('System.Windows.Forms'); [void][reflection.assembly]::LoadWithPartialName('System.Drawing'); \$n = New-Object System.Windows.Forms.NotifyIcon; \$n.Icon = [System.Drawing.SystemIcons]::Information; \$n.BalloonTipTitle = '${title}'; \$n.BalloonTipText = '${body}'; \$n.Visible = \$true; \$n.ShowBalloonTip(5000); Start-Sleep -Seconds 6; \$n.Dispose()" >/dev/null 2>&1
}

notify_loop_finished() {
  local title="$1"
  local body="$2"

  case "${NOTIFY_MODE}" in
    off)
      return 0
      ;;
    bell)
      printf '\a'
      return 0
      ;;
    desktop)
      notify_with_notify_send "${title}" "${body}" || notify_with_powershell "${title}" "${body}" || return 1
      return 0
      ;;
    auto)
      notify_with_notify_send "${title}" "${body}" || notify_with_powershell "${title}" "${body}" || printf '\a'
      return 0
      ;;
  esac
}

write_last_run_status() {
  local status="$1"
  local detail="$2"
  local final_iteration="$3"

  cat > "${LAST_RUN_STATUS_FILE}" <<EOF
Loop status: ${status}
Finished at: $(date -Iseconds)
Iteration: ${final_iteration}/${MAX_ITERATIONS}
Notify mode: ${NOTIFY_MODE}
Detail: ${detail}
Run log: ${RUN_LOG}
Progress file: ${PROGRESS_FILE}
Current slice file: ${CURRENT_SLICE_FILE}
Last slice file: ${LAST_SLICE_FILE}
EOF
}

touch "${RUN_LOG}" "${PROGRESS_FILE}" "${LAST_SLICE_FILE}"

if [[ ! -f "${MEMORY_FILE}" ]]; then
  cat > "${MEMORY_FILE}" <<'EOF'
# Codex Loop Operating Memory

Use this file for durable loop learnings that should influence future iterations.

## Stable Rules

- Prefer one safe, validated slice per iteration.
- Prefer explicit AIC metadata and stable contracts over inference.
- Do not hand-edit generated AIC JSON artifacts.
- Update related docs when public behavior or supported workflows change.

## Known Good Commands

- `pnpm check`
- `pnpm build`
- `pnpm test:contracts`
- `pnpm test:goldens`
- `pnpm test:packaging`
- `pnpm smoke:init`
- `pnpm smoke:adoption`
- `pnpm smoke:mcp`
- `pnpm smoke:mcp:stdio`

## Notes

- Promote repeated learnings from `progress.txt` into this file when they should affect future slice selection or validation behavior.
EOF
fi

if [[ ! -f "${KNOWN_GOOD_FILE}" ]]; then
  cat > "${KNOWN_GOOD_FILE}" <<'EOF'
# Known Good Commands

- `pnpm check`: workspace typecheck gate
- `pnpm build`: full workspace build gate
- `pnpm test:contracts`: contract and integration verification
- `pnpm test:goldens`: generated artifact verification
- `pnpm test:packaging`: npm publish-surface verification
- `pnpm smoke:init`: onboarding bootstrap smoke
- `pnpm smoke:adoption`: adoption flow smoke
- `pnpm smoke:mcp`: MCP handler smoke
- `pnpm smoke:mcp:stdio`: MCP stdio transport smoke
EOF
fi

if [[ ! -f "${TOUCH_MATRIX_FILE}" ]]; then
  cat > "${TOUCH_MATRIX_FILE}" <<'EOF'
# Touch Matrix

- If touching `packages/spec`, verify `pnpm test:contracts`.
- If touching `packages/runtime` or `packages/sdk-react`, verify `pnpm test:contracts`.
- If touching `packages/cli`, prefer `pnpm test:contracts` and a relevant smoke command.
- If touching plugin or generated artifact flows, verify `pnpm test:goldens`.
- If touching publishable package manifests or exports, verify `pnpm test:packaging`.
- If touching MCP behavior, verify `pnpm smoke:mcp` and `pnpm smoke:mcp:stdio`.
- If touching docs for supported behavior, keep `README.md`, `docs/release-status.md`, and `docs/supported-today.md` aligned when relevant.
EOF
fi

if [[ ! -f "${RECENT_REGRESSIONS_FILE}" ]]; then
  cat > "${RECENT_REGRESSIONS_FILE}" <<'EOF'
# Recent Regressions

- `ShadcnAICTextarea` must not render textarea wrappers through button abstractions. Preserve textarea semantics and avoid passing textarea children through as host children.
EOF
fi

if [[ ! -f "${RETROSPECTIVE_FILE}" ]]; then
  cat > "${RETROSPECTIVE_FILE}" <<'EOF'
# Loop Retrospective

Record periodic meta-learnings here when the loop needs to change its own behavior.

Template:

## YYYY-MM-DD

- What the loop handled well:
- Where time was wasted:
- Which repeated workflow should become a skill or checklist:
- Which prompt, task, or memory rule should change:
EOF
fi

echo "Starting Codex loop"
echo "root=${ROOT_DIR}"
echo "prompt=${PROMPT_FILE}"
echo "task_file=${TASK_FILE}"
echo "state_dir=${STATE_DIR}"
echo "progress_file=${PROGRESS_FILE}"
echo "memory_file=${MEMORY_FILE}"
echo "notify_mode=${NOTIFY_MODE}"
echo "max_iterations=${MAX_ITERATIONS}"
echo

for ((iteration = 1; iteration <= MAX_ITERATIONS; iteration++)); do
  SESSION_DIR="${STATE_DIR}/iteration-${iteration}"
  LAST_MESSAGE_FILE="${SESSION_DIR}/last-message.txt"
  mkdir -p "${SESSION_DIR}"

  {
    echo "## $(date -Iseconds) iteration ${iteration}"
  } >> "${RUN_LOG}"

  : > "${CURRENT_SLICE_FILE}"

  CODEx_CMD=(
    codex exec
    -C "${ROOT_DIR}"
    --output-last-message "${LAST_MESSAGE_FILE}"
  )

  if [[ -n "${MODEL}" ]]; then
    CODEx_CMD+=(--model "${MODEL}")
  fi

  if [[ "${USE_FULL_AUTO}" == "1" ]]; then
    CODEx_CMD+=(--full-auto)
  fi

  if [[ "${USE_DANGEROUS}" == "1" ]]; then
    CODEx_CMD+=(--dangerously-bypass-approvals-and-sandbox)
  fi

  if [[ "${USE_SEARCH}" == "1" ]]; then
    CODEx_CMD+=(--search)
  fi

  CODEx_CMD+=(-)

  printf 'Iteration %s/%s\n' "${iteration}" "${MAX_ITERATIONS}"

  if ! {
    cat "${PROMPT_FILE}"
    printf '\n\n'
    printf 'Current iteration: %s of %s\n' "${iteration}" "${MAX_ITERATIONS}"
    printf 'Task file: %s\n' "${TASK_FILE}"
    printf 'State directory: %s\n' "${STATE_DIR}"
    printf 'Shared progress file: %s\n' "${PROGRESS_FILE}"
    printf 'Operating memory file: %s\n' "${MEMORY_FILE}"
    printf 'Known good commands file: %s\n' "${KNOWN_GOOD_FILE}"
    printf 'Touch matrix file: %s\n' "${TOUCH_MATRIX_FILE}"
    printf 'Recent regressions file: %s\n' "${RECENT_REGRESSIONS_FILE}"
    printf 'Current slice file: %s\n' "${CURRENT_SLICE_FILE}"
    printf 'Last slice file: %s\n' "${LAST_SLICE_FILE}"
    printf 'Retrospective file: %s\n' "${RETROSPECTIVE_FILE}"
    printf 'Run log file: %s\n' "${RUN_LOG}"
  } | "${CODEx_CMD[@]}" | tee -a "${RUN_LOG}"; then
    echo "codex exec failed on iteration ${iteration}. Stopping." | tee -a "${RUN_LOG}" >&2
    write_last_run_status "failed" "codex exec failed on iteration ${iteration}" "${iteration}"
    notify_loop_finished "AIC Codex Loop Failed" "Iteration ${iteration}/${MAX_ITERATIONS}. See .codex-loop/last-run-status.txt."
    exit 1
  fi

  if [[ -s "${CURRENT_SLICE_FILE}" ]]; then
    cat "${CURRENT_SLICE_FILE}" > "${LAST_SLICE_FILE}"
  fi

  if grep -q "COMPLETE" "${LAST_MESSAGE_FILE}"; then
    echo "Detected COMPLETE. Exiting loop." | tee -a "${RUN_LOG}"
    write_last_run_status "complete" "loop emitted COMPLETE on iteration ${iteration}" "${iteration}"
    notify_loop_finished "AIC Codex Loop Complete" "COMPLETE on iteration ${iteration}/${MAX_ITERATIONS}. See .codex-loop/last-run-status.txt."
    exit 0
  fi

  {
    echo
    echo "---"
    echo
  } >> "${RUN_LOG}"
done

echo "Reached max iterations without COMPLETE." | tee -a "${RUN_LOG}"
write_last_run_status "max-iterations" "reached max iterations without COMPLETE" "${MAX_ITERATIONS}"
notify_loop_finished "AIC Codex Loop Paused" "Reached max iterations (${MAX_ITERATIONS}) without COMPLETE. See .codex-loop/last-run-status.txt."
exit 0
