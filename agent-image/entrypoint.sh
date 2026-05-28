#!/bin/bash
set -e

echo "Sidecar starting for container: ${CONTAINER_ID:-unknown}"
echo "Task: ${TASK:-no task specified}"
echo "Control Plane: ${CONTROL_PLANE_URL:-http://localhost:8080}"

/usr/local/bin/sidecar &

if [ -n "$SKILL_REPOS" ]; then
    IFS=',' read -ra REPOS <<< "$SKILL_REPOS"
    for repo in "${REPOS[@]}"; do
        repo_name=$(basename "$repo" .git)
        echo "Cloning skill repo: $repo"
        git clone --depth 1 "$repo" "/workspace/skills/$repo_name" 2>/dev/null || true
    done
fi

echo "Sidecar and skills ready. Waiting..."
wait
